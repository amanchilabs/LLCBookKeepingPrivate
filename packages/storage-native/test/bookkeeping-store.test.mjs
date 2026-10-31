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

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('bookkeeping repository SQL contract', () => {
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
