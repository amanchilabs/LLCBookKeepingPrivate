import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { NativeRestoreStore } from '../../backup/src/native-restore-store';
import { recoverInterruptedRestore } from '../../backup/src/restore-coordinator';
import {
  CATALOG_DATABASE,
  CATALOG_KEY_ALIAS,
  ensureDatabaseCatalog,
  INITIAL_GENERATION,
  PORTABLE_RESTORE_REQUIRED_MARKER,
  readDatabaseActivation,
  type DatabaseGeneration,
} from './database-catalog';
import { closeAllEncryptedDatabases, MAIN_DATABASE_KEY_ALIAS, openEncryptedDatabase, readStoredDeviceKeyHex } from './encrypted-database';
import { createDatabaseLease, type DatabaseLease } from './database-lease';
import {
  canReplaceStorageWithPortableBackup,
  classifySecureKeyAccessError,
  resolveStoredDatabaseKey,
  SecureKeyAccessError,
} from './secure-key-access';
import { StorageAccessCoordinator } from './storage-access-coordinator';

const access = new StorageAccessCoordinator();
const STORAGE_DIRECTORY_NAME = 'LLCBookKeepingPrivate';
const ARCHIVE_DIRECTORY_PREFIX = 'LLCBookKeepingPrivate-restore-archive-';
let startupRecovery: Promise<string> | undefined;

function databaseDirectory(): Directory {
  return new Directory(Paths.document, STORAGE_DIRECTORY_NAME);
}

function hasPendingPortableRestoreMarker(): boolean {
  const directory = databaseDirectory();
  if (directory.exists && new File(directory, PORTABLE_RESTORE_REQUIRED_MARKER).exists) return true;
  if (!Paths.document.exists) return false;
  return Paths.document.list().some((entry) => entry instanceof Directory
    && entry.name.startsWith(ARCHIVE_DIRECTORY_PREFIX)
    && new File(entry, PORTABLE_RESTORE_REQUIRED_MARKER).exists);
}

function writePortableRestoreMarker(directory: Directory): void {
  directory.create({ idempotent: true, intermediates: true });
  const marker = new File(directory, PORTABLE_RESTORE_REQUIRED_MARKER);
  marker.create({ intermediates: true, overwrite: true });
  marker.writeSync('portable-restore-required-v1');
}

async function archiveCurrentStorageDirectoryForConfirmedRestore(): Promise<void> {
  const current = databaseDirectory();
  current.create({ idempotent: true, intermediates: true });
  writePortableRestoreMarker(current);
  if (current.list().some((entry) => entry.name !== PORTABLE_RESTORE_REQUIRED_MARKER)) {
    const archive = new Directory(Paths.document, `${ARCHIVE_DIRECTORY_PREFIX}${Crypto.randomUUID()}`);
    await current.move(archive);
  }
  const fresh = databaseDirectory();
  fresh.create({ idempotent: true, intermediates: true });
  writePortableRestoreMarker(fresh);
}

async function removeUnreadableKeyAliasesAfterArchive(): Promise<void> {
  for (const alias of [CATALOG_KEY_ALIAS, MAIN_DATABASE_KEY_ALIAS]) {
    let value: string | null;
    try {
      value = await SecureStore.getItemAsync(alias);
    } catch (error) {
      const classified = classifySecureKeyAccessError(error);
      if (classified.state !== 'key-unavailable-or-corrupt') throw classified;
      await SecureStore.deleteItemAsync(alias);
      continue;
    }
    if (value !== null && !/^[0-9a-f]{64}$/.test(value)) await SecureStore.deleteItemAsync(alias);
  }
}

async function clearPortableRestoreMarkers(): Promise<void> {
  const current = databaseDirectory();
  const currentMarker = new File(current, PORTABLE_RESTORE_REQUIRED_MARKER);
  if (currentMarker.exists) currentMarker.delete();
  if (!Paths.document.exists) return;
  for (const entry of Paths.document.list()) {
    if (!(entry instanceof Directory) || !entry.name.startsWith(ARCHIVE_DIRECTORY_PREFIX)) continue;
    const marker = new File(entry, PORTABLE_RESTORE_REQUIRED_MARKER);
    if (marker.exists) marker.delete();
  }
}

async function validateActiveGeneration(): Promise<void> {
  const activation = await readDatabaseActivation();
  if (activation.journal) throw new Error('Restore recovery did not clear its activation journal.');
  const generation = activation.active;
  const key = resolveStoredDatabaseKey(await readStoredDeviceKeyHex(generation.keyAlias), true);
  if (!key) throw new SecureKeyAccessError('key-missing');

  const database = await openEncryptedDatabase(generation.databaseName, key, generation.keyAlias);
  try {
    const integrity = await database.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('The active database failed SQLite integrity_check.');
    const manifest = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'restore_manifest'",
    );
    if (manifest) await new NativeRestoreStore().verifyGeneration(generation.id);
  } finally {
    await database.closeAsync();
  }
}

