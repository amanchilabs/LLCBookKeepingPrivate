import * as SQLite from 'expo-sqlite';
import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { closeAllEncryptedDatabases, getOrCreateDeviceKeyHex, MAIN_DATABASE, openEncryptedDatabase } from './encrypted-database';

export const CATALOG_DATABASE = 'llc-database-catalog.db';
export const CATALOG_KEY_ALIAS = 'llcbookkeepingprivate.catalog-key.v1';
export const INITIAL_GENERATION = 'initial';

export interface DatabaseGeneration {
  id: string;
  databaseName: string;
  keyAlias: string;
}

export interface DatabaseActivation {
  active: DatabaseGeneration;
  journal?: { previous: DatabaseGeneration; candidate: DatabaseGeneration };
}

function databaseDirectory(): Directory {
  return new Directory(Paths.document, 'LLCBookKeepingPrivate');
}

async function withCatalog<T>(operation: (database: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const database = await openEncryptedDatabase(CATALOG_DATABASE, undefined, CATALOG_KEY_ALIAS);
  try {
    await database.execAsync('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
    return await operation(database);
  } finally {
    await database.closeAsync();
  }
}

async function transaction<T>(database: SQLite.SQLiteDatabase, operation: () => Promise<T>): Promise<T> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    const result = await operation();
    await database.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}

async function generationById(database: SQLite.SQLiteDatabase, id: string): Promise<DatabaseGeneration> {
  const row = await database.getFirstAsync<DatabaseGeneration>(
    'SELECT id, database_name AS databaseName, key_alias AS keyAlias FROM restore_generations WHERE id = ?', id,
  );
  if (!row) throw new Error(`Restore generation ${id} is missing from the encrypted catalog.`);
  return row;
}

export async function getDatabaseGeneration(id: string): Promise<DatabaseGeneration> {
  return await withCatalog((database) => generationById(database, id));
}

/** Create the encrypted catalog and register a legacy proof database on first use. */
export async function ensureDatabaseCatalog(): Promise<DatabaseActivation> {
  await closeAllEncryptedDatabases();
  await getOrCreateDeviceKeyHex(CATALOG_DATABASE, CATALOG_KEY_ALIAS);
  await withCatalog(async (database) => {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS restore_generations (
        id TEXT PRIMARY KEY NOT NULL,
        database_name TEXT NOT NULL UNIQUE,
        key_alias TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS restore_control (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        active_generation_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS restore_journal (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        previous_generation_id TEXT NOT NULL,
        candidate_generation_id TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
    const control = await database.getFirstAsync<{ active_generation_id: string }>(
      'SELECT active_generation_id FROM restore_control WHERE singleton = 1',
    );
    if (!control) {
      const legacyKey = await getOrCreateDeviceKeyHex(MAIN_DATABASE);
      const legacy = await openEncryptedDatabase(MAIN_DATABASE, legacyKey);
      await legacy.closeAsync();
      await transaction(database, async () => {
        await database.runAsync(
          'INSERT OR IGNORE INTO restore_generations (id, database_name, key_alias) VALUES (?, ?, ?)',
          INITIAL_GENERATION, MAIN_DATABASE, 'llcbookkeepingprivate.database-key.v1',
        );
        await database.runAsync('INSERT OR IGNORE INTO restore_control (singleton, active_generation_id) VALUES (1, ?)', INITIAL_GENERATION);
      });
    }
  });
  return await readDatabaseActivation();
}

export async function readDatabaseActivation(): Promise<DatabaseActivation> {
  return await withCatalog(async (database) => {
    const control = await database.getFirstAsync<{ active_generation_id: string }>(
      'SELECT active_generation_id FROM restore_control WHERE singleton = 1',
    );
    if (!control) throw new Error('Encrypted restore catalog is not initialized.');
    const active = await generationById(database, control.active_generation_id);
    const journalRow = await database.getFirstAsync<{ previous_generation_id: string; candidate_generation_id: string }>(
      'SELECT previous_generation_id, candidate_generation_id FROM restore_journal WHERE singleton = 1',
    );
    if (!journalRow) return { active };
    return {
      active,
      journal: {
        previous: await generationById(database, journalRow.previous_generation_id),
        candidate: await generationById(database, journalRow.candidate_generation_id),
      },
    };
  });
}

export async function registerRestoreGeneration(generation: DatabaseGeneration): Promise<void> {
  await withCatalog(async (database) => {
    await database.runAsync(
      'INSERT INTO restore_generations (id, database_name, key_alias) VALUES (?, ?, ?)',
      generation.id, generation.databaseName, generation.keyAlias,
    );
  });
}

export async function activateRestoreGeneration(previous: string, candidate: string): Promise<void> {
  await withCatalog(async (database) => transaction(database, async () => {
    const control = await database.getFirstAsync<{ active_generation_id: string }>(
      'SELECT active_generation_id FROM restore_control WHERE singleton = 1',
    );
    const candidateRow = await database.getFirstAsync<{ id: string }>('SELECT id FROM restore_generations WHERE id = ?', candidate);
    if (control?.active_generation_id !== previous || !candidateRow) throw new Error('Restore activation precondition changed.');
    await database.runAsync(
      'INSERT INTO restore_journal (singleton, previous_generation_id, candidate_generation_id) VALUES (1, ?, ?)', previous, candidate,
    );
    await database.runAsync('UPDATE restore_control SET active_generation_id = ? WHERE singleton = 1', candidate);
  }));
}

export async function finishRestoreActivation(): Promise<void> {
  await withCatalog(async (database) => transaction(database, async () => {
    await database.runAsync('DELETE FROM restore_journal WHERE singleton = 1');
  }));
}

export async function rollbackRestoreActivation(previous: string): Promise<void> {
  await withCatalog(async (database) => transaction(database, async () => {
    const prior = await database.getFirstAsync<{ id: string }>('SELECT id FROM restore_generations WHERE id = ?', previous);
    if (!prior) throw new Error('Original database generation is missing; refusing destructive recovery.');
    await database.runAsync('UPDATE restore_control SET active_generation_id = ? WHERE singleton = 1', previous);
    await database.runAsync('DELETE FROM restore_journal WHERE singleton = 1');
  }));
}

export async function deleteInactiveGeneration(generationId: string): Promise<void> {
  await closeAllEncryptedDatabases();
  const activation = await readDatabaseActivation();
  if (activation.active.id === generationId) throw new Error('Refusing to delete the active database generation.');
  if (activation.journal?.previous.id === generationId || activation.journal?.candidate.id === generationId) {
    throw new Error('Refusing to delete a database generation named by the restore journal.');
  }
  const generation = await withCatalog(async (database) => generationById(database, generationId));
  const directory = databaseDirectory();
  await SQLite.deleteDatabaseAsync(generation.databaseName, directory.uri);
  await SecureStore.deleteItemAsync(generation.keyAlias);
  await withCatalog(async (database) => database.runAsync('DELETE FROM restore_generations WHERE id = ?', generationId));
}
