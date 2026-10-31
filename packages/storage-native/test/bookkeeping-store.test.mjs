import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBusinessInDatabase,
  createCashAccountInDatabase,
  ensureBookkeepingSchema,
  getBookkeepingSnapshotFromDatabase,
  recordCashTransactionInDatabase,
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
});