/** Resolve any durable restore journal before allowing the application to use storage. */
export function recoverDatabaseRestoreAtStartup(): Promise<string> {
  if (!startupRecovery) {
    startupRecovery = access.withExclusiveTransition(async () => {
      const pendingPortableRestore = hasPendingPortableRestoreMarker();
      const directory = databaseDirectory();
      if (pendingPortableRestore && (!directory.exists || !new File(directory, CATALOG_DATABASE).exists)) {
        throw new SecureKeyAccessError('portable-restore-required');
      }
      await ensureDatabaseCatalog();
      await closeAllEncryptedDatabases();
      const result = await recoverInterruptedRestore(new NativeRestoreStore());
      const activation = await readDatabaseActivation();
      if (pendingPortableRestore && activation.active.id === INITIAL_GENERATION) {
        throw new SecureKeyAccessError('portable-restore-required');
      }
      await validateActiveGeneration();
      if (pendingPortableRestore) await clearPortableRestoreMarkers();
      return result;
    }).catch((error: unknown) => {
      startupRecovery = undefined;
      throw error;
    });
  }
  return startupRecovery;
}

/** Explicit retry used by the locked/recovery state after key access becomes available. */
export function retryDatabaseRestoreRecovery(): Promise<string> {
  startupRecovery = undefined;
  return recoverDatabaseRestoreAtStartup();
}

/**
 * Restore a previously authenticated portable snapshot after explicit user
 * confirmation. This path can recover when the old database or catalog key is
 * unavailable; it never unlocks a fresh empty catalog after a failed import.
 */
export async function withPortableBackupRestoreTransition<T>(
  transition: () => Promise<T>,
  replacementConfirmed: boolean,
): Promise<T> {
  if (!replacementConfirmed) throw new Error('Explicit confirmation is required before replacing local data.');

  const outcome = await access.withExclusiveTransition(async (): Promise<
    { ok: true; value: T } | { ok: false; error: unknown }
  > => {
    await closeAllEncryptedDatabases();
    let pendingPortableRestore = hasPendingPortableRestoreMarker();
    try {
      await ensureDatabaseCatalog();
      const activation = await readDatabaseActivation();
      if (activation.journal) await recoverInterruptedRestore(new NativeRestoreStore());
    } catch (error) {
      if (!canReplaceStorageWithPortableBackup(error)) throw error;
      pendingPortableRestore = true;
      await archiveCurrentStorageDirectoryForConfirmedRestore();
      await removeUnreadableKeyAliasesAfterArchive();
      await ensureDatabaseCatalog();
    }

    let value: T | undefined;
    let operationError: unknown;
    let operationFailed = false;
    try {
      value = await transition();
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }

    await closeAllEncryptedDatabases();
    if (operationFailed) await recoverInterruptedRestore(new NativeRestoreStore());
    const activation = await readDatabaseActivation();
    if (pendingPortableRestore && activation.active.id === INITIAL_GENERATION) {
      throw new SecureKeyAccessError('portable-restore-required');
    }
    await validateActiveGeneration();
    if (pendingPortableRestore) await clearPortableRestoreMarkers();
    return operationFailed ? { ok: false, error: operationError } : { ok: true, value: value as T };
  });

  startupRecovery = undefined;
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

/**
 * Run one complete read or write against the active generation. The callback
 * cannot retain a live handle past its lease; restore waits for it to settle.
 */
export async function withActiveDatabase<T>(
  operation: (database: DatabaseLease, generation: DatabaseGeneration) => Promise<T>,
): Promise<T> {
  await recoverDatabaseRestoreAtStartup();
  try {
    return await access.withOperation(async () => {
    const activation = await readDatabaseActivation();
    if (activation.journal) throw new Error('Financial storage is locked until interrupted restore recovery completes.');
    const generation = activation.active;
    const key = resolveStoredDatabaseKey(await readStoredDeviceKeyHex(generation.keyAlias), true);
    if (!key) throw new SecureKeyAccessError('key-missing');
    const database = await openEncryptedDatabase(generation.databaseName, key, generation.keyAlias);
    const lease = createDatabaseLease(database);
    try {
      return await operation(lease.database, generation);
    } finally {
      await lease.release();
    }
    });
  } catch (error) {
    if (error instanceof SecureKeyAccessError) access.lock(error);
    throw error;
  }
}

/**
 * Own the exclusive storage barrier for restore and failure-injection work.
 * Failure is returned only after recovery has selected and validated one full
 * generation, so ordinary access can safely resume before the error is shown.
 */
export async function withStorageTransition<T>(transition: () => Promise<T>): Promise<T> {
  await recoverDatabaseRestoreAtStartup();
  const outcome = await access.withExclusiveTransition(async (): Promise<
    { ok: true; value: T } | { ok: false; error: unknown }
  > => {
    await closeAllEncryptedDatabases();
    let value: T | undefined;
    let operationError: unknown;
    let operationFailed = false;
    try {
      value = await transition();
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }

    await closeAllEncryptedDatabases();
    if (operationFailed) {
      await recoverInterruptedRestore(new NativeRestoreStore());
    }
    await validateActiveGeneration();
    return operationFailed ? { ok: false, error: operationError } : { ok: true, value: value as T };
  });

  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
