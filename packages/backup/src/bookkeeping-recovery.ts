/**
 * Non-UI restore orchestration, verification, accounting parity and schema-version
 * handling for complete bookkeeping recovery (Story RECOVERY-003).
 *
 * Scope & Security Model (see docs/recovery/VALIDATION.md):
 * - Authenticate before Provision: A backup payload is strictly decrypted and validated
 *   before any candidate database is requested from the destination store.
 * - Isolated Candidate Lifecycle: Candidates are provisioned with fresh destination key
 *   identities, isolated from protected active stores, verified across complete rows
 *   and accounting reports, and returned in a closed, verified, unpublished state.
 * - Explicit Disposal: Failed or rejected candidates are safely disposed and keys wiped.
 *   Disposal failures are surfaced with context while preventing activation.
 * - Host Evidence Only: SQLite behavior is validated against real file-backed Node SQLite;
 *   does not certify native SQLCipher, Keychain/Keystore or physical-device recovery.
 * - Memory & Secret Hygiene: Passphrases and key material are never logged or embedded
 *   in error messages.
 */

import type { BookkeepingSqlDatabase } from '../../storage-native/src/bookkeeping-store';
import {
  ensureBookkeepingSchema,
  getBookkeepingSnapshotFromDatabase,
  journalBalanceReportFromDatabase,
  cashBasisReportFromDatabase,
  generalLedgerReportFromDatabase,
  type JournalBalanceReport,
  type CashBasisReport,
  type GeneralLedgerReport,
  type AccountReconciliationRecord,
} from '../../storage-native/src/bookkeeping-store';
import {
  BOOKKEEPING_DATASET_SCHEMA_VERSION,
  BookkeepingDatasetError,
  type BookkeepingDatasetSnapshot,
} from './bookkeeping-dataset';
import {
  exportBookkeepingDataset,
  verifyBookkeepingDatasetInDatabase,
  importBookkeepingDatasetIntoEmptyDatabase,
} from './bookkeeping-snapshot';
import {
  decryptBookkeepingBackupWithManifest,
  type BookkeepingBackupCrypto,
  type BookkeepingBackupManifest,
} from './bookkeeping-backup';

export const BOOKKEEPING_RECOVERY_REPORT_FROM_DATE = '1970-01-01';
export const BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE = '2099-12-31';

export type BookkeepingRecoveryErrorCode =
  | 'backup-rejected'
  | 'candidate-provision-failed'
  | 'candidate-not-isolated'
  | 'candidate-import-failed'
  | 'candidate-verification-failed'
  | 'candidate-cleanup-failed'
  | 'lifecycle-violation'
  | 'unsupported-source-schema'
  | 'source-migration-failed';

export type BookkeepingRecoveryCandidateOutcome =
  | 'not-requested'
  | 'not-created'
  | 'not-touched'
  | 'disposed'
  | 'cleanup-failed';

export type BookkeepingRecoveryStage =
  | 'authenticate'
  | 'provision-candidate'
  | 'import'
  | 'reopen-candidate'
  | 'verification'
  | 'cleanup'
  | 'migrate-source';

export class BookkeepingRecoveryError extends Error {
  readonly code: BookkeepingRecoveryErrorCode;
  readonly candidateOutcome: BookkeepingRecoveryCandidateOutcome;
  readonly stage?: BookkeepingRecoveryStage;
  readonly cleanupError?: unknown;
  readonly cause?: unknown;

  constructor(
    code: BookkeepingRecoveryErrorCode,
    message: string,
    options: {
      candidateOutcome: BookkeepingRecoveryCandidateOutcome;
      stage?: BookkeepingRecoveryStage;
      cause?: unknown;
      cleanupError?: unknown;
    },
  ) {
    super(message);
    this.name = 'BookkeepingRecoveryError';
    this.code = code;
    this.candidateOutcome = options.candidateOutcome;
    this.stage = options.stage;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    if (options.cleanupError !== undefined) {
      this.cleanupError = options.cleanupError;
    }
  }
}

