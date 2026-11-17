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

function databaseDirectory(): Directory {
  return new Directory(Paths.document, 'LLCBookKeepingPrivate');
}

/**
 * Native candidate store implementing candidate provisioning, encrypted database opening,
 * and candidate disposal using native platform storage.
 */
export class NativeBookkeepingCandidateStore implements BookkeepingCandidateStore {
  private candidateCounter = 0;

  async provision(): Promise<BookkeepingCandidateIdentity> {
    this.candidateCounter += 1;
    const randomBytes = await Crypto.getRandomBytesAsync(8);
    const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const candidateId = `candidate-${Date.now()}-${this.candidateCounter}-${hex}.db`;
    const keyAlias = `llcbookkeepingprivate.recovery-candidate-key.${candidateId}`;
    return {
      candidateId,
      keyIdentity: keyAlias,
    };
  }

  async open(identity: BookkeepingCandidateIdentity): Promise<BookkeepingCandidateConnection> {
    const databaseName = identity.candidateId;
    const keyAlias = identity.keyIdentity;
    const sqlite = await openEncryptedDatabase(databaseName, undefined, keyAlias);
    const lease = createDatabaseLease(sqlite);
    return {
      database: lease.database,
      close: async () => {
        await lease.release();
      },
    };
  }

  async dispose(identity: BookkeepingCandidateIdentity): Promise<void> {
    const directory = databaseDirectory();
    const file = new File(directory, identity.candidateId);
    if (file.exists) {
      file.delete();
    }
    await SecureStore.deleteItemAsync(identity.keyIdentity).catch(() => undefined);
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
