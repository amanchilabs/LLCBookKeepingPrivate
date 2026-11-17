/**
 * Native non-UI candidate store and recovery orchestration adapter (Story RECOVERY-003).
 *
 * Scope & Security Model (see docs/recovery/VALIDATION.md):
 * - Isolated Destination Key Provisioning: Candidate databases are provisioned with
 *   a fresh, destination-owned key in SecureStore. The source key is never reused.
 * - Non-UI & Zero Activation: Provides candidate creation, encrypted database opening
 *   under safe storage leases, and safe disposal. Does NOT wire UI controls, mutate
 *   the active database catalog, or perform active generation transitions.
 * - Reuses existing SQLCipher probe and open contracts via `openEncryptedDatabase`.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { openEncryptedDatabase } from '../../storage-native/src/encrypted-database';
import { createDatabaseLease } from '../../storage-native/src/database-lease';
import type {
  BookkeepingCandidateConnection,
  BookkeepingCandidateIdentity,
  BookkeepingCandidateStore,
  BookkeepingRecoveryCandidate,
  BookkeepingRecoveryOptions,
} from './bookkeeping-recovery';
import { prepareBookkeepingRecoveryCandidate } from './bookkeeping-recovery';
import { nativeBookkeepingBackupCrypto } from './native-bookkeeping-backup';

const CANDIDATE_ID_PATTERN = /^candidate-\d+-\d+-[0-9a-f]{16}\.db$/;
const KEY_ALIAS_PREFIX = 'llcbookkeepingprivate.recovery-candidate-key.';

function databaseDirectory(): Directory {
  return new Directory(Paths.document, 'LLCBookKeepingPrivate');
}

/**
 * Native candidate store implementing candidate provisioning, encrypted database opening,
 * and candidate disposal using native platform storage.
 *
 * Invariants:
 * - Only internally issued candidate identities can be opened or disposed.
 * - No alias, path traversal, or active database access is permitted.
 * - Owned connections are tracked and closed before file deletion on disposal.
 * - Deletes owned database and all SQLite sidecars (WAL, SHM, rollback journal).
 * - Surfaces key, file, and connection close cleanup failures without falsely reporting disposed.
 */
export class NativeBookkeepingCandidateStore implements BookkeepingCandidateStore {
  private candidateCounter = 0;
  private readonly issuedIdentities = new Map<string, BookkeepingCandidateIdentity>();
  private readonly openLeases = new Map<string, Set<{ release: () => Promise<void> }>>();

