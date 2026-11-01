import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cashBasisReportFromDatabase,
  createBusinessInDatabase,
  createCashAccountInDatabase,
  createRecurringTransactionInDatabase,
  updateRecurringTransactionInDatabase,
  setRecurringTransactionActiveInDatabase,
  createLoanAgreementInDatabase,
  correctCashTransactionInDatabase,
  ensureBookkeepingSchema,
  getBookkeepingSnapshotFromDatabase,
  generalLedgerReportFromDatabase,
  journalBalanceReportFromDatabase,
  createGuaranteedPaymentObligationInDatabase,
  createAccountReconciliationInDatabase,
  closeAccountingPeriodInDatabase,
  completeAccountReconciliationInDatabase,
  recordGuaranteedPaymentInDatabase,
  recordLoanAdvanceInDatabase,
  recordLoanRepaymentInDatabase,
  recordTransferInDatabase,
  reverseGuaranteedPaymentInDatabase,
  recordMemberCapitalActivityInDatabase,
  recordCashTransactionInDatabase,
  postRecurringTransactionInDatabase,
  recordSplitCashTransactionInDatabase,
  reopenAccountReconciliationInDatabase,
  reopenAccountingPeriodInDatabase,
  replaceMembersInDatabase,
  setAccountReconciliationItemClearedInDatabase,
  transactionsCsv,
} from '../src/bookkeeping-store.ts';

class TestDatabase {
  database;

  constructor(path) {
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
    this.database.close();
  }
}

const setup = {
  id: 'business-1',
  name: 'Northstar Studio LLC',
  formationState: 'AZ',
  formationDate: '2024-03-01',
  bookkeepingStartDate: '2024-01-01',
  ownershipConfirmed: true,
  members: [
    { id: 'member-1', name: 'Jordan Lee', ownershipBasisPoints: 4_000 },
    { id: 'member-2', name: 'Casey Morgan', ownershipBasisPoints: 2_000 },
    { id: 'member-3', name: 'Riley Patel', ownershipBasisPoints: 2_000 },
    { id: 'member-4', name: 'Avery Kim', ownershipBasisPoints: 2_000 },
  ],
};

const directories = [];
function databasePath() {
  const directory = mkdtempSync(join(tmpdir(), 'llc-bookkeeping-test-'));
  directories.push(directory);
  return join(directory, 'books.db');
}