export interface BookkeepingCandidateIdentity {
  candidateId: string;
  keyIdentity: string;
}

export interface BookkeepingCandidateConnection {
  database: BookkeepingSqlDatabase;
  close: () => Promise<void>;
}

export interface BookkeepingCandidateStore {
  provision(): Promise<BookkeepingCandidateIdentity>;
  open(identity: BookkeepingCandidateIdentity): Promise<BookkeepingCandidateConnection>;
  dispose(identity: BookkeepingCandidateIdentity): Promise<void>;
}

export interface BookkeepingProtectedIdentities {
  candidateIds?: readonly string[];
  keyIdentities?: readonly string[];
}

export interface BookkeepingRecoveryOptions {
  crypto: BookkeepingBackupCrypto;
  candidateStore: BookkeepingCandidateStore;
  protectedIdentities?: BookkeepingProtectedIdentities;
}

export type BookkeepingRecoveryCandidateState =
  | 'verified-unpublished'
  | 'handed-off'
  | 'discard-failed'
  | 'discarded';

export interface BookkeepingBusinessAccounting {
  businessId: string;
  businessName: string;
  journalBalance: JournalBalanceReport;
  cashBasis: CashBasisReport;
  generalLedgers: GeneralLedgerReport[];
  reconciliations: AccountReconciliationRecord[];
}

export interface BookkeepingAccountingSummary {
  journalEntryCount: number;
  journalLineCount: number;
  totalDebitsCents: bigint;
  totalCreditsCents: bigint;
  businesses: BookkeepingBusinessAccounting[];
}

const genuineSnapshots = new WeakMap<AuthenticatedBookkeepingBackup, BookkeepingDatasetSnapshot>();
const stagedInstances = new WeakSet<AuthenticatedBookkeepingBackup>();
const releasedInstances = new WeakSet<AuthenticatedBookkeepingBackup>();

export class AuthenticatedBookkeepingBackup {
  readonly manifest: BookkeepingBackupManifest;

  constructor(manifest: BookkeepingBackupManifest, snapshot?: BookkeepingDatasetSnapshot) {
    this.manifest = manifest;
    if (snapshot) {
      genuineSnapshots.set(this, snapshot);
    }
  }

  release(): void {
    releasedInstances.add(this);
    genuineSnapshots.delete(this);
  }
}

export class BookkeepingRecoveryCandidate {
  readonly candidateId: string;
  readonly keyIdentity: string;
  readonly manifest: BookkeepingBackupManifest;
  readonly accounting: BookkeepingAccountingSummary;
  private readonly store: BookkeepingCandidateStore;
  private _state: BookkeepingRecoveryCandidateState = 'verified-unpublished';

  constructor(
    identity: BookkeepingCandidateIdentity,
    manifest: BookkeepingBackupManifest,
    accounting: BookkeepingAccountingSummary,
    store: BookkeepingCandidateStore,
  ) {
    this.candidateId = identity.candidateId;
    this.keyIdentity = identity.keyIdentity;
    this.manifest = manifest;
    this.accounting = accounting;
    this.store = store;
  }

  state(): BookkeepingRecoveryCandidateState {
    return this._state;
  }

  handOff(): BookkeepingCandidateIdentity {
    if (this._state !== 'verified-unpublished') {
      throw new BookkeepingRecoveryError(
        'lifecycle-violation',
        `Candidate cannot be handed off from state '${this._state}'.`,
        { candidateOutcome: 'not-touched' },
      );
    }
    this._state = 'handed-off';
    return { candidateId: this.candidateId, keyIdentity: this.keyIdentity };
  }

