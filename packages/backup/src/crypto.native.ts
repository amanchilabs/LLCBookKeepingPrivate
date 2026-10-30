import * as Crypto from 'expo-crypto';
import { aesDecryptAsync, aesEncryptAsync, AESEncryptionKey, AESSealedData } from 'expo-crypto';
import QuickCrypto from 'react-native-quick-crypto';
import { authenticatedMetadata, BACKUP_ITERATIONS, BACKUP_MAX_BYTES, decodeBackupEnvelope, encodeBackupEnvelope, validateBackupPassphrase, type BackupEnvelope } from './format';

const utf8 = new TextEncoder();
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<AESEncryptionKey> {
  const password = validateBackupPassphrase(passphrase);
  const keyBytes = await new Promise<Uint8Array>((resolve, reject) => {
    QuickCrypto.pbkdf2(password, salt, BACKUP_ITERATIONS, 32, 'sha256', (error, derivedKey) => {
      if (error || !derivedKey) {
        reject(error ?? new Error('PBKDF2 did not return a key.'));
        return;
      }
      const copy = Uint8Array.from(derivedKey);
      derivedKey.fill(0);
      resolve(copy);
    });
  });
  try {
    return await AESEncryptionKey.import(keyBytes);
  } finally {
    password.fill(0);
    keyBytes.fill(0);
  }
}

export async function encryptBackupPayload(plaintext: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (plaintext.length + 16 > BACKUP_MAX_BYTES - 52) throw new Error('Backup payload exceeds the 8 MiB file limit.');
  const salt = await Crypto.getRandomBytesAsync(16);
  const nonce = await Crypto.getRandomBytesAsync(12);
  const metadata = authenticatedMetadata(salt, nonce, plaintext.length + 16);
  const key = await deriveKey(passphrase, salt);
  const sealed = await aesEncryptAsync(plaintext, key, { nonce: { bytes: nonce }, additionalData: metadata });
  const ciphertext = await sealed.ciphertext({ includeTag: true });
  const envelope: BackupEnvelope = { salt, nonce, ciphertext };
  return encodeBackupEnvelope(envelope);
}

export async function decryptBackupPayload(backup: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const envelope = decodeBackupEnvelope(backup);
  const key = await deriveKey(passphrase, envelope.salt);
  try {
    const sealed = AESSealedData.fromParts(envelope.nonce, envelope.ciphertext);
    const plaintext = await aesDecryptAsync(sealed, key, { additionalData: envelope.authenticatedMetadata });
    if (typeof plaintext === 'string') throw new Error('Unexpected text result from AES-GCM decryption.');
    return plaintext;
  } catch {
    throw new Error('Backup authentication failed. The passphrase may be incorrect or the file may be damaged.');
  }
}

/** Measures PBKDF2 only; it uses a synthetic passphrase and never logs key material. */
export async function benchmarkBackupKdf(samples = 5): Promise<number[]> {
  if (!Number.isInteger(samples) || samples < 1 || samples > 20) throw new Error('KDF benchmark sample count is invalid.');
  const password = utf8.encode('SyntheticBenchmarkPassphrase2026');
  try {
    const measurements: number[] = [];
    for (let index = 0; index < samples; index += 1) {
      const salt = await Crypto.getRandomBytesAsync(16);
      const started = performance.now();
      const derived = await new Promise<Uint8Array>((resolve, reject) => {
        QuickCrypto.pbkdf2(password, salt, BACKUP_ITERATIONS, 32, 'sha256', (error, key) => {
          if (error || !key) reject(error ?? new Error('PBKDF2 benchmark returned no key.'));
          else resolve(Uint8Array.from(key));
        });
      });
      measurements.push(performance.now() - started);
      derived.fill(0);
      salt.fill(0);
    }
    return measurements;
  } finally {
    password.fill(0);
  }
}
