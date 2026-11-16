/**
 * Host crypto adapter for complete bookkeeping backup conformance tests.
 *
 * Implements real PBKDF2-HMAC-SHA-256 (600,000 iterations) and real AES-256-GCM
 * using the standard Web Cryptography API (`globalThis.crypto.subtle`) available in
 * Node 24. It operates under the exact same envelope, header parameters, and
 * additional authenticated data (AAD) as the native implementation in `crypto.native.ts`.
 *
 * Security & Memory Hygiene:
 * - Atomic Authenticated Decryption: WebCrypto AES-GCM performs atomic decryption,
 *   releasing plaintext only after tag verification succeeds. This eliminates
 *   intermediate unauthenticated plaintext buffers on decryption failure.
 * - Key Material: Derived keys are unextractable CryptoKey instances managed by
 *   the runtime engine, avoiding raw intermediate key buffers in user JS.
 * - Passphrase Cleanup: Transient passphrase byte arrays are explicitly zeroed
 *   (`fill(0)`) in finally blocks on all execution paths.
 *
 * Limitations:
 * - This is host Node crypto conformance evidence only.
 * - It does NOT certify native QuickCrypto, expo-crypto, iOS Keychain,
 *   Android Keystore, or physical-device recovery durability.
 */

import {
  authenticatedMetadata,
  BACKUP_ITERATIONS,
  BACKUP_MAX_BYTES,
  BACKUP_NONCE_BYTES,
  BACKUP_SALT_BYTES,
  BACKUP_TAG_BYTES,
  decodeBackupEnvelope,
  encodeBackupEnvelope,
  validateBackupPassphrase,
  type BackupEnvelope,
} from '../src/format';
import type { BookkeepingBackupCrypto } from '../src/bookkeeping-backup';

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.subtle === 'undefined') {
    throw new Error('WebCrypto (globalThis.crypto.subtle) is not available in this environment.');
  }
  return globalThis.crypto.subtle;
}

export class NodeBookkeepingCryptoAdapter implements BookkeepingBackupCrypto {
  private readonly iterations: number;

  constructor(iterations = BACKUP_ITERATIONS) {
    this.iterations = iterations;
  }

  async encryptBackupPayload(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array> {
    if (plaintext.length + BACKUP_TAG_BYTES > BACKUP_MAX_BYTES - 52) {
      throw new Error('Backup payload exceeds the 8 MiB file limit.');
    }

    const subtle = getSubtleCrypto();
    let passphraseBytes: Uint8Array | null = null;
    try {
      passphraseBytes = validateBackupPassphrase(passphrase);
      const salt = new Uint8Array(BACKUP_SALT_BYTES);
      globalThis.crypto.getRandomValues(salt);
      const nonce = new Uint8Array(BACKUP_NONCE_BYTES);
      globalThis.crypto.getRandomValues(nonce);

      const baseKey = await subtle.importKey(
        'raw',
        passphraseBytes,
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      passphraseBytes.fill(0);
      passphraseBytes = null;

      const derivedKey = await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: this.iterations,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt'],
      );

      const metadata = authenticatedMetadata(salt, nonce, plaintext.length + BACKUP_TAG_BYTES);
      const encrypted = await subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          additionalData: metadata,
          tagLength: 128,
        },
        derivedKey,
        plaintext,
      );

      const ciphertext = new Uint8Array(encrypted);
      const envelope: BackupEnvelope = {
        salt,
        nonce,
        ciphertext,
      };
      return encodeBackupEnvelope(envelope);
    } finally {
      if (passphraseBytes) {
        passphraseBytes.fill(0);
      }
    }
  }

  async decryptBackupPayload(backup: Uint8Array, passphrase: string): Promise<Uint8Array> {
    const envelope = decodeBackupEnvelope(backup);
    const subtle = getSubtleCrypto();

    let passphraseBytes: Uint8Array | null = null;
    try {
      passphraseBytes = validateBackupPassphrase(passphrase);
      const baseKey = await subtle.importKey(
        'raw',
        passphraseBytes,
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      passphraseBytes.fill(0);
      passphraseBytes = null;

      const derivedKey = await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: envelope.salt,
          iterations: this.iterations,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );

      const decrypted = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: envelope.nonce,
          additionalData: envelope.authenticatedMetadata,
          tagLength: 128,
        },
        derivedKey,
        envelope.ciphertext,
      );

      return new Uint8Array(decrypted);
    } catch {
      throw new Error('Backup authentication failed. The passphrase may be incorrect or the file may be damaged.');
    } finally {
      if (passphraseBytes) {
        passphraseBytes.fill(0);
      }
    }
  }

  async encrypt(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array> {
    return await this.encryptBackupPayload(plaintext, passphrase);
  }

  async decrypt(backup: Uint8Array, passphrase: string): Promise<Uint8Array> {
    return await this.decryptBackupPayload(backup, passphrase);
  }
}

export function createNodeBookkeepingCryptoAdapter(iterations = BACKUP_ITERATIONS): BookkeepingBackupCrypto {
  return new NodeBookkeepingCryptoAdapter(iterations);
}
