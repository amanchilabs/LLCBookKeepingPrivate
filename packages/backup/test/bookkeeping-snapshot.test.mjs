// Host evidence only: these tests exercise SQL behaviour against real file-backed
// SQLite through the Node adapter. They do not certify native SQLCipher, Keychain,
// crash durability or physical-device recovery. All data is synthetic.
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createBusinessInDatabase,
  createCashAccountInDatabase,
  ensureBookkeepingSchema,
  listBusinessProfilesFromDatabase,
  recordCashTransactionInDatabase,
  setActiveBusinessInDatabase,
} from '../../storage-native/src/bookkeeping-store.ts';
import {
  BOOKKEEPING_DATASET_FORMAT,
  BOOKKEEPING_DATASET_FORMAT_VERSION,
  BOOKKEEPING_DATASET_SCHEMA_VERSION,
  BOOKKEEPING_DATASET_TABLES,
  BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES,
  BOOKKEEPING_SCHEMA_METADATA_TABLE,
  bookkeepingDatasetColumnSqlType,
  compareBookkeepingDatasets,
  parseBookkeepingDataset,
  serializeBookkeepingDataset,
  validateBookkeepingDatasetSnapshot,
} from '../src/bookkeeping-dataset.ts';
import {
  exportBookkeepingDataset,
  importBookkeepingDatasetIntoEmptyDatabase,
  verifyBookkeepingDatasetInDatabase,
} from '../src/bookkeeping-snapshot.ts';

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

class RecordingDatabase extends TestDatabase {
  statements = [];
  onReadAll = null;

  async execAsync(sql) {
    this.statements.push(sql.trim());
    return await super.execAsync(sql);
  }

  async runAsync(sql, ...parameters) {
    this.statements.push(sql.trim());
    return await super.runAsync(sql, ...parameters);
  }

  async getFirstAsync(sql, ...parameters) {
    this.statements.push(sql.trim());
    return await super.getFirstAsync(sql, ...parameters);
  }

  async getAllAsync(sql, ...parameters) {
    this.statements.push(sql.trim());
    if (this.onReadAll) this.onReadAll(sql);
    return await super.getAllAsync(sql, ...parameters);
  }
}

class FaultInjectingDatabase extends TestDatabase {
  failRollback = false;
  rollbackError = new Error('simulated rollback cleanup failure');

  async execAsync(sql) {
    if (this.failRollback && sql.trim() === 'ROLLBACK;') {
      throw this.rollbackError;
    }
    return await super.execAsync(sql);
  }
}

const AT = '2024-06-01T12:00:00.000Z';
const LARGE_MINOR = '9007199254740993123'; // exceeds 2^53; must survive as exact text
const UNICODE_DESCRIPTION = 'Café — synthetic résumé 📒 "quoted", comma';

const directories = [];
const openDatabases = [];
let templatePath = null;

function newDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'llc-bookkeeping-dataset-test-'));
  directories.push(directory);
  return directory;
}

function open(path, DatabaseClass = TestDatabase) {
  const database = new DatabaseClass(path);
  openDatabases.push(database);
  return database;
}

function closeAll() {
  for (const database of openDatabases.splice(0)) {
    try {
      database.close();
    } catch {
      // already closed by the test
    }
  }
}

