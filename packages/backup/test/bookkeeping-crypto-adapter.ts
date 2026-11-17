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
 * - WebCrypto Boundary Copies: WebCrypto's `BufferSource` requires views backed by
 *   a plain `ArrayBuffer`, while the backup APIs accept any `Uint8Array` (which may
 *   be `SharedArrayBuffer`-backed). Inputs are therefore copied into fresh
 *   `ArrayBuffer`-backed views at the WebCrypto boundary. Every such copy is owned
 *   by this adapter and zeroed in a finally block; caller-owned inputs are never
 *   modified here.
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

/**
 * Copies bytes into a fresh view backed by a plain `ArrayBuffer`, as required by
 * WebCrypto's `BufferSource`. The caller owns the returned copy and must wipe it.
 */
function toOwnedArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

function wipeAll(owned: Uint8Array[]): void {
  for (const bytes of owned) {
    bytes.fill(0);
  }
  owned.length = 0;
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
    const owned: Uint8Array[] = [];
    try {
      const passphraseBytes = validateBackupPassphrase(passphrase);
      owned.push(passphraseBytes);
      const passphraseKeyBytes = toOwnedArrayBufferView(passphraseBytes);
      owned.push(passphraseKeyBytes);
      const salt = new Uint8Array(BACKUP_SALT_BYTES);
      globalThis.crypto.getRandomValues(salt);
      const nonce = new Uint8Array(BACKUP_NONCE_BYTES);
      globalThis.crypto.getRandomValues(nonce);

      const baseKey = await subtle.importKey(
        'raw',
        passphraseKeyBytes,
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      passphraseBytes.fill(0);
      passphraseKeyBytes.fill(0);

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

      // AAD is public envelope metadata; it is copied only for the BufferSource type.
      const metadata = toOwnedArrayBufferView(
        authenticatedMetadata(salt, nonce, plaintext.length + BACKUP_TAG_BYTES),
      );
      const plaintextCopy = toOwnedArrayBufferView(plaintext);
      owned.push(plaintextCopy);
      const encrypted = await subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          additionalData: metadata,
          tagLength: 128,
        },
        derivedKey,
        plaintextCopy,
      );

      const ciphertext = new Uint8Array(encrypted);
      const envelope: BackupEnvelope = {
        salt,
        nonce,
        ciphertext,
      };
      return encodeBackupEnvelope(envelope);
    } finally {
      wipeAll(owned);
    }
  }

  async decryptBackupPayload(backup: Uint8Array, passphrase: string): Promise<Uint8Array> {
    const envelope = decodeBackupEnvelope(backup);
    const subtle = getSubtleCrypto();

    const owned: Uint8Array[] = [];
    try {
      const passphraseBytes = validateBackupPassphrase(passphrase);
      owned.push(passphraseBytes);
      const passphraseKeyBytes = toOwnedArrayBufferView(passphraseBytes);
      owned.push(passphraseKeyBytes);
      const baseKey = await subtle.importKey(
        'raw',
        passphraseKeyBytes,
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      passphraseBytes.fill(0);
      passphraseKeyBytes.fill(0);

      // Envelope fields are public (salt, nonce, AAD, ciphertext); the copies exist
      // only to satisfy WebCrypto's ArrayBuffer-backed BufferSource requirement.
      const salt = toOwnedArrayBufferView(envelope.salt);
      const nonce = toOwnedArrayBufferView(envelope.nonce);
      const metadata = toOwnedArrayBufferView(envelope.authenticatedMetadata);
      const ciphertext = toOwnedArrayBufferView(envelope.ciphertext);
      owned.push(salt, nonce, metadata, ciphertext);

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
        ['decrypt'],
      );

      const decrypted = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          additionalData: metadata,
          tagLength: 128,
        },
        derivedKey,
        ciphertext,
      );

      return new Uint8Array(decrypted);
    } catch {
      throw new Error('Backup authentication failed. The passphrase may be incorrect or the file may be damaged.');
    } finally {
      wipeAll(owned);
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
