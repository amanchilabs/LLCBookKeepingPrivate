// Deterministic SYNTHETIC fixtures and host-only adapters for the recovery tests.
//
// Host evidence only: `HostDatabase` is plain, unencrypted, file-backed SQLite
// (node:sqlite). `HostCandidateStore` models destination key provisioning with
// an in-memory synthetic keystore; the key is never applied to the SQLite file.
// Nothing here certifies native SQLCipher, Keychain/Keystore, crash durability
// or physical-device recovery. No real financial data is used.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import {
  closeAccountingPeriodInDatabase,
  completeAccountReconciliationInDatabase,
  completeBookkeepingReminderInDatabase,
  correctCashTransactionInDatabase,
  createAccountReconciliationInDatabase,
  createBusinessInDatabase,
  createCashAccountInDatabase,
  createCategoryAccountInDatabase,
  createGuaranteedPaymentObligationInDatabase,
  createLoanAgreementInDatabase,
  createRecurringTransactionInDatabase,
  ensureBookkeepingSchema,
  importCashTransactionsInDatabase,
  postRecurringTransactionInDatabase,
  recordCashTransactionInDatabase,
  recordGuaranteedPaymentInDatabase,
  recordLoanAdvanceInDatabase,
  recordLoanRepaymentInDatabase,
  recordMemberCapitalActivityInDatabase,
  recordSplitCashTransactionInDatabase,
  recordTransferInDatabase,
  reopenAccountReconciliationInDatabase,
  reopenAccountingPeriodInDatabase,
  replaceMembersInDatabase,
  reverseGuaranteedPaymentInDatabase,
  saveBookkeepingReminderInDatabase,
  setAccountReconciliationItemClearedInDatabase,
  setActiveBusinessInDatabase,
  setRecurringTransactionActiveInDatabase,
  updateRecurringTransactionInDatabase,
} from '../../storage-native/src/bookkeeping-store.ts';

export const ALPHA = 'business-alpha';
export const BETA = 'business-beta';
export const LEGACY = 'business-legacy';
/** Identity of the synthetic SOURCE device key. A restore must never use it. */
export const SOURCE_KEY_IDENTITY = 'synthetic-source-device-key';
/** Exceeds 2^53 cents; must survive backup, restore and every report exactly. */
export const LARGE_PROPERTY_CENTS = 9_007_199_254_740_993_123n;
export const UNICODE_DESCRIPTION = 'Café retainer — synthetic résumé 📒 "quoted", comma';

// ---------------------------------------------------------------------------
// Host SQLite adapter
// ---------------------------------------------------------------------------

export class HostDatabase {
  database;
  databasePath;
  closed = false;

  constructor(path) {
    this.databasePath = path;
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA foreign_keys = ON;');
  }

  async execAsync(sql) {
    this.database.exec(sql);
  }

  async runAsync(sql, ...parameters) {
    const result = this.database.prepare(sql).run(...parameters);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync(sql, ...parameters) {
    return this.database.prepare(sql).get(...parameters) ?? null;
  }

  async getAllAsync(sql, ...parameters) {
    return this.database.prepare(sql).all(...parameters);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }
}

/**
 * Host database with scripted faults. Only the matching statement fails or is
 * altered; every other statement (including rollback and cleanup) is real.
 *
 * faults: {
 *   failExec?: RegExp,                      // execAsync containing a match throws
 *   failRun?: { pattern: RegExp, onCall: number }, // the Nth matching runAsync throws
 *   corruptRead?: RegExp,                   // matching getAllAsync returns altered rows
 * }
 */
export class FaultInjectingHostDatabase extends HostDatabase {
  faults;
  injectedError = new Error('synthetic injected storage fault');
  matchingRuns = 0;

  constructor(path, faults = {}) {
    super(path);
    this.faults = faults;
  }

  async execAsync(sql) {
    if (this.faults.failExec && this.faults.failExec.test(sql)) throw this.injectedError;
    return await super.execAsync(sql);
  }

  async runAsync(sql, ...parameters) {
    if (this.faults.failRun && this.faults.failRun.pattern.test(sql)) {
      this.matchingRuns += 1;
      if (this.matchingRuns === this.faults.failRun.onCall) throw this.injectedError;
    }
    return await super.runAsync(sql, ...parameters);
  }