  async discard(): Promise<void> {
    if (this._state === 'handed-off' || this._state === 'discarded') {
      throw new BookkeepingRecoveryError(
        'lifecycle-violation',
        `Candidate cannot be discarded from state '${this._state}'.`,
        { candidateOutcome: 'not-touched' },
      );
    }
    try {
      await this.store.dispose({ candidateId: this.candidateId, keyIdentity: this.keyIdentity });
      this._state = 'discarded';
    } catch (error) {
      this._state = 'discard-failed';
      throw new BookkeepingRecoveryError(
        'candidate-cleanup-failed',
        error instanceof Error ? error.message : 'Candidate discard cleanup failed.',
        {
          candidateOutcome: 'cleanup-failed',
          stage: 'cleanup',
          cleanupError: error,
        },
      );
    }
  }
}

/**
 * Authenticates and strictly validates a portable bookkeeping backup payload before
 * requesting any candidate database from destination storage.
 */
export async function authenticateBookkeepingBackupForRecovery(
  backup: unknown,
  passphrase: string,
  crypto: BookkeepingBackupCrypto,
): Promise<AuthenticatedBookkeepingBackup> {
  try {
    const { snapshot, manifest } = await decryptBookkeepingBackupWithManifest(backup, passphrase, crypto);
    return new AuthenticatedBookkeepingBackup(manifest, snapshot);
  } catch (error) {
    if (error instanceof BookkeepingRecoveryError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Backup authentication failed.';
    throw new BookkeepingRecoveryError('backup-rejected', message, {
      candidateOutcome: 'not-requested',
      stage: 'authenticate',
      cause: error,
    });
  }
}

/**
 * Reads accounting reports, general ledgers, trial balance, cash basis, and reconciliations
 * to verify complete financial parity.
 */
export async function readBookkeepingAccountingSummary(
  database: BookkeepingSqlDatabase,
): Promise<BookkeepingAccountingSummary> {
  const businesses = await database.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM businesses ORDER BY created_at, id',
  );

  const businessSummaries: BookkeepingBusinessAccounting[] = [];
  for (const business of businesses) {
    const journalBalance = await journalBalanceReportFromDatabase(
      database,
      business.id,
      BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE,
    );
    const cashBasis = await cashBasisReportFromDatabase(
      database,
      business.id,
      BOOKKEEPING_RECOVERY_REPORT_FROM_DATE,
      BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE,
    );
    const generalLedgers: GeneralLedgerReport[] = [];
    for (const line of journalBalance.trialBalance) {
      generalLedgers.push(
        await generalLedgerReportFromDatabase(
          database,
          business.id,
          line.accountId,
          BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE,
        ),
      );
    }
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, business.id);
    const reconciliations = snapshot?.accountReconciliations ?? [];
    businessSummaries.push({
      businessId: business.id,
      businessName: business.name,
      journalBalance,
      cashBasis,
      generalLedgers,
      reconciliations,
    });
  }

  const counts = await database.getFirstAsync<{ entryCount: number; lineCount: number }>(
    `SELECT
      (SELECT COUNT(*) FROM journal_entries) AS entryCount,
      (SELECT COUNT(*) FROM journal_lines) AS lineCount`,
  );
  const lines = await database.getAllAsync<{ debit_minor: string; credit_minor: string }>(
    'SELECT debit_minor, credit_minor FROM journal_lines',
  );
  let totalDebitsCents = 0n;
  let totalCreditsCents = 0n;
  for (const line of lines) {
    totalDebitsCents += BigInt(line.debit_minor);
    totalCreditsCents += BigInt(line.credit_minor);
  }

  return {
    journalEntryCount: Number(counts?.entryCount ?? 0),
    journalLineCount: Number(counts?.lineCount ?? 0),
    totalDebitsCents,
    totalCreditsCents,
    businesses: businessSummaries,
  };
}

/**
 * Asserts that journal entries and reconciliation reports are fully balanced across the books.
 */
