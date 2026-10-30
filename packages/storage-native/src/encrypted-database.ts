import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';

export const MAIN_DATABASE = 'llc-local.db';
const DEVICE_KEY_ALIAS = 'llcbookkeepingprivate.database-key.v1';
const HEX = /^[0-9a-f]{64}$/;

function databaseDirectory(): Directory {
  return new Directory(Paths.document, 'LLCBookKeepingPrivate');
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function getOrCreateDeviceKeyHex(databaseName = MAIN_DATABASE, keyAlias = DEVICE_KEY_ALIAS): Promise<string> {
  const directory = databaseDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const existing = await SecureStore.getItemAsync(keyAlias);
  if (existing !== null) {
    if (!HEX.test(existing)) throw new Error('Stored database key is malformed; refusing to open the local database.');
    return existing;
  }
  if (new File(directory, databaseName).exists) {
    throw new Error('Encrypted database exists but its local key is missing. Restore from an encrypted backup; a replacement key was not created.');
  }

  const generated = toHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(keyAlias, generated, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  const persisted = await SecureStore.getItemAsync(keyAlias);
  if (persisted !== generated) throw new Error('Secure key storage did not persist the generated database key.');
  return generated;
}

export async function openEncryptedDatabase(databaseName = MAIN_DATABASE, suppliedKeyHex?: string): Promise<SQLite.SQLiteDatabase> {
  const keyHex = suppliedKeyHex ?? await getOrCreateDeviceKeyHex(databaseName);
  if (!HEX.test(keyHex)) throw new Error('Database key must be 32 bytes of hexadecimal data.');

  const directory = databaseDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const database = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }, directory.uri);
  try {
    const cipher = await database.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
    if (!cipher?.cipher_version) {
      throw new Error('SQLCipher is unavailable in this native build. Refusing plaintext database access.');
    }
    await database.execAsync(`PRAGMA key = "x'${keyHex}'";`);
    await database.getFirstAsync<{ tableCount: number }>('SELECT COUNT(*) AS tableCount FROM sqlite_master');
    return database;
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw error;
  }
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
  const keyHex = await getOrCreateDeviceKeyHex();
  let database = await openEncryptedDatabase(MAIN_DATABASE, keyHex);
  const databasePath = database.databasePath;
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
    new Uint8Array([76, 76, 67, 45, 80, 82, 79, 79, 70]),
  );
  await database.closeAsync();

  database = await openEncryptedDatabase(MAIN_DATABASE, keyHex);
  const persisted = await database.getFirstAsync<{ note: string; attachment: Uint8Array }>(
    'SELECT note, attachment FROM proof_records WHERE id = ?',
    'synthetic-proof',
  );
  await database.closeAsync();
  if (persisted?.note !== 'Synthetic storage proof record' || persisted.attachment.length !== 9) {
    throw new Error('Encrypted database did not preserve its proof record across connections.');
  }

  const incorrectKey = toHex(await Crypto.getRandomBytesAsync(32));
  if (incorrectKey === keyHex) throw new Error('Unexpected random key collision.');
  let wrongKeyRejected = false;
  try {
    const wrongDatabase = await openEncryptedDatabase(MAIN_DATABASE, incorrectKey);
    await wrongDatabase.closeAsync();
  } catch {
    wrongKeyRejected = true;
  }
  if (!wrongKeyRejected) throw new Error('An incorrect SQLCipher key opened the database.');

  return {
    cipherVersion: cipher?.cipher_version ?? 'unknown',
    secureKeyStored: true,
    databaseReopened: true,
    rowAndAttachmentPersisted: true,
    wrongKeyRejected: true,
    databaseName: MAIN_DATABASE,
    databasePath,
  };
}