async function createLegacyV1Books(database) {
  await database.execAsync(`
    CREATE TABLE bookkeeping_schema (singleton INTEGER PRIMARY KEY, version INTEGER NOT NULL);
    INSERT INTO bookkeeping_schema VALUES (1, 1);
    CREATE TABLE businesses (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, formation_state TEXT NOT NULL,
      formation_date TEXT NOT NULL, bookkeeping_start_date TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD', created_at TEXT NOT NULL
    );
    CREATE TABLE members (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL, created_at TEXT NOT NULL, retired_at TEXT
    );
    CREATE TABLE member_interest_history (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
      member_id TEXT NOT NULL REFERENCES members(id), ownership_basis_points INTEGER NOT NULL,
      effective_from TEXT NOT NULL, effective_to TEXT, created_at TEXT NOT NULL,
      UNIQUE (member_id, effective_from)
    );
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL, business_id TEXT NOT NULL REFERENCES businesses(id),
      code TEXT NOT NULL, name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('bank', 'cash', 'equity', 'income', 'expense')),
      category TEXT NOT NULL, is_system INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
      UNIQUE (business_id, code), UNIQUE (business_id, name)
    );
    CREATE TABLE journal_entries (
      id TEXT PRIMARY KEY NOT NULL, business_id TEXT NOT NULL REFERENCES businesses(id),
      entry_date TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('opening-balance', 'income', 'expense', 'reversal')),
      description TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE journal_lines (
      id TEXT PRIMARY KEY NOT NULL, journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
      account_id TEXT NOT NULL REFERENCES accounts(id), line_number INTEGER NOT NULL,
      debit_minor TEXT NOT NULL, credit_minor TEXT NOT NULL,
      UNIQUE (journal_entry_id, line_number)
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL, business_id TEXT NOT NULL REFERENCES businesses(id),
      journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id), entry_date TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('opening-balance', 'income', 'expense', 'reversal')),
      account_id TEXT NOT NULL REFERENCES accounts(id), category_account_id TEXT NOT NULL REFERENCES accounts(id),
      amount_minor TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE transaction_corrections (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
      original_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
      reversal_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
      replacement_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id), created_at TEXT NOT NULL
    );
    CREATE TABLE transaction_correction_roles (
      transaction_id TEXT PRIMARY KEY REFERENCES transactions(id),
      correction_id TEXT NOT NULL REFERENCES transaction_corrections(id),
      role TEXT NOT NULL CHECK (role IN ('reversal', 'replacement'))
    );
    INSERT INTO businesses VALUES ('business-1', 'Northstar Studio LLC', 'AZ', '2024-03-01', '2024-01-01', 'USD', '2024-01-01T00:00:00.000Z');
    INSERT INTO members VALUES ('member-1', 'business-1', 'Jordan Lee', '2024-01-01T00:00:00.000Z', NULL);
    INSERT INTO member_interest_history VALUES ('member-1-history', 'business-1', 'member-1', 10000, '2024-01-01', NULL, '2024-01-01T00:00:00.000Z');
    INSERT INTO accounts VALUES ('opening-equity', 'business-1', '3000', 'Opening Balance Equity', 'equity', 'Opening balance', 1, 1, '2024-01-01T00:00:00.000Z');
    INSERT INTO accounts VALUES ('bank-1', 'business-1', 'cash:bank-1', 'Operating checking', 'bank', 'Bank account', 0, 1, '2024-01-01T00:00:00.000Z');
    INSERT INTO journal_entries VALUES ('opening-entry-1', 'business-1', '2024-01-01', 'opening-balance', 'Opening balance', '2024-01-01T00:00:00.000Z');
    INSERT INTO journal_lines VALUES ('opening-line-1', 'opening-entry-1', 'bank-1', 1, '125000', '0');
    INSERT INTO journal_lines VALUES ('opening-line-2', 'opening-entry-1', 'opening-equity', 2, '0', '125000');
    INSERT INTO transactions VALUES ('opening-1', 'business-1', 'opening-entry-1', '2024-01-01', 'opening-balance', 'bank-1', 'opening-equity', '125000', 'Opening balance', '2024-01-01T00:00:00.000Z');
  `);
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('bookkeeping repository SQL contract', () => {
  it('closes periods as an auditable posting lock and reopens only the latest closed interval', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });

    await closeAccountingPeriodInDatabase(database, {
      id: 'close-jan', businessId: 'business-1', throughDate: '2024-01-31', reason: 'January review complete',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'feb-early-income', journalEntryId: 'feb-early-income-entry', businessId: 'business-1', date: '2024-02-01',
      kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 1_000n,
      description: 'Open February receipt',
    });
    await closeAccountingPeriodInDatabase(database, {
      id: 'close-feb', businessId: 'business-1', throughDate: '2024-02-29', reason: 'February review complete',
    });

    await expect(recordCashTransactionInDatabase(database, {
      id: 'locked-income', journalEntryId: 'locked-income-entry', businessId: 'business-1', date: '2024-02-29',
      kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 2_500n,
      description: 'Backdated after close',
    })).rejects.toThrow('books are closed through 2024-02-29');

    await reopenAccountingPeriodInDatabase(database, {
      id: 'reopen-feb', businessId: 'business-1', reason: 'Correct an omitted February receipt',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'feb-income', journalEntryId: 'feb-income-entry', businessId: 'business-1', date: '2024-02-29',
      kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 2_500n,
      description: 'Omitted February receipt',
    });
    await expect(recordCashTransactionInDatabase(database, {
      id: 'still-locked-income', journalEntryId: 'still-locked-income-entry', businessId: 'business-1', date: '2024-01-31',
      kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 500n,
      description: 'January remains closed',
    })).rejects.toThrow('books are closed through 2024-01-31');

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.closedThroughDate).toBe('2024-01-31');
    expect(snapshot.accountingPeriodEvents.map((event) => [event.action, event.throughDate, event.isActive])).toEqual([
      ['close', '2024-01-31', true],
      ['close', '2024-02-29', false],
      ['reopen', '2024-02-29', false],
    ]);
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(103_500n);
    expect(snapshot.transactions).toHaveLength(3);
    database.close();
  });

  it('rejects corrections to closed originals atomically and rejects ownership changes inside a closed period', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, { id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank' });
    await recordCashTransactionInDatabase(database, {
      id: 'income-1', journalEntryId: 'income-entry-1', businessId: 'business-1', date: '2024-01-10',
      kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 2_500n,
      description: 'Original receipt',
    });
    await closeAccountingPeriodInDatabase(database, {
      id: 'close-jan', businessId: 'business-1', throughDate: '2024-01-31', reason: 'January reviewed',
    });

    await expect(correctCashTransactionInDatabase(database, {
      correctionId: 'correction-1', originalTransactionId: 'income-1',
      reversalTransactionId: 'reversal-1', reversalJournalEntryId: 'reversal-entry-1',
      replacement: {
        id: 'replacement-1', journalEntryId: 'replacement-entry-1', businessId: 'business-1',
        date: '2024-02-01', kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services',
        amountCents: 2_600n, description: 'Replacement receipt',
      },
    })).rejects.toThrow('books are closed through 2024-01-31');
    await expect(replaceMembersInDatabase(database, {
      businessId: 'business-1', effectiveDate: '2024-01-31', ownershipConfirmed: true,
      members: setup.members,
    })).rejects.toThrow('books are closed through 2024-01-31');

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.transactions.map((transaction) => transaction.id)).toEqual(['income-1']);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM transaction_corrections').get().count).toBe(0);
    expect(snapshot.members.map((member) => member.ownershipBasisPoints)).toEqual([4_000, 2_000, 2_000, 2_000]);
    database.close();
  });

  it('rejects future or empty-reason period closes without recording an event', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const futureDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    await expect(closeAccountingPeriodInDatabase(database, {
      id: 'future-close', businessId: 'business-1', throughDate: futureDate, reason: 'Future close',
    })).rejects.toThrow('cannot be closed through a future date');
    await expect(closeAccountingPeriodInDatabase(database, {
      id: 'empty-reason-close', businessId: 'business-1', throughDate: '2024-01-31', reason: '   ',
    })).rejects.toThrow('Enter a reason for closing');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM accounting_period_events').get().count).toBe(0);
    database.close();
  });

  it('upgrades version 9 databases with recurring schedule and occurrence history tables', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    database.database.exec(`
      DROP TABLE recurring_transaction_occurrences;
      DROP TABLE recurring_transaction_templates;
      DROP TABLE accounting_period_events;
      UPDATE bookkeeping_schema SET version = 9 WHERE singleton = 1;
    `);
    await ensureBookkeepingSchema(database);
    expect(database.database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version).toBe(11);
    expect(database.database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
        'recurring_transaction_templates', 'recurring_transaction_occurrences'
      ) ORDER BY name
    `).all().map((row) => row.name)).toEqual([
      'recurring_transaction_occurrences', 'recurring_transaction_templates',
    ]);
    expect(database.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounting_period_events'").get()).toBeTruthy();
    database.close();
  });

  it('requires manual recurring posts, advances anchored due dates, and reconciles each occurrence', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-recurring', openingJournalEntryId: 'opening-recurring-journal',
    });
    await createRecurringTransactionInDatabase(database, {
      id: 'monthly-rent', businessId: 'business-1', kind: 'expense',
      accountId: 'bank-1', categoryAccountId: 'expense-rent', amountCents: 10_000n,
      description: 'Synthetic monthly rent', cadence: 'monthly', nextDate: '2024-01-31',
    });

    await expect(postRecurringTransactionInDatabase(database, {
      templateId: 'monthly-rent', businessId: 'business-1', occurrenceId: 'rent-early-occurrence',
      transactionId: 'rent-early', journalEntryId: 'rent-early-journal', postingDate: '2024-01-30',
    })).rejects.toThrow('not due yet');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM transactions').get().count).toBe(1);

    await postRecurringTransactionInDatabase(database, {
      templateId: 'monthly-rent', businessId: 'business-1', occurrenceId: 'rent-occurrence-1',
      transactionId: 'rent-transaction-1', journalEntryId: 'rent-journal-1', postingDate: '2024-02-01',
    });
    let snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.recurringTransactions[0]).toMatchObject({
      id: 'monthly-rent', nextDate: '2024-02-29', lastPostedDate: '2024-02-01',
      lastTransactionId: 'rent-transaction-1', isActive: true,
    });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'rent-transaction-1')).toMatchObject({
      date: '2024-02-01', amountCents: -10_000n, recurringTemplateId: 'monthly-rent',
    });
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(90_000n);
    expect(snapshot.cashBasis.expenseCents).toBe(10_000n);
    await expect(postRecurringTransactionInDatabase(database, {
      templateId: 'monthly-rent', businessId: 'business-1', occurrenceId: 'rent-early-occurrence-2',
      transactionId: 'rent-early-2', journalEntryId: 'rent-early-journal-2', postingDate: '2024-02-28',
    })).rejects.toThrow('not due yet');

    await postRecurringTransactionInDatabase(database, {
      templateId: 'monthly-rent', businessId: 'business-1', occurrenceId: 'rent-occurrence-2',
      transactionId: 'rent-transaction-2', journalEntryId: 'rent-journal-2', postingDate: '2024-03-01',
    });
    snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.recurringTransactions[0]).toMatchObject({ nextDate: '2024-03-31', lastPostedDate: '2024-03-01' });
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(80_000n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 20_000n, netIncomeCents: -20_000n });
    expect(snapshot.transactions.filter((transaction) => transaction.recurringTemplateId === 'monthly-rent')).toHaveLength(2);
    expect(database.database.prepare(`
      SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
      GROUP BY je.id HAVING SUM(CAST(jl.debit_minor AS INTEGER)) != SUM(CAST(jl.credit_minor AS INTEGER))
    `).all()).toEqual([]);
    database.close();
  });

  it('rolls back an overdrawn recurring occurrence without advancing the schedule', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'cash',
      openingDate: '2024-01-01', openingBalanceCents: 500n,
      openingTransactionId: 'opening-recurring-overdraw', openingJournalEntryId: 'opening-recurring-overdraw-journal',
    });
    await createRecurringTransactionInDatabase(database, {
      id: 'overdrawn-template', businessId: 'business-1', kind: 'expense',
      accountId: 'bank-1', categoryAccountId: 'expense-rent', amountCents: 750n,
      description: 'Synthetic unaffordable rent', cadence: 'monthly', nextDate: '2024-01-01',
    });
    await expect(postRecurringTransactionInDatabase(database, {
      templateId: 'overdrawn-template', businessId: 'business-1', occurrenceId: 'overdrawn-occurrence',
      transactionId: 'overdrawn-transaction', journalEntryId: 'overdrawn-journal', postingDate: '2024-01-01',
    })).rejects.toThrow('balance would become negative');
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.recurringTransactions[0].nextDate).toBe('2024-01-01');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(500n);
    expect(snapshot.transactions).toHaveLength(1);
    expect(database.database.prepare(`SELECT COUNT(*) AS count FROM recurring_transaction_occurrences`).get().count).toBe(0);
    database.close();
  });

  it('edits future schedule details without changing posted history or the month-end anchor', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-recurring-edit', openingJournalEntryId: 'opening-recurring-edit-journal',
    });
    const original = {
      id: 'editable-rent', businessId: 'business-1', kind: 'expense',
      accountId: 'bank-1', categoryAccountId: 'expense-rent', amountCents: 10_000n,
      description: 'Original rent amount', cadence: 'monthly', nextDate: '2024-01-31',
    };
    await createRecurringTransactionInDatabase(database, original);
    await postRecurringTransactionInDatabase(database, {
      templateId: original.id, businessId: original.businessId, occurrenceId: 'editable-rent-occurrence-1',
      transactionId: 'editable-rent-transaction-1', journalEntryId: 'editable-rent-journal-1', postingDate: '2024-01-31',
    });

    await updateRecurringTransactionInDatabase(database, {
      ...original, amountCents: 12_000n, description: 'Updated rent amount', nextDate: '2024-02-29',
    });
    await setRecurringTransactionActiveInDatabase(database, original.businessId, original.id, false);
    await expect(postRecurringTransactionInDatabase(database, {
      templateId: original.id, businessId: original.businessId, occurrenceId: 'paused-rent-occurrence',
      transactionId: 'paused-rent-transaction', journalEntryId: 'paused-rent-journal', postingDate: '2024-03-01',
    })).rejects.toThrow('Resume this recurring schedule');
    await setRecurringTransactionActiveInDatabase(database, original.businessId, original.id, true);
    await postRecurringTransactionInDatabase(database, {
      templateId: original.id, businessId: original.businessId, occurrenceId: 'editable-rent-occurrence-2',
      transactionId: 'editable-rent-transaction-2', journalEntryId: 'editable-rent-journal-2', postingDate: '2024-03-01',
    });

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, original.businessId);
    expect(snapshot.recurringTransactions[0]).toMatchObject({
      amountCents: 12_000n, description: 'Updated rent amount', nextDate: '2024-03-31', isActive: true,
    });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'editable-rent-transaction-1').description)
      .toBe('Original rent amount');
    expect(snapshot.transactions.find((transaction) => transaction.id === 'editable-rent-transaction-2').description)
      .toBe('Updated rent amount');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(78_000n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 22_000n, netIncomeCents: -22_000n });
    database.close();
  });

  it('upgrades v8 transaction records to split-capable storage without changing legacy balances', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-v8', openingJournalEntryId: 'opening-v8-journal',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-v8', journalEntryId: 'expense-v8-journal', businessId: 'business-1',
      date: '2024-01-10', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
      amountCents: 1_000n, description: 'Legacy category transaction',
    });
    database.database.exec('DROP TABLE transaction_splits; UPDATE bookkeeping_schema SET version = 8 WHERE singleton = 1;');

    await ensureBookkeepingSchema(database);
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(database.database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version).toBe(11);
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(124_000n);
    expect(snapshot.transactions.find((transaction) => transaction.id === 'expense-v8').splitLines).toEqual([
      { categoryAccountId: 'expense-rent', category: 'Rent', amountCents: 1_000n },
    ]);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('posts and persists category splits as one balanced cash transaction', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-split', openingJournalEntryId: 'opening-split-journal',
    });

    await recordSplitCashTransactionInDatabase(database, {
      id: 'split-expense', journalEntryId: 'split-expense-journal', businessId: 'business-1',
      date: '2024-01-10', kind: 'expense', accountId: 'bank-1', amountCents: 7_500n,
      description: 'Synthetic combined receipt',
      splits: [
        { categoryAccountId: 'expense-rent', amountCents: 5_000n },
        { categoryAccountId: 'expense-supplies', amountCents: 2_500n },
      ],
    });

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.transactions).toHaveLength(2);
    expect(snapshot.transactions[0]).toMatchObject({
      id: 'split-expense', kind: 'expense', amountCents: -7_500n,
      splitLines: [
        { categoryAccountId: 'expense-rent', category: 'Rent', amountCents: 5_000n },
        { categoryAccountId: 'expense-supplies', category: 'Office Supplies', amountCents: 2_500n },
      ],
    });
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(117_500n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 7_500n, netIncomeCents: -7_500n });
    expect(database.database.prepare(`
      SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
      GROUP BY je.id HAVING SUM(CAST(jl.debit_minor AS INTEGER)) != SUM(CAST(jl.credit_minor AS INTEGER))
    `).all()).toEqual([]);
    expect(transactionsCsv(snapshot).split('\r\n')).toContain(
      '"2024-01-10","Rent","-50.00","Checking","Synthetic combined receipt"',
    );
    expect(transactionsCsv(snapshot).split('\r\n')).toContain(
      '"2024-01-10","Office Supplies","-25.00","Checking","Synthetic combined receipt"',
    );

    await correctCashTransactionInDatabase(database, {
      correctionId: 'split-correction', originalTransactionId: 'split-expense',
      reversalTransactionId: 'split-reversal', reversalJournalEntryId: 'split-reversal-journal',
      replacement: {
        id: 'split-replacement', journalEntryId: 'split-replacement-journal', businessId: 'business-1',
        date: '2024-01-12', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
        amountCents: 8_000n, description: 'Synthetic corrected split receipt',
      },
      replacementSplits: [
        { categoryAccountId: 'expense-rent', amountCents: 6_000n },
        { categoryAccountId: 'expense-supplies', amountCents: 2_000n },
      ],
    });
    const corrected = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(corrected.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(117_000n);
    expect(corrected.cashBasis.expenseCents).toBe(8_000n);
    expect(corrected.transactions.find((transaction) => transaction.id === 'split-reversal').splitLines).toEqual([
      { categoryAccountId: 'expense-rent', category: 'Rent', amountCents: 5_000n },
      { categoryAccountId: 'expense-supplies', category: 'Office Supplies', amountCents: 2_500n },
    ]);
    const correctedCsv = transactionsCsv(corrected).split('\r\n');
    expect(correctedCsv).toContain('"2024-01-10","Rent · reversal","50.00","Checking","Reversal of: Synthetic combined receipt"');
    expect(correctedCsv).toContain('"2024-01-12","Rent","-60.00","Checking","Synthetic corrected split receipt"');
    const exportedCashCents = correctedCsv.slice(1).reduce((sum, row) => {
      const amount = Number(row.split(',')[2].replaceAll('"', ''));
      return sum + BigInt(Math.round(amount * 100));
    }, 0n);
    expect(exportedCashCents).toBe(corrected.accounts.find((account) => account.id === 'bank-1').balanceCents);

    await recordSplitCashTransactionInDatabase(database, {
      id: 'split-income', journalEntryId: 'split-income-journal', businessId: 'business-1',
      date: '2024-01-13', kind: 'income', accountId: 'bank-1', amountCents: 20_000n,
      description: 'Synthetic combined deposit',
      splits: [
        { categoryAccountId: 'income-services', amountCents: 12_500n },
        { categoryAccountId: 'income-other', amountCents: 7_500n },
      ],
    });
    const withIncome = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(withIncome.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(137_000n);
    expect(withIncome.cashBasis).toEqual({ incomeCents: 20_000n, expenseCents: 8_000n, netIncomeCents: 12_000n });
    expect(transactionsCsv(withIncome).split('\r\n')).toContain(
      '"2024-01-13","Sales and Services","125.00","Checking","Synthetic combined deposit"',
    );
    expect(transactionsCsv(withIncome).split('\r\n')).toContain(
      '"2024-01-13","Other Income","75.00","Checking","Synthetic combined deposit"',
    );

    await expect(recordSplitCashTransactionInDatabase(database, {
      id: 'bad-split', journalEntryId: 'bad-split-journal', businessId: 'business-1',
      date: '2024-01-11', kind: 'expense', accountId: 'bank-1', amountCents: 7_500n,
      description: 'Split does not add up',
      splits: [{ categoryAccountId: 'expense-rent', amountCents: 7_499n }, { categoryAccountId: 'expense-supplies', amountCents: 2n }],
    })).rejects.toThrow('split amounts must equal the transaction total');
    expect(database.database.prepare(`SELECT COUNT(*) AS count FROM transactions WHERE id = 'bad-split'`).get().count).toBe(0);
    expect(database.database.prepare(`SELECT COUNT(*) AS count FROM journal_entries WHERE id = 'bad-split-journal'`).get().count).toBe(0);
    database.close();
  });

  it('adds custom income and expense accounts that can post balanced, reportable transactions', async () => {
    const store = await import('../src/bookkeeping-store.ts');
    expect(store.createCategoryAccountInDatabase).toBeTypeOf('function');

    const database = new TestDatabase(databasePath());
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'checking-custom-categories', businessId: setup.id, name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-custom-categories', openingJournalEntryId: 'opening-entry-custom-categories',
    });
    await store.createCategoryAccountInDatabase(database, {
      id: 'income-consulting', businessId: setup.id, name: 'Consulting income', kind: 'income',
    });
    await store.createCategoryAccountInDatabase(database, {
      id: 'expense-insurance', businessId: setup.id, name: 'Insurance', kind: 'expense',
    });

    await recordCashTransactionInDatabase(database, {
      id: 'custom-income', journalEntryId: 'custom-income-entry', businessId: setup.id,
      date: '2024-01-02', kind: 'income', accountId: 'checking-custom-categories',
      categoryAccountId: 'income-consulting', amountCents: 5_000n, description: 'Consulting work',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'custom-expense', journalEntryId: 'custom-expense-entry', businessId: setup.id,
      date: '2024-01-03', kind: 'expense', accountId: 'checking-custom-categories',
      categoryAccountId: 'expense-insurance', amountCents: 2_500n, description: 'Policy premium',
    });

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, setup.id);
    expect(snapshot.accounts.find((account) => account.id === 'income-consulting'))
      .toMatchObject({ code: '4001', name: 'Consulting income', kind: 'income' });
    expect(snapshot.accounts.find((account) => account.id === 'expense-insurance'))
      .toMatchObject({ code: '6001', name: 'Insurance', kind: 'expense' });
    expect(snapshot.accounts.find((account) => account.id === 'checking-custom-categories').balanceCents).toBe(127_500n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 5_000n, expenseCents: 2_500n, netIncomeCents: 2_500n });

    const balance = await journalBalanceReportFromDatabase(database, setup.id, '2024-01-03');
    expect(balance.totalDebitsCents).toBe(balance.totalCreditsCents);
    await expect(store.createCategoryAccountInDatabase(database, {
      id: 'duplicate-insurance', businessId: setup.id, name: 'insurance', kind: 'expense',
    })).rejects.toThrow('already exists');
    database.close();
  });

  it('migrates M1 version-1 journal rows to the expanded account and journal types without breaking references', async () => {
    const database = new TestDatabase(databasePath());
    await createLegacyV1Books(database);
    await ensureBookkeepingSchema(database);

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(125_000n);
    expect(snapshot.transactions.map((transaction) => transaction.id)).toEqual(['opening-1']);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

    database.database.prepare(`INSERT INTO accounts
      (id, business_id, code, name, kind, category, created_at)
      VALUES ('property-1', 'business-1', 'property:1', 'Contributed property', 'asset', 'Member contribution', '2024-01-02')`).run();
    database.database.prepare(`INSERT INTO journal_entries
      (id, business_id, entry_date, entry_type, description, created_at)
      VALUES ('capital-entry-1', 'business-1', '2024-01-02', 'property-contribution', 'Property contribution', '2024-01-02')`).run();
    database.close();
  });

  it('rolls back the schema migration when existing journal rows contain an invalid account reference', async () => {
    const database = new TestDatabase(databasePath());
    await createLegacyV1Books(database);
    await database.execAsync(`
      PRAGMA foreign_keys = OFF;
      INSERT INTO journal_lines VALUES ('orphan-line', 'opening-entry-1', 'missing-account', 3, '0', '1');
      PRAGMA foreign_keys = ON;
    `);

    await expect(ensureBookkeepingSchema(database)).rejects.toThrow('schema migration found invalid record references');
    expect(database.database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version).toBe(1);
    expect(database.database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'accounts'").get().sql).toContain("'bank', 'cash', 'equity'");
    expect(database.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'member_capital_activity'").get()).toBeUndefined();
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toHaveLength(1);
    database.close();
  });

  it('posts cash and property contributions and distributions to member capital, cash, and assets only', async () => {
    const path = databasePath();
    let database = new TestDatabase(path);
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Operating checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'income-1', journalEntryId: 'income-entry-1', businessId: 'business-1', date: '2024-01-02',
      kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 40_000n,
      description: 'Synthetic service income',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-1', journalEntryId: 'expense-entry-1', businessId: 'business-1', date: '2024-01-02',
      kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent', amountCents: 9_000n,
      description: 'Synthetic rent expense',
    });
    await recordMemberCapitalActivityInDatabase(database, {
      id: 'cash-contribution-1', journalEntryId: 'cash-contribution-entry-1', businessId: 'business-1',
      memberId: 'member-1', date: '2024-01-03', kind: 'cash-contribution', cashAccountId: 'bank-1',
      amountCents: 10_000n, description: 'Synthetic cash contribution',
    });
    await recordMemberCapitalActivityInDatabase(database, {
      id: 'property-contribution-1', journalEntryId: 'property-contribution-entry-1', businessId: 'business-1',
      memberId: 'member-2', date: '2024-01-04', kind: 'property-contribution', propertyDescription: 'Used studio equipment',
      amountCents: 25_000n, description: 'Synthetic property contribution',
    });
    await recordMemberCapitalActivityInDatabase(database, {
      id: 'distribution-1', journalEntryId: 'distribution-entry-1', businessId: 'business-1',
      memberId: 'member-1', date: '2024-01-05', kind: 'distribution', cashAccountId: 'bank-1',
      amountCents: 3_000n, description: 'Synthetic member distribution',
    });
    database.close();

    database = new TestDatabase(path);
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(163_000n);
    expect(snapshot.accounts.find((account) => account.kind === 'asset').balanceCents).toBe(25_000n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 40_000n, expenseCents: 9_000n, netIncomeCents: 31_000n });
    expect(snapshot.transactions).toHaveLength(3);
    expect(snapshot.capitalActivities).toHaveLength(3);
    expect(snapshot.memberCapitalSummaries).toEqual([
      { memberId: 'member-1', memberName: 'Jordan Lee', cashContributionsCents: 10_000n, propertyContributionsCents: 0n, distributionsCents: 3_000n, bookCapitalActivityCents: 7_000n },
      { memberId: 'member-2', memberName: 'Casey Morgan', cashContributionsCents: 0n, propertyContributionsCents: 25_000n, distributionsCents: 0n, bookCapitalActivityCents: 25_000n },
      { memberId: 'member-3', memberName: 'Riley Patel', cashContributionsCents: 0n, propertyContributionsCents: 0n, distributionsCents: 0n, bookCapitalActivityCents: 0n },
      { memberId: 'member-4', memberName: 'Avery Kim', cashContributionsCents: 0n, propertyContributionsCents: 0n, distributionsCents: 0n, bookCapitalActivityCents: 0n },
    ]);
    expect(snapshot.capitalActivities.find((activity) => activity.id === 'property-contribution-1')).toMatchObject({
      requiresCpaReview: true,
      propertyDescription: 'Used studio equipment',
      amountCents: 25_000n,
    });
    const unbalanced = database.database.prepare(`
      SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.business_id = 'business-1' GROUP BY je.id
      HAVING SUM(CAST(jl.debit_minor AS INTEGER)) != SUM(CAST(jl.credit_minor AS INTEGER))
    `).all();
    expect(unbalanced).toEqual([]);
    const memberCapitalLines = database.database.prepare(`
      SELECT jl.account_id, SUM(CAST(jl.credit_minor AS INTEGER) - CAST(jl.debit_minor AS INTEGER)) AS capital_minor
      FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
      WHERE a.kind = 'equity' AND a.code LIKE 'member-capital:%' GROUP BY jl.account_id
    `).all();
    expect(memberCapitalLines.reduce((sum, row) => sum + Number(row.capital_minor), 0)).toBe(32_000);
    database.close();
  });

  it('rolls back an overdrawn cash distribution without partial journal or capital rows', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'cash-1', businessId: 'business-1', name: 'Petty cash', kind: 'cash',
      openingDate: '2024-01-01', openingBalanceCents: 1_000n,
      openingTransactionId: 'opening-cash-1', openingJournalEntryId: 'opening-cash-entry-1',
    });

    await expect(recordMemberCapitalActivityInDatabase(database, {
      id: 'distribution-too-large', journalEntryId: 'distribution-too-large-entry', businessId: 'business-1',
      memberId: 'member-1', date: '2024-01-02', kind: 'distribution', cashAccountId: 'cash-1',
      amountCents: 1_001n, description: 'Distribution above petty cash',
    })).rejects.toThrow('cash account balance would become negative');

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'cash-1').balanceCents).toBe(1_000n);
    expect(snapshot.capitalActivities).toEqual([]);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM journal_entries').get().count).toBe(1);
    expect(database.database.prepare("SELECT COUNT(*) AS count FROM accounts WHERE kind = 'equity' AND code LIKE 'member-capital:%'").get().count).toBe(0);
    database.close();
  });

  it('keeps obligations off the books, allocates partial payments by cash date, and reopens balances after a dated reversal', async () => {
    const path = databasePath();
    let database = new TestDatabase(path);
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Operating checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await createCashAccountInDatabase(database, {
      id: 'refund-bank', businessId: 'business-1', name: 'Refund checking', kind: 'bank', openingBalanceCents: 0n,
    });
    await createCashAccountInDatabase(database, {
      id: 'cash-small', businessId: 'business-1', name: 'Cash on hand', kind: 'cash', openingDate: '2024-01-01',
      openingBalanceCents: 500n, openingTransactionId: 'cash-opening', openingJournalEntryId: 'cash-opening-entry',
    });
    await createGuaranteedPaymentObligationInDatabase(database, {
      id: 'services-obligation', businessId: 'business-1', memberId: 'member-1',
      classification: 'services', recurrence: 'monthly', firstDueDate: '2026-12-31',
      installmentCount: 2, installmentAmountCents: 10_000n, description: 'Monthly service commitment',
    });
    await createGuaranteedPaymentObligationInDatabase(database, {
      id: 'capital-obligation', businessId: 'business-1', memberId: 'member-1',
      classification: 'use-of-capital', recurrence: 'one-time', firstDueDate: '2026-12-31',
      installmentCount: 1, installmentAmountCents: 7_500n, description: 'One-time capital commitment',
    });

    let snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(125_000n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n });
    expect(snapshot.guaranteedPaymentInstallments.map((installment) => [installment.dueDate, installment.outstandingAmountCents])).toEqual([
      ['2026-12-31', 7_500n], ['2026-12-31', 10_000n], ['2027-01-31', 10_000n],
    ]);
    expect(snapshot.guaranteedPaymentCashEvents).toEqual([]);
    await expect(recordGuaranteedPaymentInDatabase(database, {
      id: 'overallocated-payment', transactionId: 'overallocated-transaction', journalEntryId: 'overallocated-entry',
      businessId: 'business-1', memberId: 'member-1', date: '2027-01-05', cashAccountId: 'bank-1',
      description: 'Over-allocated payment', allocations: [
        { installmentId: 'services-obligation:installment:1', amountCents: 10_001n },
      ],
    })).rejects.toThrow('cannot exceed the installment balance');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM guaranteed_payment_payments').get().count).toBe(0);

    await createGuaranteedPaymentObligationInDatabase(database, {
      id: 'large-obligation', businessId: 'business-1', memberId: 'member-1',
      classification: 'services', recurrence: 'one-time', firstDueDate: '2027-01-05',
      installmentCount: 1, installmentAmountCents: 501n, description: 'Beyond available cash',
    });
    const beforeLateFailure = {
      entries: database.database.prepare('SELECT COUNT(*) AS count FROM journal_entries').get().count,
      transactions: database.database.prepare('SELECT COUNT(*) AS count FROM transactions').get().count,
    };
    await expect(recordGuaranteedPaymentInDatabase(database, {
      id: 'cash-short-payment', transactionId: 'cash-short-transaction', journalEntryId: 'cash-short-entry',
      businessId: 'business-1', memberId: 'member-1', date: '2027-01-05', cashAccountId: 'cash-small',
      description: 'Payment exceeds available cash', allocations: [
        { installmentId: 'large-obligation:installment:1', amountCents: 501n },
      ],
    })).rejects.toThrow('cash account balance would become negative');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM journal_entries').get().count).toBe(beforeLateFailure.entries);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM transactions').get().count).toBe(beforeLateFailure.transactions);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM guaranteed_payment_payments').get().count).toBe(0);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM guaranteed_payment_allocations').get().count).toBe(0);

    await recordGuaranteedPaymentInDatabase(database, {
      id: 'payment-1', transactionId: 'payment-transaction-1', journalEntryId: 'payment-entry-1',
      businessId: 'business-1', memberId: 'member-1', date: '2027-01-05', cashAccountId: 'bank-1',
      description: 'Partial service payment', allocations: [
        { installmentId: 'services-obligation:installment:1', amountCents: 4_000n },
        { installmentId: 'services-obligation:installment:2', amountCents: 2_000n },
      ],
    });
    await recordGuaranteedPaymentInDatabase(database, {
      id: 'payment-2', transactionId: 'payment-transaction-2', journalEntryId: 'payment-entry-2',
      businessId: 'business-1', memberId: 'member-1', date: '2027-01-20', cashAccountId: 'bank-1',
      description: 'Second partial service payment', allocations: [
        { installmentId: 'services-obligation:installment:1', amountCents: 4_000n },
      ],
    });
    await recordGuaranteedPaymentInDatabase(database, {
      id: 'payment-capital', transactionId: 'payment-transaction-capital', journalEntryId: 'payment-entry-capital',
      businessId: 'business-1', memberId: 'member-1', date: '2027-01-10', cashAccountId: 'bank-1',
      description: 'Actual use-of-capital payment', allocations: [
        { installmentId: 'capital-obligation:installment:1', amountCents: 2_500n },
      ],
    });
    expect(await cashBasisReportFromDatabase(database, 'business-1', '2026-12-31', '2026-12-31'))
      .toMatchObject({ expenseCents: 0n, netIncomeCents: 0n });
    expect(await cashBasisReportFromDatabase(database, 'business-1', '2027-01-01', '2027-01-31'))
      .toMatchObject({ expenseCents: 12_500n, netIncomeCents: -12_500n });

    await reverseGuaranteedPaymentInDatabase(database, {
      id: 'payment-reversal-1', paymentId: 'payment-1', reversalTransactionId: 'payment-reversal-transaction-1',
      reversalJournalEntryId: 'payment-reversal-entry-1', date: '2027-02-01',
      returnCashAccountId: 'refund-bank', reason: 'Synthetic cash refund',
    });
    await expect(reverseGuaranteedPaymentInDatabase(database, {
      id: 'payment-reversal-duplicate', paymentId: 'payment-1', reversalTransactionId: 'payment-reversal-transaction-2',
      reversalJournalEntryId: 'payment-reversal-entry-2', date: '2027-02-02',
      returnCashAccountId: 'refund-bank', reason: 'Duplicate reversal',
    })).rejects.toThrow('already been reversed');
    await expect(correctCashTransactionInDatabase(database, {
      correctionId: 'incorrect-gp-correction', originalTransactionId: 'payment-transaction-2',
      reversalTransactionId: 'incorrect-gp-reversal', reversalJournalEntryId: 'incorrect-gp-reversal-entry',
      replacement: {
        id: 'incorrect-gp-replacement', journalEntryId: 'incorrect-gp-replacement-entry', businessId: 'business-1',
        date: '2027-01-20', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
        amountCents: 1_000n, description: 'Replacement',
      },
    })).rejects.toThrow('Use the guaranteed payment reversal workflow');
    database.close();

    database = new TestDatabase(path);
    snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(112_500n);
    expect(snapshot.accounts.find((account) => account.id === 'refund-bank').balanceCents).toBe(6_000n);
    expect(snapshot.cashBasis.expenseCents).toBe(6_500n);
    expect(snapshot.guaranteedPaymentInstallments.map((installment) => installment.outstandingAmountCents)).toEqual([
      5_000n, 6_000n, 501n, 10_000n,
    ]);
    expect(snapshot.guaranteedPaymentCashEvents.map((event) => [event.kind, event.amountCents, event.date])).toEqual([
      ['payment', 6_000n, '2027-01-05'], ['payment', 2_500n, '2027-01-10'],
      ['payment', 4_000n, '2027-01-20'], ['reversal', -6_000n, '2027-02-01'],
    ]);
    expect(snapshot.guaranteedPaymentCashEvents.find((event) => event.kind === 'reversal').cashAccountName).toBe('Refund checking');
    expect(snapshot.transactions.filter((transaction) => transaction.isGuaranteedPayment)).toHaveLength(4);
    expect(snapshot.transactions.find((transaction) => transaction.id === 'payment-transaction-1')).toMatchObject({
      originalTransactionId: 'payment-transaction-1', isGuaranteedPayment: true,
    });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'payment-reversal-transaction-1')).toMatchObject({
      originalTransactionId: 'payment-transaction-1', correctionRole: 'reversal', isGuaranteedPayment: true,
      accountId: 'refund-bank', accountName: 'Refund checking',
    });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'payment-transaction-capital').category)
      .toBe('Guaranteed payments · use of capital');
    expect(await cashBasisReportFromDatabase(database, 'business-1', '2027-02-01', '2027-02-01'))
      .toMatchObject({ expenseCents: -6_000n, netIncomeCents: 6_000n });
    const unbalanced = database.database.prepare(`
      SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.business_id = 'business-1' GROUP BY je.id
      HAVING SUM(CAST(jl.debit_minor AS INTEGER)) != SUM(CAST(jl.credit_minor AS INTEGER))
    `).all();
    expect(unbalanced).toEqual([]);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });
  it('migrates v3 payment reversals and backfills the original cash account', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 10_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await createGuaranteedPaymentObligationInDatabase(database, {
      id: 'obligation-1', businessId: 'business-1', memberId: 'member-1', classification: 'services',
      recurrence: 'one-time', firstDueDate: '2024-01-02', installmentCount: 1,
      installmentAmountCents: 5_000n, description: 'One-time service payment',
    });
    await recordGuaranteedPaymentInDatabase(database, {
      id: 'payment-1', transactionId: 'payment-transaction-1', journalEntryId: 'payment-entry-1',
      businessId: 'business-1', memberId: 'member-1', date: '2024-01-02', cashAccountId: 'bank-1',
      description: 'Actual service payment',
      allocations: [{ installmentId: 'obligation-1:installment:1', amountCents: 5_000n }],
    });
    await reverseGuaranteedPaymentInDatabase(database, {
      id: 'reversal-1', paymentId: 'payment-1', reversalTransactionId: 'reversal-transaction-1',
      reversalJournalEntryId: 'reversal-entry-1', date: '2024-01-03', returnCashAccountId: 'bank-1', reason: 'Cash returned',
    });

    database.database.exec(`
      ALTER TABLE guaranteed_payment_reversals RENAME TO guaranteed_payment_reversals_v4;
      CREATE TABLE guaranteed_payment_reversals (
        id TEXT PRIMARY KEY NOT NULL,
        payment_id TEXT NOT NULL UNIQUE REFERENCES guaranteed_payment_payments(id),
        reversal_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
        reversal_journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
        reversal_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO guaranteed_payment_reversals
        (id, payment_id, reversal_transaction_id, reversal_journal_entry_id, reversal_date, reason, created_at)
      SELECT id, payment_id, reversal_transaction_id, reversal_journal_entry_id, reversal_date, reason, created_at
      FROM guaranteed_payment_reversals_v4;
      DROP TABLE guaranteed_payment_reversals_v4;
      DROP TABLE loan_repayments;
      DROP TABLE loan_advances;
      DROP TABLE loan_agreements;
      UPDATE bookkeeping_schema SET version = 3 WHERE singleton = 1;
    `);

    await ensureBookkeepingSchema(database);
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(database.database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version).toBe(11);
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(10_000n);
    expect(snapshot.guaranteedPaymentCashEvents.find((event) => event.kind === 'reversal')).toMatchObject({
      cashAccountName: 'Checking', reason: 'Cash returned', amountCents: -5_000n,
    });
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('stores loan commitments for members and third parties without posting cash or income', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    const before = await getBookkeepingSnapshotFromDatabase(database, 'business-1');

    await createLoanAgreementInDatabase(database, {
      id: 'member-loan', businessId: 'business-1', lenderType: 'member', memberId: 'member-1',
      agreementDate: '2024-01-02', commitmentCents: 250_000n, annualRateBasisPoints: 725,
      dayCount: 'ACT/365F', description: 'Jordan synthetic loan agreement',
    });
    await createLoanAgreementInDatabase(database, {
      id: 'third-party-loan', businessId: 'business-1', lenderType: 'third-party', lenderName: 'Synthetic Credit Union',
      agreementDate: '2024-01-03', commitmentCents: 500_000n, annualRateBasisPoints: 600,
      dayCount: 'ACT/ACT ISDA', description: 'Synthetic lender agreement',
    });

    const after = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(after.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(100_000n);
    expect(after.cashBasis).toEqual(before.cashBasis);
    expect(database.database.prepare("SELECT COUNT(*) AS count FROM journal_entries WHERE entry_type LIKE 'loan-%'").get().count).toBe(0);
    expect(database.database.prepare('SELECT kind FROM accounts WHERE id = ?').get('loan-liability:member-loan').kind).toBe('liability');
    expect(database.database.prepare(`
      SELECT id, lender_type AS lenderType, member_id AS memberId, lender_name AS lenderName,
             commitment_minor AS commitmentMinor, annual_rate_basis_points AS annualRateBasisPoints, day_count AS dayCount
      FROM loan_agreements ORDER BY id
    `).all()).toEqual([
      { id: 'member-loan', lenderType: 'member', memberId: 'member-1', lenderName: 'Jordan Lee', commitmentMinor: '250000', annualRateBasisPoints: 725, dayCount: 'ACT/365F' },
      { id: 'third-party-loan', lenderType: 'third-party', memberId: null, lenderName: 'Synthetic Credit Union', commitmentMinor: '500000', annualRateBasisPoints: 600, dayCount: 'ACT/ACT ISDA' },
    ]);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('rejects an ambiguous ACT/ACT label when creating a loan agreement', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);

    await expect(createLoanAgreementInDatabase(database, {
      id: 'ambiguous-loan', businessId: 'business-1', lenderType: 'member', memberId: 'member-1',
      agreementDate: '2024-01-01', commitmentCents: 100_000n, annualRateBasisPoints: 1_000,
      dayCount: 'ACT/ACT', description: 'Synthetic agreement with ambiguous convention',
    })).rejects.toThrow('ACT/ACT ISDA');

    expect(database.database.prepare('SELECT COUNT(*) AS count FROM loan_agreements').get().count).toBe(0);
    database.close();
  });

  it('migrates existing ACT/ACT agreements to the explicit ISDA calculation without losing advances', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-transaction', openingJournalEntryId: 'opening-journal',
    });
    await createLoanAgreementInDatabase(database, {
      id: 'legacy-act-act-loan', businessId: 'business-1', lenderType: 'member', memberId: 'member-1',
      agreementDate: '2024-01-01', commitmentCents: 100_000n, annualRateBasisPoints: 1_000,
      dayCount: 'ACT/ACT ISDA', description: 'Synthetic legacy migration agreement',
    });
    await recordLoanAdvanceInDatabase(database, {
      id: 'legacy-act-act-advance', transactionId: 'legacy-act-act-transaction',
      journalEntryId: 'legacy-act-act-journal', loanId: 'legacy-act-act-loan',
      date: '2024-01-02', cashAccountId: 'bank-1', amountCents: 25_000n,
      description: 'Synthetic advance to preserve across migration',
    });
    await recordLoanRepaymentInDatabase(database, {
      id: 'legacy-act-act-repayment', transactionId: 'legacy-act-act-repayment-transaction',
      journalEntryId: 'legacy-act-act-repayment-journal', loanId: 'legacy-act-act-loan',
      date: '2024-01-10', cashAccountId: 'bank-1', principalCents: 10_000n,
      interestCents: 22n, description: 'Synthetic repayment to preserve across migration',
    });

    database.database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      CREATE TABLE loan_agreements_v5 (
        id TEXT PRIMARY KEY NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        lender_type TEXT NOT NULL CHECK (lender_type IN ('member', 'third-party')),
        member_id TEXT REFERENCES members(id),
        lender_name TEXT NOT NULL,
        agreement_date TEXT NOT NULL,
        commitment_minor TEXT NOT NULL CHECK (CAST(commitment_minor AS INTEGER) > 0),
        annual_rate_basis_points INTEGER NOT NULL CHECK (annual_rate_basis_points BETWEEN 0 AND 100000),
        day_count TEXT NOT NULL CHECK (day_count IN ('ACT/365F', 'ACT/ACT')),
        description TEXT NOT NULL,
        liability_account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
        created_at TEXT NOT NULL,
        CHECK ((lender_type = 'member' AND member_id IS NOT NULL) OR (lender_type = 'third-party' AND member_id IS NULL))
      );
      INSERT INTO loan_agreements_v5
        (id, business_id, lender_type, member_id, lender_name, agreement_date, commitment_minor,
         annual_rate_basis_points, day_count, description, liability_account_id, created_at)
      SELECT id, business_id, lender_type, member_id, lender_name, agreement_date, commitment_minor,
             annual_rate_basis_points,
             CASE day_count WHEN 'ACT/ACT ISDA' THEN 'ACT/ACT' ELSE day_count END,
             description, liability_account_id, created_at
      FROM loan_agreements;
      DROP TABLE loan_agreements;
      ALTER TABLE loan_agreements_v5 RENAME TO loan_agreements;
      CREATE INDEX loan_agreements_business_lender
        ON loan_agreements (business_id, lender_type, member_id, agreement_date);
      UPDATE bookkeeping_schema SET version = 5 WHERE singleton = 1;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);

    await ensureBookkeepingSchema(database);
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(database.database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version).toBe(11);
    expect(snapshot.loanAgreements[0].dayCount).toBe('ACT/ACT ISDA');
    expect(snapshot.loanActivities.map((activity) => [activity.kind, activity.amountCents])).toEqual([
      ['advance', 25_000n], ['repayment', -10_022n],
    ]);
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(139_978n);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('migrates v6 journal tables to support transfers without changing persisted balances', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 50_000n,
      openingTransactionId: 'opening-migration', openingJournalEntryId: 'opening-migration-journal',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-migration', journalEntryId: 'expense-migration-journal', businessId: 'business-1',
      date: '2024-01-03', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
      amountCents: 5_000n, description: 'Synthetic rent before migration',
    });
    database.database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      CREATE TABLE journal_entries_v6 (
        id TEXT PRIMARY KEY NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        entry_date TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK (entry_type IN (
          'opening-balance', 'income', 'expense', 'reversal', 'cash-contribution',
          'property-contribution', 'member-distribution', 'loan-advance', 'loan-repayment'
        )),
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO journal_entries_v6 SELECT * FROM journal_entries;
      CREATE TABLE transactions_v6 (
        id TEXT PRIMARY KEY NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
        entry_date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('opening-balance', 'income', 'expense', 'reversal', 'loan-advance', 'loan-repayment')),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        category_account_id TEXT NOT NULL REFERENCES accounts(id),
        amount_minor TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO transactions_v6 SELECT * FROM transactions;
      DROP TABLE transactions;
      DROP TABLE journal_entries;
      ALTER TABLE journal_entries_v6 RENAME TO journal_entries;
      ALTER TABLE transactions_v6 RENAME TO transactions;
      CREATE INDEX journal_entries_business_date ON journal_entries (business_id, entry_date);
      CREATE INDEX transactions_business_date ON transactions (business_id, entry_date);
      UPDATE bookkeeping_schema SET version = 6 WHERE singleton = 1;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');

    expect(database.database.prepare('SELECT version FROM bookkeeping_schema WHERE singleton = 1').get().version).toBe(11);
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(45_000n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 5_000n, netIncomeCents: -5_000n });
    expect(snapshot.transactions.map((transaction) => transaction.id).sort()).toEqual(['expense-migration', 'opening-migration']);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    await createCashAccountInDatabase(database, { id: 'cash-after-migration', businessId: 'business-1', name: 'Savings', kind: 'cash' });
    await recordTransferInDatabase(database, {
      transactionId: 'transfer-after-migration', journalEntryId: 'transfer-after-migration-journal', businessId: 'business-1',
      date: '2024-01-04', sourceAccountId: 'bank-1', destinationAccountId: 'cash-after-migration',
      amountCents: 10_000n, description: 'Transfer after schema migration',
    });
    const afterTransfer = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(afterTransfer.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(35_000n);
    expect(afterTransfer.accounts.find((account) => account.id === 'cash-after-migration').balanceCents).toBe(10_000n);
    expect(afterTransfer.cashBasis).toEqual(snapshot.cashBasis);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('posts a transfer between bank and cash accounts with zero P&L and two reconciled CSV legs', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 50_000n,
      openingTransactionId: 'opening-transfer-transaction', openingJournalEntryId: 'opening-transfer-journal',
    });
    await createCashAccountInDatabase(database, {
      id: 'cash-1', businessId: 'business-1', name: 'Savings', kind: 'cash',
    });

    await recordTransferInDatabase(database, {
      transactionId: 'transfer-transaction-1', journalEntryId: 'transfer-journal-1',
      businessId: 'business-1', date: '2024-01-05', sourceAccountId: 'bank-1', destinationAccountId: 'cash-1',
      amountCents: 15_000n, description: 'Move funds to savings',
    });
    await expect(recordTransferInDatabase(database, {
      transactionId: 'cash-overdraft-transfer', journalEntryId: 'cash-overdraft-journal', businessId: 'business-1',
      date: '2024-01-04', sourceAccountId: 'cash-1', destinationAccountId: 'bank-1',
      amountCents: 16_000n, description: 'Must roll back an overdrawn cash transfer',
    })).rejects.toThrow('cash account balance would become negative');
    await expect(recordTransferInDatabase(database, {
      transactionId: 'same-account-transfer', journalEntryId: 'same-account-journal', businessId: 'business-1',
      date: '2024-01-05', sourceAccountId: 'bank-1', destinationAccountId: 'bank-1',
      amountCents: 1n, description: 'Must use two different accounts',
    })).rejects.toThrow('different');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM transactions').get().count).toBe(2);

    await correctCashTransactionInDatabase(database, {
      correctionId: 'transfer-correction-1', originalTransactionId: 'transfer-transaction-1',
      reversalTransactionId: 'transfer-reversal-transaction-1', reversalJournalEntryId: 'transfer-reversal-journal-1',
      replacement: {
        id: 'transfer-replacement-transaction-1', journalEntryId: 'transfer-replacement-journal-1',
        businessId: 'business-1', date: '2024-01-06', kind: 'transfer', accountId: 'bank-1', categoryAccountId: 'cash-1',
        amountCents: 17_500n, description: 'Corrected move to savings',
      },
    });

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(32_500n);
    expect(snapshot.accounts.find((account) => account.id === 'cash-1').balanceCents).toBe(17_500n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'transfer-transaction-1')).toMatchObject({
      kind: 'transfer', transferRole: 'transfer', accountId: 'bank-1', categoryAccountId: 'cash-1',
      amountCents: -15_000n, category: 'Savings',
    });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'transfer-reversal-transaction-1')).toMatchObject({
      kind: 'reversal', transferRole: 'transfer-reversal', correctionRole: 'reversal', amountCents: 15_000n,
    });
    expect(snapshot.transactions.find((transaction) => transaction.id === 'transfer-replacement-transaction-1')).toMatchObject({
      kind: 'transfer', transferRole: 'transfer', correctionRole: 'replacement', amountCents: -17_500n,
    });
    expect(database.database.prepare(`
      SELECT account_id AS account, debit_minor AS debit, credit_minor AS credit
      FROM journal_lines WHERE journal_entry_id = 'transfer-journal-1' ORDER BY line_number
    `).all()).toEqual([
      { account: 'cash-1', debit: '15000', credit: '0' },
      { account: 'bank-1', debit: '0', credit: '15000' },
    ]);
    const csvRows = transactionsCsv(snapshot).split('\r\n').filter((row) => row.includes('Transfer')).sort();
    expect(csvRows).toEqual([
      '"2024-01-05","Transfer out","-150.00","Checking","Move funds to savings"',
      '"2024-01-05","Transfer in","150.00","Savings","Move funds to savings"',
      '"2024-01-05","Transfer in","150.00","Checking","Reversal of: Move funds to savings"',
      '"2024-01-05","Transfer out","-150.00","Savings","Reversal of: Move funds to savings"',
      '"2024-01-06","Transfer out","-175.00","Checking","Corrected move to savings"',
      '"2024-01-06","Transfer in","175.00","Savings","Corrected move to savings"',
    ].sort());
    expect(database.database.prepare(`
      SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
      GROUP BY je.id HAVING SUM(CAST(jl.debit_minor AS INTEGER)) != SUM(CAST(jl.credit_minor AS INTEGER))
    `).all()).toEqual([]);
    database.close();
  });

  it('reconciles selected posted account movements and preserves statement history when reopened', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-reconciliation', openingJournalEntryId: 'opening-reconciliation-journal',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'income-reconciliation', journalEntryId: 'income-reconciliation-journal', businessId: 'business-1',
      date: '2024-01-10', kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services',
      amountCents: 20_000n, description: 'Synthetic cleared income',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-reconciliation', journalEntryId: 'expense-reconciliation-journal', businessId: 'business-1',
      date: '2024-01-12', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
      amountCents: 5_000n, description: 'Synthetic outstanding rent',
    });

    await createAccountReconciliationInDatabase(database, {
      id: 'reconciliation-1', businessId: 'business-1', accountId: 'bank-1',
      periodStartDate: '2024-01-01', statementDate: '2024-01-31',
      beginningBalanceCents: 100_000n, endingBalanceCents: 115_000n,
    });
    let snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    const reconciliation = snapshot.accountReconciliations.find((item) => item.id === 'reconciliation-1');
    expect(reconciliation.activities.map(({ transactionId, amountCents, cleared }) => [transactionId, amountCents, cleared])).toEqual([
      ['income-reconciliation', 20_000n, false],
      ['expense-reconciliation', -5_000n, false],
    ]);
    await setAccountReconciliationItemClearedInDatabase(database, 'reconciliation-1', 'income-reconciliation', true);
    await expect(completeAccountReconciliationInDatabase(database, 'reconciliation-1')).rejects.toThrow('difference must be zero');
    await setAccountReconciliationItemClearedInDatabase(database, 'reconciliation-1', 'expense-reconciliation', true);
    await completeAccountReconciliationInDatabase(database, 'reconciliation-1');

    snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accountReconciliations.find((item) => item.id === 'reconciliation-1')).toMatchObject({
      status: 'completed', beginningBalanceCents: 100_000n, endingBalanceCents: 115_000n,
      clearedMovementCents: 15_000n, differenceCents: 0n,
    });
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(115_000n);
    expect(snapshot.cashBasis).toEqual({ incomeCents: 20_000n, expenseCents: 5_000n, netIncomeCents: 15_000n });
    await expect(correctCashTransactionInDatabase(database, {
      correctionId: 'blocked-reconciled-correction', originalTransactionId: 'income-reconciliation',
      reversalTransactionId: 'blocked-reconciled-reversal', reversalJournalEntryId: 'blocked-reconciled-reversal-journal',
      replacement: {
        id: 'blocked-reconciled-replacement', journalEntryId: 'blocked-reconciled-replacement-journal',
        businessId: 'business-1', date: '2024-01-10', kind: 'income', accountId: 'bank-1',
        categoryAccountId: 'income-services', amountCents: 20_000n, description: 'Unchanged reconciliation',
      },
    })).rejects.toThrow('Reopen its reconciliation');

    await reopenAccountReconciliationInDatabase(database, 'reconciliation-1');
    snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accountReconciliations.find((item) => item.id === 'reconciliation-1').status).toBe('draft');
    expect(snapshot.accountReconciliationEvents.filter((event) => event.reconciliationId === 'reconciliation-1').map((event) => event.eventType)).toEqual([
      'created', 'item-cleared', 'item-cleared', 'completed', 'reopened',
    ]);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('keeps transfer legs available to reconcile independently for each bank account', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-source', businessId: 'business-1', name: 'Source bank', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-source', openingJournalEntryId: 'opening-source-journal',
    });
    await createCashAccountInDatabase(database, {
      id: 'bank-destination', businessId: 'business-1', name: 'Destination bank', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 50_000n,
      openingTransactionId: 'opening-destination', openingJournalEntryId: 'opening-destination-journal',
    });
    await recordTransferInDatabase(database, {
      transactionId: 'bank-transfer', journalEntryId: 'bank-transfer-journal', businessId: 'business-1',
      date: '2024-01-15', sourceAccountId: 'bank-source', destinationAccountId: 'bank-destination',
      amountCents: 20_000n, description: 'Synthetic interbank transfer',
    });

    await createAccountReconciliationInDatabase(database, {
      id: 'source-reconciliation', businessId: 'business-1', accountId: 'bank-source',
      periodStartDate: '2024-01-01', statementDate: '2024-01-31',
      beginningBalanceCents: 100_000n, endingBalanceCents: 80_000n,
    });
    await setAccountReconciliationItemClearedInDatabase(database, 'source-reconciliation', 'bank-transfer', true);
    await completeAccountReconciliationInDatabase(database, 'source-reconciliation');

    await createAccountReconciliationInDatabase(database, {
      id: 'destination-reconciliation', businessId: 'business-1', accountId: 'bank-destination',
      periodStartDate: '2024-01-01', statementDate: '2024-01-31',
      beginningBalanceCents: 50_000n, endingBalanceCents: 70_000n,
    });
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    const destination = snapshot.accountReconciliations.find((item) => item.id === 'destination-reconciliation');
    expect(destination.activities).toEqual([expect.objectContaining({
      transactionId: 'bank-transfer', amountCents: 20_000n, cleared: false,
    })]);
    await setAccountReconciliationItemClearedInDatabase(database, 'destination-reconciliation', 'bank-transfer', true);
    await completeAccountReconciliationInDatabase(database, 'destination-reconciliation');
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('builds a balanced trial balance and book balance sheet from journal lines through a date', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-report', businessId: 'business-1', name: 'Report checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-report', openingJournalEntryId: 'opening-report-journal',
    });
    await createCashAccountInDatabase(database, {
      id: 'bank-overdraft-report', businessId: 'business-1', name: 'Overdraft checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: -5_000n,
      openingTransactionId: 'opening-overdraft-report', openingJournalEntryId: 'opening-overdraft-report-journal',
    });
    await createCashAccountInDatabase(database, { id: 'cash-report', businessId: 'business-1', name: 'Petty cash', kind: 'cash' });
    await recordCashTransactionInDatabase(database, {
      id: 'income-report', journalEntryId: 'income-report-journal', businessId: 'business-1',
      date: '2024-01-10', kind: 'income', accountId: 'bank-report', categoryAccountId: 'income-services',
      amountCents: 40_000n, description: 'Synthetic report income',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-report', journalEntryId: 'expense-report-journal', businessId: 'business-1',
      date: '2024-01-12', kind: 'expense', accountId: 'bank-report', categoryAccountId: 'expense-rent',
      amountCents: 7_500n, description: 'Synthetic report rent',
    });
    await recordTransferInDatabase(database, {
      transactionId: 'transfer-report', journalEntryId: 'transfer-report-journal', businessId: 'business-1',
      date: '2024-01-15', sourceAccountId: 'bank-report', destinationAccountId: 'cash-report',
      amountCents: 10_000n, description: 'Synthetic report cash transfer',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'income-after-report-date', journalEntryId: 'income-after-report-date-journal', businessId: 'business-1',
      date: '2024-02-01', kind: 'income', accountId: 'bank-report', categoryAccountId: 'income-services',
      amountCents: 30_000n, description: 'Excluded after report date',
    });

    const report = await journalBalanceReportFromDatabase(database, 'business-1', '2024-01-31');
    const ledger = await generalLedgerReportFromDatabase(database, 'business-1', 'bank-report', '2024-01-31');

    expect(report.trialBalance.find((line) => line.accountId === 'bank-report')).toMatchObject({ debitCents: 122_500n, creditCents: 0n });
    expect(report.trialBalance.find((line) => line.accountId === 'bank-overdraft-report')).toMatchObject({ debitCents: 0n, creditCents: 5_000n });
    expect(report.trialBalance.find((line) => line.accountId === 'cash-report')).toMatchObject({ debitCents: 10_000n, creditCents: 0n });
    expect(report.trialBalance.find((line) => line.accountId === 'opening-equity')).toMatchObject({ debitCents: 0n, creditCents: 95_000n });
    expect(report.trialBalance.find((line) => line.accountId === 'income-services')).toMatchObject({ debitCents: 0n, creditCents: 40_000n });
    expect(report.trialBalance.find((line) => line.accountId === 'expense-rent')).toMatchObject({ debitCents: 7_500n, creditCents: 0n });
    expect(report.totalDebitsCents).toBe(140_000n);
    expect(report.totalCreditsCents).toBe(140_000n);
    expect(report.balanceSheet).toMatchObject({
      totalAssetsCents: 132_500n, totalLiabilitiesCents: 5_000n, bookEquityCents: 95_000n,
      currentEarningsCents: 32_500n, totalEquityCents: 127_500n, differenceCents: 0n,
    });
    expect(report.balanceSheet.liabilities).toContainEqual(expect.objectContaining({
      accountId: 'overdraft:bank-overdraft-report', name: 'Overdraft checking · bank overdraft', balanceCents: 5_000n,
    }));
    expect(ledger.lines.map(({ date, description, debitCents, creditCents, runningBalanceCents }) => [
      date, description, debitCents, creditCents, runningBalanceCents,
    ])).toEqual([
      ['2024-01-01', 'Opening balance · Report checking', 100_000n, 0n, 100_000n],
      ['2024-01-10', 'Synthetic report income', 40_000n, 0n, 140_000n],
      ['2024-01-12', 'Synthetic report rent', 0n, 7_500n, 132_500n],
      ['2024-01-15', 'Synthetic report cash transfer', 0n, 10_000n, 122_500n],
    ]);
    expect(ledger).toMatchObject({ totalDebitsCents: 140_000n, totalCreditsCents: 17_500n, endingBalanceCents: 122_500n });
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('posts multiple funded loan advances to cash and liability without treating proceeds as income', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await createLoanAgreementInDatabase(database, {
      id: 'member-loan', businessId: 'business-1', lenderType: 'member', memberId: 'member-1',
      agreementDate: '2024-01-02', commitmentCents: 50_000n, annualRateBasisPoints: 1000,
      dayCount: 'ACT/365F', description: 'Synthetic member loan',
    });
    const before = await getBookkeepingSnapshotFromDatabase(database, 'business-1');

    await recordLoanAdvanceInDatabase(database, {
      id: 'advance-1', transactionId: 'advance-transaction-1', journalEntryId: 'advance-entry-1',
      loanId: 'member-loan', date: '2024-01-10', cashAccountId: 'bank-1', amountCents: 30_000n,
      description: 'First funded advance',
    });
    const beforeLateFailure = {
      entries: database.database.prepare('SELECT COUNT(*) AS count FROM journal_entries').get().count,
      transactions: database.database.prepare('SELECT COUNT(*) AS count FROM transactions').get().count,
    };
    await expect(recordLoanAdvanceInDatabase(database, {
      id: 'advance-duplicate', transactionId: 'advance-transaction-1', journalEntryId: 'advance-duplicate-entry',
      loanId: 'member-loan', date: '2024-01-11', cashAccountId: 'bank-1', amountCents: 1_000n,
      description: 'Must roll back on duplicate transaction ID',
    })).rejects.toThrow();
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM journal_entries').get().count).toBe(beforeLateFailure.entries);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM transactions').get().count).toBe(beforeLateFailure.transactions);
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM loan_advances').get().count).toBe(1);

    await recordLoanAdvanceInDatabase(database, {
      id: 'advance-2', transactionId: 'advance-transaction-2', journalEntryId: 'advance-entry-2',
      loanId: 'member-loan', date: '2024-02-15', cashAccountId: 'bank-1', amountCents: 20_000n,
      description: 'Second dated advance',
    });
    const after = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(after.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(150_000n);
    expect(after.accounts.find((account) => account.id === 'loan-liability:member-loan').balanceCents).toBe(50_000n);
    expect(after.cashBasis).toEqual(before.cashBasis);
    expect(after.transactions.filter((transaction) => transaction.kind === 'loan-advance').map((transaction) => transaction.amountCents))
      .toEqual([20_000n, 30_000n]);
    expect(after.loanActivities.map((activity) => [activity.date, activity.kind, activity.amountCents])).toEqual([
      ['2024-01-10', 'advance', 30_000n], ['2024-02-15', 'advance', 20_000n],
    ]);
    const unbalanced = database.database.prepare(`
      SELECT je.id FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.business_id = 'business-1' GROUP BY je.id
      HAVING SUM(CAST(jl.debit_minor AS INTEGER)) != SUM(CAST(jl.credit_minor AS INTEGER))
    `).all();
    expect(unbalanced).toEqual([]);
    await expect(recordLoanAdvanceInDatabase(database, {
      id: 'advance-overcommit', transactionId: 'advance-overcommit-transaction', journalEntryId: 'advance-overcommit-entry',
      loanId: 'member-loan', date: '2024-03-01', cashAccountId: 'bank-1', amountCents: 1n,
      description: 'Exceeds commitment',
    })).rejects.toThrow('commitment');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM loan_advances').get().count).toBe(2);
    expect(database.database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    database.close();
  });

  it('records mixed principal and interest repayments with journal, cash, P&L, and persisted loan activity in sync', async () => {
    const path = databasePath();
    let database = new TestDatabase(path);
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await createLoanAgreementInDatabase(database, {
      id: 'member-loan', businessId: 'business-1', lenderType: 'member', memberId: 'member-1',
      agreementDate: '2024-01-01', commitmentCents: 100_000n, annualRateBasisPoints: 1_000,
      dayCount: 'ACT/365F', description: 'Synthetic 10 percent member loan',
    });
    await recordLoanAdvanceInDatabase(database, {
      id: 'advance-1', transactionId: 'advance-tx-1', journalEntryId: 'advance-je-1', loanId: 'member-loan',
      date: '2024-01-01', cashAccountId: 'bank-1', amountCents: 50_000n, description: 'First advance',
    });
    await recordLoanAdvanceInDatabase(database, {
      id: 'advance-2', transactionId: 'advance-tx-2', journalEntryId: 'advance-je-2', loanId: 'member-loan',
      date: '2024-01-11', cashAccountId: 'bank-1', amountCents: 50_000n, description: 'Second advance',
    });

    const { recordLoanRepaymentInDatabase } = await import('../src/bookkeeping-store.ts');
    expect(recordLoanRepaymentInDatabase).toBeTypeOf('function');
    await recordLoanRepaymentInDatabase(database, {
      id: 'repayment-1', transactionId: 'repayment-tx-1', journalEntryId: 'repayment-je-1',
      loanId: 'member-loan', date: '2024-01-21', cashAccountId: 'bank-1',
      principalCents: 10_000n, interestCents: 411n, description: 'First synthetic mixed repayment',
    });

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(189_589n);
    expect(snapshot.accounts.find((account) => account.id === 'loan-liability:member-loan').balanceCents).toBe(90_000n);
    expect(snapshot.accounts.find((account) => account.id === 'loan-interest:business-1').balanceCents).toBe(411n);
    expect(snapshot.cashBasis.expenseCents).toBe(411n);
    expect(snapshot.transactions.find((transaction) => transaction.id === 'repayment-tx-1')).toMatchObject({
      kind: 'loan-repayment', amountCents: -10_411n, categoryAccountId: 'loan-liability:member-loan', category: 'Loan repayment',
    });
    expect(snapshot.loanActivities.at(-1)).toMatchObject({
      id: 'repayment-1', kind: 'repayment', principalCents: 10_000n, interestCents: 411n,
      amountCents: -10_411n, date: '2024-01-21',
    });
    expect(database.database.prepare(`
      SELECT SUM(CAST(jl.debit_minor AS INTEGER)) AS debits, SUM(CAST(jl.credit_minor AS INTEGER)) AS credits
      FROM journal_lines jl WHERE jl.journal_entry_id = 'repayment-je-1'
    `).get()).toEqual({ debits: 10_411, credits: 10_411 });

    await recordLoanRepaymentInDatabase(database, {
      id: 'repayment-2', transactionId: 'repayment-tx-2', journalEntryId: 'repayment-je-2',
      loanId: 'member-loan', date: '2024-02-20', cashAccountId: 'bank-1',
      principalCents: 0n, interestCents: 740n, description: 'Interest-only synthetic repayment',
    });
    const afterInterestOnly = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(afterInterestOnly.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(188_849n);
    expect(afterInterestOnly.accounts.find((account) => account.id === 'loan-liability:member-loan').balanceCents).toBe(90_000n);
    expect(afterInterestOnly.accounts.find((account) => account.id === 'loan-interest:business-1').balanceCents).toBe(1_151n);
    expect(afterInterestOnly.cashBasis).toEqual({ incomeCents: 0n, expenseCents: 1_151n, netIncomeCents: -1_151n });
    expect(afterInterestOnly.loanActivities.at(-1)).toMatchObject({
      id: 'repayment-2', principalCents: 0n, interestCents: 740n, amountCents: -740n,
    });
    await recordLoanRepaymentInDatabase(database, {
      id: 'repayment-3', transactionId: 'repayment-tx-3', journalEntryId: 'repayment-je-3',
      loanId: 'member-loan', date: '2024-03-01', cashAccountId: 'bank-1',
      principalCents: 90_000n, interestCents: 0n, description: 'Principal-only synthetic repayment',
    });
    const afterPrincipalOnly = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(afterPrincipalOnly.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(98_849n);
    expect(afterPrincipalOnly.accounts.find((account) => account.id === 'loan-liability:member-loan').balanceCents).toBe(0n);
    expect(afterPrincipalOnly.cashBasis.expenseCents).toBe(1_151n);
    expect(afterPrincipalOnly.loanActivities.at(-1)).toMatchObject({
      id: 'repayment-3', principalCents: 90_000n, interestCents: 0n, amountCents: -90_000n,
    });

    database.close();
    database = new TestDatabase(path);
    await ensureBookkeepingSchema(database);
    const reopened = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(reopened.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(98_849n);
    expect(reopened.accounts.find((account) => account.id === 'loan-liability:member-loan').balanceCents).toBe(0n);
    expect(reopened.loanActivities.map((activity) => [activity.kind, activity.principalCents, activity.interestCents]))
      .toEqual([
        ['advance', 0n, 0n], ['advance', 0n, 0n], ['repayment', 10_000n, 411n],
        ['repayment', 0n, 740n], ['repayment', 90_000n, 0n],
      ]);
    database.close();
  });

  it('rejects principal and interest overpayments atomically and keeps loan activity out of generic correction', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 100_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await createCashAccountInDatabase(database, {
      id: 'cash-empty', businessId: 'business-1', name: 'Petty cash', kind: 'cash',
    });
    await createLoanAgreementInDatabase(database, {
      id: 'loan-1', businessId: 'business-1', lenderType: 'third-party', lenderName: 'Synthetic lender',
      agreementDate: '2024-01-01', commitmentCents: 50_000n, annualRateBasisPoints: 1_000,
      dayCount: 'ACT/365F', description: 'Synthetic loan',
    });
    await recordLoanAdvanceInDatabase(database, {
      id: 'advance-1', transactionId: 'advance-tx-1', journalEntryId: 'advance-je-1', loanId: 'loan-1',
      date: '2024-01-01', cashAccountId: 'bank-1', amountCents: 10_000n, description: 'Funded advance',
    });
    const { recordLoanRepaymentInDatabase } = await import('../src/bookkeeping-store.ts');
    expect(recordLoanRepaymentInDatabase).toBeTypeOf('function');
    const before = await getBookkeepingSnapshotFromDatabase(database, 'business-1');

    await expect(recordLoanRepaymentInDatabase(database, {
      id: 'principal-overpay', transactionId: 'principal-overpay-tx', journalEntryId: 'principal-overpay-je',
      loanId: 'loan-1', date: '2024-01-10', cashAccountId: 'bank-1',
      principalCents: 10_001n, interestCents: 0n, description: 'Principal exceeds outstanding',
    })).rejects.toThrow('outstanding principal');
    await expect(recordLoanRepaymentInDatabase(database, {
      id: 'interest-overpay', transactionId: 'interest-overpay-tx', journalEntryId: 'interest-overpay-je',
      loanId: 'loan-1', date: '2024-01-10', cashAccountId: 'bank-1',
      principalCents: 0n, interestCents: 26n, description: 'Interest exceeds accrued amount',
    })).rejects.toThrow('accrued interest');
    await expect(recordLoanRepaymentInDatabase(database, {
      id: 'cash-overdraw', transactionId: 'cash-overdraw-tx', journalEntryId: 'cash-overdraw-je',
      loanId: 'loan-1', date: '2024-01-10', cashAccountId: 'cash-empty',
      principalCents: 0n, interestCents: 25n, description: 'Must roll back when petty cash is empty',
    })).rejects.toThrow('cash account balance would become negative');
    const after = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(after.transactions).toEqual(before.transactions);
    expect(after.loanActivities).toEqual(before.loanActivities);
    expect(after.accounts.map((account) => [account.id, account.balanceCents]))
      .toEqual(before.accounts.map((account) => [account.id, account.balanceCents]));
    await recordLoanRepaymentInDatabase(database, {
      id: 'interest-only', transactionId: 'interest-only-tx', journalEntryId: 'interest-only-je',
      loanId: 'loan-1', date: '2024-01-10', cashAccountId: 'bank-1',
      principalCents: 0n, interestCents: 25n, description: 'Pay accrued interest only',
    });
    const beforeBackdated = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    await expect(recordLoanRepaymentInDatabase(database, {
      id: 'backdated-principal', transactionId: 'backdated-principal-tx', journalEntryId: 'backdated-principal-je',
      loanId: 'loan-1', date: '2024-01-08', cashAccountId: 'bank-1',
      principalCents: 5_000n, interestCents: 0n, description: 'Would invalidate later interest payment',
    })).rejects.toThrow('accrued interest');
    const afterBackdated = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(afterBackdated.transactions).toEqual(beforeBackdated.transactions);
    expect(afterBackdated.loanActivities).toEqual(beforeBackdated.loanActivities);
    await expect(correctCashTransactionInDatabase(database, {
      correctionId: 'correction-loan', originalTransactionId: 'advance-tx-1',
      reversalTransactionId: 'loan-reversal', reversalJournalEntryId: 'loan-reversal-je',
      replacement: {
        id: 'loan-replacement', journalEntryId: 'loan-replacement-je', businessId: 'business-1',
        date: '2024-01-11', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-other',
        amountCents: 1n, description: 'Must not alter loan activity',
      },
    })).rejects.toThrow('original income or expense');
    expect(database.database.prepare('SELECT COUNT(*) AS count FROM loan_repayments').get().count).toBe(1);
    database.close();
  });

  it('persists business, member interests, account, opening balance, income, and expense across reopen', async () => {
    const path = databasePath();
    let database = new TestDatabase(path);
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1',
      businessId: 'business-1',
      name: 'Operating checking',
      kind: 'bank',
      openingDate: '2024-01-01',
      openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-1',
      openingJournalEntryId: 'opening-entry-1',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'income-1',
      journalEntryId: 'income-entry-1',
      businessId: 'business-1',
      date: '2024-01-05',
      kind: 'income',
      accountId: 'bank-1',
      categoryAccountId: 'income-services',
      amountCents: 40_000n,
      description: 'Synthetic client payment',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-1',
      journalEntryId: 'expense-entry-1',
      businessId: 'business-1',
      date: '2024-01-09',
      kind: 'expense',
      accountId: 'bank-1',
      categoryAccountId: 'expense-supplies',
      amountCents: 7_500n,
      description: 'Synthetic office supplies',
    });
    database.close();

    database = new TestDatabase(path);
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.business.name).toBe('Northstar Studio LLC');
    expect(snapshot.members.map((member) => member.ownershipBasisPoints)).toEqual([4_000, 2_000, 2_000, 2_000]);
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(157_500n);
    expect(snapshot.cashBasis.incomeCents).toBe(40_000n);
    expect(snapshot.cashBasis.expenseCents).toBe(7_500n);
    expect(snapshot.cashBasis.netIncomeCents).toBe(32_500n);
    expect(snapshot.transactions).toHaveLength(3);

    await correctCashTransactionInDatabase(database, {
      correctionId: 'correction-after-reopen',
      originalTransactionId: 'expense-1',
      reversalTransactionId: 'reversal-after-reopen',
      reversalJournalEntryId: 'reversal-entry-after-reopen',
      replacement: {
        id: 'replacement-after-reopen', journalEntryId: 'replacement-entry-after-reopen',
        businessId: 'business-1', date: '2024-01-10', kind: 'expense', accountId: 'bank-1',
        categoryAccountId: 'expense-rent', amountCents: 9_000n, description: 'Corrected synthetic rent',
      },
    });
    const corrected = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(corrected.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(156_000n);
    expect(corrected.cashBasis).toEqual({ incomeCents: 40_000n, expenseCents: 9_000n, netIncomeCents: 31_000n });
    expect(corrected.transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0n)).toBe(156_000n);
    expect(corrected.transactions).toHaveLength(5);
    const correctedPeriod = await cashBasisReportFromDatabase(database, 'business-1', '2024-01-10', '2024-01-10');
    expect(correctedPeriod).toEqual({ fromDate: '2024-01-10', throughDate: '2024-01-10', incomeCents: 0n, expenseCents: 9_000n, netIncomeCents: -9_000n });
    const csv = transactionsCsv(corrected);
    expect(csv).toContain('"2024-01-10","Rent","-90.00","Operating checking","Corrected synthetic rent"');
    database.close();
  });

  it('rolls back a transaction when its category is not an expense account', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, { id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank' });
    await expect(recordCashTransactionInDatabase(database, {
      id: 'bad-transaction',
      journalEntryId: 'bad-entry',
      businessId: 'business-1',
      date: '2024-01-09',
      kind: 'expense',
      accountId: 'bank-1',
      categoryAccountId: 'income-services',
      amountCents: 100n,
      description: 'Invalid account classification',
    })).rejects.toThrow('expense account');
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.transactions).toEqual([]);
    database.close();
  });

  it('reverses and replaces a posted transaction while preserving a reconciled history and CSV', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank',
      openingDate: '2024-01-01', openingBalanceCents: 125_000n,
      openingTransactionId: 'opening-1', openingJournalEntryId: 'opening-entry-1',
    });
    await recordCashTransactionInDatabase(database, {
      id: 'expense-1', journalEntryId: 'expense-entry-1', businessId: 'business-1', date: '2024-01-05',
      kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-supplies', amountCents: 7_500n,
      description: 'Original supplies amount',
    });

    await correctCashTransactionInDatabase(database, {
      correctionId: 'correction-1',
      originalTransactionId: 'expense-1',
      reversalTransactionId: 'reversal-1',
      reversalJournalEntryId: 'reversal-entry-1',
      replacement: {
        id: 'replacement-1', journalEntryId: 'replacement-entry-1', businessId: 'business-1',
        date: '2024-01-10', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
        amountCents: 9_000n, description: 'Corrected rent amount',
      },
    });

    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(116_000n);
    expect(snapshot.cashBasis.expenseCents).toBe(9_000n);
    expect(snapshot.transactions).toHaveLength(4);
    expect(snapshot.transactions.find((transaction) => transaction.id === 'expense-1').originalTransactionId).toBe('expense-1');
    expect(snapshot.transactions.find((transaction) => transaction.id === 'reversal-1').correctionRole).toBe('reversal');
    expect(snapshot.transactions.find((transaction) => transaction.id === 'replacement-1').correctionRole).toBe('replacement');
    expect(snapshot.transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0n)).toBe(116_000n);
    const csv = transactionsCsv(snapshot);
    expect(csv).toContain('"Date","Category","Amount","Account","Description"');
    expect(csv).toContain('"2024-01-10","Rent","-90.00","Checking","Corrected rent amount"');

    await expect(correctCashTransactionInDatabase(database, {
      correctionId: 'correction-2',
      originalTransactionId: 'expense-1',
      reversalTransactionId: 'reversal-2',
      reversalJournalEntryId: 'reversal-entry-2',
      replacement: {
        id: 'replacement-2', journalEntryId: 'replacement-entry-2', businessId: 'business-1',
        date: '2024-01-11', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-rent',
        amountCents: 1n, description: 'Second replacement',
      },
    })).rejects.toThrow('already been corrected');
    database.close();
  });

  it('preserves dated ownership history when interests change', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await replaceMembersInDatabase(database, {
      businessId: 'business-1',
      effectiveDate: '2025-01-01',
      ownershipConfirmed: true,
      members: [
        { id: 'member-1', name: 'Jordan Lee', ownershipBasisPoints: 3_000 },
        { id: 'member-2', name: 'Casey Morgan', ownershipBasisPoints: 3_000 },
        { id: 'member-3', name: 'Riley Patel', ownershipBasisPoints: 2_000 },
        { id: 'member-4', name: 'Avery Kim', ownershipBasisPoints: 2_000 },
      ],
    });
    const snapshot = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(snapshot.members.map((member) => member.ownershipBasisPoints)).toEqual([3_000, 3_000, 2_000, 2_000]);
    expect(snapshot.memberHistory.find((member) => member.id === 'member-1' && member.effectiveFrom === '2024-01-01').effectiveTo)
      .toBe('2024-12-31');
    expect(snapshot.memberHistory.find((member) => member.id === 'member-1' && member.effectiveFrom === '2025-01-01').effectiveTo)
      .toBe(null);

    await expect(replaceMembersInDatabase(database, {
      businessId: 'business-1',
      effectiveDate: '2025-02-01',
      ownershipConfirmed: true,
      members: snapshot.members.map((member) => ({ ...member, ownershipBasisPoints: member.ownershipBasisPoints - 100 })),
    })).rejects.toThrow('total 100%');
    database.close();
  });

  it('does not allow a cash account to become negative while bank overdrafts remain recordable', async () => {
    const database = new TestDatabase(databasePath());
    await ensureBookkeepingSchema(database);
    await createBusinessInDatabase(database, setup);
    await createCashAccountInDatabase(database, {
      id: 'cash-1', businessId: 'business-1', name: 'Petty cash', kind: 'cash',
      openingDate: '2024-01-01', openingBalanceCents: 5_000n,
      openingTransactionId: 'cash-opening-1', openingJournalEntryId: 'cash-opening-entry-1',
    });
    await expect(recordCashTransactionInDatabase(database, {
      id: 'cash-overdraw-1', journalEntryId: 'cash-overdraw-entry-1', businessId: 'business-1', date: '2024-01-02',
      kind: 'expense', accountId: 'cash-1', categoryAccountId: 'expense-supplies', amountCents: 7_500n,
      description: 'More cash than available',
    })).rejects.toThrow('cash account balance would become negative');
    const afterRejectedCashExpense = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(afterRejectedCashExpense.accounts.find((account) => account.id === 'cash-1').balanceCents).toBe(5_000n);
    expect(afterRejectedCashExpense.transactions).toHaveLength(1);

    await createCashAccountInDatabase(database, { id: 'bank-1', businessId: 'business-1', name: 'Checking', kind: 'bank' });
    await recordCashTransactionInDatabase(database, {
      id: 'bank-overdraw-1', journalEntryId: 'bank-overdraw-entry-1', businessId: 'business-1', date: '2024-01-02',
      kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-supplies', amountCents: 7_500n,
      description: 'Synthetic bank overdraft',
    });
    const afterBankExpense = await getBookkeepingSnapshotFromDatabase(database, 'business-1');
    expect(afterBankExpense.accounts.find((account) => account.id === 'bank-1').balanceCents).toBe(-7_500n);
    database.close();
  });
});