afterEach(closeAll);
afterAll(() => {
  closeAll();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function insertRow(database, table, row) {
  const columns = Object.keys(row);
  await database.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    ...Object.values(row),
  );
}

async function insertAccount(database, id, code, name, kind, category) {
  await insertRow(database, 'accounts', {
    id, business_id: 'business-1', code, name, kind, category, is_system: 0, is_active: 1, created_at: AT,
  });
}

/** Posts a balanced synthetic journal entry and, optionally, its transaction row. */
async function postEntry(database, { entryId, date, entryType, description, lines, transaction }) {
  await insertRow(database, 'journal_entries', {
    id: entryId, business_id: 'business-1', entry_date: date, entry_type: entryType, description, created_at: AT,
  });
  for (const [index, [accountId, debit, credit]] of lines.entries()) {
    await insertRow(database, 'journal_lines', {
      id: `${entryId}:line:${index + 1}`, journal_entry_id: entryId, account_id: accountId,
      line_number: index + 1, debit_minor: debit, credit_minor: credit,
    });
  }
  if (transaction) {
    await insertRow(database, 'transactions', {
      id: transaction.id, business_id: 'business-1', journal_entry_id: entryId, entry_date: date,
      kind: transaction.kind, account_id: transaction.accountId, category_account_id: transaction.categoryAccountId,
      amount_minor: transaction.amount, description, created_at: AT,
    });
  }
}

/**
 * Synthetic books with at least one row in every inventoried table: two
 * workspaces, ownership history, corrections, splits, capital, loans,
 * guaranteed payments, recurring items, reminders, period events and
 * reconciliation history.
 */
async function seedCompleteBooks(database) {
  await ensureBookkeepingSchema(database);
  await createBusinessInDatabase(database, {
    id: 'business-1', name: 'Northstar Studio LLC', formationState: 'AZ', formationDate: '2024-03-01',
    bookkeepingStartDate: '2024-01-01', ownershipConfirmed: true,
    members: [
      { id: 'member-1', name: 'Jordan Lee', ownershipBasisPoints: 6_000 },
      { id: 'member-2', name: 'Casey Morgan', ownershipBasisPoints: 4_000 },
    ],
  });
  await createBusinessInDatabase(database, {
    id: 'business-2', name: 'Harbor Single LLC', formationState: 'CA', formationDate: '2023-05-01',
    bookkeepingStartDate: '2023-05-01', ownershipConfirmed: true,
    members: [{ id: 'member-b2-1', name: 'Sam Rivera', ownershipBasisPoints: 10_000 }],
  });
  await setActiveBusinessInDatabase(database, 'business-1');
  await createCashAccountInDatabase(database, {
    id: 'bank-1', businessId: 'business-1', name: 'Operating checking', kind: 'bank',
    openingDate: '2024-01-01', openingBalanceCents: 100_000n,
    openingTransactionId: 'txn-opening-1', openingJournalEntryId: 'je-opening-1',
  });
  await createCashAccountInDatabase(database, {
    id: 'b2-bank-1', businessId: 'business-2', name: 'Harbor checking', kind: 'bank',
    openingDate: '2023-05-01', openingBalanceCents: 7_500n,
    openingTransactionId: 'b2-txn-opening-1', openingJournalEntryId: 'b2-je-opening-1',
  });
  await recordCashTransactionInDatabase(database, {
    id: 'txn-income-1', journalEntryId: 'je-income-1', businessId: 'business-1', date: '2024-01-10',
    kind: 'income', accountId: 'bank-1', categoryAccountId: 'income-services', amountCents: 25_000n,
    description: UNICODE_DESCRIPTION,
  });
  await recordCashTransactionInDatabase(database, {
    id: 'txn-expense-1', journalEntryId: 'je-expense-1', businessId: 'business-1', date: '2024-01-12',
    kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-supplies', amountCents: 4_000n,
    description: 'Synthetic supplies',
  });

  // Retired member with closed ownership history.
  await insertRow(database, 'members', {
    id: 'member-retired', business_id: 'business-1', name: 'Morgan Retired', created_at: AT,
    retired_at: '2024-05-31T00:00:00.000Z',
  });
  await insertRow(database, 'member_interest_history', {
    id: 'member-retired:interest:2024-01-01', business_id: 'business-1', member_id: 'member-retired',
    ownership_basis_points: 0, effective_from: '2024-01-01', effective_to: '2024-05-31', created_at: AT,
  });

  await insertAccount(database, 'capital-member-1', '3190', 'Synthetic member capital', 'equity', 'Member capital');
  await insertAccount(database, 'asset-property-1', '1890', 'Synthetic contributed equipment', 'asset', 'Contributed property');
  await insertAccount(database, 'loan-liability-1', '2890', 'Synthetic member loan payable', 'liability', 'Loan payable');
  await insertAccount(database, 'loan-liability-2', '2891', 'Synthetic lender loan payable', 'liability', 'Loan payable');

  // Correction: original preserved, linked reversal and replacement.
  await postEntry(database, {
    entryId: 'je-expense-1-reversal', date: '2024-01-15', entryType: 'reversal', description: 'Reverse supplies',
    lines: [['bank-1', '4000', '0'], ['expense-supplies', '0', '4000']],
    transaction: { id: 'txn-expense-1-reversal', kind: 'reversal', accountId: 'bank-1', categoryAccountId: 'expense-supplies', amount: '4000' },
  });
  await postEntry(database, {
    entryId: 'je-expense-1-replacement', date: '2024-01-15', entryType: 'expense', description: 'Corrected supplies',
    lines: [['expense-supplies', '4500', '0'], ['bank-1', '0', '4500']],
    transaction: { id: 'txn-expense-1-replacement', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-supplies', amount: '4500' },
  });
  await insertRow(database, 'transaction_corrections', {
    id: 'correction-1', business_id: 'business-1', original_transaction_id: 'txn-expense-1',
    reversal_transaction_id: 'txn-expense-1-reversal', replacement_transaction_id: 'txn-expense-1-replacement',
    created_at: AT,
  });
  await insertRow(database, 'transaction_correction_roles', {
    transaction_id: 'txn-expense-1-reversal', correction_id: 'correction-1', role: 'reversal',
  });
  await insertRow(database, 'transaction_correction_roles', {
    transaction_id: 'txn-expense-1-replacement', correction_id: 'correction-1', role: 'replacement',
  });

  // Split transaction.
  await postEntry(database, {
    entryId: 'je-split-1', date: '2024-01-18', entryType: 'expense', description: 'Synthetic split purchase',
    lines: [['expense-supplies', '1000', '0'], ['expense-rent', '2000', '0'], ['bank-1', '0', '3000']],
    transaction: { id: 'txn-split-1', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-supplies', amount: '3000' },
  });
  await insertRow(database, 'transaction_splits', {
    transaction_id: 'txn-split-1', line_number: 1, category_account_id: 'expense-supplies', amount_minor: '1000',
  });
  await insertRow(database, 'transaction_splits', {
    transaction_id: 'txn-split-1', line_number: 2, category_account_id: 'expense-rent', amount_minor: '2000',
  });

  // Member capital: cash and property contributions.
  await postEntry(database, {
    entryId: 'je-capital-cash-1', date: '2024-02-01', entryType: 'cash-contribution', description: 'Synthetic cash contribution',
    lines: [['bank-1', '500000', '0'], ['capital-member-1', '0', '500000']],
  });
  await insertRow(database, 'member_capital_activity', {
    id: 'capital-cash-1', business_id: 'business-1', member_id: 'member-1', journal_entry_id: 'je-capital-cash-1',
    activity_date: '2024-02-01', activity_kind: 'cash-contribution', amount_minor: '500000', cash_account_id: 'bank-1',
    property_asset_account_id: null, property_description: null, description: 'Synthetic cash contribution',
    requires_cpa_review: 0, created_at: AT,
  });
  await postEntry(database, {
    entryId: 'je-capital-property-1', date: '2024-02-02', entryType: 'property-contribution', description: 'Synthetic equipment',
    lines: [['asset-property-1', LARGE_MINOR, '0'], ['capital-member-1', '0', LARGE_MINOR]],
  });
  await insertRow(database, 'member_capital_activity', {
    id: 'capital-property-1', business_id: 'business-1', member_id: 'member-1', journal_entry_id: 'je-capital-property-1',
    activity_date: '2024-02-02', activity_kind: 'property-contribution', amount_minor: LARGE_MINOR, cash_account_id: null,
    property_asset_account_id: 'asset-property-1', property_description: 'Synthetic equipment',
    description: 'Synthetic property contribution', requires_cpa_review: 1, created_at: AT,
  });

  // Guaranteed payments: obligation, installments, two payments, one reversed.
  await insertRow(database, 'guaranteed_payment_obligations', {
    id: 'gp-obligation-1', business_id: 'business-1', member_id: 'member-2', classification: 'services',
    recurrence: 'monthly', first_due_date: '2024-02-01', installment_count: 2, installment_amount_minor: '150000',
    description: 'Synthetic services payment', created_at: AT,
  });
  await insertRow(database, 'guaranteed_payment_installments', {
    id: 'gp-installment-1', obligation_id: 'gp-obligation-1', due_date: '2024-02-01', amount_minor: '150000',
    installment_number: 1, created_at: AT,
  });
  await insertRow(database, 'guaranteed_payment_installments', {
    id: 'gp-installment-2', obligation_id: 'gp-obligation-1', due_date: '2024-03-01', amount_minor: '150000',
    installment_number: 2, created_at: AT,
  });
  for (const [number, date] of [[1, '2024-02-05'], [2, '2024-03-05']]) {
    await postEntry(database, {
      entryId: `je-gp-${number}`, date, entryType: 'expense', description: `Synthetic guaranteed payment ${number}`,
      lines: [['expense-other', '150000', '0'], ['bank-1', '0', '150000']],
      transaction: { id: `txn-gp-${number}`, kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-other', amount: '150000' },
    });
    await insertRow(database, 'guaranteed_payment_payments', {
      id: `gp-payment-${number}`, business_id: 'business-1', member_id: 'member-2', classification: 'services',
      transaction_id: `txn-gp-${number}`, payment_date: date, cash_account_id: 'bank-1', amount_minor: '150000',
      description: `Synthetic guaranteed payment ${number}`, created_at: AT,
    });
    await insertRow(database, 'guaranteed_payment_allocations', {
      payment_id: `gp-payment-${number}`, installment_id: `gp-installment-${number}`, amount_minor: '150000', created_at: AT,
    });
  }
  await postEntry(database, {
    entryId: 'je-gp-2-reversal', date: '2024-03-06', entryType: 'reversal', description: 'Reverse guaranteed payment 2',
    lines: [['bank-1', '150000', '0'], ['expense-other', '0', '150000']],
    transaction: { id: 'txn-gp-2-reversal', kind: 'reversal', accountId: 'bank-1', categoryAccountId: 'expense-other', amount: '150000' },
  });
  await insertRow(database, 'guaranteed_payment_reversals', {
    id: 'gp-reversal-1', payment_id: 'gp-payment-2', reversal_transaction_id: 'txn-gp-2-reversal',
    reversal_journal_entry_id: 'je-gp-2-reversal', return_cash_account_id: 'bank-1', reversal_date: '2024-03-06',
    reason: 'Synthetic duplicate payment', created_at: AT,
  });

  // Loans: member loan with advance and repayment; unfunded third-party agreement.
  await insertRow(database, 'loan_agreements', {
    id: 'loan-1', business_id: 'business-1', lender_type: 'member', member_id: 'member-1', lender_name: 'Jordan Lee',
    agreement_date: '2024-02-10', commitment_minor: '2000000', annual_rate_basis_points: 500, day_count: 'ACT/365F',
    description: 'Synthetic member loan', liability_account_id: 'loan-liability-1', created_at: AT,
  });
  await insertRow(database, 'loan_agreements', {
    id: 'loan-2', business_id: 'business-1', lender_type: 'third-party', member_id: null, lender_name: 'Synthetic Lender',
    agreement_date: '2024-02-11', commitment_minor: '750000', annual_rate_basis_points: 0, day_count: 'ACT/ACT ISDA',
    description: 'Synthetic unfunded commitment', liability_account_id: 'loan-liability-2', created_at: AT,
  });
  await postEntry(database, {
    entryId: 'je-loan-advance-1', date: '2024-02-12', entryType: 'loan-advance', description: 'Synthetic loan advance',
    lines: [['bank-1', '1000000', '0'], ['loan-liability-1', '0', '1000000']],
    transaction: { id: 'txn-loan-advance-1', kind: 'loan-advance', accountId: 'bank-1', categoryAccountId: 'loan-liability-1', amount: '1000000' },
  });
  await insertRow(database, 'loan_advances', {
    id: 'loan-advance-1', loan_id: 'loan-1', transaction_id: 'txn-loan-advance-1', journal_entry_id: 'je-loan-advance-1',
    advance_date: '2024-02-12', cash_account_id: 'bank-1', amount_minor: '1000000', description: 'Synthetic loan advance',
    created_at: AT,
  });
  await postEntry(database, {
    entryId: 'je-loan-repayment-1', date: '2024-03-12', entryType: 'loan-repayment', description: 'Synthetic loan repayment',
    lines: [['loan-liability-1', '100000', '0'], ['expense-other', '5000', '0'], ['bank-1', '0', '105000']],
    transaction: { id: 'txn-loan-repayment-1', kind: 'loan-repayment', accountId: 'bank-1', categoryAccountId: 'loan-liability-1', amount: '105000' },
  });
  await insertRow(database, 'loan_repayments', {
    id: 'loan-repayment-1', loan_id: 'loan-1', transaction_id: 'txn-loan-repayment-1',
    journal_entry_id: 'je-loan-repayment-1', repayment_date: '2024-03-12', cash_account_id: 'bank-1',
    principal_minor: '100000', interest_minor: '5000', description: 'Synthetic loan repayment', created_at: AT,
  });

  // Recurring template with one posted occurrence.
  await insertRow(database, 'recurring_transaction_templates', {
    id: 'recurring-1', business_id: 'business-1', kind: 'expense', account_id: 'bank-1',
    category_account_id: 'expense-software', amount_minor: '9900', description: 'Synthetic hosting', cadence: 'monthly',
    next_date: '2024-04-15', anchor_day: 15, is_active: 1, created_at: AT,
  });
  await postEntry(database, {
    entryId: 'je-recurring-1', date: '2024-03-15', entryType: 'expense', description: 'Synthetic hosting',
    lines: [['expense-software', '9900', '0'], ['bank-1', '0', '9900']],
    transaction: { id: 'txn-recurring-1', kind: 'expense', accountId: 'bank-1', categoryAccountId: 'expense-software', amount: '9900' },
  });
  await insertRow(database, 'recurring_transaction_occurrences', {
    id: 'recurring-occurrence-1', template_id: 'recurring-1', transaction_id: 'txn-recurring-1',
    scheduled_date: '2024-03-15', posted_date: '2024-03-15', created_at: AT,
  });

  // Reconciliation: one completed with history, one draft; a negative statement balance.
  await insertRow(database, 'account_reconciliations', {
    id: 'reconciliation-1', business_id: 'business-1', account_id: 'bank-1', period_start_date: '2024-01-01',
    statement_date: '2024-01-31', beginning_minor: '-2500', ending_minor: '120500', status: 'completed',
    created_at: AT, completed_at: '2024-02-02T09:00:00.000Z',
  });
  await insertRow(database, 'account_reconciliations', {
    id: 'reconciliation-2', business_id: 'business-1', account_id: 'bank-1', period_start_date: '2024-02-01',
    statement_date: '2024-02-29', beginning_minor: '120500', ending_minor: '0', status: 'draft',
    created_at: AT, completed_at: null,
  });
  await insertRow(database, 'account_reconciliation_items', {
    reconciliation_id: 'reconciliation-1', transaction_id: 'txn-income-1', created_at: AT,
  });
  for (const [eventId, eventType, transactionId] of [
    ['reconciliation-event-1', 'created', null],
    ['reconciliation-event-2', 'item-cleared', 'txn-income-1'],
    ['reconciliation-event-3', 'completed', null],
  ]) {
    await insertRow(database, 'account_reconciliation_events', {
      id: eventId, reconciliation_id: 'reconciliation-1', event_type: eventType, transaction_id: transactionId, created_at: AT,
    });
  }

  // Period close and reopen. The reopen id sorts BEFORE the close it targets.
  await insertRow(database, 'accounting_period_events', {
    id: 'period-close-1', business_id: 'business-1', event_type: 'close', period_start_date: '2024-01-01',
    period_end_date: '2024-01-31', reason: 'Synthetic month end', target_close_event_id: null, created_at: AT,
  });
  await insertRow(database, 'accounting_period_events', {
    id: 'period-a-reopen-1', business_id: 'business-1', event_type: 'reopen', period_start_date: '2024-01-01',
    period_end_date: '2024-01-31', reason: 'Synthetic correction', target_close_event_id: 'period-close-1',
    created_at: '2024-06-02T12:00:00.000Z',
  });

  await insertRow(database, 'bookkeeping_reminders', {
    id: 'reminder-1', business_id: 'business-1', due_date: '2024-04-15', title: 'Synthetic quarterly review',
    details: '', is_complete: 0, created_at: AT, updated_at: AT, completed_at: null,
  });
  await insertRow(database, 'bookkeeping_reminders', {
    id: 'reminder-2', business_id: 'business-2', due_date: '2024-03-01', title: 'Synthetic CPA packet',
    details: 'Send synthetic workpapers', is_complete: 1, created_at: AT, updated_at: AT,
    completed_at: '2024-03-02T08:00:00.000Z',
  });
}

/** A fresh file-backed copy of the fully seeded synthetic books. */
async function seededBooksPath() {
  if (!templatePath) {
    const path = join(newDirectory(), 'template.db');
    const database = new TestDatabase(path);
    try {
      await seedCompleteBooks(database);
    } finally {
      database.close();
    }
    templatePath = path;
  }
  const copy = join(newDirectory(), 'books.db');
  copyFileSync(templatePath, copy);
  return copy;
}

function emptyDatabasePath() {
  return join(newDirectory(), 'candidate.db');
}

function userObjects(database) {
  return database.database
    .prepare(`SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite!_%' ESCAPE '!' ORDER BY type, name`)
    .all()
    .map((row) => `${row.type}:${row.name}`);
}

function tableOf(snapshot, name) {
  return snapshot.tables.find((table) => table.name === name);
}

function columnOf(snapshot, tableName, columnName) {
  const index = tableOf(snapshot, tableName).columns.indexOf(columnName);
  if (index < 0) throw new Error(`test fixture: unknown column ${tableName}.${columnName}`);
  return index;
}

async function expectNoOpenTransaction(database) {
  await database.execAsync('BEGIN IMMEDIATE; ROLLBACK;');
}

describe('bookkeeping dataset inventory', () => {
  it('lists every schema-13 table, column, primary key and foreign key created by ensureBookkeepingSchema', async () => {
    const database = open(emptyDatabasePath());
    await ensureBookkeepingSchema(database);

    const version = await database.getFirstAsync('SELECT version FROM bookkeeping_schema WHERE singleton = 1');
    expect(version.version).toBe(13);
    expect(BOOKKEEPING_DATASET_SCHEMA_VERSION).toBe(13);

    const actualTables = (await database.getAllAsync(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`))
      .map((row) => row.name)
      .filter((name) => !name.startsWith('sqlite_'));
    const inventoried = [BOOKKEEPING_SCHEMA_METADATA_TABLE, ...BOOKKEEPING_DATASET_TABLES.map((table) => table.name)];
    expect(new Set(inventoried).size).toBe(inventoried.length);
    expect([...inventoried].sort()).toEqual(actualTables);
    expect(BOOKKEEPING_DATASET_TABLES).toHaveLength(27);
    for (const excluded of BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES) expect(actualTables).not.toContain(excluded);

    const position = new Map(BOOKKEEPING_DATASET_TABLES.map((table, index) => [table.name, index]));
    for (const [index, table] of BOOKKEEPING_DATASET_TABLES.entries()) {
      const actualColumns = (await database.getAllAsync(`PRAGMA table_xinfo("${table.name}")`)).map((column) => ({
        name: column.name,
        type: column.type,
        primaryKeyPosition: Number(column.pk),
        nullable: Number(column.notnull) === 0,
        hidden: Number(column.hidden),
      }));
      expect(actualColumns, table.name).toEqual(table.columns.map((column) => ({
        name: column.name,
        type: bookkeepingDatasetColumnSqlType(column.kind),
        primaryKeyPosition: column.primaryKeyPosition,
        nullable: column.nullable,
        hidden: 0,
      })));

      const actualReferences = (await database.getAllAsync(`PRAGMA foreign_key_list("${table.name}")`))
        .map((reference) => `${reference.from}->${reference.table}(${reference.to})`)
        .sort();
      const expectedReferences = table.columns
        .filter((column) => column.references !== null)
        .map((column) => `${column.name}->${column.references}(id)`)
        .sort();
      expect(actualReferences, table.name).toEqual(expectedReferences);

      // Foreign-key-safe order: every parent is inserted no later than its child.
      for (const column of table.columns) {
        if (column.references !== null) expect(position.get(column.references), `${table.name}.${column.name}`).toBeLessThanOrEqual(index);
      }
    }
  });
});

describe('bookkeeping dataset export', () => {
  it('captures every inventoried table losslessly and deterministically', async () => {
    const database = open(await seededBooksPath());
    const snapshot = await exportBookkeepingDataset(database);

    expect(snapshot.format).toBe(BOOKKEEPING_DATASET_FORMAT);
    expect(snapshot.formatVersion).toBe(BOOKKEEPING_DATASET_FORMAT_VERSION);
    expect(snapshot.schemaVersion).toBe(13);
    expect(Object.keys(snapshot)).toEqual(['format', 'formatVersion', 'schemaVersion', 'tables']);
    expect(snapshot.tables.map((table) => table.name)).toEqual(BOOKKEEPING_DATASET_TABLES.map((table) => table.name));

    for (const table of snapshot.tables) {
      const counted = await database.getFirstAsync(`SELECT COUNT(*) AS count FROM "${table.name}"`);
      expect(table.rowCount, `${table.name} must be covered by the synthetic fixture`).toBeGreaterThan(0);
      expect(table.rowCount, table.name).toBe(counted.count);
      expect(table.rows, table.name).toHaveLength(counted.count);
    }

    // Integer cents stay exact text, including values beyond 2^53 and negatives.
    const capital = tableOf(snapshot, 'member_capital_activity');
    const property = capital.rows.find((row) => row[0] === 'capital-property-1');
    expect(property[columnOf(snapshot, 'member_capital_activity', 'amount_minor')]).toBe(LARGE_MINOR);
    expect(property[columnOf(snapshot, 'member_capital_activity', 'cash_account_id')]).toBe(null);
    expect(property[columnOf(snapshot, 'member_capital_activity', 'requires_cpa_review')]).toBe(1);
    const reconciliation = tableOf(snapshot, 'account_reconciliations').rows.find((row) => row[0] === 'reconciliation-1');
    expect(reconciliation[columnOf(snapshot, 'account_reconciliations', 'beginning_minor')]).toBe('-2500');
    expect(reconciliation[columnOf(snapshot, 'account_reconciliations', 'statement_date')]).toBe('2024-01-31');
    const income = tableOf(snapshot, 'transactions').rows.find((row) => row[0] === 'txn-income-1');
    expect(income[columnOf(snapshot, 'transactions', 'description')]).toBe(UNICODE_DESCRIPTION);
    expect(income[columnOf(snapshot, 'transactions', 'amount_minor')]).toBe('25000');
    expect(tableOf(snapshot, 'businesses').rows.map((row) => row[0])).toEqual(['business-1', 'business-2']);
    expect(tableOf(snapshot, 'bookkeeping_preferences').rows).toEqual([['active_business_id', 'business-1']]);
    const interest = tableOf(snapshot, 'member_interest_history').rows.find((row) => row[0] === 'member-1:interest:2024-01-01');
    expect(interest[columnOf(snapshot, 'member_interest_history', 'ownership_basis_points')]).toBe(6_000);

    // Deterministic and canonical.
    const again = await exportBookkeepingDataset(database);
    expect(again).toEqual(snapshot);
    const serialized = serializeBookkeepingDataset(snapshot);
    expect(serializeBookkeepingDataset(again)).toBe(serialized);
    expect(parseBookkeepingDataset(serialized)).toEqual(snapshot);
    expect(compareBookkeepingDatasets(snapshot, again)).toEqual([]);
  });

  it('reads inside one transaction, blocks concurrent writers, and never writes to or migrates the source', async () => {
    const path = await seededBooksPath();
    const database = open(path, RecordingDatabase);
    let writerOutcome = 'not attempted';
    database.onReadAll = (sql) => {
      if (writerOutcome !== 'not attempted' || !sql.includes('FROM "transactions"')) return;
      const writer = new DatabaseSync(path);
      try {
        writer.exec(`UPDATE bookkeeping_reminders SET title = 'Changed during export'`);
        writerOutcome = 'write committed during export';
      } catch (error) {
        writerOutcome = String(error.message);
      } finally {
        writer.close();
      }
    };

    const snapshot = await exportBookkeepingDataset(database);
    database.onReadAll = null;

    expect(writerOutcome).toMatch(/locked/i);
    expect(database.statements[0]).toBe('BEGIN IMMEDIATE;');
    expect(database.statements.at(-1)).toBe('ROLLBACK;');
    for (const statement of database.statements.slice(1, -1)) {
      expect(statement).toMatch(/^(SELECT |PRAGMA table_xinfo\()/);
    }
    expect(tableOf(snapshot, 'bookkeeping_reminders').rows.map((row) => row[3]))
      .toEqual(['Synthetic quarterly review', 'Synthetic CPA packet']);

    // The lock is released afterwards and the source is unchanged.
    await expectNoOpenTransaction(database);
    const writer = new DatabaseSync(path);
    writer.exec(`UPDATE bookkeeping_reminders SET details = details`);
    writer.close();
    expect(await exportBookkeepingDataset(database)).toEqual(snapshot);
  });

  it('rejects when rollback cleanup fails on export and prevents success leak', async () => {
    const path = await seededBooksPath();
    const database = open(path, FaultInjectingDatabase);
    database.failRollback = true;

    // Export must reject with the cleanup failure instead of resolving successfully.
    await expect(exportBookkeepingDataset(database)).rejects.toThrow('simulated rollback cleanup failure');

    // The caller owns the connection: because rollback failed, the transaction remained open,
    // so starting a new transaction on this connection fails until the connection is discarded/closed.
    await expect(database.execAsync('BEGIN IMMEDIATE;')).rejects.toThrow(/cannot start a transaction within a transaction/i);

    // Discarding/closing the failed connection releases the lock, allowing clean access.
    database.close();
    const fresh = open(path);
    await expectNoOpenTransaction(fresh);
    const snapshot = await exportBookkeepingDataset(fresh);
    expect(snapshot.tables.length).toBe(BOOKKEEPING_DATASET_TABLES.length);
  });

  it('rejects rollback cleanup failure while preserving an underlying export error', async () => {
    const path = await seededBooksPath();
    const database = open(path, FaultInjectingDatabase);
    // Introduce an unknown table so readDataset encounters an unsupported-source-structure error
    await database.execAsync('CREATE TABLE unexpected_test_table (id TEXT PRIMARY KEY NOT NULL);');
    database.failRollback = true;
    database.rollbackError = new Error('rollback cleanup failed during export error unwind');

    let capturedError = null;
    try {
      await exportBookkeepingDataset(database);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('Rollback cleanup failed.');
    expect(capturedError.cleanupError).toBe(database.rollbackError);
    expect(capturedError.originalError).toBeDefined();
    expect(capturedError.originalError.code).toBe('unsupported-source-structure');
    expect(capturedError.cause).toBe(capturedError.originalError);

    database.close();
  });

  it('rejects with undefined when read adapter rejects with undefined on export', async () => {
    const path = await seededBooksPath();
    const database = open(path, FaultInjectingDatabase);
    database.getFirstAsync = async () => Promise.reject(undefined);

    let rejected = false;
    let captured = 'sentinel';
    try {
      await exportBookkeepingDataset(database);
    } catch (error) {
      rejected = true;
      captured = error;
    }

    expect(rejected).toBe(true);
    expect(captured).toBeUndefined();
    await expectNoOpenTransaction(database);
    database.close();
  });

  it('preserves underlying export error and frozen cleanup error in wrapper without mutating cleanup error', async () => {
    const path = await seededBooksPath();
    const database = open(path, FaultInjectingDatabase);
    await database.execAsync('CREATE TABLE unexpected_test_table (id TEXT PRIMARY KEY NOT NULL);');
    const frozenRollbackError = Object.freeze(new Error('frozen rollback failure during export error unwind'));
    database.failRollback = true;
    database.rollbackError = frozenRollbackError;

    let capturedError = null;
    try {
      await exportBookkeepingDataset(database);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('Rollback cleanup failed.');
    expect(capturedError.originalError).toBeDefined();
    expect(capturedError.originalError.code).toBe('unsupported-source-structure');
    expect(capturedError.cause).toBe(capturedError.originalError);
    expect(capturedError.cleanupError).toBe(frozenRollbackError);
    expect(Object.isFrozen(frozenRollbackError)).toBe(true);
    expect(Object.isExtensible(frozenRollbackError)).toBe(false);

    database.close();
  });

  it('preserves both failures on export when operation rejects undefined or primitive and rollback fails with frozen or primitive error', async () => {
    const path = await seededBooksPath();
    const databaseA = open(path, FaultInjectingDatabase);
    databaseA.failRollback = true;

    // Case A: operation rejects undefined, rollback throws frozen Error
    const frozenRollback = Object.freeze(new Error('frozen rollback with undefined operation rejection'));
    databaseA.rollbackError = frozenRollback;
    databaseA.getFirstAsync = async () => Promise.reject(undefined);

    let capturedA = null;
    try {
      await exportBookkeepingDataset(databaseA);
    } catch (error) {
      capturedA = error;
    }
    expect(capturedA).toBeInstanceOf(Error);
    expect(capturedA.message).toBe('Rollback cleanup failed.');
    expect('originalError' in capturedA).toBe(true);
    expect(capturedA.originalError).toBeUndefined();
    expect(capturedA.cause).toBeUndefined();
    expect(capturedA.cleanupError).toBe(frozenRollback);
    expect(Object.isFrozen(frozenRollback)).toBe(true);

    databaseA.close();

    // Case B: operation rejects primitive, rollback throws primitive string
    const databaseB = open(path, FaultInjectingDatabase);
    databaseB.failRollback = true;
    databaseB.rollbackError = 'primitive rollback failure';
    databaseB.getFirstAsync = async () => Promise.reject('primitive adapter read failure');

    let capturedB = null;
    try {
      await exportBookkeepingDataset(databaseB);
    } catch (error) {
      capturedB = error;
    }
    expect(capturedB).toBeInstanceOf(Error);
    expect(capturedB.message).toBe('Rollback cleanup failed.');
    expect(capturedB.originalError).toBe('primitive adapter read failure');
    expect(capturedB.cause).toBe('primitive adapter read failure');
    expect(capturedB.cleanupError).toBe('primitive rollback failure');

    databaseB.close();

    // Case C: operation rejects undefined, rollback throws undefined
    const databaseC = open(path, FaultInjectingDatabase);
    databaseC.failRollback = true;
    databaseC.rollbackError = undefined;
    databaseC.getFirstAsync = async () => Promise.reject(undefined);

    let capturedC = null;
    try {
      await exportBookkeepingDataset(databaseC);
    } catch (error) {
      capturedC = error;
    }
    expect(capturedC).toBeInstanceOf(Error);
    expect(capturedC.message).toBe('Rollback cleanup failed.');
    expect('originalError' in capturedC).toBe(true);
    expect(capturedC.originalError).toBeUndefined();
    expect(capturedC.cause).toBeUndefined();
    expect(capturedC.cleanupError).toBeUndefined();

    databaseC.close();
  });

  it('rejects when rollback fails with a frozen Error or primitive error after export operation succeeds', async () => {
    const path = await seededBooksPath();
    const databaseA = open(path, FaultInjectingDatabase);
    databaseA.failRollback = true;

    const frozenError = Object.freeze(new Error('frozen rollback failure on export success'));
    databaseA.rollbackError = frozenError;
    await expect(exportBookkeepingDataset(databaseA)).rejects.toThrow('frozen rollback failure on export success');
    expect(Object.isFrozen(frozenError)).toBe(true);

    databaseA.close();

    const databaseB = open(path, FaultInjectingDatabase);
    databaseB.failRollback = true;
    databaseB.rollbackError = 'primitive rollback string on export success';
    let captured = null;
    try {
      await exportBookkeepingDataset(databaseB);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBe('primitive rollback string on export success');

    databaseB.close();
  });

  it('preserves non-enumerable references without leaking synthetic private markers in message or JSON.stringify', async () => {
    const path = await seededBooksPath();
    const database = open(path, FaultInjectingDatabase);
    database.failRollback = true;

    const SECRET_MARKER = 'SYNTHETIC-PRIVATE-KEY-MARKER-987654321';
    const cleanupError = new Error(`Cleanup failure containing ${SECRET_MARKER}`);
    cleanupError.secretDetail = SECRET_MARKER;
    const operationError = new Error(`Operation error containing ${SECRET_MARKER}`);
    operationError.secretDetail = SECRET_MARKER;

    database.rollbackError = cleanupError;
    database.getFirstAsync = async () => Promise.reject(operationError);

    let captured = null;
    try {
      await exportBookkeepingDataset(database);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe('Rollback cleanup failed.');
    expect(captured.message).not.toContain(SECRET_MARKER);

    // References are retained accurately
    expect(captured.cleanupError).toBe(cleanupError);
    expect(captured.originalError).toBe(operationError);
    expect(captured.cause).toBe(operationError);

    // Properties are non-enumerable and do not appear in Object.keys
    expect(Object.keys(captured)).toEqual([]);
    const cleanupDesc = Object.getOwnPropertyDescriptor(captured, 'cleanupError');
    expect(cleanupDesc.enumerable).toBe(false);
    const originalDesc = Object.getOwnPropertyDescriptor(captured, 'originalError');
    expect(originalDesc.enumerable).toBe(false);
    const causeDesc = Object.getOwnPropertyDescriptor(captured, 'cause');
    expect(causeDesc.enumerable).toBe(false);

    // JSON.stringify does not serialize non-enumerable properties or leak markers
    const serialized = JSON.stringify(captured);
    expect(serialized).not.toContain(SECRET_MARKER);
    expect(serialized).toBe('{}');

    database.close();
  });

  it('safely wraps when errors are null-prototype objects or have throwing property getters', async () => {
    const path = await seededBooksPath();

    // Subcase 1: cleanupError is null-prototype object, operationError has throwing getters
    const databaseA = open(path, FaultInjectingDatabase);
    databaseA.failRollback = true;

    const nullProtoCleanup = Object.create(null);
    nullProtoCleanup.tag = 'null-prototype-cleanup';

    const throwingOp = {
      get message() {
        throw new Error('thrown from message getter');
      },
      get stack() {
        throw new Error('thrown from stack getter');
      },
      get name() {
        throw new Error('thrown from name getter');
      },
      get code() {
        throw new Error('thrown from code getter');
      },
    };

    databaseA.rollbackError = nullProtoCleanup;
    databaseA.getFirstAsync = async () => Promise.reject(throwingOp);

    let capturedA = null;
    try {
      await exportBookkeepingDataset(databaseA);
    } catch (error) {
      capturedA = error;
    }

    expect(capturedA).toBeInstanceOf(Error);
    expect(capturedA.message).toBe('Rollback cleanup failed.');
    expect(capturedA.cleanupError).toBe(nullProtoCleanup);
    expect(capturedA.originalError).toBe(throwingOp);
    expect(capturedA.cause).toBe(throwingOp);
    expect(Object.getPrototypeOf(capturedA.cleanupError)).toBeNull();
    databaseA.close();

    // Subcase 2: cleanupError has throwing getters, operationError is null-prototype object
    const databaseB = open(path, FaultInjectingDatabase);
    databaseB.failRollback = true;

    const throwingCleanup = {
      get message() {
        throw new Error('thrown from cleanup message getter');
      },
      get stack() {
        throw new Error('thrown from cleanup stack getter');
      },
      get name() {
        throw new Error('thrown from cleanup name getter');
      },
      get code() {
        throw new Error('thrown from cleanup code getter');
      },
      get toString() {
        throw new Error('thrown from cleanup toString getter');
      },
    };

    const nullProtoOp = Object.create(null);
    nullProtoOp.tag = 'null-prototype-operation';

    databaseB.rollbackError = throwingCleanup;
    databaseB.getFirstAsync = async () => Promise.reject(nullProtoOp);

    let capturedB = null;
    try {
      await exportBookkeepingDataset(databaseB);
    } catch (error) {
      capturedB = error;
    }

    expect(capturedB).toBeInstanceOf(Error);
    expect(capturedB.message).toBe('Rollback cleanup failed.');
    expect(capturedB.cleanupError).toBe(throwingCleanup);
    expect(capturedB.originalError).toBe(nullProtoOp);
    expect(capturedB.cause).toBe(nullProtoOp);
    expect(Object.getPrototypeOf(capturedB.originalError)).toBeNull();
    databaseB.close();
  });

  it('excludes the documented proof-only tables without serializing their records', async () => {
    const database = open(await seededBooksPath());
    const before = await exportBookkeepingDataset(database);
    await database.execAsync(`
      CREATE TABLE proof_records (id TEXT PRIMARY KEY NOT NULL, note TEXT NOT NULL, attachment BLOB NOT NULL);
      INSERT INTO proof_records VALUES ('synthetic-proof', 'SYNTHETIC-PROOF-NOTE-MARKER', x'4c4c43');
      CREATE TABLE restore_manifest (singleton INTEGER PRIMARY KEY, payload_sha256 TEXT NOT NULL, record_count INTEGER NOT NULL);
      INSERT INTO restore_manifest VALUES (1, 'synthetic-hash', 1);
    `);
    expect([...BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES].sort()).toEqual(['proof_records', 'restore_manifest']);

    const snapshot = await exportBookkeepingDataset(database);
    expect(snapshot).toEqual(before);
    const serialized = serializeBookkeepingDataset(snapshot);
    for (const forbidden of ['proof_records', 'restore_manifest', 'SYNTHETIC-PROOF-NOTE-MARKER', 'synthetic-hash', 'sqlite_master', 'CREATE TABLE']) {
      expect(serialized).not.toContain(forbidden);
    }
    const proof = await database.getFirstAsync('SELECT COUNT(*) AS count FROM proof_records');
    expect(proof.count).toBe(1);
  });

  const sourceFailures = [
    ['an unknown table such as receipt storage',
      `CREATE TABLE receipt_attachments (id TEXT PRIMARY KEY NOT NULL, content BLOB);`,
      'unsupported-source-structure', /unknown table/],
    ['an unknown column',
      `ALTER TABLE transactions ADD COLUMN memo TEXT;`,
      'unsupported-source-structure', /transactions has unknown or missing columns/],
    ['a view',
      `CREATE VIEW synthetic_view AS SELECT id FROM businesses;`,
      'unsupported-source-structure', /unsupported view/],
    ['a trigger',
      `CREATE TRIGGER synthetic_trigger AFTER INSERT ON bookkeeping_reminders BEGIN SELECT 1; END;`,
      'unsupported-source-structure', /unsupported trigger/],
    ['a missing bookkeeping table',
      `DROP TABLE bookkeeping_reminders;`,
      'unsupported-source-structure', /bookkeeping_reminders is missing/],
    ['a BLOB stored in a text column',
      `UPDATE transactions SET description = x'00ff' WHERE id = 'txn-income-1';`,
      'unsupported-source-structure', /transactions contains values with an unsupported storage type/],
    ['a REAL stored in an integer column',
      `UPDATE journal_lines SET line_number = line_number + 0.5;`,
      'unsupported-source-structure', /journal_lines contains values with an unsupported storage type/],
    ['an integer beyond the lossless range',
      `UPDATE journal_lines SET line_number = line_number + 9007199254740993;`,
      'unsupported-source-structure', /journal_lines contains values with an unsupported storage type/],
    ['a non-integer minor-unit amount',
      `UPDATE transactions SET amount_minor = '12.50' WHERE id = 'txn-income-1';`,
      'malformed-snapshot', /transactions row \d+ column amount_minor/],
    ['an impossible calendar date',
      `UPDATE transactions SET entry_date = '2024-02-30' WHERE id = 'txn-income-1';`,
      'malformed-snapshot', /transactions row \d+ column entry_date/],
    ['a dangling record reference',
      `PRAGMA foreign_keys = OFF; UPDATE bookkeeping_reminders SET business_id = 'missing-business' WHERE id = 'reminder-1';`,
      'malformed-snapshot', /bookkeeping_reminders row \d+ column business_id references a missing businesses record/],
    ['a newer schema version',
      `UPDATE bookkeeping_schema SET version = 14;`,
      'newer-schema-version', /newer than the supported version 13/],
    ['an older schema version',
      `UPDATE bookkeeping_schema SET version = 12;`,
      'unsupported-schema-version', /version 12 is not supported/],
  ];

  it.each(sourceFailures)('fails closed on %s and leaves the source untouched', async (_label, mutation, code, message) => {
    const database = open(await seededBooksPath());
    await database.execAsync(mutation);
    const objectsBefore = userObjects(database);
    const versionBefore = await database.getFirstAsync('SELECT version FROM bookkeeping_schema');
    const journalLinesBefore = await database.getFirstAsync('SELECT COUNT(*) AS count FROM journal_lines');

    const failure = await exportBookkeepingDataset(database).then(() => null, (error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).toBe(code);
    expect(failure.message).toMatch(message);
    // Messages never echo stored values.
    expect(failure.message).not.toContain('12.50');
    expect(failure.message).not.toContain('2024-02-30');
    expect(failure.message).not.toContain('missing-business');

    await expectNoOpenTransaction(database);
    expect(userObjects(database)).toEqual(objectsBefore);
    expect(await database.getFirstAsync('SELECT version FROM bookkeeping_schema')).toEqual(versionBefore);
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM journal_lines')).toEqual(journalLinesBefore);
  });

  it('rejects a database without a bookkeeping schema instead of creating one', async () => {
    const database = open(emptyDatabasePath());
    await expect(exportBookkeepingDataset(database)).rejects.toMatchObject({
      code: 'unsupported-source-structure',
      message: expect.stringMatching(/does not contain a bookkeeping schema/),
    });
    expect(userObjects(database)).toEqual([]);
  });
});

describe('bookkeeping dataset payload contract', () => {
  async function goodSnapshot() {
    return await exportBookkeepingDataset(open(await seededBooksPath()));
  }

  const payloadFailures = [
    ['a newer schema version', (s) => { s.schemaVersion = 14; }, 'newer-schema-version'],
    ['an older schema version', (s) => { s.schemaVersion = 12; }, 'unsupported-schema-version'],
    ['a non-integer schema version', (s) => { s.schemaVersion = '13'; }, 'unsupported-schema-version'],
    ['a newer format version', (s) => { s.formatVersion = 2; }, 'unsupported-format-version'],
    ['a different format marker', (s) => { s.format = 'llc-proof-snapshot'; }, 'malformed-snapshot'],
    ['an unknown top-level field such as a device key', (s) => { s.deviceKeyHex = '00'.repeat(32); }, 'malformed-snapshot'],
    ['a missing top-level field', (s) => { delete s.format; }, 'malformed-snapshot'],
    ['a missing table', (s) => { s.tables.splice(3, 1); }, 'malformed-snapshot'],
    ['an unknown table', (s) => { s.tables.push({ name: 'receipt_attachments', columns: ['id'], rowCount: 0, rows: [] }); }, 'malformed-snapshot'],
    ['a duplicated table', (s) => { s.tables.push(structuredClone(s.tables[0])); }, 'malformed-snapshot'],
    ['reordered tables', (s) => { [s.tables[0], s.tables[1]] = [s.tables[1], s.tables[0]]; }, 'malformed-snapshot'],
    ['arbitrary schema SQL on a table', (s) => { s.tables[0].sql = 'CREATE TABLE businesses (id TEXT)'; }, 'malformed-snapshot'],
    ['an unknown column', (s) => {
      const table = tableOf(s, 'transactions');
      table.columns.push('memo');
      table.rows.forEach((row) => row.push('note'));
    }, 'malformed-snapshot'],
    ['a missing column', (s) => {
      const table = tableOf(s, 'transactions');
      table.columns.pop();
      table.rows.forEach((row) => row.pop());
    }, 'malformed-snapshot'],
    ['reordered columns', (s) => {
      const table = tableOf(s, 'businesses');
      [table.columns[1], table.columns[2]] = [table.columns[2], table.columns[1]];
    }, 'malformed-snapshot'],
    ['a short row', (s) => { tableOf(s, 'accounts').rows[0].pop(); }, 'malformed-snapshot'],
    ['a keyed-object row', (s) => { tableOf(s, 'accounts').rows[0] = { id: 'x' }; }, 'malformed-snapshot'],
    ['a duplicate primary key', (s) => {
      const table = tableOf(s, 'accounts');
      table.rows.splice(1, 0, structuredClone(table.rows[0]));
      table.rowCount += 1;
    }, 'malformed-snapshot'],
    ['a duplicate composite primary key', (s) => {
      const table = tableOf(s, 'transaction_splits');
      table.rows.splice(1, 0, structuredClone(table.rows[0]));
      table.rowCount += 1;
    }, 'malformed-snapshot'],
    ['rows outside canonical order', (s) => { tableOf(s, 'accounts').rows.reverse(); }, 'malformed-snapshot'],
    ['a row count that disagrees with the rows', (s) => { tableOf(s, 'accounts').rowCount += 1; }, 'malformed-snapshot'],
    ['a silently dropped row', (s) => { tableOf(s, 'bookkeeping_reminders').rows.pop(); }, 'malformed-snapshot'],
    ['a minor-unit amount as a JSON number', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'debit_minor')] = 100;
    }, 'malformed-snapshot'],
    ['a minor-unit amount with a leading zero', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'debit_minor')] = '0100';
    }, 'malformed-snapshot'],
    ['a minor-unit amount with a plus sign', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'debit_minor')] = '+100';
    }, 'malformed-snapshot'],
    ['a negative-zero minor-unit amount', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'debit_minor')] = '-0';
    }, 'malformed-snapshot'],
    ['an empty minor-unit amount', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'debit_minor')] = '';
    }, 'malformed-snapshot'],
    ['a fractional integer', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'line_number')] = 1.5;
    }, 'malformed-snapshot'],
    ['an unsafe integer', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'line_number')] = 2 ** 53;
    }, 'malformed-snapshot'],
    ['an integer supplied as text', (s) => {
      tableOf(s, 'journal_lines').rows[0][columnOf(s, 'journal_lines', 'line_number')] = '1';
    }, 'malformed-snapshot'],
    ['a flag outside 0 and 1', (s) => {
      tableOf(s, 'accounts').rows[0][columnOf(s, 'accounts', 'is_active')] = 2;
    }, 'malformed-snapshot'],
    ['a boolean flag', (s) => {
      tableOf(s, 'accounts').rows[0][columnOf(s, 'accounts', 'is_active')] = true;
    }, 'malformed-snapshot'],
    ['null in a required column', (s) => {
      tableOf(s, 'businesses').rows[0][columnOf(s, 'businesses', 'name')] = null;
    }, 'malformed-snapshot'],
    ['an empty identifier', (s) => {
      tableOf(s, 'bookkeeping_reminders').rows[0][0] = '';
    }, 'malformed-snapshot'],
    ['an impossible date', (s) => {
      tableOf(s, 'businesses').rows[0][columnOf(s, 'businesses', 'formation_date')] = '2024-13-01';
    }, 'malformed-snapshot'],
    ['a date with a time component', (s) => {
      tableOf(s, 'businesses').rows[0][columnOf(s, 'businesses', 'formation_date')] = '2024-03-01T00:00:00Z';
    }, 'malformed-snapshot'],
    ['text containing a NUL character', (s) => {
      tableOf(s, 'businesses').rows[0][columnOf(s, 'businesses', 'name')] = 'Synthetic\u0000LLC';
    }, 'malformed-snapshot'],
    ['text containing a lone surrogate', (s) => {
      tableOf(s, 'businesses').rows[0][columnOf(s, 'businesses', 'name')] = 'Synthetic\ud800LLC';
    }, 'malformed-snapshot'],
    ['a dangling reference', (s) => {
      tableOf(s, 'bookkeeping_reminders').rows[0][columnOf(s, 'bookkeeping_reminders', 'business_id')] = 'missing-business';
    }, 'malformed-snapshot'],
    ['a dangling self reference', (s) => {
      const table = tableOf(s, 'accounting_period_events');
      const row = table.rows.find((candidate) => candidate[0] === 'period-a-reopen-1');
      row[columnOf(s, 'accounting_period_events', 'target_close_event_id')] = 'missing-close';
    }, 'malformed-snapshot'],
  ];

  it.each(payloadFailures)('rejects %s', async (_label, mutate, code) => {
    const snapshot = await goodSnapshot();
    const mutated = structuredClone(snapshot);
    mutate(mutated);
    let failure = null;
    try {
      validateBookkeepingDatasetSnapshot(mutated);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).toBe(code);
    expect(() => serializeBookkeepingDataset(mutated)).toThrow();
    // The unmodified dataset still validates, so the rejection is caused by the mutation alone.
    expect(validateBookkeepingDatasetSnapshot(snapshot)).toEqual(snapshot);
  });

  it('rejects non-object payloads', () => {
    for (const value of [null, undefined, 'text', 13, [], new Map()]) {
      expect(() => validateBookkeepingDatasetSnapshot(value)).toThrow(/top-level fields/);
    }
  });

  it('accepts exactly one canonical text encoding', async () => {
    const snapshot = await goodSnapshot();
    const serialized = serializeBookkeepingDataset(snapshot);
    expect(serialized.startsWith('{"format":"llc-bookkeeping-dataset","formatVersion":1,"schemaVersion":13,"tables":[')).toBe(true);
    expect(serialized).toContain(`"${LARGE_MINOR}"`);
    expect(parseBookkeepingDataset(serialized)).toEqual(snapshot);

    const duplicateKey = serialized.replace('{"format":', '{"format":"llc-bookkeeping-dataset","format":');
    expect(duplicateKey).not.toBe(serialized);
    for (const text of [` ${serialized}`, `${serialized}\n`, duplicateKey, JSON.stringify(snapshot, null, 1)]) {
      expect(() => parseBookkeepingDataset(text)).toThrow(/canonical form/);
    }
    expect(() => parseBookkeepingDataset(serialized.slice(0, -10))).toThrow(/not valid JSON/);
    expect(() => parseBookkeepingDataset(new Uint8Array([1, 2, 3]))).toThrow(/not text/);
  });

  it('compares complete rows and counts without revealing values', async () => {
    const snapshot = await goodSnapshot();
    const changed = structuredClone(snapshot);
    tableOf(changed, 'transactions').rows[0][columnOf(changed, 'transactions', 'description')] = 'SECRET-CHANGED-VALUE';
    const reminders = tableOf(changed, 'bookkeeping_reminders');
    reminders.rows.pop();
    reminders.rowCount -= 1;

    expect(compareBookkeepingDatasets(snapshot, snapshot)).toEqual([]);
    const differences = compareBookkeepingDatasets(snapshot, changed);
    expect(differences).toEqual([
      { table: 'transactions', kind: 'row-content', expected: 1, actual: 1 },
      { table: 'bookkeeping_reminders', kind: 'row-count', expected: 2, actual: 1 },
      { table: 'bookkeeping_reminders', kind: 'row-content', expected: 1, actual: 0 },
    ]);
    expect(JSON.stringify(differences)).not.toContain('SECRET-CHANGED-VALUE');
  });
});

describe('isolated bookkeeping dataset import', () => {
  it('restores every row into an empty file-backed candidate and proves parity after reopening', async () => {
    const source = open(await seededBooksPath());
    const snapshot = await exportBookkeepingDataset(source);
    const serialized = serializeBookkeepingDataset(snapshot);

    // The fixture forces a row that references a later row of its own table.
    const periodIds = tableOf(snapshot, 'accounting_period_events').rows.map((row) => row[0]);
    expect(periodIds).toEqual(['period-a-reopen-1', 'period-close-1']);

    const targetPath = emptyDatabasePath();
    const candidate = open(targetPath);
    const result = await importBookkeepingDatasetIntoEmptyDatabase(candidate, parseBookkeepingDataset(serialized));
    const expectedTotal = snapshot.tables.reduce((total, table) => total + table.rowCount, 0);
    expect(result.schemaVersion).toBe(13);
    expect(result.totalRowCount).toBe(expectedTotal);
    expect(result.tableRowCounts).toEqual(Object.fromEntries(snapshot.tables.map((table) => [table.name, table.rowCount])));
    await expectNoOpenTransaction(candidate);
    candidate.close();

    const reopened = open(targetPath);
    const restored = await exportBookkeepingDataset(reopened);
    expect(restored).toEqual(snapshot);
    expect(serializeBookkeepingDataset(restored)).toBe(serialized);
    expect(compareBookkeepingDatasets(snapshot, restored)).toEqual([]);
    await verifyBookkeepingDatasetInDatabase(reopened, snapshot);

    for (const table of BOOKKEEPING_DATASET_TABLES) {
      const sourceCount = await source.getFirstAsync(`SELECT COUNT(*) AS count FROM "${table.name}"`);
      const restoredCount = await reopened.getFirstAsync(`SELECT COUNT(*) AS count FROM "${table.name}"`);
      expect(restoredCount, table.name).toEqual(sourceCount);
    }
    expect(await reopened.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    expect(await reopened.getAllAsync('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(await reopened.getAllAsync('SELECT singleton, version FROM bookkeeping_schema')).toEqual([{ singleton: 1, version: 13 }]);
    expect(userObjects(reopened)).toEqual(userObjects(source));
    expect(await listBusinessProfilesFromDatabase(reopened)).toEqual(await listBusinessProfilesFromDatabase(source));

    // Ledger parity straight from persisted journal lines, as exact integer text.
    const ledgerSql = `
      SELECT account_id AS accountId,
             CAST(SUM(CAST(debit_minor AS INTEGER)) AS TEXT) AS debits,
             CAST(SUM(CAST(credit_minor AS INTEGER)) AS TEXT) AS credits
      FROM journal_lines GROUP BY account_id ORDER BY account_id`;
    expect(await reopened.getAllAsync(ledgerSql)).toEqual(await source.getAllAsync(ledgerSql));

    // The source is unchanged by export and by the candidate import.
    expect(await exportBookkeepingDataset(source)).toEqual(snapshot);
  });

  it('rejects a nonempty destination and leaves it unchanged', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));

    const existingBooks = open(await seededBooksPath());
    await existingBooks.execAsync(`UPDATE bookkeeping_reminders SET title = 'Existing destination reminder' WHERE id = 'reminder-1'`);
    const existingBefore = await exportBookkeepingDataset(existingBooks);
    await expect(importBookkeepingDatasetIntoEmptyDatabase(existingBooks, snapshot)).rejects.toMatchObject({ code: 'nonempty-destination' });
    expect(await exportBookkeepingDataset(existingBooks)).toEqual(existingBefore);
    expect(existingBefore).not.toEqual(snapshot);

    const schemaOnly = open(emptyDatabasePath());
    await ensureBookkeepingSchema(schemaOnly);
    const schemaObjects = userObjects(schemaOnly);
    await expect(importBookkeepingDatasetIntoEmptyDatabase(schemaOnly, snapshot)).rejects.toMatchObject({ code: 'nonempty-destination' });
    expect(userObjects(schemaOnly)).toEqual(schemaObjects);
    expect(await schemaOnly.getFirstAsync('SELECT COUNT(*) AS count FROM businesses')).toEqual({ count: 0 });

    const unrelated = open(emptyDatabasePath());
    await unrelated.execAsync(`CREATE TABLE unrelated_notes (id TEXT PRIMARY KEY NOT NULL); INSERT INTO unrelated_notes VALUES ('keep');`);
    await expect(importBookkeepingDatasetIntoEmptyDatabase(unrelated, snapshot)).rejects.toMatchObject({ code: 'nonempty-destination' });
    expect(userObjects(unrelated)).toEqual(['table:unrelated_notes']);
    expect(await unrelated.getAllAsync('SELECT id FROM unrelated_notes')).toEqual([{ id: 'keep' }]);
  });

  it('validates the payload before touching the candidate', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidate = open(emptyDatabasePath(), RecordingDatabase);

    const newer = structuredClone(snapshot);
    newer.schemaVersion = 14;
    await expect(importBookkeepingDatasetIntoEmptyDatabase(candidate, newer)).rejects.toMatchObject({ code: 'newer-schema-version' });

    const dangling = structuredClone(snapshot);
    tableOf(dangling, 'members').rows[0][columnOf(dangling, 'members', 'business_id')] = 'missing-business';
    await expect(importBookkeepingDatasetIntoEmptyDatabase(candidate, dangling)).rejects.toMatchObject({ code: 'malformed-snapshot' });

    await expect(importBookkeepingDatasetIntoEmptyDatabase(candidate, serializeBookkeepingDataset(snapshot)))
      .rejects.toMatchObject({ code: 'malformed-snapshot' });

    expect(candidate.statements).toEqual([]);
    expect(userObjects(candidate)).toEqual([]);
  });

  it('rolls back a failed import, returns the candidate to empty, and allows a clean retry', async () => {
    const source = open(await seededBooksPath());
    const snapshot = await exportBookkeepingDataset(source);
    const candidate = open(emptyDatabasePath(), RecordingDatabase);

    // Passes the portable contract but violates a schema CHECK inside SQLite.
    const constraintViolation = structuredClone(snapshot);
    const accounts = tableOf(constraintViolation, 'accounts');
    accounts.rows[accounts.rows.length - 1][columnOf(constraintViolation, 'accounts', 'kind')] = 'unsupported-kind';
    expect(validateBookkeepingDatasetSnapshot(constraintViolation)).toEqual(constraintViolation);
    await expect(importBookkeepingDatasetIntoEmptyDatabase(candidate, constraintViolation)).rejects.toThrow(/constraint/i);
    expect(userObjects(candidate)).toEqual([]);
    await expectNoOpenTransaction(candidate);

    // Passes the portable contract but violates a UNIQUE constraint late in the import.
    const uniqueViolation = structuredClone(snapshot);
    const reconciliations = tableOf(uniqueViolation, 'account_reconciliations');
    const statusIndex = columnOf(uniqueViolation, 'account_reconciliations', 'status');
    const completedIndex = columnOf(uniqueViolation, 'account_reconciliations', 'completed_at');
    for (const row of reconciliations.rows) {
      row[statusIndex] = 'draft';
      row[completedIndex] = null;
    }
    await expect(importBookkeepingDatasetIntoEmptyDatabase(candidate, uniqueViolation)).rejects.toThrow(/constraint/i);
    expect(userObjects(candidate)).toEqual([]);
    await expectNoOpenTransaction(candidate);

    // Every insert was parameterized: no statement text carries row values.
    const inserts = candidate.statements.filter((statement) => statement.startsWith('INSERT INTO'));
    expect(inserts.length).toBeGreaterThan(0);
    for (const statement of inserts) {
      expect(statement).toMatch(/^INSERT INTO "[a-z_]+" \(("[a-z_]+", )*"[a-z_]+"\) VALUES \((\?, )*\?\)$/);
    }

    const result = await importBookkeepingDatasetIntoEmptyDatabase(candidate, snapshot);
    expect(result.totalRowCount).toBe(snapshot.tables.reduce((total, table) => total + table.rowCount, 0));
    expect(await exportBookkeepingDataset(candidate)).toEqual(snapshot);
    expect(await exportBookkeepingDataset(source)).toEqual(snapshot);
  });

  it('detects a candidate that diverges from the expected dataset', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidate = open(emptyDatabasePath());
    await importBookkeepingDatasetIntoEmptyDatabase(candidate, snapshot);
    await verifyBookkeepingDatasetInDatabase(candidate, snapshot);

    await candidate.execAsync(`UPDATE journal_lines SET debit_minor = '4001' WHERE id = 'je-expense-1-reversal:line:1'`);
    await expect(verifyBookkeepingDatasetInDatabase(candidate, snapshot)).rejects.toMatchObject({
      code: 'restore-verification-failed',
      message: expect.stringMatching(/journal_lines/),
    });
    await expectNoOpenTransaction(candidate);

    await candidate.execAsync(`
      UPDATE journal_lines SET debit_minor = '4000' WHERE id = 'je-expense-1-reversal:line:1';
      PRAGMA foreign_keys = OFF;
      DELETE FROM bookkeeping_preferences;
      DELETE FROM businesses WHERE id = 'business-2';
    `);
    await expect(verifyBookkeepingDatasetInDatabase(candidate, snapshot)).rejects.toMatchObject({
      code: 'restore-verification-failed',
      message: expect.stringMatching(/invalid record references/),
    });
  });

  it('rejects when rollback cleanup fails during verification and prevents success leak', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidate = open(emptyDatabasePath(), FaultInjectingDatabase);
    await importBookkeepingDatasetIntoEmptyDatabase(candidate, snapshot);

    candidate.failRollback = true;
    candidate.rollbackError = new Error('simulated rollback cleanup failure on verification');

    // Verification must reject rather than resolving successfully on failed rollback cleanup.
    await expect(verifyBookkeepingDatasetInDatabase(candidate, snapshot))
      .rejects.toThrow('simulated rollback cleanup failure on verification');

    // The caller owns the connection: discarding/closing the broken connection allows clean access.
    candidate.close();
  });

  it('rejects rollback cleanup failure while preserving an underlying verification error', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidate = open(emptyDatabasePath(), FaultInjectingDatabase);
    await importBookkeepingDatasetIntoEmptyDatabase(candidate, snapshot);

    // Modify data to cause restore-verification-failed
    await candidate.execAsync(`UPDATE journal_lines SET debit_minor = '4001' WHERE id = 'je-expense-1-reversal:line:1'`);

    candidate.failRollback = true;
    candidate.rollbackError = new Error('rollback cleanup failed during verification error unwind');

    let capturedError = null;
    try {
      await verifyBookkeepingDatasetInDatabase(candidate, snapshot);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('Rollback cleanup failed.');
    expect(capturedError.cleanupError).toBe(candidate.rollbackError);
    expect(capturedError.originalError).toBeDefined();
    expect(capturedError.originalError.code).toBe('restore-verification-failed');
    expect(capturedError.cause).toBe(capturedError.originalError);

    candidate.close();
  });

  it('rejects with undefined when verification adapter rejects with undefined', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidate = open(emptyDatabasePath(), FaultInjectingDatabase);
    await importBookkeepingDatasetIntoEmptyDatabase(candidate, snapshot);

    candidate.getAllAsync = async () => Promise.reject(undefined);

    let rejected = false;
    let captured = 'sentinel';
    try {
      await verifyBookkeepingDatasetInDatabase(candidate, snapshot);
    } catch (error) {
      rejected = true;
      captured = error;
    }

    expect(rejected).toBe(true);
    expect(captured).toBeUndefined();
    await expectNoOpenTransaction(candidate);
    candidate.close();
  });

  it('preserves underlying verification error and frozen cleanup error in wrapper without mutating cleanup error', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidate = open(emptyDatabasePath(), FaultInjectingDatabase);
    await importBookkeepingDatasetIntoEmptyDatabase(candidate, snapshot);

    await candidate.execAsync(`UPDATE journal_lines SET debit_minor = '4001' WHERE id = 'je-expense-1-reversal:line:1'`);

    const frozenRollback = Object.freeze(new Error('frozen rollback failure during verification error unwind'));
    candidate.failRollback = true;
    candidate.rollbackError = frozenRollback;

    let capturedError = null;
    try {
      await verifyBookkeepingDatasetInDatabase(candidate, snapshot);
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('Rollback cleanup failed.');
    expect(capturedError.originalError).toBeDefined();
    expect(capturedError.originalError.code).toBe('restore-verification-failed');
    expect(capturedError.cause).toBe(capturedError.originalError);
    expect(capturedError.cleanupError).toBe(frozenRollback);
    expect(Object.isFrozen(frozenRollback)).toBe(true);
    expect(Object.isExtensible(frozenRollback)).toBe(false);

    candidate.close();
  });

  it('preserves both failures on verification when operation rejects undefined or primitive and rollback fails with frozen or primitive error', async () => {
    const snapshot = await exportBookkeepingDataset(open(await seededBooksPath()));
    const candidatePath = emptyDatabasePath();
    const setupCandidate = open(candidatePath);
    await importBookkeepingDatasetIntoEmptyDatabase(setupCandidate, snapshot);
    setupCandidate.close();

    // Case A: operation rejects undefined, rollback throws frozen Error
    const candidateA = open(candidatePath, FaultInjectingDatabase);
    candidateA.failRollback = true;
    const frozenRollback = Object.freeze(new Error('frozen rollback with undefined verification operation rejection'));
    candidateA.rollbackError = frozenRollback;
    candidateA.getAllAsync = async () => Promise.reject(undefined);

    let capturedA = null;
    try {
      await verifyBookkeepingDatasetInDatabase(candidateA, snapshot);
    } catch (error) {
      capturedA = error;
    }
    expect(capturedA).toBeInstanceOf(Error);
    expect(capturedA.message).toBe('Rollback cleanup failed.');
    expect('originalError' in capturedA).toBe(true);
    expect(capturedA.originalError).toBeUndefined();
    expect(capturedA.cause).toBeUndefined();
    expect(capturedA.cleanupError).toBe(frozenRollback);
    expect(Object.isFrozen(frozenRollback)).toBe(true);
    candidateA.close();

    // Case B: operation rejects primitive, rollback throws primitive string
    const candidateB = open(candidatePath, FaultInjectingDatabase);
    candidateB.failRollback = true;
    candidateB.rollbackError = 'primitive verification rollback failure';
    candidateB.getAllAsync = async () => Promise.reject('primitive verification read failure');

    let capturedB = null;
    try {
      await verifyBookkeepingDatasetInDatabase(candidateB, snapshot);
    } catch (error) {
      capturedB = error;
    }
    expect(capturedB).toBeInstanceOf(Error);
    expect(capturedB.message).toBe('Rollback cleanup failed.');
    expect(capturedB.originalError).toBe('primitive verification read failure');
    expect(capturedB.cause).toBe('primitive verification read failure');
    expect(capturedB.cleanupError).toBe('primitive verification rollback failure');
    candidateB.close();

    // Case C: operation rejects undefined, rollback throws undefined
    const candidateC = open(candidatePath, FaultInjectingDatabase);
    candidateC.failRollback = true;
    candidateC.rollbackError = undefined;
    candidateC.getAllAsync = async () => Promise.reject(undefined);

    let capturedC = null;
    try {
      await verifyBookkeepingDatasetInDatabase(candidateC, snapshot);
    } catch (error) {
      capturedC = error;
    }
    expect(capturedC).toBeInstanceOf(Error);
    expect(capturedC.message).toBe('Rollback cleanup failed.');
    expect('originalError' in capturedC).toBe(true);
    expect(capturedC.originalError).toBeUndefined();
    expect(capturedC.cause).toBeUndefined();
    expect(capturedC.cleanupError).toBeUndefined();
    candidateC.close();
  });
});
