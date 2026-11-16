/**
 * Pure non-UI creation and decryption APIs for complete bookkeeping dataset backups.
 *
 * Scope & Security Model (see docs/recovery/BACKUP-FORMAT.md):
 * - Authenticated Envelope: Encrypted under the existing portable envelope
 *   (PBKDF2-HMAC-SHA-256 with 600,000 iterations, AES-256-GCM, 16-byte salt,
 *   12-byte nonce, 16-byte tag, 52-byte authenticated metadata).
 * - Payload Discriminator & Separation: Uses `BOOKKEEPING_DATASET_FORMAT`
 *   ('llc-bookkeeping-dataset') and schema version 13. Proof-only restore
 *   payloads are strictly rejected and cannot be restored as books or vice versa.
 * - Injected Crypto Boundary: Decoupled from native hardware so host test
 *   suites can verify real cryptographic roundtrips using the Node crypto adapter.
 * - Defense-in-Depth Validation: Passphrase and envelope bounds are checked
 *   before expensive cryptographic operations; full schema and manifest
 *   integrity are strictly verified after authentication.
 * - Memory Hygiene: Transient plaintext buffers are zeroed (`fill(0)`) when owned.
 * - Sensitive Data Protection: Passphrases and key material are never logged or
 *   embedded in error messages.
 * - Keychain Independence: Restore requires only the passphrase and backup bytes;
 *   no source Keychain or device secrets are used.
 */

import {
  BOOKKEEPING_DATASET_FORMAT,
  BOOKKEEPING_DATASET_FORMAT_VERSION,
  BOOKKEEPING_DATASET_SCHEMA_VERSION,
  BOOKKEEPING_DATASET_TABLES,
  BookkeepingDatasetError,
  parseBookkeepingDataset,
  serializeBookkeepingDataset,
  validateBookkeepingDatasetSnapshot,
  type BookkeepingDatasetSnapshot,
} from './bookkeeping-dataset';
import {
  BACKUP_ITERATIONS,
  BACKUP_MAX_BYTES,
  BACKUP_NONCE_BYTES,
  BACKUP_PASSPHRASE_MAX_UTF8_BYTES,
  BACKUP_PASSPHRASE_MIN_CHARACTERS,
  BACKUP_SALT_BYTES,
  BACKUP_TAG_BYTES,
  decodeBackupEnvelope,
  validateBackupPassphrase,
} from './format';

export const BOOKKEEPING_BACKUP_PAYLOAD_FORMAT = BOOKKEEPING_DATASET_FORMAT;
export const BOOKKEEPING_BACKUP_PAYLOAD_VERSION = BOOKKEEPING_DATASET_FORMAT_VERSION;
export const BOOKKEEPING_BACKUP_SCHEMA_VERSION = BOOKKEEPING_DATASET_SCHEMA_VERSION;
export const BOOKKEEPING_BACKUP_MAX_BYTES = BACKUP_MAX_BYTES;
export const BOOKKEEPING_BACKUP_ITERATIONS = BACKUP_ITERATIONS;

export type BookkeepingBackupErrorCode =
  | 'invalid-passphrase'
  | 'payload-too-large'
  | 'envelope-corrupt'
  | 'authentication-failed'
  | 'unsupported-envelope'
  | 'unsupported-format'
  | 'unsupported-schema'
  | 'proof-payload-rejected'
  | 'malformed-payload'
  | 'crypto-unavailable';

export class BookkeepingBackupError extends Error {
  readonly code: BookkeepingBackupErrorCode;

  constructor(code: BookkeepingBackupErrorCode, message: string) {
    super(message);
    this.name = 'BookkeepingBackupError';
    this.code = code;
  }
}

/**
 * Injected crypto interface.
 * Implemented by `crypto.native.ts` (QuickCrypto/expo-crypto) for device builds,
 * and `bookkeeping-crypto-adapter.ts` (Node crypto) for host tests.
 */
