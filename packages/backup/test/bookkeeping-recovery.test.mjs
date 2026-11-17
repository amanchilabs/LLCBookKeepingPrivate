// RECOVERY-003 host evidence: isolated restore orchestration, complete parity,
// failure injection and schema-version handling.
//
// Evidence boundaries:
// - SQL runs against real file-backed but PLAIN (unencrypted) SQLite via node:sqlite.
// - Backups are real PBKDF2-HMAC-SHA-256 (600,000 iterations) + AES-256-GCM
//   round trips through the Node WebCrypto adapter, never an identity mock.
// - The destination "key" is a synthetic identity held by a host keystore; it is
//   not applied to the SQLite file. Native SQLCipher, QuickCrypto, Keychain or
//   Keystore, crash durability and physical-device recovery are NOT exercised.
// - `native-bookkeeping-recovery.ts` is explicitly unavailable fail-closed; host
//   tests verify zero resource effects and default rejection via static check
//   and in-memory evaluation.
// - All data is synthetic.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cashBasisReportFromDatabase,
  cashMovementReportFromDatabase,
  generalLedgerReportFromDatabase,
  getBookkeepingSnapshotFromDatabase,
  journalBalanceReportFromDatabase,
} from '../../storage-native/src/bookkeeping-store.ts';
import { BOOKKEEPING_DATASET_TABLES, compareBookkeepingDatasets } from '../src/bookkeeping-dataset.ts';
import { exportBookkeepingDataset } from '../src/bookkeeping-snapshot.ts';
import { BookkeepingBackupError, createBookkeepingBackup } from '../src/bookkeeping-backup.ts';
import {
  AuthenticatedBookkeepingBackup,
  BOOKKEEPING_RECOVERY_REPORT_FROM_DATE,
  BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE,
  BookkeepingRecoveryError,
  assertBookkeepingAccountingBalanced,
  authenticateBookkeepingBackupForRecovery,
  exportBookkeepingDatasetWithIsolatedMigration,
  prepareBookkeepingRecoveryCandidate,
  readBookkeepingAccountingSummary,
  stageAuthenticatedBookkeepingRecovery,
} from '../src/bookkeeping-recovery.ts';
import { createNodeBookkeepingCryptoAdapter } from './bookkeeping-crypto-adapter.ts';
import {
  ACTIVE_DESTINATION_FILES,
  ACTIVE_DESTINATION_IDENTITY,
  ALPHA,
  BETA,
  HostCandidateStore,
  HostDatabase,
  HostIsolatedCopyProvider,
  LARGE_PROPERTY_CENTS,
  LEGACY,
  SOURCE_KEY_IDENTITY,
  UNICODE_DESCRIPTION,
  copyOfFile,
  createHostDestination,
  createSeededFile,
  destinationState,
  removeAllDirectories,
  schemaVersionOfFile,
  seedActiveDestinationBooks,
  seedLegacyV8Books,
  seedRecoveryBooks,
  sha256File,
} from './bookkeeping-recovery-fixture.mjs';

const PASSPHRASE = 'SyntheticRecoveryPassphrase2026!';
const WRONG_PASSPHRASE = 'ADifferentSyntheticPassphrase2026!';
const SETUP_TIMEOUT_MS = 120_000;
const CRYPTO_TEST_TIMEOUT_MS = 60_000;

const crypto = createNodeBookkeepingCryptoAdapter();
const openDatabases = [];
const stores = [];

let sourcePath;
let sourceSnapshot;
let backupBytes;
let activeTemplatePath;

function openFile(path) {
  const database = new HostDatabase(path);
  openDatabases.push(database);
  return database;
}

async function exportFromFile(path) {
  const database = openFile(path);
  try {
    return await exportBookkeepingDataset(database);
  } finally {
    database.close();
  }
}

async function rejectionOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('test expectation: the operation should have been rejected');
}

function tableOf(snapshot, name) {
  return snapshot.tables.find((table) => table.name === name);
}

function columnValues(snapshot, tableName, columnName) {
  const table = tableOf(snapshot, tableName);
  const index = table.columns.indexOf(columnName);
  if (index < 0) throw new Error(`test fixture: unknown column ${tableName}.${columnName}`);
  return table.rows.map((row) => row[index]);
}

/** A destination with an existing ACTIVE database, plus everything a failure must leave untouched. */
function newScenario(storeOptions = {}) {
  const destination = createHostDestination(activeTemplatePath);
  const store = new HostCandidateStore(destination, storeOptions);
  stores.push(store);
  return {
    destination,
    store,
    before: destinationState(destination),
    sourceSha256: sha256File(sourcePath),
    backupCopy: Uint8Array.from(backupBytes),
  };
}

function recoveryOptions(store, cryptoAdapter = crypto) {
  return {
    crypto: cryptoAdapter,
    candidateStore: store,
    protectedIdentities: {
      candidateIds: [ACTIVE_DESTINATION_IDENTITY.candidateId],
      keyIdentities: [ACTIVE_DESTINATION_IDENTITY.keyIdentity, SOURCE_KEY_IDENTITY],
    },
  };
}

/** The source, the backup bytes, the active database and its pointer are byte-identical; nothing was published. */
function expectNothingChanged(scenario, leftoverCandidateFiles = []) {
  const after = destinationState(scenario.destination);
  expect(after.activeSha256).toBe(scenario.before.activeSha256);
  expect(after.activePointer).toBe(scenario.before.activePointer);
  expect(after.files).toEqual([...ACTIVE_DESTINATION_FILES, ...leftoverCandidateFiles].sort());
  expect(sha256File(sourcePath)).toBe(scenario.sourceSha256);
  expect(backupBytes).toEqual(scenario.backupCopy);
}

function expectRecoveryError(error, code, candidateOutcome) {
  expect(error).toBeInstanceOf(BookkeepingRecoveryError);
  expect(error.code).toBe(code);
  expect(error.candidateOutcome).toBe(candidateOutcome);
  expect(error.message).not.toContain(PASSPHRASE);
}

const ALPHA_PERIODS = [
  ['2024-01-01', '2024-01-31'],
  ['2024-02-01', '2024-02-29'],
  ['2024-01-01', '2024-12-31'],
  [BOOKKEEPING_RECOVERY_REPORT_FROM_DATE, BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE],
];
const ALPHA_AS_OF = ['2024-01-31', '2024-02-29', '2024-12-31'];
const BETA_PERIODS = [['2023-07-01', '2023-12-31'], [BOOKKEEPING_RECOVERY_REPORT_FROM_DATE, BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE]];
const BETA_AS_OF = ['2023-08-31', '2023-12-31'];

/** Existing report functions only; none of them migrates or writes. */
async function collectReports(database, businessId, periods, asOfDates) {
  const reports = { cashBasis: [], cashMovement: [], journalBalance: [], generalLedger: [] };
  for (const [fromDate, throughDate] of periods) {
    reports.cashBasis.push(await cashBasisReportFromDatabase(database, businessId, fromDate, throughDate));
    reports.cashMovement.push(await cashMovementReportFromDatabase(database, businessId, fromDate, throughDate));
  }
  for (const asOfDate of asOfDates) {
    const journalBalance = await journalBalanceReportFromDatabase(database, businessId, asOfDate);
    reports.journalBalance.push(journalBalance);
    for (const line of journalBalance.trialBalance) {
      reports.generalLedger.push(await generalLedgerReportFromDatabase(database, businessId, line.accountId, asOfDate));
    }
  }
  return reports;
}

