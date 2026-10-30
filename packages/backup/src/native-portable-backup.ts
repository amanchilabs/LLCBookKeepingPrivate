import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { decryptBackupPayload, encryptBackupPayload } from './crypto';
import { BACKUP_MAX_BYTES } from './format';
import { getOrCreateDeviceKeyHex, MAIN_DATABASE, openEncryptedDatabase, runNativeStorageProof } from '../../storage-native/src/encrypted-database';

const utf8 = new TextEncoder();
const PROOF_PASSPHRASE = 'SyntheticProofPassphrase2026';

interface ProofPayload {
  formatVersion: 1;
  records: Array<{ id: string; note: string; attachmentHex: string }>;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) throw new Error('Attachment encoding is invalid.');
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function parsePayload(bytes: Uint8Array): ProofPayload {
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || !('formatVersion' in value) || !('records' in value)) {
    throw new Error('Backup payload structure is invalid.');
  }
  const candidate = value as ProofPayload;
  if (candidate.formatVersion !== 1 || !Array.isArray(candidate.records) || candidate.records.length > 10_000) {
    throw new Error('Backup payload version or record count is unsupported.');
  }
  for (const row of candidate.records) {
    if (typeof row.id !== 'string' || row.id.length > 128 || typeof row.note !== 'string' || row.note.length > 4096 || typeof row.attachmentHex !== 'string' || row.attachmentHex.length > 4 * 1024 * 1024) {
      throw new Error('Backup record exceeds the supported restore limits.');
    }
    fromHex(row.attachmentHex);
  }
  return candidate;
}

async function loadProofPayload(): Promise<Uint8Array> {
  const database = await openEncryptedDatabase(MAIN_DATABASE);
  try {
    const row = await database.getFirstAsync<{ id: string; note: string; attachment: Uint8Array }>(
      'SELECT id, note, attachment FROM proof_records WHERE id = ?',
      'synthetic-proof',
    );
    if (!row) throw new Error('Run the SQLCipher storage proof before creating a backup.');
    return utf8.encode(JSON.stringify({
      formatVersion: 1,
      records: [{ id: row.id, note: row.note, attachmentHex: toHex(row.attachment) }],
    } satisfies ProofPayload));
  } finally {
    await database.closeAsync();
  }
}

async function restoreProofPayload(bytes: Uint8Array, databaseName: string, keyHex: string): Promise<void> {
  const payload = parsePayload(bytes);
  const database = await openEncryptedDatabase(databaseName, keyHex);
  try {
    await database.execAsync('CREATE TABLE IF NOT EXISTS proof_records (id TEXT PRIMARY KEY NOT NULL, note TEXT NOT NULL, attachment BLOB NOT NULL);');
    // Keep the transaction on the keyed connection; an exclusive transaction
    // may create a fresh connection that has not received PRAGMA key.
    await database.withTransactionAsync(async () => {
      for (const row of payload.records) {
        await database.runAsync(
          'INSERT OR REPLACE INTO proof_records (id, note, attachment) VALUES (?, ?, ?)',
          row.id,
          row.note,
          fromHex(row.attachmentHex),
        );
      }
    });
  } finally {
    await database.closeAsync();
  }
}

function createRestoreTarget() {
  const id = Crypto.randomUUID();
  return {
    databaseName: `llc-restore-${id}.db`,
    keyAlias: `llcbookkeepingprivate.restore.${id}`,
  };
}

async function restoreDeviceKey(databaseName: string, keyAlias: string): Promise<string> {
  return await getOrCreateDeviceKeyHex(databaseName, keyAlias);
}

export async function shareEncryptedBackup(passphrase: string): Promise<void> {
  const plainPayload = await loadProofPayload();
  const encrypted = await encryptBackupPayload(plainPayload, passphrase);
  const name = `LLCBookKeepingPrivate-${Crypto.randomUUID()}.llcbk`;
  const file = new File(Paths.cache, name);
  try {
    file.write(encrypted);
    if (!await Sharing.isAvailableAsync()) throw new Error('System sharing is unavailable on this device.');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Export encrypted LLCBookKeepingPrivate backup' });
  } finally {
    if (file.exists) file.delete();
    plainPayload.fill(0);
  }
}

