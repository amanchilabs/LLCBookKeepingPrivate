import * as SecureStore from 'expo-secure-store';
import { NativeRestoreStore } from '../../backup/src/native-restore-store';
import { recoverInterruptedRestore } from '../../backup/src/restore-coordinator';
import {
  ensureDatabaseCatalog,
  readDatabaseActivation,
  type DatabaseGeneration,
} from './database-catalog';
import { closeAllEncryptedDatabases, openEncryptedDatabase } from './encrypted-database';
import { createDatabaseLease, type DatabaseLease } from './database-lease';
import { StorageAccessCoordinator } from './storage-access-coordinator';

const access = new StorageAccessCoordinator();
let startupRecovery: Promise<string> | undefined;

async function validateActiveGeneration(): Promise<void> {
  const activation = await readDatabaseActivation();
  if (activation.journal) throw new Error('Restore recovery did not clear its activation journal.');
  const generation = activation.active;
  const key = await SecureStore.getItemAsync(generation.keyAlias);
  if (!key) throw new Error('The active database key is unavailable. Financial storage remains locked.');

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
      await ensureDatabaseCatalog();
      await closeAllEncryptedDatabases();
      const result = await recoverInterruptedRestore(new NativeRestoreStore());
      await validateActiveGeneration();
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
 * Run one complete read or write against the active generation. The callback
 * cannot retain a live handle past its lease; restore waits for it to settle.
 */
export async function withActiveDatabase<T>(
  operation: (database: DatabaseLease, generation: DatabaseGeneration) => Promise<T>,
): Promise<T> {
  await recoverDatabaseRestoreAtStartup();
  return await access.withOperation(async () => {
    const activation = await readDatabaseActivation();
    if (activation.journal) throw new Error('Financial storage is locked until interrupted restore recovery completes.');
    const generation = activation.active;
    const key = await SecureStore.getItemAsync(generation.keyAlias);
    if (!key) throw new Error('The active database key is unavailable. Financial storage remains locked.');
    const database = await openEncryptedDatabase(generation.databaseName, key, generation.keyAlias);
    const lease = createDatabaseLease(database);
    try {
      return await operation(lease.database, generation);
    } finally {
      await lease.release();
    }
  });
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
