import * as Crypto from 'expo-crypto';
import { aesDecryptAsync, aesEncryptAsync, AESEncryptionKey, AESSealedData } from 'expo-crypto';
import QuickCrypto from 'react-native-quick-crypto';
import { authenticatedMetadata, BACKUP_ITERATIONS, BACKUP_MAX_BYTES, decodeBackupEnvelope, encodeBackupEnvelope, type BackupEnvelope } from './format';

const utf8 = new TextEncoder();
const MIN_PASSPHRASE_CHARACTERS = 12;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<AESEncryptionKey> {
  if (passphrase.length < MIN_PASSPHRASE_CHARACTERS) {
    throw new Error(`Backup passphrase must be at least ${MIN_PASSPHRASE_CHARACTERS} characters.`);
  }
  const password = utf8.encode(passphrase);
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