  async getAllAsync(sql, ...parameters) {
    if (this.faults.failGetAll && this.faults.failGetAll.test(sql)) throw this.injectedError;
    const rows = await super.getAllAsync(sql, ...parameters);
    if (this.faults.corruptRead && this.faults.corruptRead.test(sql) && rows.length > 0) {
      const [first, ...rest] = rows;
      return [{ ...first, debit_minor: `1${first.debit_minor}` }, ...rest];
    }
    return rows;
  }
}

// ---------------------------------------------------------------------------
// Temporary files
// ---------------------------------------------------------------------------

const directories = [];

export function newDirectory(label = 'recovery') {
  const directory = mkdtempSync(join(tmpdir(), `llc-bookkeeping-${label}-test-`));
  directories.push(directory);
  return directory;
}

export function removeAllDirectories() {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** A private copy, so reading it can never disturb the file under test. */
export function copyOfFile(path, name = 'copy.db') {
  const copy = join(newDirectory('copy'), name);
  copyFileSync(path, copy);
  return copy;
}

export function schemaVersionOfFile(path) {
  const database = new DatabaseSync(path);
  try {
    return database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version;
  } finally {
    database.close();
  }
}

// ---------------------------------------------------------------------------
// Deterministic clock
// ---------------------------------------------------------------------------

const CLOCK_START = Date.UTC(2024, 11, 1, 12, 0, 0);

/**
 * The store stamps rows with `new Date()`. Only `Date` is faked, and every
 * store call gets its own second, so `created_at` values are reproducible and
 * distinct. Real timers are restored before any cryptography runs.
 */
async function withDeterministicClock(run) {
  vi.useFakeTimers({ toFake: ['Date'] });
  let tick = 0;
  const step = async (operation) => {
    vi.setSystemTime(new Date(CLOCK_START + tick * 1000));
    tick += 1;
    return await operation();
  };
  try {
    return await run(step);
  } finally {
    vi.useRealTimers();
  }
}

// ---------------------------------------------------------------------------
// Complete multi-workspace books, created only through existing store APIs
// ---------------------------------------------------------------------------

/**
 * Two workspaces with at least one row in every one of the 27 dataset tables.
 *
 * Deliberate properties:
 * - Member ids are inserted in the opposite order to their primary-key order
 *   (`member-zoe` before `member-adam`), and a reopen event id sorts before
 *   the close event it targets, so insertion order and key order differ.
 * - Reconciliation event ids come from the store's own `randomblob`; they are
 *   the only values that are not reproducible between two seedings.
 * - The store has no loan-reversal workflow, so none can be seeded.
 */
export async function seedRecoveryBooks(database) {
  await withDeterministicClock(async (step) => {
    await step(() => ensureBookkeepingSchema(database));

    // ---- Workspace Alpha: multi-member LLC -------------------------------
    await step(() => createBusinessInDatabase(database, {
      id: ALPHA, name: 'Northstar Studio LLC', formationState: 'AZ', formationDate: '2023-11-15',
      bookkeepingStartDate: '2024-01-01', ownershipConfirmed: true,
      members: [
        { id: 'member-zoe', name: 'Zoe Lee', ownershipBasisPoints: 6_000 },
        { id: 'member-adam', name: 'Adam Morgan', ownershipBasisPoints: 4_000 },
      ],
    }));
    // ---- Workspace Beta: single-member LLC -------------------------------
    await step(() => createBusinessInDatabase(database, {
      id: BETA, name: 'Harbor Solo LLC', formationState: 'CA', formationDate: '2023-06-15',
      bookkeepingStartDate: '2023-07-01', ownershipConfirmed: true,
      members: [{ id: 'member-solo', name: 'Sam Rivera', ownershipBasisPoints: 10_000 }],
    }));

    // Accounts.
    await step(() => createCashAccountInDatabase(database, {
      id: 'alpha-checking', businessId: ALPHA, name: 'Operating checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 1_000_000n,
      openingTransactionId: 'alpha-open-checking', openingJournalEntryId: 'alpha-open-checking-je',
    }));
    await step(() => createCashAccountInDatabase(database, {
      id: 'alpha-petty', businessId: ALPHA, name: 'Petty cash', kind: 'cash',
      openingDate: '2024-01-01', openingBalanceCents: 20_000n,
      openingTransactionId: 'alpha-open-petty', openingJournalEntryId: 'alpha-open-petty-je',
    }));
    await step(() => createCategoryAccountInDatabase(database, {
      id: 'alpha-consulting', businessId: ALPHA, name: 'Consulting retainers', kind: 'income',
    }));
    await step(() => createCategoryAccountInDatabase(database, {
      id: 'alpha-insurance', businessId: ALPHA, name: 'Insurance', kind: 'expense',
    }));

    // Cash activity, a split, a transfer and a CSV-style import.
    await step(() => recordCashTransactionInDatabase(database, {
      id: 'alpha-income-1', journalEntryId: 'alpha-income-1-je', businessId: ALPHA, date: '2024-01-05',
      kind: 'income', accountId: 'alpha-checking', categoryAccountId: 'income-services',
      amountCents: 250_000n, description: UNICODE_DESCRIPTION,
    }));
    await step(() => recordCashTransactionInDatabase(database, {
      id: 'alpha-expense-1', journalEntryId: 'alpha-expense-1-je', businessId: ALPHA, date: '2024-01-08',
      kind: 'expense', accountId: 'alpha-checking', categoryAccountId: 'expense-supplies',
      amountCents: 12_500n, description: 'Synthetic supplies (to be corrected)',
    }));
    await step(() => recordSplitCashTransactionInDatabase(database, {
      id: 'alpha-split-1', journalEntryId: 'alpha-split-1-je', businessId: ALPHA, date: '2024-01-10',
      kind: 'expense', accountId: 'alpha-checking', amountCents: 30_000n, description: 'Synthetic split purchase',
      splits: [
        { categoryAccountId: 'expense-supplies', amountCents: 10_000n },
        { categoryAccountId: 'expense-rent', amountCents: 20_000n },
      ],
    }));
    await step(() => recordTransferInDatabase(database, {
      transactionId: 'alpha-transfer-1', journalEntryId: 'alpha-transfer-1-je', businessId: ALPHA,
      date: '2024-01-12', sourceAccountId: 'alpha-checking', destinationAccountId: 'alpha-petty',
      amountCents: 5_000n, description: 'Synthetic petty cash top-up (to be corrected)',
    }));
    await step(() => importCashTransactionsInDatabase(database, ALPHA, 'alpha-checking', [
      {
        id: 'alpha-import-1', journalEntryId: 'alpha-import-1-je', date: '2024-01-15', amountCents: 40_000n,
        categoryAccountId: 'alpha-consulting', description: 'Synthetic imported retainer',
      },
      {
        id: 'alpha-import-2', journalEntryId: 'alpha-import-2-je', date: '2024-01-15', amountCents: -7_500n,
        categoryAccountId: 'alpha-insurance', description: 'Synthetic imported premium',
      },
    ], false));

    // Corrections: original preserved, linked reversal and replacement.
    await step(() => correctCashTransactionInDatabase(database, {
      correctionId: 'alpha-correction-1', originalTransactionId: 'alpha-expense-1',
      reversalTransactionId: 'alpha-expense-1-reversal', reversalJournalEntryId: 'alpha-expense-1-reversal-je',
      replacement: {
        id: 'alpha-expense-1-replacement', journalEntryId: 'alpha-expense-1-replacement-je', businessId: ALPHA,
        date: '2024-01-08', kind: 'expense', accountId: 'alpha-checking', categoryAccountId: 'expense-supplies',
        amountCents: 13_000n, description: 'Synthetic supplies and software (corrected)',
      },
      replacementSplits: [
        { categoryAccountId: 'expense-supplies', amountCents: 9_000n },
        { categoryAccountId: 'expense-software', amountCents: 4_000n },
      ],
    }));
    await step(() => correctCashTransactionInDatabase(database, {
      correctionId: 'alpha-correction-2', originalTransactionId: 'alpha-transfer-1',
      reversalTransactionId: 'alpha-transfer-1-reversal', reversalJournalEntryId: 'alpha-transfer-1-reversal-je',
      replacement: {
        id: 'alpha-transfer-1-replacement', journalEntryId: 'alpha-transfer-1-replacement-je', businessId: ALPHA,
        date: '2024-01-12', kind: 'transfer', accountId: 'alpha-checking', categoryAccountId: 'alpha-petty',
        amountCents: 6_000n, description: 'Synthetic petty cash top-up (corrected)',
      },
    }));

    // Member capital: cash contribution, property contribution, distribution.
    await step(() => recordMemberCapitalActivityInDatabase(database, {
      id: 'alpha-capital-cash', journalEntryId: 'alpha-capital-cash-je', businessId: ALPHA, memberId: 'member-zoe',
      date: '2024-01-20', kind: 'cash-contribution', amountCents: 500_000n,
      description: 'Synthetic cash contribution', cashAccountId: 'alpha-checking',
    }));
    await step(() => recordMemberCapitalActivityInDatabase(database, {
      id: 'alpha-capital-property', journalEntryId: 'alpha-capital-property-je', businessId: ALPHA,
      memberId: 'member-adam', date: '2024-01-22', kind: 'property-contribution', amountCents: LARGE_PROPERTY_CENTS,
      description: 'Synthetic property contribution', propertyDescription: 'Synthetic studio equipment',
    }));
    await step(() => recordMemberCapitalActivityInDatabase(database, {
      id: 'alpha-capital-distribution', journalEntryId: 'alpha-capital-distribution-je', businessId: ALPHA,
      memberId: 'member-zoe', date: '2024-02-15', kind: 'distribution', amountCents: 50_000n,
      description: 'Synthetic member distribution', cashAccountId: 'alpha-checking',
    }));

    // Guaranteed payments: obligations, a full payment, a reversed partial
    // payment, and a second classification.
    await step(() => createGuaranteedPaymentObligationInDatabase(database, {
      id: 'alpha-gp-services', businessId: ALPHA, memberId: 'member-adam', classification: 'services',
      recurrence: 'monthly', firstDueDate: '2024-02-01', installmentCount: 3, installmentAmountCents: 150_000n,
      description: 'Synthetic services guaranteed payment',
    }));
    await step(() => recordGuaranteedPaymentInDatabase(database, {
      id: 'alpha-gp-pay-1', transactionId: 'alpha-gp-pay-1-txn', journalEntryId: 'alpha-gp-pay-1-je',
      businessId: ALPHA, memberId: 'member-adam', date: '2024-02-02', cashAccountId: 'alpha-checking',
      description: 'Synthetic guaranteed payment 1',
      allocations: [{ installmentId: 'alpha-gp-services:installment:1', amountCents: 150_000n }],
    }));
    await step(() => recordGuaranteedPaymentInDatabase(database, {
      id: 'alpha-gp-pay-2', transactionId: 'alpha-gp-pay-2-txn', journalEntryId: 'alpha-gp-pay-2-je',
      businessId: ALPHA, memberId: 'member-adam', date: '2024-03-04', cashAccountId: 'alpha-checking',
      description: 'Synthetic guaranteed payment 2 (to be reversed)',
      allocations: [{ installmentId: 'alpha-gp-services:installment:2', amountCents: 100_000n }],
    }));
    await step(() => reverseGuaranteedPaymentInDatabase(database, {
      id: 'alpha-gp-reversal-1', paymentId: 'alpha-gp-pay-2', reversalTransactionId: 'alpha-gp-pay-2-reversal-txn',
      reversalJournalEntryId: 'alpha-gp-pay-2-reversal-je', date: '2024-03-06',
      returnCashAccountId: 'alpha-checking', reason: 'Synthetic duplicate payment',
    }));
    await step(() => createGuaranteedPaymentObligationInDatabase(database, {
      id: 'alpha-gp-capital', businessId: ALPHA, memberId: 'member-zoe', classification: 'use-of-capital',
      recurrence: 'one-time', firstDueDate: '2024-03-15', installmentCount: 1, installmentAmountCents: 80_000n,
      description: 'Synthetic use-of-capital guaranteed payment',
    }));
    await step(() => recordGuaranteedPaymentInDatabase(database, {
      id: 'alpha-gp-pay-3', transactionId: 'alpha-gp-pay-3-txn', journalEntryId: 'alpha-gp-pay-3-je',
      businessId: ALPHA, memberId: 'member-zoe', date: '2024-03-15', cashAccountId: 'alpha-checking',
      description: 'Synthetic guaranteed payment 3',
      allocations: [{ installmentId: 'alpha-gp-capital:installment:1', amountCents: 80_000n }],
    }));

    // Loans: funded member loan with repayment; unfunded third-party commitment.
    await step(() => createLoanAgreementInDatabase(database, {
      id: 'alpha-loan-member', businessId: ALPHA, lenderType: 'member', memberId: 'member-zoe',
      agreementDate: '2024-02-05', commitmentCents: 2_000_000n, annualRateBasisPoints: 600, dayCount: 'ACT/365F',
      description: 'Synthetic member loan',
    }));
    await step(() => createLoanAgreementInDatabase(database, {
      id: 'alpha-loan-lender', businessId: ALPHA, lenderType: 'third-party', lenderName: 'Synthetic Lender Co',
      agreementDate: '2024-02-10', commitmentCents: 750_000n, annualRateBasisPoints: 0, dayCount: 'ACT/ACT ISDA',
      description: 'Synthetic unfunded commitment',
    }));
    await step(() => recordLoanAdvanceInDatabase(database, {
      id: 'alpha-loan-advance-1', transactionId: 'alpha-loan-advance-1-txn', journalEntryId: 'alpha-loan-advance-1-je',
      loanId: 'alpha-loan-member', date: '2024-02-06', cashAccountId: 'alpha-checking', amountCents: 1_200_000n,
      description: 'Synthetic loan advance 1',
    }));
    await step(() => recordLoanRepaymentInDatabase(database, {
      id: 'alpha-loan-repayment-1', transactionId: 'alpha-loan-repayment-1-txn',
      journalEntryId: 'alpha-loan-repayment-1-je', loanId: 'alpha-loan-member', date: '2024-03-07',
      cashAccountId: 'alpha-checking', principalCents: 200_000n, interestCents: 5_000n,
      description: 'Synthetic loan repayment 1',
    }));
    await step(() => recordLoanAdvanceInDatabase(database, {
      id: 'alpha-loan-advance-2', transactionId: 'alpha-loan-advance-2-txn', journalEntryId: 'alpha-loan-advance-2-je',
      loanId: 'alpha-loan-member', date: '2024-03-20', cashAccountId: 'alpha-checking', amountCents: 300_000n,
      description: 'Synthetic loan advance 2',
    }));

    // Recurring: two posted occurrences, an edited template and a paused one.
    await step(() => createRecurringTransactionInDatabase(database, {
      id: 'alpha-recurring-hosting', businessId: ALPHA, kind: 'expense', accountId: 'alpha-checking',
      categoryAccountId: 'expense-software', amountCents: 9_900n, description: 'Synthetic hosting',
      cadence: 'monthly', nextDate: '2024-02-15',
    }));
    await step(() => postRecurringTransactionInDatabase(database, {
      templateId: 'alpha-recurring-hosting', businessId: ALPHA, occurrenceId: 'alpha-recurring-occurrence-1',
      transactionId: 'alpha-recurring-1-txn', journalEntryId: 'alpha-recurring-1-je', postingDate: '2024-02-15',
    }));
    await step(() => postRecurringTransactionInDatabase(database, {
      templateId: 'alpha-recurring-hosting', businessId: ALPHA, occurrenceId: 'alpha-recurring-occurrence-2',
      transactionId: 'alpha-recurring-2-txn', journalEntryId: 'alpha-recurring-2-je', postingDate: '2024-03-16',
    }));
    await step(() => updateRecurringTransactionInDatabase(database, {
      id: 'alpha-recurring-hosting', businessId: ALPHA, kind: 'expense', accountId: 'alpha-checking',
      categoryAccountId: 'expense-software', amountCents: 10_900n, description: 'Synthetic hosting (new plan)',
      cadence: 'monthly', nextDate: '2024-04-15',
    }));
    await step(() => createRecurringTransactionInDatabase(database, {
      id: 'alpha-recurring-retainer', businessId: ALPHA, kind: 'income', accountId: 'alpha-checking',
      categoryAccountId: 'alpha-consulting', amountCents: 15_000n, description: 'Synthetic weekly retainer',
      cadence: 'weekly', nextDate: '2024-04-01',
    }));
    await step(() => setRecurringTransactionActiveInDatabase(database, ALPHA, 'alpha-recurring-retainer', false));

    // Ownership history: admit a member, then retire them.
    await step(() => replaceMembersInDatabase(database, {
      businessId: ALPHA, effectiveDate: '2024-03-01', ownershipConfirmed: true,
      members: [
        { id: 'member-zoe', name: 'Zoe Lee', ownershipBasisPoints: 5_000 },
        { id: 'member-adam', name: 'Adam Morgan', ownershipBasisPoints: 3_000 },
        { id: 'member-kai', name: 'Kai Patel', ownershipBasisPoints: 2_000 },
      ],
    }));
    await step(() => replaceMembersInDatabase(database, {
      businessId: ALPHA, effectiveDate: '2024-03-25', ownershipConfirmed: true,
      members: [
        { id: 'member-zoe', name: 'Zoe Lee', ownershipBasisPoints: 6_000 },
        { id: 'member-adam', name: 'Adam Morgan', ownershipBasisPoints: 4_000 },
      ],
    }));

    // Reconciliation: cleared, uncleared, completed, reopened, completed again;
    // then a following draft statement.
    await step(() => createAccountReconciliationInDatabase(database, {
      id: 'alpha-rec-1', businessId: ALPHA, accountId: 'alpha-checking', periodStartDate: '2024-01-01',
      statementDate: '2024-01-31', beginningBalanceCents: 1_000_000n, endingBalanceCents: 1_252_500n,
    }));
    for (const transactionId of ['alpha-income-1', 'alpha-split-1', 'alpha-import-1', 'alpha-import-2', 'alpha-expense-1']) {
      await step(() => setAccountReconciliationItemClearedInDatabase(database, 'alpha-rec-1', transactionId, true));
    }
    await step(() => setAccountReconciliationItemClearedInDatabase(database, 'alpha-rec-1', 'alpha-expense-1', false));
    await step(() => completeAccountReconciliationInDatabase(database, 'alpha-rec-1'));
    await step(() => reopenAccountReconciliationInDatabase(database, 'alpha-rec-1'));
    await step(() => completeAccountReconciliationInDatabase(database, 'alpha-rec-1'));
    await step(() => createAccountReconciliationInDatabase(database, {
      id: 'alpha-rec-2', businessId: ALPHA, accountId: 'alpha-checking', periodStartDate: '2024-01-31',
      statementDate: '2024-02-29', beginningBalanceCents: 1_252_500n, endingBalanceCents: 1_000_000n,
    }));
    await step(() => setAccountReconciliationItemClearedInDatabase(database, 'alpha-rec-2', 'alpha-gp-pay-1-txn', true));

    // Reminders: open, completed and edited.
    await step(() => saveBookkeepingReminderInDatabase(database, {
      id: 'alpha-reminder-open', businessId: ALPHA, dueDate: '2024-04-15', title: 'Synthetic quarterly review', details: '',
    }));
    await step(() => saveBookkeepingReminderInDatabase(database, {
      id: 'alpha-reminder-done', businessId: ALPHA, dueDate: '2024-03-01', title: 'Synthetic CPA packet',
      details: 'Send synthetic workpapers',
    }));
    await step(() => completeBookkeepingReminderInDatabase(database, ALPHA, 'alpha-reminder-done', true));
    await step(() => saveBookkeepingReminderInDatabase(database, {
      id: 'alpha-reminder-edited', businessId: ALPHA, dueDate: '2024-05-01', title: 'Synthetic draft title', details: 'Draft',
    }));
    await step(() => saveBookkeepingReminderInDatabase(database, {
      id: 'alpha-reminder-edited', businessId: ALPHA, dueDate: '2024-05-10', title: 'Synthetic edited title', details: 'Edited',
    }));

    // Period history: close, reopen, close again, then close the next period.
    // The reopen id sorts BEFORE the close it targets.
    await step(() => closeAccountingPeriodInDatabase(database, {
      id: 'alpha-period-z-close-1', businessId: ALPHA, throughDate: '2024-01-31', reason: 'Synthetic January close',
    }));
    await step(() => reopenAccountingPeriodInDatabase(database, {
      id: 'alpha-period-a-reopen-1', businessId: ALPHA, reason: 'Synthetic January correction',
    }));
    await step(() => closeAccountingPeriodInDatabase(database, {
      id: 'alpha-period-m-close-2', businessId: ALPHA, throughDate: '2024-01-31', reason: 'Synthetic January re-close',
    }));
    await step(() => closeAccountingPeriodInDatabase(database, {
      id: 'alpha-period-n-close-3', businessId: ALPHA, throughDate: '2024-02-29', reason: 'Synthetic February close',
    }));

    // ---- Workspace Beta activity -----------------------------------------
    await step(() => createCashAccountInDatabase(database, {
      id: 'beta-checking', businessId: BETA, name: 'Harbor checking', kind: 'bank',
      openingDate: '2023-07-01', openingBalanceCents: 75_000n,
      openingTransactionId: 'beta-open-checking', openingJournalEntryId: 'beta-open-checking-je',
    }));
    await step(() => createCashAccountInDatabase(database, {
      id: 'beta-credit-line', businessId: BETA, name: 'Harbor overdraft line', kind: 'bank',
      openingDate: '2023-07-01', openingBalanceCents: -15_000n,
      openingTransactionId: 'beta-open-credit-line', openingJournalEntryId: 'beta-open-credit-line-je',
    }));
    await step(() => recordCashTransactionInDatabase(database, {
      id: 'beta-income-1', journalEntryId: 'beta-income-1-je', businessId: BETA, date: '2023-08-01',
      kind: 'income', accountId: 'beta-checking', categoryAccountId: `${BETA}:income-services`,
      amountCents: 20_000n, description: 'Synthetic harbor services',
    }));
    await step(() => recordCashTransactionInDatabase(database, {
      id: 'beta-expense-1', journalEntryId: 'beta-expense-1-je', businessId: BETA, date: '2023-08-15',
      kind: 'expense', accountId: 'beta-checking', categoryAccountId: `${BETA}:expense-software`,
      amountCents: 3_000n, description: 'Synthetic harbor software',
    }));
    await step(() => recordMemberCapitalActivityInDatabase(database, {
      id: 'beta-capital-distribution', journalEntryId: 'beta-capital-distribution-je', businessId: BETA,
      memberId: 'member-solo', date: '2023-09-01', kind: 'distribution', amountCents: 10_000n,
      description: 'Synthetic owner distribution', cashAccountId: 'beta-checking',
    }));
    await step(() => createAccountReconciliationInDatabase(database, {
      id: 'beta-rec-1', businessId: BETA, accountId: 'beta-checking', periodStartDate: '2023-07-01',
      statementDate: '2023-08-31', beginningBalanceCents: 75_000n, endingBalanceCents: 92_000n,
    }));
    await step(() => setAccountReconciliationItemClearedInDatabase(database, 'beta-rec-1', 'beta-income-1', true));
    await step(() => setAccountReconciliationItemClearedInDatabase(database, 'beta-rec-1', 'beta-expense-1', true));
    await step(() => completeAccountReconciliationInDatabase(database, 'beta-rec-1'));
    await step(() => saveBookkeepingReminderInDatabase(database, {
      id: 'beta-reminder-open', businessId: BETA, dueDate: '2024-01-31', title: 'Synthetic owner labor CPA review',
      details: 'Synthetic note',
    }));
    await step(() => closeAccountingPeriodInDatabase(database, {
      id: 'beta-period-close-1', businessId: BETA, throughDate: '2023-12-31', reason: 'Synthetic 2023 close',
    }));

    await step(() => setActiveBusinessInDatabase(database, ALPHA));
  });
}

/** Small, different v13 books standing in for the destination's ACTIVE database. */
export async function seedActiveDestinationBooks(database) {
  await withDeterministicClock(async (step) => {
    await step(() => ensureBookkeepingSchema(database));
    await step(() => createBusinessInDatabase(database, {
      id: 'business-active', name: 'Existing Active LLC', formationState: 'WA', formationDate: '2022-01-01',
      bookkeepingStartDate: '2022-01-01', ownershipConfirmed: true,
      members: [{ id: 'member-active', name: 'Active Owner', ownershipBasisPoints: 10_000 }],
    }));
    await step(() => createCashAccountInDatabase(database, {
      id: 'active-checking', businessId: 'business-active', name: 'Active checking', kind: 'bank',
      openingDate: '2022-01-01', openingBalanceCents: 4_200n,
      openingTransactionId: 'active-open', openingJournalEntryId: 'active-open-je',
    }));
  });
}

/**
 * Legacy schema-8 books. Built the same way the existing store migration tests
 * build legacy databases: current-schema books are created through the store,
 * then every table added by migrations 9-13 is removed and the recorded
 * version is set to 8. It is a reconstructed legacy shape, not an archived
 * historical database file; migrations 1-7 are covered by the store's tests.
 */
export async function seedLegacyV8Books(database) {
  await withDeterministicClock(async (step) => {
    await step(() => ensureBookkeepingSchema(database));
    await step(() => createBusinessInDatabase(database, {
      id: LEGACY, name: 'Legacy Ledger LLC', formationState: 'OR', formationDate: '2021-12-01',
      bookkeepingStartDate: '2022-01-01', ownershipConfirmed: true,
      members: [
        { id: 'legacy-member-1', name: 'Rowan Blake', ownershipBasisPoints: 7_000 },
        { id: 'legacy-member-2', name: 'Quinn Ortiz', ownershipBasisPoints: 3_000 },
      ],
    }));
    await step(() => createCashAccountInDatabase(database, {
      id: 'legacy-checking', businessId: LEGACY, name: 'Legacy checking', kind: 'bank',
      openingDate: '2022-01-01', openingBalanceCents: 500_000n,
      openingTransactionId: 'legacy-open', openingJournalEntryId: 'legacy-open-je',
    }));
    await step(() => recordCashTransactionInDatabase(database, {
      id: 'legacy-income-1', journalEntryId: 'legacy-income-1-je', businessId: LEGACY, date: '2022-01-10',
      kind: 'income', accountId: 'legacy-checking', categoryAccountId: 'income-services',
      amountCents: 120_000n, description: 'Synthetic legacy services',
    }));
    await step(() => recordCashTransactionInDatabase(database, {
      id: 'legacy-expense-1', journalEntryId: 'legacy-expense-1-je', businessId: LEGACY, date: '2022-01-12',
      kind: 'expense', accountId: 'legacy-checking', categoryAccountId: 'expense-rent',
      amountCents: 30_000n, description: 'Synthetic legacy rent (to be corrected)',
    }));
    await step(() => correctCashTransactionInDatabase(database, {
      correctionId: 'legacy-correction-1', originalTransactionId: 'legacy-expense-1',
      reversalTransactionId: 'legacy-expense-1-reversal', reversalJournalEntryId: 'legacy-expense-1-reversal-je',
      replacement: {
        id: 'legacy-expense-1-replacement', journalEntryId: 'legacy-expense-1-replacement-je', businessId: LEGACY,
        date: '2022-01-12', kind: 'expense', accountId: 'legacy-checking', categoryAccountId: 'expense-rent',
        amountCents: 31_000n, description: 'Synthetic legacy rent (corrected)',
      },
    }));
    await step(() => recordMemberCapitalActivityInDatabase(database, {
      id: 'legacy-capital-cash', journalEntryId: 'legacy-capital-cash-je', businessId: LEGACY,
      memberId: 'legacy-member-1', date: '2022-02-01', kind: 'cash-contribution', amountCents: 200_000n,
      description: 'Synthetic legacy contribution', cashAccountId: 'legacy-checking',
    }));
    await step(() => createLoanAgreementInDatabase(database, {
      id: 'legacy-loan', businessId: LEGACY, lenderType: 'third-party', lenderName: 'Synthetic Legacy Lender',
      agreementDate: '2022-02-05', commitmentCents: 400_000n, annualRateBasisPoints: 450, dayCount: 'ACT/ACT ISDA',
      description: 'Synthetic legacy loan',
    }));
    await step(() => recordLoanAdvanceInDatabase(database, {
      id: 'legacy-loan-advance', transactionId: 'legacy-loan-advance-txn', journalEntryId: 'legacy-loan-advance-je',
      loanId: 'legacy-loan', date: '2022-02-10', cashAccountId: 'legacy-checking', amountCents: 100_000n,
      description: 'Synthetic legacy advance',
    }));
    await step(() => createGuaranteedPaymentObligationInDatabase(database, {
      id: 'legacy-gp', businessId: LEGACY, memberId: 'legacy-member-2', classification: 'services',
      recurrence: 'one-time', firstDueDate: '2022-03-01', installmentCount: 1, installmentAmountCents: 60_000n,
      description: 'Synthetic legacy guaranteed payment',
    }));
    await step(() => recordGuaranteedPaymentInDatabase(database, {
      id: 'legacy-gp-pay', transactionId: 'legacy-gp-pay-txn', journalEntryId: 'legacy-gp-pay-je',
      businessId: LEGACY, memberId: 'legacy-member-2', date: '2022-03-02', cashAccountId: 'legacy-checking',
      description: 'Synthetic legacy guaranteed payment',
      allocations: [{ installmentId: 'legacy-gp:installment:1', amountCents: 60_000n }],
    }));
    await step(() => createAccountReconciliationInDatabase(database, {
      id: 'legacy-rec-1', businessId: LEGACY, accountId: 'legacy-checking', periodStartDate: '2022-01-01',
      statementDate: '2022-01-31', beginningBalanceCents: 500_000n, endingBalanceCents: 620_000n,
    }));
    await step(() => setAccountReconciliationItemClearedInDatabase(database, 'legacy-rec-1', 'legacy-income-1', true));
    await step(() => completeAccountReconciliationInDatabase(database, 'legacy-rec-1'));
  });
  database.database.exec(`
    DROP TABLE transaction_splits;
    DROP TABLE recurring_transaction_occurrences;
    DROP TABLE recurring_transaction_templates;
    DROP TABLE accounting_period_events;
    DROP TABLE bookkeeping_reminders;
    DROP TABLE bookkeeping_preferences;
    UPDATE bookkeeping_schema SET version = 8 WHERE singleton = 1;
  `);
}

/** Seeds a new file with `seed`, closes it, and returns its path. */
export async function createSeededFile(seed, name = 'books.db') {
  const path = join(newDirectory('seed'), name);
  const database = new HostDatabase(path);
  try {
    await seed(database);
  } finally {
    database.close();
  }
  return path;
}

// ---------------------------------------------------------------------------
// Host destination: an existing active database plus an isolated candidate store
// ---------------------------------------------------------------------------

const ACTIVE_DATABASE_FILE = 'active-books.db';
const ACTIVE_POINTER_FILE = 'active-pointer.txt';

/** A destination directory that already holds an ACTIVE database and its pointer. */
export function createHostDestination(activeTemplatePath) {
  const directory = newDirectory('destination');
  copyFileSync(activeTemplatePath, join(directory, ACTIVE_DATABASE_FILE));
  writeFileSync(join(directory, ACTIVE_POINTER_FILE), ACTIVE_DATABASE_FILE);
  return directory;
}

export function destinationState(directory) {
  return {
    files: readdirSync(directory).sort(),
    activeSha256: sha256File(join(directory, ACTIVE_DATABASE_FILE)),
    activePointer: readFileSync(join(directory, ACTIVE_POINTER_FILE), 'utf8'),
  };
}

export const ACTIVE_DESTINATION_FILES = [ACTIVE_DATABASE_FILE, ACTIVE_POINTER_FILE].sort();
export const ACTIVE_DESTINATION_IDENTITY = { candidateId: ACTIVE_DATABASE_FILE, keyIdentity: 'synthetic-active-device-key' };

/**
 * Host implementation of the recovery candidate store contract.
 *
 * Each provisioned candidate gets a new file and a NEW random synthetic key
 * held only in this object's in-memory keystore, addressed by a non-secret
 * identity. The store has no "publish" or "activate" operation at all.
 *
 * options: {
 *   failProvision?: Error,
 *   provisionIdentity?: { candidateId, keyIdentity },  // return this instead of a fresh candidate
 *   failOpenOnCall?: number,                           // the Nth open() throws
 *   failDispose?: Error,
 *   databaseFaults?: (openCall: number) => object | undefined, // faults for the Nth opened connection
 *   beforeOpen?: (openCall: number, path: string) => void,
 * }
 */
export class HostCandidateStore {
  directory;
  options;
  events = [];
  keystore = new Map();
  openConnections = new Set();
  lastOpenedDatabase = null;
  provisionCalls = 0;
  openCalls = 0;
  disposeCalls = 0;

  constructor(directory, options = {}) {
    this.directory = directory;
    this.options = options;
  }

  pathOf(identity) {
    return join(this.directory, identity.candidateId);
  }

  async provision() {
    this.provisionCalls += 1;
    this.events.push('provision');
    if (this.options.failProvision) throw this.options.failProvision;
    if (this.options.provisionIdentity) return this.options.provisionIdentity;
    const identity = {
      candidateId: `candidate-${this.provisionCalls}-${randomBytes(4).toString('hex')}.db`,
      keyIdentity: `synthetic-destination-key-${this.provisionCalls}-${randomBytes(4).toString('hex')}`,
    };
    if (existsSync(this.pathOf(identity))) throw new Error('host candidate path already exists');
    this.keystore.set(identity.keyIdentity, randomBytes(32));
    return identity;
  }

  async open(identity) {
    this.openCalls += 1;
    this.events.push('open');
    const path = this.pathOf(identity);
    if (this.options.failOpenOnCall === this.openCalls) throw new Error('synthetic injected candidate open failure');
    if (!this.options.provisionIdentity && !this.keystore.has(identity.keyIdentity)) {
      throw new Error('synthetic destination key is unavailable');
    }
    this.options.beforeOpen?.(this.openCalls, path);
    const faults = this.options.databaseFaults?.(this.openCalls);
    const database = faults ? new FaultInjectingHostDatabase(path, faults) : new HostDatabase(path);
    this.openConnections.add(database);
    this.lastOpenedDatabase = database;
    return {
      database,
      close: async () => {
        this.events.push('close');
        this.openConnections.delete(database);
        database.close();
        if (this.options.failCloseOnCall === this.openCalls) {
          throw this.options.failClose || new Error('synthetic injected candidate connection close failure');
        }
      },
    };
  }

  async dispose(identity) {
    this.disposeCalls += 1;
    this.events.push('dispose');
    for (const database of [...this.openConnections]) {
      database.close();
      this.openConnections.delete(database);
    }
    if (this.options.failDispose) throw this.options.failDispose;
    rmSync(this.pathOf(identity), { force: true });
    this.keystore.delete(identity.keyIdentity);
  }

  closeAll() {
    for (const database of [...this.openConnections]) {
      database.close();
      this.openConnections.delete(database);
    }
  }
}

/** Host provider of an isolated, disposable copy of a (possibly legacy) source file. */
export class HostIsolatedCopyProvider {
  sourcePath;
  options;
  calls = 0;
  disposed = 0;
  copyPaths = [];

  /** options: { faults?: object, failDispose?: Error, returnInstead?: object } */
  constructor(sourcePath, options = {}) {
    this.sourcePath = sourcePath;
    this.options = options;
  }

  async provisionIsolatedCopy() {
    this.calls += 1;
    if (this.options.returnInstead) {
      return { database: this.options.returnInstead, dispose: async () => { this.disposed += 1; } };
    }
    const path = copyOfFile(this.sourcePath, 'isolated-migration-copy.db');
    this.copyPaths.push(path);
    const database = this.options.faults ? new FaultInjectingHostDatabase(path, this.options.faults) : new HostDatabase(path);
    return {
      database,
      dispose: async () => {
        this.disposed += 1;
        database.close();
        if (this.options.failDispose) throw this.options.failDispose;
        rmSync(path, { force: true });
      },
    };
  }
}
