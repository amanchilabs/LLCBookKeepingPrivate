import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import type { RestoreStore } from './restore-coordinator';
import {
  activateRestoreGeneration,
  deleteInactiveGeneration,
  ensureDatabaseCatalog,
  finishRestoreActivation,
  getDatabaseGeneration,
  readDatabaseActivation,
  registerRestoreGeneration,
  rollbackRestoreActivation,
  type DatabaseGeneration,
} from '../../storage-native/src/database-catalog';
import { closeAllEncryptedDatabases, openEncryptedDatabase, readStoredDeviceKeyHex } from '../../storage-native/src/encrypted-database';
import { resolveStoredDatabaseKey, SecureKeyAccessError } from '../../storage-native/src/secure-key-access';

export interface RestoredProofRecord {
  id: string;
  note: string;
  attachmentHex: string;
}

export interface RestoredProofSnapshot {
  formatVersion: 1;
  schemaVersion: 1;
  records: RestoredProofRecord[];
}

function bytesFromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalSnapshot(snapshot: RestoredProofSnapshot): RestoredProofSnapshot {
  return {
    formatVersion: 1,
    schemaVersion: 1,
    records: [...snapshot.records]
      .map(({ id, note, attachmentHex }) => ({ id, note, attachmentHex: attachmentHex.toLowerCase() }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

async function snapshotHash(snapshot: RestoredProofSnapshot): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(canonicalSnapshot(snapshot)), {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

async function closeCleanly(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  await database.execAsync('PRAGMA journal_mode=DELETE;');
  await database.closeAsync();
}

async function checkDatabase(database: SQLite.SQLiteDatabase, expectedHash?: string): Promise<void> {
  const integrity = await database.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (integrity?.integrity_check !== 'ok') throw new Error('Restored database failed SQLite integrity_check.');
  const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version?.user_version !== 1) throw new Error('Restored database schema version is unsupported.');
  const manifest = await database.getFirstAsync<{ payload_sha256: string; record_count: number }>(
    'SELECT payload_sha256, record_count FROM restore_manifest WHERE singleton = 1',
  );
  const rows = await database.getAllAsync<{ id: string; note: string; attachment: Uint8Array }>(
    'SELECT id, note, attachment FROM proof_records ORDER BY id',
  );
  if (!manifest || manifest.record_count !== rows.length) throw new Error('Restored database record manifest does not match its rows.');
  const actual = await snapshotHash({
    formatVersion: 1,
    schemaVersion: 1,
    records: rows.map((row) => ({ id: row.id, note: row.note, attachmentHex: hexFromBytes(row.attachment) })),
  });
  if (actual !== manifest.payload_sha256 || (expectedHash && expectedHash !== actual)) {
    throw new Error('Restored database content checksum does not match the authenticated backup.');
  }
}

export class NativeRestoreStore implements RestoreStore<RestoredProofSnapshot> {
  constructor(private readonly failurePoint?: (name: string) => void) {}

  private checkpoint(name: string): void {
    this.failurePoint?.(name);
  }

  async stageCandidate(input: RestoredProofSnapshot): Promise<string> {
    const snapshot = canonicalSnapshot(input);
    const id = Crypto.randomUUID();
    const generation: DatabaseGeneration = {
      id,
      databaseName: `llc-generation-${id}.db`,
      keyAlias: `llcbookkeepingprivate.generation.${id}`,
    };
    const expectedHash = await snapshotHash(snapshot);
    this.checkpoint('before-candidate-create');
    const database = await openEncryptedDatabase(generation.databaseName, undefined, generation.keyAlias);
    let registered = false;
    try {
      await database.execAsync(`
        CREATE TABLE proof_records (
          id TEXT PRIMARY KEY NOT NULL,
          note TEXT NOT NULL,
          attachment BLOB NOT NULL
        );
        CREATE TABLE restore_manifest (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          payload_sha256 TEXT NOT NULL,
          record_count INTEGER NOT NULL
        );
        PRAGMA user_version = 1;
      `);
      await database.execAsync('BEGIN IMMEDIATE;');
      try {
        for (const row of snapshot.records) {
          await database.runAsync(
            'INSERT INTO proof_records (id, note, attachment) VALUES (?, ?, ?)',
            row.id, row.note, bytesFromHex(row.attachmentHex),
          );
        }
        await database.runAsync(
          'INSERT INTO restore_manifest (singleton, payload_sha256, record_count) VALUES (1, ?, ?)',
          expectedHash, snapshot.records.length,
        );
        await database.execAsync('COMMIT;');
      } catch (error) {
        await database.execAsync('ROLLBACK;').catch(() => undefined);
        throw error;
      }
      await checkDatabase(database, expectedHash);
      await closeCleanly(database);
      this.checkpoint('after-candidate-closed');
      await registerRestoreGeneration(generation);
      registered = true;
      this.checkpoint('after-candidate-registered');
      await this.verifyGeneration(id);
      return id;
    } catch (error) {
      await database.closeAsync().catch(() => undefined);
      if (registered) await deleteInactiveGeneration(id).catch(() => undefined);
      else {
        await closeAllEncryptedDatabases().catch(() => undefined);
        await SQLite.deleteDatabaseAsync(generation.databaseName, new Directory(Paths.document, 'LLCBookKeepingPrivate').uri).catch(() => undefined);
        await SecureStore.deleteItemAsync(generation.keyAlias).catch(() => undefined);
      }
      throw error;
    }
  }

  async getActivation() {
    await ensureDatabaseCatalog();
    const state = await readDatabaseActivation();
    return {
      activeGeneration: state.active.id,
      journal: state.journal && {
        previousGeneration: state.journal.previous.id,
        candidateGeneration: state.journal.candidate.id,
      },
    };
  }

  async activate(previousGeneration: string, candidateGeneration: string): Promise<void> {
    await ensureDatabaseCatalog();
    this.checkpoint('before-activation-transaction');
    await activateRestoreGeneration(previousGeneration, candidateGeneration);
    this.checkpoint('after-activation-transaction');
  }

  async verifyGeneration(generationId: string): Promise<void> {
    this.checkpoint('before-candidate-reopen');
    const generation = await getDatabaseGeneration(generationId);
    const key = resolveStoredDatabaseKey(await readStoredDeviceKeyHex(generation.keyAlias), true);
    if (!key) throw new SecureKeyAccessError('key-missing');
    const database = await openEncryptedDatabase(generation.databaseName, key, generation.keyAlias);
    try {
      await checkDatabase(database);
      this.checkpoint('after-candidate-reopen-verified');
    } finally {
      await closeCleanly(database);
    }
  }

  async finishActivation(): Promise<void> {
    this.checkpoint('before-journal-clear');
    await finishRestoreActivation();
    this.checkpoint('after-journal-clear');
  }

  async rollback(previousGeneration: string): Promise<void> {
    await rollbackRestoreActivation(previousGeneration);
  }

  async deleteGeneration(generationId: string): Promise<void> {
    this.checkpoint('before-old-generation-delete');
    await deleteInactiveGeneration(generationId);
    this.checkpoint('after-old-generation-delete');
  }
}

export function validateRestoredProofSnapshot(value: unknown): RestoredProofSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Backup payload structure is invalid.');
  const candidate = value as Partial<RestoredProofSnapshot>;
  if (candidate.formatVersion !== 1 || candidate.schemaVersion !== 1 || !Array.isArray(candidate.records) || candidate.records.length > 10_000) {
    throw new Error('Backup format, schema version, or record count is unsupported.');
  }
  const ids = new Set<string>();
  let totalAttachmentBytes = 0;
  for (const item of candidate.records) {
    if (!item || typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 128
      || typeof item.note !== 'string' || item.note.length > 4096
      || typeof item.attachmentHex !== 'string' || !/^(?:[0-9a-f]{2}){0,2097152}$/i.test(item.attachmentHex)) {
      throw new Error('Backup record exceeds restore limits or contains invalid data.');
    }
    if (ids.has(item.id)) throw new Error('Backup contains duplicate record identifiers.');
    ids.add(item.id);
    totalAttachmentBytes += item.attachmentHex.length / 2;
  }
  if (totalAttachmentBytes > 6 * 1024 * 1024) throw new Error('Backup attachments exceed the combined restore limit.');
  return canonicalSnapshot(candidate as RestoredProofSnapshot);
}