export function assertBookkeepingAccountingBalanced(accounting: BookkeepingAccountingSummary): void {
  if (accounting.totalDebitsCents !== accounting.totalCreditsCents) {
    throw new BookkeepingDatasetError(
      'restore-verification-failed',
      `Journal total debits (${accounting.totalDebitsCents}) do not match total credits (${accounting.totalCreditsCents}).`,
    );
  }
  for (const business of accounting.businesses) {
    if (business.journalBalance.totalDebitsCents !== business.journalBalance.totalCreditsCents) {
      throw new BookkeepingDatasetError(
        'restore-verification-failed',
        `Trial balance does not balance for business ${business.businessId}.`,
      );
    }
    if (business.journalBalance.balanceSheet.differenceCents !== 0n) {
      throw new BookkeepingDatasetError(
        'restore-verification-failed',
        `Balance sheet difference is not zero for business ${business.businessId}.`,
      );
    }
    if (business.cashBasis.netIncomeCents !== business.journalBalance.balanceSheet.currentEarningsCents) {
      throw new BookkeepingDatasetError(
        'restore-verification-failed',
        `Cash basis net income does not match current earnings for business ${business.businessId}.`,
      );
    }
    for (const rec of business.reconciliations) {
      if (rec.status === 'completed' && rec.differenceCents !== 0n) {
        throw new BookkeepingDatasetError(
          'restore-verification-failed',
          `Completed reconciliation ${rec.id} has a non-zero difference of ${rec.differenceCents} cents.`,
        );
      }
    }
  }
}

/**
 * Stages an authenticated backup into an isolated fresh candidate database.
 */
