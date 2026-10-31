import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cashBasisReportFromDatabase,
  createBusinessInDatabase,
  createCashAccountInDatabase,
  correctCashTransactionInDatabase,
  ensureBookkeepingSchema,
  getBookkeepingSnapshotFromDatabase,
  recordMemberCapitalActivityInDatabase,
  recordCashTransactionInDatabase,
  replaceMembersInDatabase,
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
