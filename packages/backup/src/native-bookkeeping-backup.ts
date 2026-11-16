/**
 * Native adapter for complete bookkeeping backup creation and decryption.
 *
 * Reuses the existing production AES-GCM/PBKDF2 implementation from `crypto.native.ts`
 * (or `crypto.web.ts` on web preview).
 *
 * In the web preview, operations throw the unchanged limitation:
 * 'Encrypted backup is available only in a native development build.'
 *
 * Scope: Pure non-UI. Does not wire UI controls or replace proof backup.
 */

import { decryptBackupPayload, encryptBackupPayload } from './crypto';
import {
  createBookkeepingBackup,
  decryptBookkeepingBackup,
  decryptBookkeepingBackupWithManifest,
  type BookkeepingBackupCrypto,
  type BookkeepingBackupManifest,
} from './bookkeeping-backup';
import type { BookkeepingDatasetSnapshot } from './bookkeeping-dataset';

export const nativeBookkeepingBackupCrypto: BookkeepingBackupCrypto = {
  encryptBackupPayload,
  decryptBackupPayload,
  encrypt: encryptBackupPayload,
  decrypt: decryptBackupPayload,
};

/**
 * Creates a passphrase-encrypted complete bookkeeping dataset backup using
 * the native platform cryptographic implementation.
 */
export async function createNativeBookkeepingBackup(
  dataset: unknown,
  passphrase: string,
): Promise<Uint8Array> {
  return await createBookkeepingBackup(dataset, passphrase, nativeBookkeepingBackupCrypto);
}

/**
 * Decrypts and validates a portable bookkeeping dataset backup using
 * the native platform cryptographic implementation.
 */
export async function decryptNativeBookkeepingBackup(
  backup: unknown,
  passphrase: string,
): Promise<BookkeepingDatasetSnapshot> {
  return await decryptBookkeepingBackup(backup, passphrase, nativeBookkeepingBackupCrypto);
}

/**
 * Decrypts and validates a portable bookkeeping dataset backup using
 * the native platform cryptographic implementation, returning the verified manifest.
 */
export async function decryptNativeBookkeepingBackupWithManifest(
  backup: unknown,
  passphrase: string,
): Promise<{ snapshot: BookkeepingDatasetSnapshot; manifest: BookkeepingBackupManifest }> {
  return await decryptBookkeepingBackupWithManifest(backup, passphrase, nativeBookkeepingBackupCrypto);
}