  async provision(): Promise<BookkeepingCandidateIdentity> {
    this.candidateCounter += 1;
    const randomBytes = await Crypto.getRandomBytesAsync(8);
    const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const candidateId = `candidate-${Date.now()}-${this.candidateCounter}-${hex}.db`;
    if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
      throw new Error(`Provisioned candidate ID does not match expected pattern: ${candidateId}`);
    }
    const keyAlias = `${KEY_ALIAS_PREFIX}${candidateId}`;
    const identity: BookkeepingCandidateIdentity = {
      candidateId,
      keyIdentity: keyAlias,
    };
    this.issuedIdentities.set(candidateId, identity);
    return identity;
  }

  async open(identity: BookkeepingCandidateIdentity): Promise<BookkeepingCandidateConnection> {
    this.assertOwnedIdentity(identity, 'open');
    const databaseName = identity.candidateId;
    const keyAlias = identity.keyIdentity;
    const sqlite = await openEncryptedDatabase(databaseName, undefined, keyAlias);
    const lease = createDatabaseLease(sqlite);

    if (!this.openLeases.has(identity.candidateId)) {
      this.openLeases.set(identity.candidateId, new Set());
    }
    const candidateLeases = this.openLeases.get(identity.candidateId)!;
    candidateLeases.add(lease);

    let released = false;
    return {
      database: lease.database,
      close: async () => {
        if (released) return;
        released = true;
        candidateLeases.delete(lease);
        await lease.release();
      },
    };
  }

  async dispose(identity: BookkeepingCandidateIdentity): Promise<void> {
    this.assertOwnedIdentity(identity, 'dispose');

    let closeError: unknown = undefined;
    const candidateLeases = this.openLeases.get(identity.candidateId);
    if (candidateLeases && candidateLeases.size > 0) {
      for (const lease of [...candidateLeases]) {
        try {
          await lease.release();
          candidateLeases.delete(lease);
        } catch (err) {
          if (!closeError) closeError = err;
        }
      }
    }

    const directory = databaseDirectory();
    let fileError: unknown = undefined;
    const sidecars = ['', '-wal', '-shm', '-journal'];
    for (const ext of sidecars) {
      try {
        const file = new File(directory, `${identity.candidateId}${ext}`);
        if (file.exists) {
          file.delete();
        }
      } catch (err) {
        if (!fileError) fileError = err;
      }
    }

    let keyError: unknown = undefined;
    try {
      await SecureStore.deleteItemAsync(identity.keyIdentity);
    } catch (err) {
      keyError = err;
    }

    if (closeError || fileError || keyError) {
      const reasons = [
        closeError ? `connection close failed (${closeError instanceof Error ? closeError.message : String(closeError)})` : null,
        fileError ? `file deletion failed (${fileError instanceof Error ? fileError.message : String(fileError)})` : null,
        keyError ? `key deletion failed (${keyError instanceof Error ? keyError.message : String(keyError)})` : null,
      ].filter(Boolean).join('; ');
      throw new Error(`Candidate disposal failed: ${reasons}. The candidate database and key must not be activated.`);
    }

    this.issuedIdentities.delete(identity.candidateId);
    this.openLeases.delete(identity.candidateId);
  }

  private assertOwnedIdentity(identity: BookkeepingCandidateIdentity, operation: string): void {
    if (!identity || !identity.candidateId || typeof identity.candidateId !== 'string') {
      throw new Error(`Candidate store ${operation} rejected: candidateId is missing or invalid.`);
    }
    if (!identity.keyIdentity || typeof identity.keyIdentity !== 'string') {
      throw new Error(`Candidate store ${operation} rejected: keyIdentity is missing or invalid.`);
    }
    if (
      identity.candidateId.includes('..') ||
      identity.candidateId.includes('/') ||
      identity.candidateId.includes('\\')
    ) {
      throw new Error(`Candidate store ${operation} rejected: path traversal characters detected.`);
    }
    if (!CANDIDATE_ID_PATTERN.test(identity.candidateId)) {
      throw new Error(`Candidate store ${operation} rejected: candidateId '${identity.candidateId}' is not an internally formatted candidate ID.`);
    }
    const issued = this.issuedIdentities.get(identity.candidateId);
    if (!issued) {
      throw new Error(`Candidate store ${operation} rejected: candidateId '${identity.candidateId}' was not issued by this store instance.`);
    }
    if (issued.keyIdentity !== identity.keyIdentity) {
      throw new Error(`Candidate store ${operation} rejected: keyIdentity mismatch for candidateId '${identity.candidateId}'.`);
    }
  }
}

/**
 * Creates an instance of the native candidate store.
 */
export function createNativeBookkeepingCandidateStore(): BookkeepingCandidateStore {
  return new NativeBookkeepingCandidateStore();
}

/**
 * Orchestrates complete candidate recovery using the native candidate store and crypto.
 */
export async function createNativeBookkeepingRecoveryCandidate(
  backupBytes: unknown,
  passphrase: string,
  options?: Partial<BookkeepingRecoveryOptions>,
): Promise<BookkeepingRecoveryCandidate> {
  const store = options?.candidateStore ?? createNativeBookkeepingCandidateStore();
  const crypto = options?.crypto ?? nativeBookkeepingBackupCrypto;
  return await prepareBookkeepingRecoveryCandidate(backupBytes, passphrase, {
    candidateStore: store,
    crypto,
    protectedIdentities: options?.protectedIdentities,
  });
}
