/**
 * Native non-UI candidate recovery orchestration adapter (Story RECOVERY-003).
 *
 * Scope & Security Model (see docs/recovery/VALIDATION.md):
 * - Native Candidate Storage On Hold: Default native candidate storage is explicitly
 *   held/unavailable fail-closed pending separately verified storage ownership, closure
 *   guarantees, and physical-device certification. This milestone certifies host generic
 *   restoration and accounting parity only; no native integration or device recovery is claimed.
 * - Zero Resource Effects: The fail-closed candidate store performs zero filesystem,
 *   Keychain/keystore, or database access, creation, or deletion.
 * - Non-UI & Zero Activation: Does NOT wire UI controls, mutate the active database catalog,
 *   or perform active generation transitions.
 * - Explicit Injected Store: `createNativeBookkeepingRecoveryCandidate` operates only when
 *   an explicit candidateStore is injected, running through the generic verified recovery core.
 *   An absent store fails closed.
 * - Native Crypto Reuse: Reuses `nativeBookkeepingBackupCrypto` for physical builds.
 */

import type {
  BookkeepingCandidateConnection,
  BookkeepingCandidateIdentity,
  BookkeepingCandidateStore,
  BookkeepingRecoveryCandidate,
  BookkeepingRecoveryOptions,
} from './bookkeeping-recovery';
import { prepareBookkeepingRecoveryCandidate } from './bookkeeping-recovery';
import { nativeBookkeepingBackupCrypto } from './native-bookkeeping-backup';

export const NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE =
  'Native bookkeeping candidate storage is unavailable pending verified storage ownership and device certification.';

/**
 * Explicitly unavailable fail-closed native candidate store.
 *
 * All operations (provision, open, dispose) reject with a fixed clear error.
 * Performs zero filesystem, Keychain, or database operations.
 */
export class NativeBookkeepingCandidateStore implements BookkeepingCandidateStore {
  async provision(): Promise<BookkeepingCandidateIdentity> {
    throw new Error(NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);
  }

  async open(_identity: BookkeepingCandidateIdentity): Promise<BookkeepingCandidateConnection> {
    throw new Error(NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);
  }

  async dispose(_identity: BookkeepingCandidateIdentity): Promise<void> {
    throw new Error(NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);
  }
}

/**
 * Creates an instance of the native candidate store (fail-closed, unavailable).
 */
export function createNativeBookkeepingCandidateStore(): BookkeepingCandidateStore {
  return new NativeBookkeepingCandidateStore();
}

/**
 * Orchestrates candidate recovery using the generic verified core and native crypto.
 *
 * When options.candidateStore is absent, defaults to createNativeBookkeepingCandidateStore()
 * which fails closed (zero resource effects). Operates only when an explicit candidateStore
 * is injected.
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
