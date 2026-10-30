import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { openOnlyAfterCipherProbe } from './fail-closed-open';

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

const openConnections = new Set<SQLite.SQLiteDatabase>();

export async function openEncryptedDatabase(
  databaseName = MAIN_DATABASE,
  suppliedKeyHex?: string,
  keyAlias = DEVICE_KEY_ALIAS,
): Promise<SQLite.SQLiteDatabase> {
  // SQLCipher must be proved on a memory-only connection before SQLite sees
  // any persistent financial database path. Expo Go/negative builds may have
  // ordinary SQLite, where PRAGMA key can be silently ignored.
  return await openOnlyAfterCipherProbe(
    () => SQLite.openDatabaseAsync(':memory:', { useNewConnection: true }),
    async (connection) => {
      const result = await connection.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
      return Boolean(result?.cipher_version);
    },
    async () => {
      const keyHex = suppliedKeyHex ?? await getOrCreateDeviceKeyHex(databaseName, keyAlias);
      if (!HEX.test(keyHex)) throw new Error('Database key must be 32 bytes of hexadecimal data.');

      const directory = databaseDirectory();
      directory.create({ idempotent: true, intermediates: true });
      const database = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true }, directory.uri);
      try {
        const cipher = await database.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
        if (!cipher?.cipher_version) {
          await database.closeAsync();
          if (new File(directory, databaseName).exists) new File(directory, databaseName).delete();
          throw new Error('SQLCipher is unavailable in this native build. Refusing plaintext database access.');
        }
        await database.execAsync(`PRAGMA key = "x'${keyHex}'";`);
        await database.getFirstAsync<{ tableCount: number }>('SELECT COUNT(*) AS tableCount FROM sqlite_master');
        openConnections.add(database);
        const originalClose = database.closeAsync.bind(database);
        database.closeAsync = async () => {
          try { await originalClose(); } finally { openConnections.delete(database); }
        };
        return database;
      } catch (error) {
        await database.closeAsync().catch(() => undefined);
        throw error;
      }
    },
  );
}

export async function closeAllEncryptedDatabases(): Promise<void> {
  const connections = [...openConnections];
  for (const database of connections) {
    await database.execAsync('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => undefined);
    await database.execAsync('PRAGMA journal_mode=DELETE;').catch(() => undefined);
    await database.closeAsync();
  }
}
