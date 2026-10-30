export type SecureKeyAccessState =
  | 'temporarily-locked'
  | 'authentication-cancelled'
  | 'authentication-required'
  | 'key-unavailable-or-corrupt'
  | 'key-store-failure'
  | 'key-missing'
  | 'malformed-key'
  | 'catalog-missing'
  | 'portable-restore-required';

const STATE_MESSAGES: Record<SecureKeyAccessState, string> = {
  'temporarily-locked': 'Device key access is temporarily unavailable. Unlock the device, then retry.',
  'authentication-cancelled': 'Key access was cancelled. Retry key access or restore from an encrypted backup.',
  'authentication-required': 'Device authentication is required before local financial storage can be opened.',
  'key-unavailable-or-corrupt': 'The stored database key is unavailable or damaged. Existing encrypted files were preserved.',
  'key-store-failure': 'Secure key storage could not be read. Existing encrypted files were preserved.',
  'key-missing': 'The database key is missing or was invalidated. Existing encrypted files were preserved.',
  'malformed-key': 'Stored key data is malformed. Existing encrypted files were preserved.',
  'catalog-missing': 'The encrypted catalog is missing while local database files remain. Existing files were preserved.',
  'portable-restore-required': 'Local storage is locked until a valid encrypted portable backup is restored.',
};

const DATABASE_KEY_HEX = /^[0-9a-f]{64}$/;

/** A null key is creatable only when no database file exists at that path. */
export function resolveStoredDatabaseKey(value: string | null, databaseFileExists: boolean): string | null {
  if (value === null) {
    if (databaseFileExists) throw new SecureKeyAccessError('key-missing');
    return null;
  }
  if (!DATABASE_KEY_HEX.test(value)) throw new SecureKeyAccessError('malformed-key');
  return value;
}

export class SecureKeyAccessError extends Error {
  constructor(readonly state: SecureKeyAccessState) {
    super(STATE_MESSAGES[state]);
    this.name = 'SecureKeyAccessError';
  }
}

export function canReplaceStorageWithPortableBackup(error: unknown): error is SecureKeyAccessError {
  return error instanceof SecureKeyAccessError && [
    'key-missing', 'malformed-key', 'key-unavailable-or-corrupt', 'catalog-missing',
  ].includes(error.state);
}

/** Map only known native error states; never forward raw native details to UI or logs. */
export function classifySecureKeyAccessError(error: unknown): SecureKeyAccessError {
  const candidate = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code === 'ERR_AUTHENTICATION') {
    if (/cancel|dismiss|not authenticate/.test(message)) return new SecureKeyAccessError('authentication-cancelled');
    return new SecureKeyAccessError('authentication-required');
  }
  if (code === 'ERR_KEY_CHAIN' && /user canceled|user cancelled/.test(message)) {
    return new SecureKeyAccessError('authentication-cancelled');
  }
  if (code === 'ERR_KEY_CHAIN' && /authentication failed/.test(message)) {
    return new SecureKeyAccessError('authentication-required');
  }
  if (code === 'ERR_KEY_CHAIN'
    && /interaction is not allowed|no keychain.*available|keychain.*not available|device.*locked|user not authenticated/.test(message)) {
    return new SecureKeyAccessError('temporarily-locked');
  }
  if (code === 'ERR_DECRYPT') return new SecureKeyAccessError('key-unavailable-or-corrupt');
  return new SecureKeyAccessError('key-store-failure');
}
