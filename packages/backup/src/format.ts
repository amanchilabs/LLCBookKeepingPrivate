export interface BackupEnvelope {
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface DecodedBackupEnvelope extends BackupEnvelope {
  authenticatedMetadata: Uint8Array;
}

export const BACKUP_ITERATIONS = 600_000;
export const BACKUP_MAX_BYTES = 8 * 1024 * 1024;
export const BACKUP_SALT_BYTES = 16;
export const BACKUP_NONCE_BYTES = 12;
export const BACKUP_TAG_BYTES = 16;

const MAGIC = new Uint8Array([0x4c, 0x4c, 0x43, 0x42, 0x4b, 0x55, 0x50, 0x00]);
const VERSION = 1;
const HEADER_BYTES = 24;
const PAYLOAD_PREFIX_BYTES = HEADER_BYTES + BACKUP_SALT_BYTES + BACKUP_NONCE_BYTES;

function header(ciphertextLength: number): Uint8Array {
  const result = new Uint8Array(HEADER_BYTES);
  result.set(MAGIC, 0);
  result[8] = VERSION;
  result[9] = 1; // PBKDF2-HMAC-SHA-256
  result[10] = 1; // AES-256-GCM
  result[11] = 0; // reserved; must remain zero
  const view = new DataView(result.buffer);
  view.setUint32(12, BACKUP_ITERATIONS, false);
  view.setUint16(16, BACKUP_SALT_BYTES, false);
  result[18] = BACKUP_NONCE_BYTES;
  result[19] = BACKUP_TAG_BYTES;
  view.setUint32(20, ciphertextLength, false);
  return result;
}

export function authenticatedMetadata(salt: Uint8Array, nonce: Uint8Array, ciphertextLength: number): Uint8Array {
  if (salt.length !== BACKUP_SALT_BYTES || nonce.length !== BACKUP_NONCE_BYTES) {
    throw new Error('Backup salt or nonce has an invalid length.');
  }
  const metadata = new Uint8Array(HEADER_BYTES + salt.length + nonce.length);
  metadata.set(header(ciphertextLength), 0);
  metadata.set(salt, HEADER_BYTES);
  metadata.set(nonce, HEADER_BYTES + salt.length);
  return metadata;
}

export function encodeBackupEnvelope(envelope: BackupEnvelope): Uint8Array {
  if (envelope.ciphertext.length < BACKUP_TAG_BYTES || envelope.ciphertext.length > BACKUP_MAX_BYTES - PAYLOAD_PREFIX_BYTES) {
    throw new Error('Backup ciphertext size is outside the supported limits.');
  }
  const metadata = authenticatedMetadata(envelope.salt, envelope.nonce, envelope.ciphertext.length);
  const result = new Uint8Array(metadata.length + envelope.ciphertext.length);
  result.set(metadata, 0);
  result.set(envelope.ciphertext, metadata.length);
  return result;
}

export function decodeBackupEnvelope(input: Uint8Array): DecodedBackupEnvelope {
  if (input.length < PAYLOAD_PREFIX_BYTES + BACKUP_TAG_BYTES || input.length > BACKUP_MAX_BYTES) {
    throw new Error('Backup size is outside the supported limits.');
  }
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (input[index] !== MAGIC[index]) throw new Error('Backup file signature is invalid.');
  }
  if (input[8] !== VERSION || input[9] !== 1 || input[10] !== 1 || input[11] !== 0) {
    throw new Error('Backup format or algorithm version is unsupported.');
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const iterations = view.getUint32(12, false);
  const saltLength = view.getUint16(16, false);
  const nonceLength = input[18];
  const tagLength = input[19];
  const ciphertextLength = view.getUint32(20, false);
  if (iterations !== BACKUP_ITERATIONS || saltLength !== BACKUP_SALT_BYTES || nonceLength !== BACKUP_NONCE_BYTES || tagLength !== BACKUP_TAG_BYTES) {
    throw new Error('Backup cryptographic parameters are unsupported.');
  }
  if (ciphertextLength < tagLength || ciphertextLength > BACKUP_MAX_BYTES - PAYLOAD_PREFIX_BYTES || input.length !== PAYLOAD_PREFIX_BYTES + ciphertextLength) {
    throw new Error('Backup is truncated or has an invalid ciphertext length.');
  }
  const salt = input.slice(HEADER_BYTES, HEADER_BYTES + saltLength);
  const nonce = input.slice(HEADER_BYTES + saltLength, PAYLOAD_PREFIX_BYTES);
  const ciphertext = input.slice(PAYLOAD_PREFIX_BYTES);
  return { salt, nonce, ciphertext, authenticatedMetadata: input.slice(0, PAYLOAD_PREFIX_BYTES) };
}