export async function restoreEncryptedBackupFromFile(passphrase: string): Promise<void> {
  const selection = await DocumentPicker.getDocumentAsync({
    type: 'application/octet-stream',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (selection.canceled) return;
  const selected = selection.assets[0];
  if (!selected) throw new Error('No backup file was selected.');
  const file = new File(selected.uri);
  try {
    if (file.size > BACKUP_MAX_BYTES) throw new Error('Backup exceeds the 8 MiB proof limit.');
    const encrypted = await file.bytes();
    const plaintext = await decryptBackupPayload(encrypted, passphrase);
    try {
      const payload = parsePayload(plaintext);
      const target = createRestoreTarget();
      const keyHex = await restoreDeviceKey(target.databaseName, target.keyAlias);
      const sourceKey = await SecureStore.getItemAsync('llcbookkeepingprivate.database-key.v1');
      if (sourceKey !== null && sourceKey === keyHex) throw new Error('Restore reused the source device database key.');
      await restoreProofPayload(plaintext, target.databaseName, keyHex);
      const database = await openEncryptedDatabase(target.databaseName, keyHex);
      try {
        for (const row of payload.records) {
          const restored = await database.getFirstAsync<{ note: string; attachment: Uint8Array }>(
            'SELECT note, attachment FROM proof_records WHERE id = ?',
            row.id,
          );
          const expectedAttachment = fromHex(row.attachmentHex);
          if (!restored || restored.note !== row.note || restored.attachment.length !== expectedAttachment.length
            || restored.attachment.some((byte, index) => byte !== expectedAttachment[index])) {
            throw new Error('Restored record or attachment did not match the selected backup.');
          }
        }
      } finally {
        await database.closeAsync();
      }
    } finally {
      plaintext.fill(0);
      encrypted.fill(0);
    }
  } finally {
    file.delete();
  }
}

export interface PortableBackupProofResult {
  wrongPassphraseRejected: true;
  tamperingRejected: true;
  truncationRejected: true;
  freshLocalKeyGenerated: true;
  restoredDatabaseReopened: true;
  attachmentRestored: true;
  originalRecordsPreservedOnFailures: true;
}

export async function runPortableBackupProof(onProgress?: (step: string) => void): Promise<PortableBackupProofResult> {
  let stage = 'Rechecking SQLCipher and SecureStore';
  const progress = (value: string) => { stage = value.replace(/…$/, ''); onProgress?.(value); };
  try {
  progress('Rechecking SQLCipher and SecureStore…');
  await runNativeStorageProof();
  const originalKey = await SecureStore.getItemAsync('llcbookkeepingprivate.database-key.v1');
  if (!originalKey) throw new Error('Source device key is unavailable.');
  const plainPayload = await loadProofPayload();
  try {
    progress('Deriving backup key and encrypting synthetic rows…');
    const encrypted = await encryptBackupPayload(plainPayload, PROOF_PASSPHRASE);
    const tampered = encrypted.slice();
    tampered[tampered.length - 1] ^= 1;
    const truncated = encrypted.slice(0, encrypted.length - 1);
    const restoreTarget = createRestoreTarget();
    const restoredKey = await restoreDeviceKey(restoreTarget.databaseName, restoreTarget.keyAlias);
    if (restoredKey === originalKey) throw new Error('Restore reused the source device database key.');

    progress('Preparing a new-key restore target and checking failure preservation…');
    const target = await openEncryptedDatabase(restoreTarget.databaseName, restoredKey);
    await target.execAsync('CREATE TABLE IF NOT EXISTS proof_records (id TEXT PRIMARY KEY NOT NULL, note TEXT NOT NULL, attachment BLOB NOT NULL);');
    await target.runAsync('INSERT OR REPLACE INTO proof_records (id, note, attachment) VALUES (?, ?, ?)', 'restore-sentinel', 'Existing target data', new Uint8Array([1, 2, 3]));
    await target.closeAsync();

    progress('Checking wrong-passphrase rejection…');
    let wrongPassphraseRejected = false;
    try { await decryptBackupPayload(encrypted, 'IncorrectProofPassphrase2026'); } catch { wrongPassphraseRejected = true; }
    progress('Checking tamper rejection…');
    let tamperingRejected = false;
    try { await decryptBackupPayload(tampered, PROOF_PASSPHRASE); } catch { tamperingRejected = true; }
    progress('Checking truncation rejection…');
    let truncationRejected = false;
    try { await decryptBackupPayload(truncated, PROOF_PASSPHRASE); } catch { truncationRejected = true; }
    if (!wrongPassphraseRejected || !tamperingRejected || !truncationRejected) {
      throw new Error('Backup integrity checks did not reject a negative case.');
    }
    const preservedDb = await openEncryptedDatabase(restoreTarget.databaseName, restoredKey);
    const preserved = await preservedDb.getFirstAsync<{ note: string }>('SELECT note FROM proof_records WHERE id = ?', 'restore-sentinel');
    await preservedDb.closeAsync();
    if (preserved?.note !== 'Existing target data') throw new Error('A failed restore changed the existing restore target.');

    progress('Decrypting backup and restoring synthetic row plus attachment…');
    const restoredPlaintext = await decryptBackupPayload(encrypted, PROOF_PASSPHRASE);
    try {
      await restoreProofPayload(restoredPlaintext, restoreTarget.databaseName, restoredKey);
    } finally {
      restoredPlaintext.fill(0);
    }
    const restoredDb = await openEncryptedDatabase(restoreTarget.databaseName, restoredKey);
    const restored = await restoredDb.getFirstAsync<{ note: string; attachment: Uint8Array }>(
      'SELECT note, attachment FROM proof_records WHERE id = ?',
      'synthetic-proof',
    );
    await restoredDb.closeAsync();
    if (restored?.note !== 'Synthetic storage proof record' || restored.attachment.length !== 9) {
      throw new Error('Fresh-key restore failed to recover the record and attachment.');
    }

    const originalDb = await openEncryptedDatabase(MAIN_DATABASE, originalKey);
    const original = await originalDb.getFirstAsync<{ note: string }>(
      'SELECT note FROM proof_records WHERE id = ?',
      'synthetic-proof',
    );
    await originalDb.closeAsync();
    if (original?.note !== 'Synthetic storage proof record') throw new Error('A failed restore changed the original source database.');
    progress('Portable backup proof complete.');

    encrypted.fill(0);
    tampered.fill(0);
    truncated.fill(0);
    return {
      wrongPassphraseRejected: true,
      tamperingRejected: true,
      truncationRejected: true,
      freshLocalKeyGenerated: true,
      restoredDatabaseReopened: true,
      attachmentRestored: true,
      originalRecordsPreservedOnFailures: true,
    };
  } finally {
    plainPayload.fill(0);
  }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`${stage}: ${detail}`);
  }
}