export async function stageAuthenticatedBookkeepingRecovery(
  authenticated: AuthenticatedBookkeepingBackup,
  options: BookkeepingRecoveryOptions,
): Promise<BookkeepingRecoveryCandidate> {
  if (releasedInstances.has(authenticated) || !genuineSnapshots.has(authenticated) || stagedInstances.has(authenticated)) {
    throw new BookkeepingRecoveryError(
      'lifecycle-violation',
      'Authenticated backup is invalid, already staged, or released.',
      { candidateOutcome: 'not-requested' },
    );
  }

  const snapshot = genuineSnapshots.get(authenticated)!;
  stagedInstances.add(authenticated);

  let identity: BookkeepingCandidateIdentity;
  try {
    identity = await options.candidateStore.provision();
  } catch (error) {
    throw new BookkeepingRecoveryError(
      'candidate-provision-failed',
      error instanceof Error ? error.message : 'Candidate database provisioning failed.',
      {
        candidateOutcome: 'not-created',
        stage: 'provision-candidate',
        cause: error,
      },
    );
  }

  const protectedCandidates = new Set(options.protectedIdentities?.candidateIds ?? []);
  const protectedKeys = new Set(options.protectedIdentities?.keyIdentities ?? []);

  if (
    !identity.candidateId ||
    !identity.candidateId.trim() ||
    !identity.keyIdentity ||
    !identity.keyIdentity.trim() ||
    protectedCandidates.has(identity.candidateId) ||
    protectedKeys.has(identity.keyIdentity)
  ) {
    throw new BookkeepingRecoveryError(
      'candidate-not-isolated',
      'Candidate database identity or key identity is not isolated from protected active stores.',
      { candidateOutcome: 'not-touched', stage: 'provision-candidate' },
    );
  }

  let connection1: BookkeepingCandidateConnection;
  try {
    connection1 = await options.candidateStore.open(identity);
  } catch (openError) {
    const earlierError = new BookkeepingRecoveryError(
      'candidate-import-failed',
      openError instanceof Error ? openError.message : 'Failed to open candidate database for import.',
      { candidateOutcome: 'disposed', stage: 'import', cause: openError },
    );
    try {
      await options.candidateStore.dispose(identity);
    } catch (cleanupError) {
      throw new BookkeepingRecoveryError(
        'candidate-cleanup-failed',
        'Candidate disposal failed after open failure. The candidate database and key must not be activated.',
        { candidateOutcome: 'cleanup-failed', stage: 'cleanup', cause: earlierError, cleanupError },
      );
    }
    throw earlierError;
  }

  const existingObjects = await connection1.database.getAllAsync<{ type: string; name: string }>(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
  );
  if (existingObjects.length > 0) {
    await connection1.close();
    throw new BookkeepingRecoveryError(
      'candidate-not-isolated',
      'Candidate database is not empty. Bookkeeping recovery requires an isolated empty destination.',
      { candidateOutcome: 'not-touched', stage: 'provision-candidate' },
    );
  }

  try {
    await importBookkeepingDatasetIntoEmptyDatabase(connection1.database, snapshot);
    await connection1.close();
  } catch (importError) {
    const isVerification =
      (importError as { code?: string })?.code === 'restore-verification-failed' ||
      ((importError as { cause?: { code?: string } })?.cause?.code === 'restore-verification-failed');
    const code: BookkeepingRecoveryErrorCode = isVerification
      ? 'candidate-verification-failed'
      : 'candidate-import-failed';
    const rootCause = (importError as { cause?: unknown })?.cause ?? importError;
    const earlierError = new BookkeepingRecoveryError(
      code,
      importError instanceof Error ? importError.message : 'Candidate database import failed.',
      {
        candidateOutcome: 'disposed',
        stage: 'import',
        cause: rootCause,
      },
    );
    try {
      await options.candidateStore.dispose(identity);
    } catch (cleanupError) {
      throw new BookkeepingRecoveryError(
        'candidate-cleanup-failed',
        'Candidate disposal failed after import failure. The candidate database and key must not be activated.',
        {
          candidateOutcome: 'cleanup-failed',
          stage: 'cleanup',
          cause: earlierError,
          cleanupError,
        },
      );
    }
    throw earlierError;
  }

  let connection2: BookkeepingCandidateConnection;
  try {
    connection2 = await options.candidateStore.open(identity);
  } catch (reopenError) {
    const earlierError = new BookkeepingRecoveryError(
      'candidate-verification-failed',
      reopenError instanceof Error ? reopenError.message : 'Candidate database could not be reopened for verification.',
      { candidateOutcome: 'disposed', stage: 'reopen-candidate', cause: reopenError },
    );
    try {
      await options.candidateStore.dispose(identity);
    } catch (cleanupError) {
      throw new BookkeepingRecoveryError(
        'candidate-cleanup-failed',
        'Candidate disposal failed after reopen failure. The candidate database and key must not be activated.',
        { candidateOutcome: 'cleanup-failed', stage: 'cleanup', cause: earlierError, cleanupError },
      );
    }
    throw earlierError;
  }

  let accounting: BookkeepingAccountingSummary;
  try {
    await verifyBookkeepingDatasetInDatabase(connection2.database, snapshot);
    accounting = await readBookkeepingAccountingSummary(connection2.database);
    assertBookkeepingAccountingBalanced(accounting);
    await connection2.close();
  } catch (verifyError) {
    try {
      await connection2.close().catch(() => undefined);
    } catch {
      // ignore
    }
    const earlierError = new BookkeepingRecoveryError(
      'candidate-verification-failed',
      verifyError instanceof Error ? verifyError.message : 'Candidate verification failed.',
      {
        candidateOutcome: 'disposed',
        stage: 'verification',
        cause: verifyError,
      },
    );
    try {
      await options.candidateStore.dispose(identity);
    } catch (cleanupError) {
      throw new BookkeepingRecoveryError(
        'candidate-cleanup-failed',
        'Candidate disposal failed after verification failure. The candidate database and key must not be activated.',
        {
          candidateOutcome: 'cleanup-failed',
          stage: 'cleanup',
          cause: earlierError,
          cleanupError,
        },
      );
    }
    throw earlierError;
  }

  return new BookkeepingRecoveryCandidate(identity, authenticated.manifest, accounting, options.candidateStore);
}

/**
 * End-to-end recovery: authenticates backup and stages candidate into verified-unpublished state.
 */
