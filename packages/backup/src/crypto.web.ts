export async function encryptBackupPayload(_plaintext: Uint8Array, _passphrase: string): Promise<Uint8Array> {
  throw new Error('Encrypted backup is available only in a native development build.');
}

export async function decryptBackupPayload(_backup: Uint8Array, _passphrase: string): Promise<Uint8Array> {
  throw new Error('Encrypted backup is available only in a native development build.');
}

export async function benchmarkBackupKdf(_samples?: number): Promise<number[]> {
  throw new Error('The native backup KDF benchmark is unavailable in the browser preview.');
}