const byKey = (key) => (left, right) => (left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0);

/** Lists the existing store orders by SQLite rowid (insertion order), which format 1 does not carry. */
function withRowidOrderedListsSorted(snapshot) {
  return {
    ...snapshot,
    members: [...snapshot.members].sort(byKey('id')),
    memberHistory: [...snapshot.memberHistory].sort((left, right) => byKey('id')(left, right) || byKey('effectiveFrom')(left, right)),
    memberCapitalSummaries: [...snapshot.memberCapitalSummaries].sort(byKey('memberId')),
    accountReconciliationEvents: [...snapshot.accountReconciliationEvents].sort(byKey('id')),
    accountingPeriodEvents: [...snapshot.accountingPeriodEvents].sort(byKey('id')),
  };
}

beforeAll(async () => {
  sourcePath = await createSeededFile(seedRecoveryBooks, 'source-books.db');
  sourceSnapshot = await exportFromFile(copyOfFile(sourcePath));
  backupBytes = await createBookkeepingBackup(sourceSnapshot, PASSPHRASE, crypto);
  activeTemplatePath = await createSeededFile(seedActiveDestinationBooks, 'active-books.db');
}, SETUP_TIMEOUT_MS);

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close();
  for (const store of stores.splice(0)) store.closeAll();
});

afterAll(() => {
  removeAllDirectories();
});

describe('synthetic recovery fixture', () => {
  it('covers every supported table, both workspaces and every history kind through existing store APIs', () => {
    expect(sourceSnapshot.tables.map((table) => table.name)).toEqual(BOOKKEEPING_DATASET_TABLES.map((table) => table.name));
    expect(sourceSnapshot.tables).toHaveLength(27);
    for (const table of sourceSnapshot.tables) {
      expect(table.rowCount, `${table.name} must be covered by the synthetic fixture`).toBeGreaterThan(0);
    }

    expect(columnValues(sourceSnapshot, 'businesses', 'id')).toEqual([ALPHA, BETA]);
    expect(new Set(columnValues(sourceSnapshot, 'accounts', 'business_id'))).toEqual(new Set([ALPHA, BETA]));
    expect(tableOf(sourceSnapshot, 'bookkeeping_preferences').rows).toEqual([['active_business_id', ALPHA]]);

    // Corrections keep the original and link a reversal and a replacement.
    expect(tableOf(sourceSnapshot, 'transaction_corrections').rowCount).toBe(2);
    expect(columnValues(sourceSnapshot, 'transaction_correction_roles', 'role').sort())
      .toEqual(['replacement', 'replacement', 'reversal', 'reversal']);
    expect(columnValues(sourceSnapshot, 'transactions', 'id')).toEqual(expect.arrayContaining([
      'alpha-expense-1', 'alpha-expense-1-reversal', 'alpha-expense-1-replacement',
      'alpha-transfer-1', 'alpha-transfer-1-reversal', 'alpha-transfer-1-replacement',
    ]));
    expect(new Set(columnValues(sourceSnapshot, 'transactions', 'kind'))).toEqual(new Set([
      'opening-balance', 'income', 'expense', 'reversal', 'transfer', 'loan-advance', 'loan-repayment',
    ]));
    expect(columnValues(sourceSnapshot, 'transactions', 'description')).toContain(UNICODE_DESCRIPTION);
    // Original split, the replacement's split.
    expect(new Set(columnValues(sourceSnapshot, 'transaction_splits', 'transaction_id')))
      .toEqual(new Set(['alpha-split-1', 'alpha-expense-1-replacement']));

    expect(new Set(columnValues(sourceSnapshot, 'member_capital_activity', 'activity_kind')))
      .toEqual(new Set(['cash-contribution', 'property-contribution', 'distribution']));
    expect(columnValues(sourceSnapshot, 'member_capital_activity', 'amount_minor')).toContain(LARGE_PROPERTY_CENTS.toString());
    expect(columnValues(sourceSnapshot, 'members', 'retired_at').filter((value) => value !== null)).toHaveLength(1);
    expect(tableOf(sourceSnapshot, 'member_interest_history').rowCount).toBe(8);

    expect(new Set(columnValues(sourceSnapshot, 'guaranteed_payment_obligations', 'classification')))
      .toEqual(new Set(['services', 'use-of-capital']));
    expect(tableOf(sourceSnapshot, 'guaranteed_payment_installments').rowCount).toBe(4);
    expect(tableOf(sourceSnapshot, 'guaranteed_payment_payments').rowCount).toBe(3);
    expect(tableOf(sourceSnapshot, 'guaranteed_payment_reversals').rowCount).toBe(1);

    expect(new Set(columnValues(sourceSnapshot, 'loan_agreements', 'lender_type'))).toEqual(new Set(['member', 'third-party']));
    expect(tableOf(sourceSnapshot, 'loan_advances').rowCount).toBe(2);
    expect(tableOf(sourceSnapshot, 'loan_repayments').rowCount).toBe(1);

    expect(columnValues(sourceSnapshot, 'recurring_transaction_templates', 'is_active').sort()).toEqual([0, 1]);
    expect(tableOf(sourceSnapshot, 'recurring_transaction_occurrences').rowCount).toBe(2);

    expect(columnValues(sourceSnapshot, 'account_reconciliations', 'status').sort()).toEqual(['completed', 'completed', 'draft']);
    expect(new Set(columnValues(sourceSnapshot, 'account_reconciliation_events', 'event_type')))
      .toEqual(new Set(['created', 'item-cleared', 'item-uncleared', 'completed', 'reopened']));
    expect(columnValues(sourceSnapshot, 'accounting_period_events', 'event_type').sort())
      .toEqual(['close', 'close', 'close', 'close', 'reopen']);
    expect(columnValues(sourceSnapshot, 'bookkeeping_reminders', 'is_complete').sort()).toEqual([0, 0, 0, 1]);
  });

  it('is reproducible except for the reconciliation event ids the store itself randomizes', async () => {
    const again = await exportFromFile(await createSeededFile(seedRecoveryBooks, 'source-again.db'));
    const eventsIndex = BOOKKEEPING_DATASET_TABLES.findIndex((table) => table.name === 'account_reconciliation_events');
    for (const [index, table] of sourceSnapshot.tables.entries()) {
      if (index === eventsIndex) continue;
      expect(again.tables[index], table.name).toEqual(table);
    }
    // account_reconciliation_events.id is `randomblob` in the existing store API.
    const withoutId = (snapshot) => snapshot.tables[eventsIndex].rows.map((row) => JSON.stringify(row.slice(1))).sort();
    expect(withoutId(again)).toEqual(withoutId(sourceSnapshot));
    expect(columnValues(again, 'account_reconciliation_events', 'id'))
      .not.toEqual(columnValues(sourceSnapshot, 'account_reconciliation_events', 'id'));
  });
});