export interface BookkeepingBackupCrypto {
  encryptBackupPayload(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array>;
  decryptBackupPayload(backup: Uint8Array, passphrase: string): Promise<Uint8Array>;
  encrypt?(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array>;
  decrypt?(backup: Uint8Array, passphrase: string): Promise<Uint8Array>;
}

export interface BookkeepingBackupManifest {
  schemaVersion: number;
  tableCount: number;
  totalRowCount: number;
  tableRowCounts: Record<string, number>;
}

function resolveEncryptFn(crypto: BookkeepingBackupCrypto): (plaintext: Uint8Array, passphrase: string) => Promise<Uint8Array> {
  if (typeof crypto.encryptBackupPayload === 'function') {
    return crypto.encryptBackupPayload.bind(crypto);
  }
  if (typeof crypto.encrypt === 'function') {
    return crypto.encrypt.bind(crypto);
  }
  throw new BookkeepingBackupError('crypto-unavailable', 'Crypto adapter does not implement encryptBackupPayload.');
}

function resolveDecryptFn(crypto: BookkeepingBackupCrypto): (backup: Uint8Array, passphrase: string) => Promise<Uint8Array> {
  if (typeof crypto.decryptBackupPayload === 'function') {
    return crypto.decryptBackupPayload.bind(crypto);
  }
  if (typeof crypto.decrypt === 'function') {
    return crypto.decrypt.bind(crypto);
  }
  throw new BookkeepingBackupError('crypto-unavailable', 'Crypto adapter does not implement decryptBackupPayload.');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Builds the manifest summarizing table counts and row statistics from a validated snapshot.
 */
export function buildBookkeepingBackupManifest(snapshot: BookkeepingDatasetSnapshot): BookkeepingBackupManifest {
  const tableRowCounts: Record<string, number> = {};
  let totalRowCount = 0;
  for (const table of snapshot.tables) {
    tableRowCounts[table.name] = table.rowCount;
    totalRowCount += table.rowCount;
  }
  return {
    schemaVersion: snapshot.schemaVersion,
    tableCount: snapshot.tables.length,
    totalRowCount,
    tableRowCounts,
  };
}

/**
 * Proves that the snapshot's tables and rows match the schema-13 manifest contract.
 */
export function assertBookkeepingBackupManifest(snapshot: BookkeepingDatasetSnapshot): BookkeepingBackupManifest {
  if (snapshot.tables.length !== BOOKKEEPING_DATASET_TABLES.length) {
    throw new BookkeepingBackupError('malformed-payload', 'The bookkeeping dataset table manifest is incomplete.');
  }
  for (let index = 0; index < BOOKKEEPING_DATASET_TABLES.length; index += 1) {
    const expected = BOOKKEEPING_DATASET_TABLES[index];
    const actual = snapshot.tables[index];
    if (actual.name !== expected.name) {
      throw new BookkeepingBackupError(
        'malformed-payload',
        `Table at position ${index} is ${actual.name}; expected ${expected.name}.`,
      );
    }
    if (actual.rowCount !== actual.rows.length) {
      throw new BookkeepingBackupError(
        'malformed-payload',
        `Table ${actual.name} rowCount (${actual.rowCount}) does not match row array length (${actual.rows.length}).`,
      );
    }
  }
  return buildBookkeepingBackupManifest(snapshot);
}

/**
 * Creates a passphrase-encrypted portable backup of the complete bookkeeping dataset.
 *
 * 1. Validates passphrase bounds (12-1024 bytes) before doing expensive work.
 * 2. Validates and canonically serializes the dataset snapshot using RECOVERY-001 APIs.
 * 3. Enforces the 8 MiB size limit.
 * 4. Encrypts under the authenticated AES-GCM/PBKDF2 envelope via the injected crypto adapter.
 * 5. Zeros transient plaintext buffers upon completion or failure.
 */
export async function createBookkeepingBackup(
  dataset: unknown,
  passphrase: string,
  crypto: BookkeepingBackupCrypto,
): Promise<Uint8Array> {
  if (typeof passphrase !== 'string') {
    throw new BookkeepingBackupError('invalid-passphrase', 'Backup passphrase must be a string.');
  }

  // Enforce passphrase bounds before expensive snapshot validation or serialization
  let passphraseBytes: Uint8Array;
  try {
    passphraseBytes = validateBackupPassphrase(passphrase);
  } catch (error) {
    throw new BookkeepingBackupError(
      'invalid-passphrase',
      error instanceof Error ? error.message : 'Invalid backup passphrase.',
    );
  }
  passphraseBytes.fill(0);

  // Validate the dataset snapshot and serialize canonically
  let snapshot: BookkeepingDatasetSnapshot;
  try {
    snapshot = validateBookkeepingDatasetSnapshot(dataset);
  } catch (error) {
    if (error instanceof BookkeepingDatasetError) {
      if (error.code === 'unsupported-schema-version' || error.code === 'newer-schema-version') {
        throw new BookkeepingBackupError('unsupported-schema', error.message);
      }
      if (error.code === 'unsupported-format-version') {
        throw new BookkeepingBackupError('unsupported-format', error.message);
      }
    }
    throw error;
  }

  assertBookkeepingBackupManifest(snapshot);
  const serialized = serializeBookkeepingDataset(snapshot);
  const plaintext = new TextEncoder().encode(serialized);

  // Enforce envelope payload bounds: 52-byte prefix + ciphertext (plaintext + 16-byte tag) <= 8 MiB
  if (plaintext.length + BACKUP_TAG_BYTES > BACKUP_MAX_BYTES - 52) {
    plaintext.fill(0);
    throw new BookkeepingBackupError(
      'payload-too-large',
      'Backup payload exceeds the 8 MiB file limit.',
    );
  }

  const encrypt = resolveEncryptFn(crypto);
  try {
    return await encrypt(plaintext, passphrase);
  } finally {
    plaintext.fill(0);
  }
}

/**
 * Decrypts and validates a passphrase-encrypted portable bookkeeping backup.
 *
 * 1. Enforces bounds and validates envelope header structure before expensive PBKDF2 key derivation.
 * 2. Authenticates and decrypts ciphertext via the injected crypto adapter.
 * 3. Rejects wrong passphrases and tampered envelopes.
 * 4. Performs strict post-authentication decode: fatal UTF-8 decoding, JSON parsing,
 *    and explicit rejection of proof-only payloads (`RestoredProofSnapshot`).
 * 5. Strictly parses and validates canonical schema-13 dataset structure using RECOVERY-001 APIs.
 * 6. Verifies complete manifest parity (table count, column structure, row count parity).
 * 7. Zeros transient decrypted plaintext buffers upon completion.
 */
export async function decryptBookkeepingBackup(
  backup: unknown,
  passphrase: string,
  crypto: BookkeepingBackupCrypto,
): Promise<BookkeepingDatasetSnapshot> {
  const result = await decryptBookkeepingBackupWithManifest(backup, passphrase, crypto);
  return result.snapshot;
}

/**
 * Decrypts and validates a backup, returning both the restored dataset and verified manifest.
 */
export async function decryptBookkeepingBackupWithManifest(
  backup: unknown,
  passphrase: string,
  crypto: BookkeepingBackupCrypto,
): Promise<{ snapshot: BookkeepingDatasetSnapshot; manifest: BookkeepingBackupManifest }> {
  if (!(backup instanceof Uint8Array)) {
    throw new BookkeepingBackupError('unsupported-envelope', 'Backup data must be a Uint8Array.');
  }

  // Pre-validate envelope bounds before expensive work
  if (backup.length < 52 + BACKUP_TAG_BYTES || backup.length > BACKUP_MAX_BYTES) {
    throw new BookkeepingBackupError(
      'payload-too-large',
      'Backup size is outside the supported limits.',
    );
  }

  if (typeof passphrase !== 'string') {
    throw new BookkeepingBackupError('invalid-passphrase', 'Backup passphrase must be a string.');
  }

  let passphraseBytes: Uint8Array;
  try {
    passphraseBytes = validateBackupPassphrase(passphrase);
  } catch (error) {
    throw new BookkeepingBackupError(
      'invalid-passphrase',
      error instanceof Error ? error.message : 'Invalid backup passphrase.',
    );
  }
  passphraseBytes.fill(0);

  // Validate envelope header parameters before expensive PBKDF2 work
  try {
    decodeBackupEnvelope(backup);
  } catch (error) {
    throw new BookkeepingBackupError(
      'envelope-corrupt',
      error instanceof Error ? error.message : 'Backup envelope is corrupt or unsupported.',
    );
  }

  const decrypt = resolveDecryptFn(crypto);
  let plaintext: Uint8Array;
  try {
    plaintext = await decrypt(backup, passphrase);
  } catch (error) {
    throw new BookkeepingBackupError(
      'authentication-failed',
      error instanceof Error ? error.message : 'Backup authentication failed.',
    );
  }

  let decodedText: string;
  try {
    decodedText = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    throw new BookkeepingBackupError(
      'malformed-payload',
      'The decrypted backup payload is not valid UTF-8 text.',
    );
  } finally {
    plaintext.fill(0);
  }

  // Check for proof-only payload rejection before general parsing
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decodedText);
  } catch {
    throw new BookkeepingBackupError(
      'malformed-payload',
      'The decrypted backup payload is not valid JSON.',
    );
  }

  if (isPlainObject(parsedJson)) {
    if ('records' in parsedJson || !('format' in parsedJson) || parsedJson.schemaVersion === 1) {
      if (parsedJson.format !== BOOKKEEPING_DATASET_FORMAT) {
        throw new BookkeepingBackupError(
          'proof-payload-rejected',
          'The backup contains a proof payload and cannot be restored as bookkeeping data.',
        );
      }
    }
  }

  let snapshot: BookkeepingDatasetSnapshot;
  try {
    snapshot = parseBookkeepingDataset(decodedText);
  } catch (error) {
    if (error instanceof BookkeepingDatasetError) {
      if (error.code === 'unsupported-schema-version' || error.code === 'newer-schema-version') {
        throw new BookkeepingBackupError('unsupported-schema', error.message);
      }
      if (error.code === 'unsupported-format-version') {
        throw new BookkeepingBackupError('unsupported-format', error.message);
      }
      throw new BookkeepingBackupError('malformed-payload', error.message);
    }
    throw error;
  }

  const manifest = assertBookkeepingBackupManifest(snapshot);
  return { snapshot, manifest };
}
