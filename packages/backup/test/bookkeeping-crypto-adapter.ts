/**
 * Host crypto adapter for complete bookkeeping backup conformance tests.
 *
 * Implements real PBKDF2-HMAC-SHA-256 (600,000 iterations) and AES-256-GCM
 * using Node's standard `node:crypto` library under the exact same envelope,
 * header parameters, and additional authenticated data (AAD) as the native
 * implementation in `crypto.native.ts`.
 *
 * Limitations:
 * - This is host Node crypto conformance evidence only.
 * - It does NOT certify native QuickCrypto, expo-crypto, iOS Keychain,
 *   Android Keystore, or physical-device recovery durability.
 */

import { pbkdf2, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
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

export class NodeBookkeepingCryptoAdapter implements BookkeepingBackupCrypto {
  private readonly iterations: number;

  constructor(iterations = BACKUP_ITERATIONS) {
    this.iterations = iterations;
  }

  async encryptBackupPayload(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array> {
    if (plaintext.length + BACKUP_TAG_BYTES > BACKUP_MAX_BYTES - 52) {
      throw new Error('Backup payload exceeds the 8 MiB file limit.');
    }
    const passphraseBytes = validateBackupPassphrase(passphrase);
    const salt = randomBytes(BACKUP_SALT_BYTES);
    const nonce = randomBytes(BACKUP_NONCE_BYTES);

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      pbkdf2(passphraseBytes, salt, this.iterations, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    passphraseBytes.fill(0);

    try {
      const metadata = authenticatedMetadata(salt, nonce, plaintext.length + BACKUP_TAG_BYTES);
      const cipher = createCipheriv('aes-256-gcm', derivedKey, nonce);
      cipher.setAAD(metadata);
      const ciphertextPart = cipher.update(plaintext);
      const finalPart = cipher.final();
      const tag = cipher.getAuthTag();

      const ciphertext = new Uint8Array(ciphertextPart.length + finalPart.length + tag.length);
      ciphertext.set(ciphertextPart, 0);
      ciphertext.set(finalPart, ciphertextPart.length);
      ciphertext.set(tag, ciphertextPart.length + finalPart.length);

      const envelope: BackupEnvelope = {
        salt: new Uint8Array(salt),
        nonce: new Uint8Array(nonce),
        ciphertext,
      };
      return encodeBackupEnvelope(envelope);
    } finally {
      derivedKey.fill(0);
    }
  }

  async decryptBackupPayload(backup: Uint8Array, passphrase: string): Promise<Uint8Array> {
    const envelope = decodeBackupEnvelope(backup);
    const passphraseBytes = validateBackupPassphrase(passphrase);

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      pbkdf2(passphraseBytes, envelope.salt, this.iterations, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    passphraseBytes.fill(0);

    try {
      if (envelope.ciphertext.length < BACKUP_TAG_BYTES) {
        throw new Error('Backup ciphertext is shorter than authentication tag.');
      }
      const rawCiphertext = envelope.ciphertext.subarray(0, envelope.ciphertext.length - BACKUP_TAG_BYTES);
      const tag = envelope.ciphertext.subarray(envelope.ciphertext.length - BACKUP_TAG_BYTES);

      const decipher = createDecipheriv('aes-256-gcm', derivedKey, envelope.nonce);
      decipher.setAAD(envelope.authenticatedMetadata);
      decipher.setAuthTag(tag);

      const decryptedPart = decipher.update(rawCiphertext);
      const finalPart = decipher.final();

      const plaintext = new Uint8Array(decryptedPart.length + finalPart.length);
      plaintext.set(decryptedPart, 0);
      plaintext.set(finalPart, decryptedPart.length);
      return plaintext;
    } catch {
      throw new Error('Backup authentication failed. The passphrase may be incorrect or the file may be damaged.');
    } finally {
      derivedKey.fill(0);
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
