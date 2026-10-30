import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { openEncryptedDatabase } from './encrypted-database';
import { withActiveDatabase, withStorageTransition } from './storage-access';

const PROOF_ATTACHMENT = new Uint8Array([76, 76, 67, 45, 80, 82, 79, 79, 70]);

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface NativeStorageProofResult {
  cipherVersion: string;
  secureKeyStored: true;
  databaseReopened: true;
  rowAndAttachmentPersisted: true;
  wrongKeyRejected: true;
  databaseName: string;
  databasePath: string;
}

export async function runNativeStorageProof(): Promise<NativeStorageProofResult> {
  const written = await withActiveDatabase(async (database, generation) => {
    const cipher = await database.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS proof_records (
        id TEXT PRIMARY KEY NOT NULL,
        note TEXT NOT NULL,
        attachment BLOB NOT NULL
      );
    `);
    await database.runAsync(
      'INSERT OR REPLACE INTO proof_records (id, note, attachment) VALUES (?, ?, ?)',
      'synthetic-proof',
      'Synthetic storage proof record',
      PROOF_ATTACHMENT,
    );
    return { cipherVersion: cipher?.cipher_version ?? 'unknown', generation, databasePath: database.databasePath };
  });

  const persisted = await withActiveDatabase((database) => database.getFirstAsync<{ note: string; attachment: Uint8Array }>(
    'SELECT note, attachment FROM proof_records WHERE id = ?', 'synthetic-proof',
  ));
  if (persisted?.note !== 'Synthetic storage proof record'
    || toHex(persisted.attachment) !== toHex(PROOF_ATTACHMENT)) {
    throw new Error('Encrypted database did not preserve its proof record and attachment across connections.');
  }

  let wrongKeyRejected = false;
  await withStorageTransition(async () => {
    const keyHex = await SecureStore.getItemAsync(written.generation.keyAlias);
    if (!keyHex) throw new Error('The active database key is unavailable.');
    const incorrectKey = toHex(await Crypto.getRandomBytesAsync(32));
    if (incorrectKey === keyHex) throw new Error('Unexpected random key collision.');
    try {
      const wrongDatabase = await openEncryptedDatabase(written.generation.databaseName, incorrectKey, written.generation.keyAlias);
      await wrongDatabase.closeAsync();
    } catch {
      wrongKeyRejected = true;
    }
    if (!wrongKeyRejected) throw new Error('An incorrect SQLCipher key opened the database.');
  });

  return {
    cipherVersion: written.cipherVersion,
    secureKeyStored: true,
    databaseReopened: true,
    rowAndAttachmentPersisted: true,
    wrongKeyRejected: true,
    databaseName: written.generation.databaseName,
    databasePath: written.databasePath,
  };
}