describe('isolated recovery of a real encrypted backup', () => {
  it('authenticates before requesting a candidate, then restores into a fresh database under a destination key identity', async () => {
    const scenario = newScenario();
    const order = [];
    const recordingCrypto = {
      encryptBackupPayload: (plaintext, passphrase) => crypto.encryptBackupPayload(plaintext, passphrase),
      decryptBackupPayload: async (backup, passphrase) => {
        order.push('decrypt');
        expect(scenario.store.provisionCalls, 'no candidate may be requested before authentication').toBe(0);
        return await crypto.decryptBackupPayload(backup, passphrase);
      },
    };

    const candidate = await prepareBookkeepingRecoveryCandidate(
      backupBytes, PASSPHRASE, recoveryOptions(scenario.store, recordingCrypto),
    );
    expect([...order, ...scenario.store.events]).toEqual(['decrypt', 'provision', 'open', 'close', 'open', 'close']);

    // Explicit lifecycle state; the candidate is closed, separate and unpublished.
    expect(candidate.state()).toBe('verified-unpublished');
    expect(scenario.store.openConnections.size).toBe(0);
    expect(candidate.candidateId).not.toBe(ACTIVE_DESTINATION_IDENTITY.candidateId);
    expect(candidate.keyIdentity).not.toBe(SOURCE_KEY_IDENTITY);
    expect(candidate.keyIdentity).not.toBe(ACTIVE_DESTINATION_IDENTITY.keyIdentity);
    expect(scenario.store.keystore.has(candidate.keyIdentity)).toBe(true);
    expectNothingChanged(scenario, [candidate.candidateId]);

    // Complete rows, counts, references and integrity in the reopened file.
    const restoredPath = join(scenario.destination, candidate.candidateId);
    const restored = openFile(restoredPath);
    const restoredSnapshot = await exportBookkeepingDataset(restored);
    expect(compareBookkeepingDatasets(sourceSnapshot, restoredSnapshot)).toEqual([]);
    expect(restoredSnapshot).toEqual(sourceSnapshot);
    for (const table of sourceSnapshot.tables) {
      expect(candidate.manifest.tableRowCounts[table.name], table.name).toBe(table.rowCount);
      const counted = await restored.getFirstAsync(`SELECT COUNT(*) AS count FROM "${table.name}"`);
      expect(counted.count, table.name).toBe(table.rowCount);
    }
    expect(candidate.manifest.schemaVersion).toBe(13);
    expect(await restored.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await restored.getAllAsync('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(schemaVersionOfFile(restoredPath)).toBe(13);
    restored.close();

    // Discarding removes the database and its destination key; the active store never changed.
    await candidate.discard();
    expect(candidate.state()).toBe('discarded');
    expect(scenario.store.keystore.has(candidate.keyIdentity)).toBe(false);
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('reproduces the existing cash, P&L, balance, trial-balance and general-ledger reports exactly', async () => {
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store));
    const source = openFile(copyOfFile(sourcePath));
    const restored = openFile(join(scenario.destination, candidate.candidateId));

    for (const [businessId, periods, asOfDates] of [[ALPHA, ALPHA_PERIODS, ALPHA_AS_OF], [BETA, BETA_PERIODS, BETA_AS_OF]]) {
      const expected = await collectReports(source, businessId, periods, asOfDates);
      const actual = await collectReports(restored, businessId, periods, asOfDates);
      expect(expected.generalLedger.length, businessId).toBeGreaterThan(10);
      expect(expected.journalBalance[0].totalDebitsCents, businessId).toBeGreaterThan(0n);
      expect(actual, businessId).toEqual(expected);
      for (const report of actual.journalBalance) {
        expect(report.totalDebitsCents, businessId).toBe(report.totalCreditsCents);
        expect(report.balanceSheet.differenceCents, businessId).toBe(0n);
      }
    }

    // Hand-derived anchors from the fixture, checked on the RESTORED database.
    // Alpha January: income 250,000 + 40,000; expenses 13,000 + 30,000 + 7,500
    // (the 12,500 original and its reversal cancel).
    expect(await cashBasisReportFromDatabase(restored, ALPHA, '2024-01-01', '2024-01-31')).toEqual({
      incomeCents: 290_000n, expenseCents: 50_500n, netIncomeCents: 239_500n,
      fromDate: '2024-01-01', throughDate: '2024-01-31',
    });
    // Beta: income 20,000; expense 3,000; the owner distribution is not an expense.
    expect(await cashBasisReportFromDatabase(restored, BETA, '2023-07-01', '2023-12-31')).toEqual({
      incomeCents: 20_000n, expenseCents: 3_000n, netIncomeCents: 17_000n,
      fromDate: '2023-07-01', throughDate: '2023-12-31',
    });
    // Petty cash: 20,000 opening + 5,000 transfer - 5,000 reversal + 6,000 replacement.
    const petty = await generalLedgerReportFromDatabase(restored, ALPHA, 'alpha-petty', '2024-12-31');
    expect(petty.endingBalanceCents).toBe(26_000n);
    // Beta checking: 75,000 + 20,000 - 3,000 - 10,000; the overdraft line is a liability.
    const betaMovement = await cashMovementReportFromDatabase(restored, BETA, '2023-07-01', '2023-12-31');
    expect(betaMovement.accounts.find((account) => account.accountId === 'beta-checking').endingBalanceCents).toBe(82_000n);
    const betaBalance = await journalBalanceReportFromDatabase(restored, BETA, '2023-12-31');
    expect(betaBalance.balanceSheet.liabilities).toEqual([
      expect.objectContaining({ accountId: 'overdraft:beta-credit-line', balanceCents: 15_000n }),
    ]);
    // A value beyond 2^53 cents is exact in the restored trial balance.
    const alphaBalance = await journalBalanceReportFromDatabase(restored, ALPHA, '2024-12-31');
    expect(alphaBalance.trialBalance.find((line) => line.accountId === 'member-property:alpha-capital-property').debitCents)
      .toBe(LARGE_PROPERTY_CENTS);

    await candidate.discard();
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('reproduces the complete workspace snapshots, reconciliations and period history', async () => {
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store));
    const source = openFile(copyOfFile(sourcePath));
    const restored = openFile(join(scenario.destination, candidate.candidateId));

    // No business id: both resolve the same ACTIVE workspace preference.
    expect((await getBookkeepingSnapshotFromDatabase(restored)).business.id).toBe(ALPHA);
    expect((await getBookkeepingSnapshotFromDatabase(source)).business.id).toBe(ALPHA);

    for (const businessId of [ALPHA, BETA]) {
      const expected = await getBookkeepingSnapshotFromDatabase(source, businessId);
      const actual = await getBookkeepingSnapshotFromDatabase(restored, businessId);
      expect(withRowidOrderedListsSorted(actual), businessId).toEqual(withRowidOrderedListsSorted(expected));
    }

    const alpha = await getBookkeepingSnapshotFromDatabase(restored, ALPHA);
    expect(alpha.closedThroughDate).toBe('2024-02-29');
    expect(alpha.accountingPeriodEvents.filter((event) => event.isActive).map((event) => event.id).sort())
      .toEqual(['alpha-period-m-close-2', 'alpha-period-n-close-3']);
    const reconciliation = alpha.accountReconciliations.find((entry) => entry.id === 'alpha-rec-1');
    expect(reconciliation).toMatchObject({
      status: 'completed', beginningBalanceCents: 1_000_000n, endingBalanceCents: 1_252_500n,
      clearedMovementCents: 252_500n, differenceCents: 0n,
    });
    expect(alpha.accountReconciliations.find((entry) => entry.id === 'alpha-rec-2')).toMatchObject({
      status: 'draft', clearedMovementCents: -150_000n,
    });
    expect(alpha.accountReconciliationEvents.map((event) => event.eventType).sort()).toEqual([
      'completed', 'completed', 'created', 'created', 'item-cleared', 'item-cleared', 'item-cleared', 'item-cleared',
      'item-cleared', 'item-cleared', 'item-uncleared', 'reopened',
    ]);
    const corrected = alpha.transactions.find((transaction) => transaction.id === 'alpha-expense-1-replacement');
    expect(corrected).toMatchObject({ originalTransactionId: 'alpha-expense-1', correctionRole: 'replacement' });
    expect(alpha.transactions.find((transaction) => transaction.id === 'alpha-transfer-1-reversal').transferRole)
      .toBe('transfer-reversal');
    expect(alpha.guaranteedPaymentInstallments.find((entry) => entry.id === 'alpha-gp-services:installment:2'))
      .toMatchObject({ paidAmountCents: 0n, outstandingAmountCents: 150_000n });
    expect(alpha.memberHistory.filter((member) => member.id === 'member-kai')).toEqual([
      expect.objectContaining({ effectiveFrom: '2024-03-01', effectiveTo: '2024-03-24', retiredAt: '2024-03-25' }),
    ]);

    const beta = await getBookkeepingSnapshotFromDatabase(restored, BETA);
    expect(beta.closedThroughDate).toBe('2023-12-31');
    expect(beta.accountReconciliations).toEqual([expect.objectContaining({ id: 'beta-rec-1', status: 'completed', differenceCents: 0n })]);

    await candidate.discard();
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('KNOWN LIMIT: format 1 does not carry SQLite insertion order, so rowid-ordered lists come back in primary-key order', async () => {
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store));
    const source = await getBookkeepingSnapshotFromDatabase(openFile(copyOfFile(sourcePath)), ALPHA);
    const restored = await getBookkeepingSnapshotFromDatabase(openFile(join(scenario.destination, candidate.candidateId)), ALPHA);

    // The same records, in a different presentation order. See docs/recovery/VALIDATION.md.
    expect(source.members.map((member) => member.id)).toEqual(['member-zoe', 'member-adam']);
    expect(restored.members.map((member) => member.id)).toEqual(['member-adam', 'member-zoe']);
    expect(source.accountingPeriodEvents.map((event) => event.id)).toEqual([
      'alpha-period-z-close-1', 'alpha-period-a-reopen-1', 'alpha-period-m-close-2', 'alpha-period-n-close-3',
    ]);
    expect(restored.accountingPeriodEvents.map((event) => event.id)).toEqual([
      'alpha-period-a-reopen-1', 'alpha-period-m-close-2', 'alpha-period-n-close-3', 'alpha-period-z-close-1',
    ]);
    // Every event keeps its own timestamp, so chronological order remains derivable.
    const chronological = (events) => [...events].sort(byKey('createdAt')).map((event) => event.id);
    expect(chronological(restored.accountingPeriodEvents)).toEqual(source.accountingPeriodEvents.map((event) => event.id));
    expect(chronological(restored.accountingPeriodEvents)).toEqual(chronological(source.accountingPeriodEvents));

    await candidate.discard();
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('returns the accounting summary it verified, equal to the source and balanced', async () => {
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store));
    const expected = await readBookkeepingAccountingSummary(openFile(copyOfFile(sourcePath)));

    expect(candidate.accounting).toEqual(expected);
    expect(candidate.accounting.businesses.map((business) => business.businessId)).toEqual([ALPHA, BETA]);
    expect(candidate.accounting.journalEntryCount).toBe(tableOf(sourceSnapshot, 'journal_entries').rowCount);
    expect(candidate.accounting.journalLineCount).toBe(tableOf(sourceSnapshot, 'journal_lines').rowCount);
    expect(candidate.accounting.totalDebitsCents).toBe(candidate.accounting.totalCreditsCents);
    expect(candidate.accounting.totalDebitsCents).toBeGreaterThan(LARGE_PROPERTY_CENTS);
    expect(() => assertBookkeepingAccountingBalanced(candidate.accounting)).not.toThrow();
    for (const business of candidate.accounting.businesses) {
      expect(business.generalLedgers).toHaveLength(business.journalBalance.trialBalance.length);
      expect(business.cashBasis.netIncomeCents).toBe(business.journalBalance.balanceSheet.currentEarningsCents);
    }

    await candidate.discard();
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('enforces the lifecycle: one terminal transition, and a hand-off performs no activation', async () => {
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store));

    const identity = candidate.handOff();
    expect(identity).toEqual({ candidateId: candidate.candidateId, keyIdentity: candidate.keyIdentity });
    expect(candidate.state()).toBe('handed-off');
    // Hand-off touched nothing: the candidate still exists beside an unchanged active database.
    expectNothingChanged(scenario, [candidate.candidateId]);
    expect(scenario.store.disposeCalls).toBe(0);

    expectRecoveryError(await rejectionOf(candidate.discard()), 'lifecycle-violation', 'not-touched');
    expect(() => candidate.handOff()).toThrow(BookkeepingRecoveryError);
    expectNothingChanged(scenario, [candidate.candidateId]);

    const second = newScenario();
    const discarded = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(second.store));
    await discarded.discard();
    expectRecoveryError(await rejectionOf(discarded.discard()), 'lifecycle-violation', 'not-touched');
    expect(() => discarded.handOff()).toThrow(BookkeepingRecoveryError);
    expect(second.store.disposeCalls).toBe(1);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('stages only a genuinely authenticated backup, exactly once', async () => {
    const scenario = newScenario();
    const forged = new AuthenticatedBookkeepingBackup(
      { schemaVersion: 13, tableCount: 27, totalRowCount: 0, tableRowCounts: {} },
    );
    expectRecoveryError(
      await rejectionOf(stageAuthenticatedBookkeepingRecovery(forged, recoveryOptions(scenario.store))),
      'lifecycle-violation', 'not-requested',
    );
    expect(scenario.store.provisionCalls).toBe(0);

    // Runtime forgery attempt: passing a valid snapshot directly to the public constructor
    // must not brand plaintext as genuine; only authenticateBookkeepingBackupForRecovery may register it.
    const forgedWithSnapshot = new AuthenticatedBookkeepingBackup(
      { schemaVersion: 13, tableCount: 27, totalRowCount: sourceSnapshot.tables.reduce((sum, table) => sum + table.rowCount, 0), tableRowCounts: {} },
      sourceSnapshot,
    );
    expectRecoveryError(
      await rejectionOf(stageAuthenticatedBookkeepingRecovery(forgedWithSnapshot, recoveryOptions(scenario.store))),
      'lifecycle-violation', 'not-requested',
    );
    expect(scenario.store.provisionCalls).toBe(0);

    const authenticated = await authenticateBookkeepingBackupForRecovery(backupBytes, PASSPHRASE, crypto);
    expect(authenticated.manifest.totalRowCount).toBe(sourceSnapshot.tables.reduce((sum, table) => sum + table.rowCount, 0));
    const candidate = await stageAuthenticatedBookkeepingRecovery(authenticated, recoveryOptions(scenario.store));
    expectRecoveryError(
      await rejectionOf(stageAuthenticatedBookkeepingRecovery(authenticated, recoveryOptions(scenario.store))),
      'lifecycle-violation', 'not-requested',
    );
    expect(scenario.store.provisionCalls).toBe(1);
    await candidate.discard();

    const released = await authenticateBookkeepingBackupForRecovery(backupBytes, PASSPHRASE, crypto);
    released.release();
    expectRecoveryError(
      await rejectionOf(stageAuthenticatedBookkeepingRecovery(released, recoveryOptions(scenario.store))),
      'lifecycle-violation', 'not-requested',
    );
    expect(scenario.store.provisionCalls).toBe(1);
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);
});

describe('failure injection leaves the source, the backup and the active database untouched', () => {
  it('decrypt: a wrong passphrase, tampering or truncation never requests a candidate', async () => {
    const tampered = Uint8Array.from(backupBytes);
    tampered[tampered.length - 20] ^= 0x01;
    const attempts = [
      [backupBytes, WRONG_PASSPHRASE, 'authentication-failed'],
      [tampered, PASSPHRASE, 'authentication-failed'],
      [backupBytes.slice(0, backupBytes.length - 7), PASSPHRASE, 'envelope-corrupt'],
      [backupBytes, 'short', 'invalid-passphrase'],
    ];
    for (const [bytes, passphrase, causeCode] of attempts) {
      const scenario = newScenario();
      const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(bytes, passphrase, recoveryOptions(scenario.store)));
      expectRecoveryError(error, 'backup-rejected', 'not-requested');
      expect(error.stage).toBe('authenticate');
      expect(error.cause).toBeInstanceOf(BookkeepingBackupError);
      expect(error.cause.code, causeCode).toBe(causeCode);
      expect(scenario.store.events, causeCode).toEqual([]);
      expectNothingChanged(scenario);
    }
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('decrypt: authentic but unsupported payloads are rejected explicitly, including a legacy-schema payload', async () => {
    const encrypt = async (payload) => await crypto.encryptBackupPayload(new TextEncoder().encode(JSON.stringify(payload)), PASSPHRASE);
    const attempts = [
      // Legacy payload migration is NOT implemented: a schema-12 payload is refused, never upgraded.
      [await encrypt({ ...sourceSnapshot, schemaVersion: 12 }), 'unsupported-schema'],
      [await encrypt({ ...sourceSnapshot, schemaVersion: 14 }), 'unsupported-schema'],
      [await encrypt({ ...sourceSnapshot, formatVersion: 2 }), 'unsupported-format'],
      [await encrypt({ formatVersion: 1, schemaVersion: 1, records: [] }), 'proof-payload-rejected'],
      [await encrypt({ ...sourceSnapshot, tables: sourceSnapshot.tables.slice(1) }), 'malformed-payload'],
    ];
    for (const [bytes, causeCode] of attempts) {
      const scenario = newScenario();
      const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(bytes, PASSPHRASE, recoveryOptions(scenario.store)));
      expectRecoveryError(error, 'backup-rejected', 'not-requested');
      expect(error.cause.code, causeCode).toBe(causeCode);
      expect(scenario.store.events, causeCode).toEqual([]);
      expectNothingChanged(scenario);
    }
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('candidate provision: a provisioning failure creates and publishes nothing', async () => {
    const failure = new Error('synthetic injected provisioning failure');
    const scenario = newScenario({ failProvision: failure });
    const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
    expectRecoveryError(error, 'candidate-provision-failed', 'not-created');
    expect(error.stage).toBe('provision-candidate');
    expect(error.cause).toBe(failure);
    expect(scenario.store.events).toEqual(['provision']);
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('candidate provision: a candidate that is the active database or reuses a protected key is refused and never disposed', async () => {
    for (const provisionIdentity of [
      ACTIVE_DESTINATION_IDENTITY,
      { candidateId: 'fresh-candidate.db', keyIdentity: SOURCE_KEY_IDENTITY },
      { candidateId: 'fresh-candidate.db', keyIdentity: ACTIVE_DESTINATION_IDENTITY.keyIdentity },
      { candidateId: '', keyIdentity: 'synthetic-destination-key' },
    ]) {
      const scenario = newScenario({ provisionIdentity });
      const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
      expectRecoveryError(error, 'candidate-not-isolated', 'not-touched');
      // Never opened and, critically, never disposed: disposing would destroy the active database.
      expect(scenario.store.events).toEqual(['provision']);
      expectNothingChanged(scenario);
    }
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('candidate provision: a candidate that already holds data is refused unchanged and never disposed', async () => {
    const scenario = newScenario({ provisionIdentity: { candidateId: 'preexisting-books.db', keyIdentity: 'synthetic-other-key' } });
    const preexistingPath = join(scenario.destination, 'preexisting-books.db');
    const template = await createSeededFile(seedActiveDestinationBooks, 'preexisting.db');
    const filled = openFile(preexistingPath);
    await filled.execAsync(`ATTACH DATABASE '${template}' AS template; CREATE TABLE kept AS SELECT * FROM template.businesses; DETACH DATABASE template;`);
    filled.close();
    const preexistingSha256 = sha256File(preexistingPath);

    const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
    expectRecoveryError(error, 'candidate-not-isolated', 'not-touched');
    expect(scenario.store.disposeCalls).toBe(0);
    expect(scenario.store.openConnections.size).toBe(0);
    expect(sha256File(preexistingPath)).toBe(preexistingSha256);
    expectNothingChanged(scenario, ['preexisting-books.db']);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('schema, row import and in-transaction verification failures dispose the rejected candidate', async () => {
    const cases = [
      ['schema', { failExec: /CREATE TABLE IF NOT EXISTS businesses/ }, 'candidate-import-failed', true],
      ['row import', { failRun: { pattern: /^INSERT INTO "journal_lines"/, onCall: 5 } }, 'candidate-import-failed', true],
      ['verification', { corruptRead: /FROM "journal_lines"$/ }, 'candidate-verification-failed', false],
    ];
    for (const [label, faults, code, causeIsInjected] of cases) {
      const scenario = newScenario({ databaseFaults: (openCall) => (openCall === 1 ? faults : undefined) });
      const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
      expectRecoveryError(error, code, 'disposed');
      expect(error.stage, label).toBe('import');
      if (causeIsInjected) expect(error.cause.message, label).toBe('synthetic injected storage fault');
      else expect(error.cause.code, label).toBe('restore-verification-failed');
      expect(scenario.store.events, label).toEqual(['provision', 'open', 'close', 'dispose']);
      expect(scenario.store.keystore.size, label).toBe(0);
      expectNothingChanged(scenario);
    }
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('candidate provision: sqlite_master emptiness query failure closes connection and disposes candidate', async () => {
    const scenario = newScenario({
      databaseFaults: (openCall) => (openCall === 1 ? { failGetAll: /sqlite_master/ } : undefined),
    });
    const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
    expectRecoveryError(error, 'candidate-import-failed', 'disposed');
    expect(error.stage).toBe('import');
    expect(scenario.store.events).toEqual(['provision', 'open', 'close', 'dispose']);
    expect(scenario.store.keystore.size).toBe(0);
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('verification: a candidate that cannot be reopened, or changed after it was closed, is disposed', async () => {
    const unopenable = newScenario({ failOpenOnCall: 2 });
    const openError = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(unopenable.store)));
    expectRecoveryError(openError, 'candidate-verification-failed', 'disposed');
    expect(openError.stage).toBe('reopen-candidate');
    expect(unopenable.store.events).toEqual(['provision', 'open', 'close', 'open', 'dispose']);
    expectNothingChanged(unopenable);

    const changed = newScenario({
      beforeOpen: (openCall, path) => {
        if (openCall !== 2) return;
        const raw = new HostDatabase(path);
        raw.database.exec(`UPDATE businesses SET name = name || ' (changed after close)' WHERE id = '${BETA}';`);
        raw.close();
      },
    });
    const changedError = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(changed.store)));
    expectRecoveryError(changedError, 'candidate-verification-failed', 'disposed');
    expect(changedError.stage).toBe('verification');
    expect(changedError.cause.code).toBe('restore-verification-failed');
    expect(changed.store.events).toEqual(['provision', 'open', 'close', 'open', 'close', 'dispose']);
    expectNothingChanged(changed);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('verification: connection close failure during verification is not swallowed and surfaces cleanup-failed', async () => {
    const closeFailure = new Error('synthetic injected verification close failure');
    const scenario = newScenario({
      failCloseOnCall: 2,
      failClose: closeFailure,
    });
    const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
    expectRecoveryError(error, 'candidate-cleanup-failed', 'cleanup-failed');
    expect(error.stage).toBe('cleanup');
    expect(error.cleanupError).toBe(closeFailure);
    expect(scenario.store.events).toEqual(['provision', 'open', 'close', 'open', 'close', 'close', 'dispose']);
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('verification: an authentic backup whose journal or reconciliation totals do not balance is not eligible', async () => {
    const tamperings = [
      [`UPDATE journal_lines SET debit_minor = '249999' WHERE id = 'alpha-income-1-je:line:1';`, 'journal'],
      [`UPDATE account_reconciliations SET ending_minor = '91999' WHERE id = 'beta-rec-1';`, 'reconciliation'],
    ];
    for (const [sql, label] of tamperings) {
      const unbalancedPath = copyOfFile(sourcePath, `unbalanced-${label}.db`);
      const raw = openFile(unbalancedPath);
      raw.database.exec(sql);
      const unbalancedSnapshot = await exportBookkeepingDataset(raw);
      raw.close();
      // The rows are internally consistent and authenticate; only the accounting is wrong.
      const unbalancedBackup = await createBookkeepingBackup(unbalancedSnapshot, PASSPHRASE, crypto);

      const scenario = newScenario();
      const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(unbalancedBackup, PASSPHRASE, recoveryOptions(scenario.store)));
      expectRecoveryError(error, 'candidate-verification-failed', 'disposed');
      expect(error.stage, label).toBe('verification');
      expect(scenario.store.events, label).toEqual(['provision', 'open', 'close', 'open', 'close', 'dispose']);
      expectNothingChanged(scenario);
    }
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('verification: rejects authentic backup with two offsetting unbalanced journal entries in the same business', async () => {
    // In business Alpha, perturb two journal lines in different journal entries by offsetting amounts (+100 and -100).
    // Aggregate debits and credits across the business still balance, but individual journal entries do not balance.
    const unbalancedPath = copyOfFile(sourcePath, 'offsetting-unbalanced.db');
    const raw = openFile(unbalancedPath);
    raw.database.exec(`UPDATE journal_lines SET debit_minor = CAST(CAST(debit_minor AS INTEGER) + 100 AS TEXT) WHERE id = 'alpha-income-1-je:line:1';`);
    raw.database.exec(`UPDATE journal_lines SET credit_minor = CAST(CAST(credit_minor AS INTEGER) + 100 AS TEXT) WHERE id = 'alpha-expense-1-replacement-je:line:3';`);

    const accounting = await readBookkeepingAccountingSummary(raw);
    expect(accounting.totalDebitsCents).toBe(accounting.totalCreditsCents);
    const alphaSummary = accounting.businesses.find((business) => business.businessId === ALPHA);
    expect(alphaSummary.journalBalance.totalDebitsCents).toBe(alphaSummary.journalBalance.totalCreditsCents);
    expect(accounting.unbalancedJournalEntries.length).toBeGreaterThan(0);
    expect(() => assertBookkeepingAccountingBalanced(accounting)).toThrow(/does not balance/i);

    const unbalancedSnapshot = await exportBookkeepingDataset(raw);
    raw.close();

    const unbalancedBackup = await createBookkeepingBackup(unbalancedSnapshot, PASSPHRASE, crypto);
    const scenario = newScenario();
    const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(unbalancedBackup, PASSPHRASE, recoveryOptions(scenario.store)));
    expectRecoveryError(error, 'candidate-verification-failed', 'disposed');
    expect(error.stage).toBe('verification');
    expect(error.cause.code).toBe('restore-verification-failed');
    expect(error.cause.message).toMatch(/journal entry .* does not balance/i);
    expect(scenario.store.events).toEqual(['provision', 'open', 'close', 'open', 'close', 'dispose']);
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('cleanup: a failed disposal is surfaced with both failures and the candidate is never returned', async () => {
    const disposeFailure = new Error('synthetic injected disposal failure');
    const scenario = newScenario({
      failDispose: disposeFailure,
      databaseFaults: (openCall) => (openCall === 1 ? { failRun: { pattern: /^INSERT INTO "transactions"/, onCall: 2 } } : undefined),
    });
    const error = await rejectionOf(prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store)));
    expectRecoveryError(error, 'candidate-cleanup-failed', 'cleanup-failed');
    expect(error.stage).toBe('cleanup');
    expect(error.cleanupError).toBe(disposeFailure);
    expect(error.cause).toBeInstanceOf(BookkeepingRecoveryError);
    expect(error.cause.code).toBe('candidate-import-failed');
    expect(error.cause.cause.message).toBe('synthetic injected storage fault');
    expect(error.message).toMatch(/must not be activated/i);
    // The leftover is an unpublished file; the active database and pointer are unchanged.
    const leftover = destinationState(scenario.destination).files.filter((name) => name.startsWith('candidate-'));
    expect(leftover).toHaveLength(1);
    expectNothingChanged(scenario, leftover);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('cleanup: a failed discard of a verified candidate is surfaced and can be retried', async () => {
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE, recoveryOptions(scenario.store));
    const disposeFailure = new Error('synthetic injected disposal failure');
    scenario.store.options.failDispose = disposeFailure;

    const error = await rejectionOf(candidate.discard());
    expectRecoveryError(error, 'candidate-cleanup-failed', 'cleanup-failed');
    expect(error.cleanupError).toBe(disposeFailure);
    expect(candidate.state()).toBe('discard-failed');
    expect(() => candidate.handOff()).toThrow(BookkeepingRecoveryError);
    expectNothingChanged(scenario, [candidate.candidateId]);

    scenario.store.options.failDispose = undefined;
    await candidate.discard();
    expect(candidate.state()).toBe('discarded');
    expectNothingChanged(scenario);
  }, CRYPTO_TEST_TIMEOUT_MS);
});

describe('schema versions and legacy migration', () => {
  it('exports current-schema books directly without requesting an isolated copy', async () => {
    const path = copyOfFile(sourcePath, 'current.db');
    const before = sha256File(path);
    const provider = new HostIsolatedCopyProvider(path);
    const result = await exportBookkeepingDatasetWithIsolatedMigration(openFile(path), provider);
    expect(result.sourceSchemaVersion).toBe(13);
    expect(result.migratedOnIsolatedCopy).toBe(false);
    expect(result.snapshot).toEqual(sourceSnapshot);
    expect(provider.calls).toBe(0);
    expect(sha256File(path)).toBe(before);
  });

  it('migrates legacy schema-8 books with the existing migrations on an isolated copy only, then restores them with report parity', async () => {
    const legacyPath = await createSeededFile(seedLegacyV8Books, 'legacy-v8.db');
    const legacySha256 = sha256File(legacyPath);
    expect(schemaVersionOfFile(legacyPath)).toBe(8);
    const legacyPeriods = [['2022-01-01', '2022-12-31'], [BOOKKEEPING_RECOVERY_REPORT_FROM_DATE, BOOKKEEPING_RECOVERY_REPORT_THROUGH_DATE]];
    const legacyAsOf = ['2022-01-31', '2022-12-31'];
    const legacyReports = await collectReports(openFile(copyOfFile(legacyPath)), LEGACY, legacyPeriods, legacyAsOf);
    expect(legacyReports.cashBasis[0]).toMatchObject({ incomeCents: 120_000n, expenseCents: 91_000n, netIncomeCents: 29_000n });

    const provider = new HostIsolatedCopyProvider(legacyPath);
    const source = openFile(legacyPath);
    const result = await exportBookkeepingDatasetWithIsolatedMigration(source, provider);
    source.close();

    expect(result.sourceSchemaVersion).toBe(8);
    expect(result.migratedOnIsolatedCopy).toBe(true);
    expect(result.snapshot.schemaVersion).toBe(13);
    // The source is byte-identical and still legacy; the migrated copy is gone.
    expect(sha256File(legacyPath)).toBe(legacySha256);
    expect(schemaVersionOfFile(legacyPath)).toBe(8);
    expect(provider.calls).toBe(1);
    expect(provider.disposed).toBe(1);
    expect(destinationState.length).toBe(1);
    expect(tableOf(result.snapshot, 'transactions').rowCount).toBe(7);
    expect(tableOf(result.snapshot, 'transaction_corrections').rowCount).toBe(1);
    // Tables introduced by migrations 9-13 exist and are empty, not invented.
    for (const name of ['transaction_splits', 'recurring_transaction_templates', 'accounting_period_events', 'bookkeeping_reminders', 'bookkeeping_preferences']) {
      expect(tableOf(result.snapshot, name).rowCount, name).toBe(0);
    }

    const legacyBackup = await createBookkeepingBackup(result.snapshot, PASSPHRASE, crypto);
    const scenario = newScenario();
    const candidate = await prepareBookkeepingRecoveryCandidate(legacyBackup, PASSPHRASE, recoveryOptions(scenario.store));
    const restoredPath = join(scenario.destination, candidate.candidateId);
    expect(schemaVersionOfFile(restoredPath)).toBe(13);
    const restored = openFile(restoredPath);
    expect(await collectReports(restored, LEGACY, legacyPeriods, legacyAsOf)).toEqual(legacyReports);
    expect(compareBookkeepingDatasets(result.snapshot, await exportBookkeepingDataset(restored))).toEqual([]);
    expect(candidate.accounting.businesses[0].reconciliations).toEqual([
      expect.objectContaining({ id: 'legacy-rec-1', status: 'completed', differenceCents: 0n }),
    ]);
    await candidate.discard();
    expect(sha256File(legacyPath)).toBe(legacySha256);
  }, CRYPTO_TEST_TIMEOUT_MS);

  it('fails closed on a newer source schema and leaves its bytes unchanged', async () => {
    const newerPath = copyOfFile(sourcePath, 'newer.db');
    const raw = openFile(newerPath);
    raw.database.exec('UPDATE bookkeeping_schema SET version = 14 WHERE singleton = 1;');
    raw.close();
    const before = sha256File(newerPath);
    const provider = new HostIsolatedCopyProvider(newerPath);

    const error = await rejectionOf(exportBookkeepingDatasetWithIsolatedMigration(openFile(newerPath), provider));
    expectRecoveryError(error, 'unsupported-source-schema', 'not-requested');
    expect(provider.calls).toBe(0);
    expect(sha256File(newerPath)).toBe(before);
    expect(schemaVersionOfFile(newerPath)).toBe(14);
  });

  it('fails closed on a database without a bookkeeping schema or with an unusable version', async () => {
    const emptyPath = copyOfFile(sourcePath, 'no-schema.db');
    const raw = openFile(emptyPath);
    raw.database.exec('UPDATE bookkeeping_schema SET version = 0 WHERE singleton = 1;');
    raw.close();
    const before = sha256File(emptyPath);
    const provider = new HostIsolatedCopyProvider(emptyPath);
    const error = await rejectionOf(exportBookkeepingDatasetWithIsolatedMigration(openFile(emptyPath), provider));
    expectRecoveryError(error, 'unsupported-source-schema', 'not-requested');
    expect(provider.calls).toBe(0);
    expect(sha256File(emptyPath)).toBe(before);
  });

  it('refuses an "isolated copy" that is the source itself, without migrating or disposing it', async () => {
    const legacyPath = await createSeededFile(seedLegacyV8Books, 'legacy-v8.db');
    const legacySha256 = sha256File(legacyPath);
    const source = openFile(legacyPath);
    const provider = new HostIsolatedCopyProvider(legacyPath, { returnInstead: source });

    const error = await rejectionOf(exportBookkeepingDatasetWithIsolatedMigration(source, provider));
    expectRecoveryError(error, 'candidate-not-isolated', 'not-touched');
    expect(provider.disposed).toBe(0);
    source.close();
    expect(sha256File(legacyPath)).toBe(legacySha256);
    expect(schemaVersionOfFile(legacyPath)).toBe(8);
  });

  it('disposes the isolated copy when an existing migration fails, leaving the legacy source unchanged', async () => {
    const legacyPath = await createSeededFile(seedLegacyV8Books, 'legacy-v8.db');
    const legacySha256 = sha256File(legacyPath);
    const provider = new HostIsolatedCopyProvider(legacyPath, { faults: { failExec: /CREATE TABLE IF NOT EXISTS recurring_transaction_templates/ } });
    const source = openFile(legacyPath);

    const error = await rejectionOf(exportBookkeepingDatasetWithIsolatedMigration(source, provider));
    source.close();
    expectRecoveryError(error, 'source-migration-failed', 'disposed');
    expect(error.cause.message).toBe('synthetic injected storage fault');
    expect(provider.disposed).toBe(1);
    expect(sha256File(legacyPath)).toBe(legacySha256);
    expect(schemaVersionOfFile(legacyPath)).toBe(8);
  });

  it('surfaces a failed disposal of the isolated migration copy instead of returning a snapshot', async () => {
    const legacyPath = await createSeededFile(seedLegacyV8Books, 'legacy-v8.db');
    const legacySha256 = sha256File(legacyPath);
    const disposeFailure = new Error('synthetic injected copy disposal failure');
    const provider = new HostIsolatedCopyProvider(legacyPath, { failDispose: disposeFailure });
    const source = openFile(legacyPath);

    const error = await rejectionOf(exportBookkeepingDatasetWithIsolatedMigration(source, provider));
    source.close();
    expectRecoveryError(error, 'candidate-cleanup-failed', 'cleanup-failed');
    expect(error.cleanupError).toBe(disposeFailure);
    expect(sha256File(legacyPath)).toBe(legacySha256);
  });

  it('surfaces both migration error and cleanup error when copy disposal fails after migration failure', async () => {
    const legacyPath = await createSeededFile(seedLegacyV8Books, 'legacy-v8-dual-fail.db');
    const legacySha256 = sha256File(legacyPath);
    const disposeFailure = new Error('synthetic injected copy disposal failure after migration error');
    const provider = new HostIsolatedCopyProvider(legacyPath, {
      faults: { failExec: /CREATE TABLE IF NOT EXISTS recurring_transaction_templates/ },
      failDispose: disposeFailure,
    });
    const source = openFile(legacyPath);

    const error = await rejectionOf(exportBookkeepingDatasetWithIsolatedMigration(source, provider));
    source.close();
    expectRecoveryError(error, 'candidate-cleanup-failed', 'cleanup-failed');
    expect(error.stage).toBe('cleanup');
    expect(error.cleanupError).toBe(disposeFailure);
    expect(error.cause).toBeInstanceOf(BookkeepingRecoveryError);
    expect(error.cause.code).toBe('source-migration-failed');
    expect(error.cause.cause.message).toBe('synthetic injected storage fault');
    expect(sha256File(legacyPath)).toBe(legacySha256);
  });
});

describe('native integration boundary (fail-closed host mock and static source verification)', () => {
  const nativeSource = readFileSync(new URL('../src/native-bookkeeping-recovery.ts', import.meta.url), 'utf8');
  const pureSource = readFileSync(new URL('../src/bookkeeping-recovery.ts', import.meta.url), 'utf8');

  it('never registers, activates, rolls back or deletes a catalog generation and never touches the proof store or UI', () => {
    for (const forbidden of [
      'registerRestoreGeneration', 'activateRestoreGeneration', 'finishRestoreActivation', 'rollbackRestoreActivation',
      'deleteInactiveGeneration', 'ensureDatabaseCatalog', 'closeAllEncryptedDatabases', 'withStorageTransition',
      'withPortableBackupRestoreTransition', 'native-restore-store', 'restore-coordinator', 'native-portable-backup',
      'apps/mobile', 'react', 'expo-file-system', 'expo-secure-store', 'openEncryptedDatabase', 'createDatabaseLease',
    ]) {
      expect(nativeSource, forbidden).not.toContain(forbidden);
    }
  });

  it('keeps the orchestration free of native modules and of any key parameter', () => {
    for (const forbidden of ['expo-', 'react-native', 'SecureStore', 'keyHex', 'PRAGMA key']) {
      expect(pureSource, forbidden).not.toContain(forbidden);
    }
  });

  it('native candidate store contract: explicitly unavailable fail-closed with zero filesystem, keychain, or database effects', async () => {
    // Static boundary assertions: zero storage/filesystem/secure-store/database access
    expect(nativeSource).toContain('NativeBookkeepingCandidateStore');
    expect(nativeSource).toContain('createNativeBookkeepingCandidateStore');
    expect(nativeSource).toContain('createNativeBookkeepingRecoveryCandidate');
    expect(nativeSource).toContain('NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE');
    for (const forbidden of [
      'expo-file-system', 'expo-secure-store', 'Paths.document', 'deleteItemAsync',
      'openEncryptedDatabase', 'createDatabaseLease', 'issuedIdentities', 'openLeases',
    ]) {
      expect(nativeSource, forbidden).not.toContain(forbidden);
    }

    // In-memory host mock evaluation of the native module
    const jsSource = nativeSource
      .replace(/import type\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?/g, '')
      .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?/g, '')
      .replace(/export\s+const\s+/g, 'const ')
      .replace(/export\s+class\s+/g, 'class ')
      .replace(/export\s+function\s+/g, 'function ')
      .replace(/export\s+async\s+function\s+/g, 'async function ')
      .replace(/implements\s+BookkeepingCandidateStore/g, '')
      .replace(/: Promise<[^>]+>/g, '')
      .replace(/: BookkeepingCandidateStore/g, '')
      .replace(/: BookkeepingRecoveryCandidate/g, '')
      .replace(/options\?:\s*Partial<BookkeepingRecoveryOptions>/g, 'options')
      .replace(/backupBytes:\s*unknown/g, 'backupBytes')
      .replace(/passphrase:\s*string/g, 'passphrase')
      .replace(/_identity:\s*BookkeepingCandidateIdentity/g, '_identity');

    const exports = {};
    const moduleFn = new Function('prepareBookkeepingRecoveryCandidate', 'nativeBookkeepingBackupCrypto', 'exports', `
      ${jsSource}
      exports.NativeBookkeepingCandidateStore = NativeBookkeepingCandidateStore;
      exports.createNativeBookkeepingCandidateStore = createNativeBookkeepingCandidateStore;
      exports.createNativeBookkeepingRecoveryCandidate = createNativeBookkeepingRecoveryCandidate;
      exports.NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE = NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE;
    `);
    moduleFn(prepareBookkeepingRecoveryCandidate, crypto, exports);

    const store = exports.createNativeBookkeepingCandidateStore();
    expect(store).toBeInstanceOf(exports.NativeBookkeepingCandidateStore);

    // Default unavailability: provision, open, dispose all reject with fixed clear native-unavailable error
    await expect(store.provision()).rejects.toThrow(exports.NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);
    await expect(store.open({ candidateId: 'candidate-test.db', keyIdentity: 'test-key' })).rejects.toThrow(exports.NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);
    await expect(store.dispose({ candidateId: 'candidate-test.db', keyIdentity: 'test-key' })).rejects.toThrow(exports.NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);

    // Zero resource effects: mutating identity does not permit active key deletion or filesystem changes
    const activeIdentity = { candidateId: ACTIVE_DESTINATION_IDENTITY.candidateId, keyIdentity: ACTIVE_DESTINATION_IDENTITY.keyIdentity };
    await expect(store.dispose(activeIdentity)).rejects.toThrow(exports.NATIVE_CANDIDATE_STORE_UNAVAILABLE_MESSAGE);

    // createNativeBookkeepingRecoveryCandidate fails closed when candidateStore is absent
    await expect(
      exports.createNativeBookkeepingRecoveryCandidate(backupBytes, PASSPHRASE),
    ).rejects.toThrow();

    // createNativeBookkeepingRecoveryCandidate operates with explicit injected candidateStore through generic verified core
    const scenario = newScenario();
    const candidate = await exports.createNativeBookkeepingRecoveryCandidate(
      backupBytes,
      PASSPHRASE,
      { candidateStore: scenario.store, crypto },
    );
    expect(candidate.state()).toBe('verified-unpublished');
    await candidate.discard();
  });
});
