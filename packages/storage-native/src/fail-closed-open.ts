export interface CipherProbe {
  closeAsync(): Promise<void>;
}

/** Probe SQLCipher on an in-memory connection before any persistent path opens. */
export async function openOnlyAfterCipherProbe<Connection extends CipherProbe, Database>(
  openInMemory: () => Promise<Connection>,
  cipherIsAvailable: (connection: Connection) => Promise<boolean>,
  openPersistent: () => Promise<Database>,
): Promise<Database> {
  const probe = await openInMemory();
  let available = false;
  try {
    available = await cipherIsAvailable(probe);
  } finally {
    await probe.closeAsync();
  }
  if (!available) {
    throw new Error('SQLCipher is unavailable in this native build. Refusing to open persistent financial storage.');
  }
  return await openPersistent();
}