export async function prepareBookkeepingRecoveryCandidate(
  backup: unknown,
  passphrase: string,
  options: BookkeepingRecoveryOptions,
): Promise<BookkeepingRecoveryCandidate> {
  const authenticated = await authenticateBookkeepingBackupForRecovery(backup, passphrase, options.crypto);
  return await stageAuthenticatedBookkeepingRecovery(authenticated, options);
}

export interface BookkeepingIsolatedCopy {
  database: BookkeepingSqlDatabase;
  dispose: () => Promise<void>;
}

export interface BookkeepingIsolatedCopyProvider {
  provisionIsolatedCopy(): Promise<BookkeepingIsolatedCopy>;
}

export interface ExportBookkeepingDatasetWithMigrationResult {
  sourceSchemaVersion: number;
  migratedOnIsolatedCopy: boolean;
  snapshot: BookkeepingDatasetSnapshot;
}

/**
 * Exports a bookkeeping dataset from a source database, applying existing migrations
 * only on an isolated temporary copy if the source is an older supported schema.
 * Source bytes are NEVER modified. Unsupported newer schemas fail closed.
 */
export async function exportBookkeepingDatasetWithIsolatedMigration(
  source: BookkeepingSqlDatabase,
  provider: BookkeepingIsolatedCopyProvider,
): Promise<ExportBookkeepingDatasetWithMigrationResult> {
  const metadata = await source.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'bookkeeping_schema'`,
  );
  if (!metadata || metadata.count !== 1) {
    throw new BookkeepingRecoveryError(
      'unsupported-source-schema',
      'The database does not contain a bookkeeping schema.',
      { candidateOutcome: 'not-requested' },
    );
  }

  const row = await source.getFirstAsync<{ singleton: number; version: number }>(
    'SELECT singleton, version FROM bookkeeping_schema WHERE singleton = 1',
  );
  if (!row || typeof row.version !== 'number' || row.version <= 0 || row.version > BOOKKEEPING_DATASET_SCHEMA_VERSION) {
    throw new BookkeepingRecoveryError(
      'unsupported-source-schema',
      'The source database schema version is unsupported or newer than supported.',
      { candidateOutcome: 'not-requested' },
    );
  }

  const version = row.version;
  if (version === BOOKKEEPING_DATASET_SCHEMA_VERSION) {
    const snapshot = await exportBookkeepingDataset(source);
    return {
      sourceSchemaVersion: 13,
      migratedOnIsolatedCopy: false,
      snapshot,
    };
  }

  const copy = await provider.provisionIsolatedCopy();
  const isSameAsSource =
    copy.database === source ||
    ('databasePath' in copy.database &&
      'databasePath' in source &&
      Boolean((copy.database as { databasePath: string }).databasePath) &&
      (copy.database as { databasePath: string }).databasePath === (source as { databasePath: string }).databasePath);

  if (isSameAsSource) {
    throw new BookkeepingRecoveryError(
      'candidate-not-isolated',
      'The isolated copy provider returned the source connection itself.',
      { candidateOutcome: 'not-touched' },
    );
  }

  let snapshot: BookkeepingDatasetSnapshot;
  try {
    await ensureBookkeepingSchema(copy.database);
    snapshot = await exportBookkeepingDataset(copy.database);
  } catch (error) {
    try {
      await copy.dispose();
    } catch {
      // ignore disposal failure during unwinding
    }
    throw new BookkeepingRecoveryError(
      'source-migration-failed',
      error instanceof Error ? error.message : 'Source migration failed on isolated copy.',
      {
        candidateOutcome: 'disposed',
        stage: 'migrate-source',
        cause: error,
      },
    );
  }

  try {
    await copy.dispose();
  } catch (cleanupError) {
    throw new BookkeepingRecoveryError(
      'candidate-cleanup-failed',
      'Disposal of the isolated migration copy failed.',
      {
        candidateOutcome: 'cleanup-failed',
        stage: 'cleanup',
        cleanupError,
      },
    );
  }

  return {
    sourceSchemaVersion: version,
    migratedOnIsolatedCopy: true,
    snapshot,
  };
}
