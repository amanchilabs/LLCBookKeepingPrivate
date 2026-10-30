/**
 * Platform-independent ordering rules for replacing a local database with an
 * authenticated restore candidate. The store must make activation and rollback
 * durable atomic operations (the native store uses a SQLCipher catalog
 * transaction), and must not return a candidate until it is closed and valid.
 */
export interface RestoreActivation {
  activeGeneration: string;
  journal?: { previousGeneration: string; candidateGeneration: string };
}

export interface RestoreStore<Snapshot> {
  stageCandidate(snapshot: Snapshot): Promise<string>;
  getActivation(): Promise<RestoreActivation>;
  /** Atomically records the recovery journal and points active at candidate. */
  activate(previousGeneration: string, candidateGeneration: string): Promise<void>;
  /** Reopens the database and validates schema, integrity, and required data. */
  verifyGeneration(generation: string): Promise<void>;
  /** Atomically clears the journal after candidate verification. */
  finishActivation(): Promise<void>;
  /** Atomically restores the old active pointer and clears the journal. */
  rollback(previousGeneration: string): Promise<void>;
  /** Caller must only delete an inactive, verified-obsolete generation. */
  deleteGeneration(generation: string): Promise<void>;
}

export interface RestoreResult {
  activeGeneration: string;
  removedGeneration: string;
}

export async function restoreCandidate<Snapshot>(store: RestoreStore<Snapshot>, snapshot: Snapshot): Promise<RestoreResult> {
  const previous = (await store.getActivation()).activeGeneration;
  const candidate = await store.stageCandidate(snapshot);
  if (!candidate || candidate === previous) throw new Error('Restore candidate must use a separate generation.');

  await store.activate(previous, candidate);
  await store.verifyGeneration(candidate);
  await store.finishActivation();
  await store.deleteGeneration(previous);
  return { activeGeneration: candidate, removedGeneration: previous };
}

export type RestoreRecoveryResult = 'no-interrupted-restore' | 'completed-candidate' | 'rolled-back-to-original';

/**
 * Run before exposing financial storage at application startup. A durable
 * journal means the pointer transition committed but completion was interrupted.
 * Reopen and verify the candidate; finalize it only when every check succeeds.
 */
export async function recoverInterruptedRestore<Snapshot>(store: RestoreStore<Snapshot>): Promise<RestoreRecoveryResult> {
  const activation = await store.getActivation();
  const journal = activation.journal;
  if (!journal) return 'no-interrupted-restore';

  if (activation.activeGeneration !== journal.candidateGeneration) {
    throw new Error('Restore activation journal and active generation disagree; refusing to guess.');
  }

  try {
    await store.verifyGeneration(journal.candidateGeneration);
  } catch {
    await store.rollback(journal.previousGeneration);
    await store.deleteGeneration(journal.candidateGeneration);
    return 'rolled-back-to-original';
  }

  await store.finishActivation();
  await store.deleteGeneration(journal.previousGeneration);
  return 'completed-candidate';
}
