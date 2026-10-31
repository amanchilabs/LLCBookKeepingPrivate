import type { DatabaseLease } from './database-lease';
import {
  assertOwnershipTotals,
  assertValidBusinessSetup,
  cashExpenseLines,
  cashIncomeLines,
  openingBalanceLines,
  reverseLines,
  type BusinessSetupInput,
  type MemberInterestInput,
} from '../../domain/src/bookkeeping';
import { assertBalancedEntry, type JournalLine } from '../../domain/src/journal';
import { formatUsd } from '../../domain/src/money';

const SCHEMA_VERSION = 1;

const SEEDED_ACCOUNTS = [
  { id: 'opening-equity', code: '3000', name: 'Opening Balance Equity', kind: 'equity', category: 'Opening balance' },
  { id: 'income-services', code: '4000', name: 'Sales and Services', kind: 'income', category: 'Income' },
  { id: 'income-other', code: '4900', name: 'Other Income', kind: 'income', category: 'Income' },
  { id: 'expense-supplies', code: '6100', name: 'Office Supplies', kind: 'expense', category: 'Operating expense' },
  { id: 'expense-rent', code: '6200', name: 'Rent', kind: 'expense', category: 'Operating expense' },
  { id: 'expense-software', code: '6300', name: 'Software and Hosting', kind: 'expense', category: 'Operating expense' },
  { id: 'expense-travel', code: '6400', name: 'Travel', kind: 'expense', category: 'Operating expense' },
  { id: 'expense-meals', code: '6500', name: 'Meals', kind: 'expense', category: 'Operating expense' },
  { id: 'expense-other', code: '6900', name: 'Other Operating Expense', kind: 'expense', category: 'Operating expense' },
] as const;

export type BookkeepingSqlDatabase = DatabaseLease;
type Database = BookkeepingSqlDatabase;

export interface CashAccountInput {
  id: string;
  businessId: string;
  name: string;
  kind: 'bank' | 'cash';
  openingDate?: string;
  openingBalanceCents?: bigint;
  openingTransactionId?: string;
  openingJournalEntryId?: string;
}

export interface CashTransactionInput {
  id: string;
  journalEntryId: string;
  businessId: string;
  date: string;
  kind: 'income' | 'expense';
  accountId: string;
  categoryAccountId: string;
  amountCents: bigint;
  description: string;
}

export interface CorrectCashTransactionInput {
  correctionId: string;
  originalTransactionId: string;
  reversalTransactionId: string;
  reversalJournalEntryId: string;
  replacement: CashTransactionInput;
}

export interface ReplaceMembersInput {
  businessId: string;
  effectiveDate: string;
  ownershipConfirmed: boolean;
  members: readonly MemberInterestInput[];
}

export interface BusinessRecord {
  id: string;
  name: string;
  formationState: string;
  formationDate: string;
  bookkeepingStartDate: string;
}

export interface MemberRecord extends MemberInterestInput {
  effectiveFrom: string;
  effectiveTo: string | null;
  retiredAt: string | null;
}

export interface AccountRecord {
  id: string;
  businessId: string;
  code: string;
  name: string;
  kind: 'bank' | 'cash' | 'equity' | 'income' | 'expense';
  category: string;
  isSystem: boolean;
  balanceCents: bigint;
}

export interface TransactionRecord {
  id: string;
  journalEntryId: string;
  date: string;
  kind: 'opening-balance' | 'income' | 'expense' | 'reversal';
  accountId: string;
  accountName: string;
  categoryAccountId: string;
  category: string;
  amountCents: bigint;
  description: string;
  originalTransactionId: string | null;
  correctionRole: 'reversal' | 'replacement' | null;
}

export interface CashBasisTotals {
  incomeCents: bigint;
  expenseCents: bigint;
  netIncomeCents: bigint;
}

export interface BookkeepingSnapshot {
  business: BusinessRecord | null;
  members: MemberRecord[];
  memberHistory: MemberRecord[];
  accounts: AccountRecord[];
  transactions: TransactionRecord[];
  cashBasis: CashBasisTotals;
}

export interface CashBasisReport extends CashBasisTotals {
  fromDate: string;
  throughDate: string;
}

interface DbBusiness {
  id: string;
  name: string;
  formationState: string;
  formationDate: string;
  bookkeepingStartDate: string;
}

interface DbMember extends MemberRecord {
  createdAt: string;
}

interface DbAccount {
  id: string;
  businessId: string;
  code: string;
  name: string;
  kind: AccountRecord['kind'];
  category: string;
  isSystem: number;
}

interface DbTransaction extends Omit<TransactionRecord, 'amountCents'> {
  amountCents: string;
}

interface DbJournalLine {
  accountId: string;
  accountKind?: AccountRecord['kind'];
  entryDate?: string;
  debitMinor: string;
  creditMinor: string;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function requireDate(value: string, label: string): void {
  if (!isValidDate(value)) throw new Error(`Enter a valid ${label}.`);
}

function dayBefore(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

async function inSqlTransaction<T>(database: Database, operation: () => Promise<T>): Promise<T> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    const result = await operation();
    await database.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}

/** Idempotent, versioned schema setup for the active SQLCipher database. */
export async function ensureBookkeepingSchema(database: Database): Promise<void> {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS bookkeeping_schema (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      version INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO bookkeeping_schema (singleton, version) VALUES (1, 0);
  `);
  const current = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM bookkeeping_schema WHERE singleton = 1',
  );
  if ((current?.version ?? 0) >= SCHEMA_VERSION) return;
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      formation_state TEXT NOT NULL,
      formation_date TEXT NOT NULL,
      bookkeeping_start_date TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retired_at TEXT
    );
    CREATE TABLE IF NOT EXISTS member_interest_history (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      ownership_basis_points INTEGER NOT NULL CHECK (ownership_basis_points BETWEEN 0 AND 10000),
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (member_id, effective_from),
      CHECK (effective_to IS NULL OR effective_to >= effective_from)
    );
    CREATE INDEX IF NOT EXISTS member_interest_as_of
      ON member_interest_history (business_id, effective_from, effective_to);
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('bank', 'cash', 'equity', 'income', 'expense')),
      category TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      UNIQUE (business_id, code),
      UNIQUE (business_id, name)
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      entry_date TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('opening-balance', 'income', 'expense', 'reversal')),
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS journal_entries_business_date
      ON journal_entries (business_id, entry_date);
    CREATE TABLE IF NOT EXISTS journal_lines (
      id TEXT PRIMARY KEY NOT NULL,
      journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      line_number INTEGER NOT NULL,
      debit_minor TEXT NOT NULL,
      credit_minor TEXT NOT NULL,
      UNIQUE (journal_entry_id, line_number),
      CHECK (CAST(debit_minor AS INTEGER) >= 0),
      CHECK (CAST(credit_minor AS INTEGER) >= 0),
      CHECK (CAST(debit_minor AS INTEGER) = 0 OR CAST(credit_minor AS INTEGER) = 0)
    );
    CREATE INDEX IF NOT EXISTS journal_lines_account ON journal_lines (account_id);
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
      entry_date TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('opening-balance', 'income', 'expense', 'reversal')),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      category_account_id TEXT NOT NULL REFERENCES accounts(id),
      amount_minor TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transactions_business_date ON transactions (business_id, entry_date);
    CREATE TABLE IF NOT EXISTS transaction_corrections (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      original_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
      reversal_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
      replacement_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transaction_correction_roles (
      transaction_id TEXT PRIMARY KEY NOT NULL REFERENCES transactions(id),
      correction_id TEXT NOT NULL REFERENCES transaction_corrections(id),
      role TEXT NOT NULL CHECK (role IN ('reversal', 'replacement'))
    );
    UPDATE bookkeeping_schema SET version = ${SCHEMA_VERSION} WHERE singleton = 1;
  `);
}

/** @internal SQL-level entry point used by repository tests. */
export async function createBusinessInDatabase(database: Database, input: BusinessSetupInput): Promise<void> {
  assertValidBusinessSetup(input);
  await ensureBookkeepingSchema(database);
  await inSqlTransaction(database, async () => {
    const existing = await database.getFirstAsync<{ id: string }>('SELECT id FROM businesses LIMIT 1');
    if (existing) throw new Error('This installation already has an LLC profile.');
    const createdAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO businesses (id, name, formation_state, formation_date, bookkeeping_start_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.id, input.name.trim(), input.formationState.trim().toUpperCase(), input.formationDate,
      input.bookkeepingStartDate, createdAt,
    );
    for (const account of SEEDED_ACCOUNTS) {
      await database.runAsync(
        `INSERT INTO accounts (id, business_id, code, name, kind, category, is_system, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        account.id, input.id, account.code, account.name, account.kind, account.category, createdAt,
      );
    }
    for (const member of input.members) {
      await database.runAsync(
        'INSERT INTO members (id, business_id, name, created_at) VALUES (?, ?, ?, ?)',
        member.id, input.id, member.name.trim(), createdAt,
      );
      await database.runAsync(
        `INSERT INTO member_interest_history
         (id, business_id, member_id, ownership_basis_points, effective_from, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        `${member.id}:interest:${input.bookkeepingStartDate}`, input.id, member.id,
        member.ownershipBasisPoints, input.bookkeepingStartDate, createdAt,
      );
    }
  });
}

async function requireBusiness(database: Database, businessId: string): Promise<DbBusiness> {
  const business = await database.getFirstAsync<DbBusiness>(
    `SELECT id, name, formation_state AS formationState, formation_date AS formationDate,
            bookkeeping_start_date AS bookkeepingStartDate
     FROM businesses WHERE id = ?`, businessId,
  );
  if (!business) throw new Error('Create the LLC profile before adding bookkeeping records.');
  return business;
}

async function requireCashAccount(database: Database, businessId: string, accountId: string): Promise<'bank' | 'cash'> {
  const account = await database.getFirstAsync<{ id: string; kind: 'bank' | 'cash' }>(
    "SELECT id, kind FROM accounts WHERE id = ? AND business_id = ? AND is_active = 1 AND kind IN ('bank', 'cash')",
    accountId, businessId,
  );
  if (!account) throw new Error('Choose an active bank or cash account for this transaction.');
  return account.kind;
}

async function ensureCashAccountNeverNegative(database: Database, businessId: string, accountId: string): Promise<void> {
  const account = await database.getFirstAsync<{ kind: string }>(
    'SELECT kind FROM accounts WHERE id = ? AND business_id = ?', accountId, businessId,
  );
  if (account?.kind !== 'cash') return;
  const lines = await database.getAllAsync<{
    entryDate: string;
    debitMinor: string;
    creditMinor: string;
  }>(
    `SELECT je.entry_date AS entryDate, jl.debit_minor AS debitMinor, jl.credit_minor AS creditMinor
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.account_id = ? AND je.business_id = ?
     ORDER BY je.entry_date, je.created_at, jl.line_number`, accountId, businessId,
  );
  let balance = 0n;
  let currentDate: string | undefined;
  let dateChange = 0n;
  for (const line of lines) {
    if (currentDate !== undefined && line.entryDate !== currentDate) {
      balance += dateChange;
      if (balance < 0n) throw new Error('The cash account balance would become negative on a recorded date.');
      dateChange = 0n;
    }
    currentDate = line.entryDate;
    dateChange += BigInt(line.debitMinor) - BigInt(line.creditMinor);
  }
  balance += dateChange;
  if (balance < 0n) throw new Error('The cash account balance would become negative on a recorded date.');
}

async function requireCategoryAccount(
  database: Database,
  businessId: string,
  accountId: string,
  kind: 'income' | 'expense',
): Promise<void> {
  const account = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM accounts WHERE id = ? AND business_id = ? AND is_active = 1 AND kind = ?',
    accountId, businessId, kind,
  );
  if (!account) throw new Error(`Choose an active ${kind} account for this transaction.`);
}

async function insertJournalEntry(
  database: Database,
  businessId: string,
  journalEntryId: string,
  date: string,
  kind: 'opening-balance' | 'income' | 'expense' | 'reversal',
  description: string,
  lines: readonly JournalLine[],
): Promise<void> {
  requireDate(date, 'transaction date');
  if (!description.trim()) throw new Error('Enter a transaction description.');
  assertBalancedEntry(lines);
  const createdAt = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO journal_entries (id, business_id, entry_date, entry_type, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    journalEntryId, businessId, date, kind, description.trim(), createdAt,
  );
  for (const [index, line] of lines.entries()) {
    const account = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM accounts WHERE id = ? AND business_id = ? AND is_active = 1', line.account, businessId,
    );
    if (!account) throw new Error('Every journal line must use an active account in this LLC.');
    await database.runAsync(
      `INSERT INTO journal_lines
       (id, journal_entry_id, account_id, line_number, debit_minor, credit_minor)
       VALUES (?, ?, ?, ?, ?, ?)`,
      `${journalEntryId}:line:${index + 1}`, journalEntryId, line.account, index + 1,
      line.debitCents.toString(), line.creditCents.toString(),
    );
  }
}

async function insertTransaction(
  database: Database,
  input: Omit<CashTransactionInput, 'amountCents' | 'kind'> & {
    kind: TransactionRecord['kind'];
    amountCents: bigint;
    categoryAccountId: string;
  },
): Promise<void> {
  await database.runAsync(
    `INSERT INTO transactions
     (id, business_id, journal_entry_id, entry_date, kind, account_id, category_account_id,
      amount_minor, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id, input.businessId, input.journalEntryId, input.date, input.kind, input.accountId,
    input.categoryAccountId, input.amountCents.toString(), input.description.trim(), new Date().toISOString(),
  );
}

/** @internal SQL-level entry point used by repository tests. */
export async function createCashAccountInDatabase(database: Database, input: CashAccountInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  const business = await requireBusiness(database, input.businessId);
  if (!input.id.trim() || !input.name.trim()) throw new Error('Enter a name for this bank or cash account.');
  const opening = input.openingBalanceCents ?? 0n;
  if (input.kind === 'cash' && opening < 0n) throw new Error('A cash account opening balance cannot be negative.');
  if (opening !== 0n) {
    if (!input.openingDate || !input.openingTransactionId || !input.openingJournalEntryId) {
      throw new Error('An opening balance requires its date and transaction identifiers.');
    }
    requireDate(input.openingDate, 'opening balance date');
    if (input.openingDate < business.bookkeepingStartDate) throw new Error('Opening balance cannot precede the bookkeeping start date.');
  }
  await inSqlTransaction(database, async () => {
    await database.runAsync(
      `INSERT INTO accounts (id, business_id, code, name, kind, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.businessId, `cash:${input.id}`, input.name.trim(), input.kind,
      input.kind === 'bank' ? 'Bank account' : 'Cash account', new Date().toISOString(),
    );
    if (opening !== 0n) {
      const lines = openingBalanceLines(input.id, 'opening-equity', opening);
      const description = `Opening balance · ${input.name.trim()}`;
      await insertJournalEntry(database, input.businessId, input.openingJournalEntryId!, input.openingDate!, 'opening-balance', description, lines);
      await insertTransaction(database, {
        id: input.openingTransactionId!, journalEntryId: input.openingJournalEntryId!, businessId: input.businessId,
        date: input.openingDate!, kind: 'opening-balance', accountId: input.id,
        categoryAccountId: 'opening-equity', amountCents: opening, description,
      });
    }
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function recordCashTransactionInDatabase(database: Database, input: CashTransactionInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  const business = await requireBusiness(database, input.businessId);
  if (input.date < business.bookkeepingStartDate) throw new Error('Transaction date cannot precede the bookkeeping start date.');
  if (!input.description.trim()) throw new Error('Enter a transaction description.');
  if (input.amountCents <= 0n) throw new Error('Transaction amounts must be positive.');
  await requireCashAccount(database, input.businessId, input.accountId);
  await requireCategoryAccount(database, input.businessId, input.categoryAccountId, input.kind);
  const lines = input.kind === 'income'
    ? cashIncomeLines(input.accountId, input.categoryAccountId, input.amountCents)
    : cashExpenseLines(input.accountId, input.categoryAccountId, input.amountCents);
  await inSqlTransaction(database, async () => {
    await insertJournalEntry(database, input.businessId, input.journalEntryId, input.date, input.kind, input.description, lines);
    const signedAmount = input.kind === 'income' ? input.amountCents : -input.amountCents;
    await insertTransaction(database, { ...input, amountCents: signedAmount });
    await ensureCashAccountNeverNegative(database, input.businessId, input.accountId);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function correctCashTransactionInDatabase(database: Database, input: CorrectCashTransactionInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  const replacement = input.replacement;
  const business = await requireBusiness(database, replacement.businessId);
  if (replacement.date < business.bookkeepingStartDate) throw new Error('Replacement date cannot precede the bookkeeping start date.');
  if (replacement.amountCents <= 0n) throw new Error('Replacement amount must be positive.');
  if (!replacement.description.trim()) throw new Error('Enter a replacement description.');
  await requireCashAccount(database, replacement.businessId, replacement.accountId);
  await requireCategoryAccount(database, replacement.businessId, replacement.categoryAccountId, replacement.kind);

  await inSqlTransaction(database, async () => {
    const original = await database.getFirstAsync<{
      id: string;
      businessId: string;
      journalEntryId: string;
      date: string;
      kind: string;
      accountId: string;
      categoryAccountId: string;
      amountMinor: string;
      description: string;
    }>(
      `SELECT id, business_id AS businessId, journal_entry_id AS journalEntryId,
              entry_date AS date, kind, account_id AS accountId,
              category_account_id AS categoryAccountId, amount_minor AS amountMinor, description
       FROM transactions WHERE id = ? AND business_id = ?`, input.originalTransactionId, replacement.businessId,
    );
    if (!original || (original.kind !== 'income' && original.kind !== 'expense')) {
      throw new Error('Choose an original income or expense transaction to correct.');
    }
    const existingCorrection = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM transaction_corrections WHERE original_transaction_id = ?', original.id,
    );
    if (existingCorrection) throw new Error('This transaction has already been corrected.');
    const originalLines = await database.getAllAsync<{ accountId: string; debitMinor: string; creditMinor: string }>(
      `SELECT account_id AS accountId, debit_minor AS debitMinor, credit_minor AS creditMinor
       FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number`, original.journalEntryId,
    );
    const reversedLines = reverseLines(originalLines.map((line) => ({
      account: line.accountId,
      debitCents: BigInt(line.debitMinor),
      creditCents: BigInt(line.creditMinor),
    })));
    const reversalDescription = `Reversal of: ${original.description}`;
    await insertJournalEntry(
      database, original.businessId, input.reversalJournalEntryId, original.date,
      'reversal', reversalDescription, reversedLines,
    );
    await insertTransaction(database, {
      id: input.reversalTransactionId,
      journalEntryId: input.reversalJournalEntryId,
      businessId: original.businessId,
      date: original.date,
      kind: 'reversal',
      accountId: original.accountId,
      categoryAccountId: original.categoryAccountId,
      amountCents: -BigInt(original.amountMinor),
      description: reversalDescription,
    });

    const replacementLines = replacement.kind === 'income'
      ? cashIncomeLines(replacement.accountId, replacement.categoryAccountId, replacement.amountCents)
      : cashExpenseLines(replacement.accountId, replacement.categoryAccountId, replacement.amountCents);
    await insertJournalEntry(
      database, replacement.businessId, replacement.journalEntryId, replacement.date,
      replacement.kind, replacement.description, replacementLines,
    );
    const replacementSignedAmount = replacement.kind === 'income' ? replacement.amountCents : -replacement.amountCents;
    await insertTransaction(database, { ...replacement, amountCents: replacementSignedAmount });

    const createdAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO transaction_corrections
       (id, business_id, original_transaction_id, reversal_transaction_id, replacement_transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.correctionId, original.businessId, original.id, input.reversalTransactionId, replacement.id, createdAt,
    );
    await database.runAsync(
      `INSERT INTO transaction_correction_roles (transaction_id, correction_id, role) VALUES (?, ?, 'reversal')`,
      input.reversalTransactionId, input.correctionId,
    );
    await database.runAsync(
      `INSERT INTO transaction_correction_roles (transaction_id, correction_id, role) VALUES (?, ?, 'replacement')`,
      replacement.id, input.correctionId,
    );
    await ensureCashAccountNeverNegative(database, original.businessId, original.accountId);
    await ensureCashAccountNeverNegative(database, replacement.businessId, replacement.accountId);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function replaceMembersInDatabase(database: Database, input: ReplaceMembersInput): Promise<void> {
  if (!input.ownershipConfirmed) throw new Error('Confirm the ownership interests before saving member changes.');
  assertOwnershipTotals(input.members);
  requireDate(input.effectiveDate, 'ownership effective date');
  await ensureBookkeepingSchema(database);
  const business = await requireBusiness(database, input.businessId);
  if (input.effectiveDate < business.bookkeepingStartDate) throw new Error('Ownership changes cannot precede the bookkeeping start date.');

  await inSqlTransaction(database, async () => {
    const active = await database.getAllAsync<MemberRecord>(
      `SELECT m.id, m.name, h.ownership_basis_points AS ownershipBasisPoints,
              h.effective_from AS effectiveFrom, h.effective_to AS effectiveTo, m.retired_at AS retiredAt
       FROM members m JOIN member_interest_history h ON h.member_id = m.id AND h.effective_to IS NULL
       WHERE m.business_id = ? AND m.retired_at IS NULL`, input.businessId,
    );
    const activeById = new Map(active.map((member) => [member.id, member]));
    const inputById = new Map(input.members.map((member) => [member.id, member]));
    const changesOwnership = active.length !== input.members.length
      || input.members.some((member) => activeById.get(member.id)?.ownershipBasisPoints !== member.ownershipBasisPoints);
    if (changesOwnership && active.some((member) => input.effectiveDate <= member.effectiveFrom)) {
      throw new Error('Choose an effective date after the current ownership period.');
    }
    const createdAt = new Date().toISOString();
    for (const current of active) {
      const replacement = inputById.get(current.id);
      if (!replacement) {
        await database.runAsync(
          'UPDATE member_interest_history SET effective_to = ? WHERE member_id = ? AND effective_to IS NULL',
          dayBefore(input.effectiveDate), current.id,
        );
        await database.runAsync('UPDATE members SET retired_at = ? WHERE id = ?', input.effectiveDate, current.id);
        continue;
      }
      await database.runAsync('UPDATE members SET name = ? WHERE id = ?', replacement.name.trim(), current.id);
      if (replacement.ownershipBasisPoints !== current.ownershipBasisPoints) {
        await database.runAsync(
          'UPDATE member_interest_history SET effective_to = ? WHERE member_id = ? AND effective_to IS NULL',
          dayBefore(input.effectiveDate), current.id,
        );
        await database.runAsync(
          `INSERT INTO member_interest_history
           (id, business_id, member_id, ownership_basis_points, effective_from, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          `${current.id}:interest:${input.effectiveDate}`, input.businessId, current.id,
          replacement.ownershipBasisPoints, input.effectiveDate, createdAt,
        );
      }
    }
    for (const member of input.members) {
      if (activeById.has(member.id)) continue;
      const known = await database.getFirstAsync<{ id: string }>(
        'SELECT id FROM members WHERE id = ? AND business_id = ?', member.id, input.businessId,
      );
      if (known) {
        await database.runAsync('UPDATE members SET name = ?, retired_at = NULL WHERE id = ?', member.name.trim(), member.id);
      } else {
        await database.runAsync(
          'INSERT INTO members (id, business_id, name, created_at) VALUES (?, ?, ?, ?)',
          member.id, input.businessId, member.name.trim(), createdAt,
        );
      }
      await database.runAsync(
        `INSERT INTO member_interest_history
         (id, business_id, member_id, ownership_basis_points, effective_from, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        `${member.id}:interest:${input.effectiveDate}`, input.businessId, member.id,
        member.ownershipBasisPoints, input.effectiveDate, createdAt,
      );
    }
  });
}

async function readBusiness(database: Database, businessId?: string): Promise<BusinessRecord | null> {
  const business = businessId
    ? await database.getFirstAsync<DbBusiness>(
      `SELECT id, name, formation_state AS formationState, formation_date AS formationDate,
              bookkeeping_start_date AS bookkeepingStartDate FROM businesses WHERE id = ?`, businessId,
    )
    : await database.getFirstAsync<DbBusiness>(
      `SELECT id, name, formation_state AS formationState, formation_date AS formationDate,
              bookkeeping_start_date AS bookkeepingStartDate FROM businesses ORDER BY created_at LIMIT 1`,
    );
  return business ?? null;
}

async function readMembers(database: Database, businessId: string): Promise<{ members: MemberRecord[]; history: MemberRecord[] }> {
  const all = await database.getAllAsync<MemberRecord>(
    `SELECT m.id, m.name, h.ownership_basis_points AS ownershipBasisPoints,
            h.effective_from AS effectiveFrom, h.effective_to AS effectiveTo, m.retired_at AS retiredAt
     FROM members m JOIN member_interest_history h ON h.member_id = m.id
     WHERE m.business_id = ? ORDER BY m.rowid, h.effective_from`, businessId,
  );
  return {
    members: all.filter((member) => member.effectiveTo === null && member.retiredAt === null),
    history: all,
  };
}

async function readAccounts(database: Database, businessId: string): Promise<AccountRecord[]> {
  const accounts = await database.getAllAsync<DbAccount>(
    `SELECT id, business_id AS businessId, code, name, kind, category, is_system AS isSystem
     FROM accounts WHERE business_id = ? AND is_active = 1 ORDER BY code`, businessId,
  );
  const lines = await database.getAllAsync<DbJournalLine>(
    `SELECT jl.account_id AS accountId, jl.debit_minor AS debitMinor, jl.credit_minor AS creditMinor
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.business_id = ?`, businessId,
  );
  const balances = new Map<string, bigint>();
  for (const line of lines) {
    balances.set(line.accountId, (balances.get(line.accountId) ?? 0n)
      + BigInt(line.debitMinor) - BigInt(line.creditMinor));
  }
  return accounts.map((account) => ({
    ...account,
    isSystem: account.isSystem === 1,
    balanceCents: balances.get(account.id) ?? 0n,
  }));
}

async function readTransactions(database: Database, businessId: string): Promise<TransactionRecord[]> {
  const rows = await database.getAllAsync<DbTransaction>(
    `SELECT t.id, t.journal_entry_id AS journalEntryId, t.entry_date AS date, t.kind,
            t.account_id AS accountId, a.name AS accountName,
            t.category_account_id AS categoryAccountId, c.name AS category,
            t.amount_minor AS amountCents, t.description,
            COALESCE(original.original_transaction_id, correction.original_transaction_id) AS originalTransactionId,
            role.role AS correctionRole
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN accounts c ON c.id = t.category_account_id
     LEFT JOIN transaction_correction_roles role ON role.transaction_id = t.id
     LEFT JOIN transaction_corrections original ON original.original_transaction_id = t.id
     LEFT JOIN transaction_corrections correction ON correction.id = role.correction_id
     WHERE t.business_id = ? ORDER BY t.entry_date DESC, t.created_at DESC, t.id`, businessId,
  );
  return rows.map((row) => ({ ...row, amountCents: BigInt(row.amountCents) }));
}

async function cashBasisForPeriod(database: Database, businessId: string, fromDate?: string, throughDate?: string): Promise<CashBasisTotals> {
  const conditions = ['je.business_id = ?', "a.kind IN ('income', 'expense')"];
  const parameters: Array<string> = [businessId];
  if (fromDate) {
    requireDate(fromDate, 'report start date');
    conditions.push('je.entry_date >= ?');
    parameters.push(fromDate);
  }
  if (throughDate) {
    requireDate(throughDate, 'report end date');
    conditions.push('je.entry_date <= ?');
    parameters.push(throughDate);
  }
  if (fromDate && throughDate && fromDate > throughDate) throw new Error('Report start date must not follow its end date.');
  const lines = await database.getAllAsync<DbJournalLine>(
    `SELECT jl.account_id AS accountId, a.kind AS accountKind,
            jl.debit_minor AS debitMinor, jl.credit_minor AS creditMinor
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE ${conditions.join(' AND ')}`,
    ...parameters,
  );
  let incomeCents = 0n;
  let expenseCents = 0n;
  for (const line of lines) {
    const debit = BigInt(line.debitMinor);
    const credit = BigInt(line.creditMinor);
    if (line.accountKind === 'income') incomeCents += credit - debit;
    if (line.accountKind === 'expense') expenseCents += debit - credit;
  }
  return { incomeCents, expenseCents, netIncomeCents: incomeCents - expenseCents };
}

/** @internal SQL-level entry point used by repository tests. */
export async function getBookkeepingSnapshotFromDatabase(database: Database, businessId?: string): Promise<BookkeepingSnapshot | null> {
  await ensureBookkeepingSchema(database);
  const business = await readBusiness(database, businessId);
  if (!business) return { business: null, members: [], memberHistory: [], accounts: [], transactions: [], cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n } };
  const { members, history } = await readMembers(database, business.id);
  const accounts = await readAccounts(database, business.id);
  const transactions = await readTransactions(database, business.id);
  const cashBasis = await cashBasisForPeriod(database, business.id);
  return { business, members, memberHistory: history, accounts, transactions, cashBasis };
}

export function transactionsCsv(snapshot: BookkeepingSnapshot): string {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [
    ['Date', 'Category', 'Amount', 'Account', 'Description'],
    ...snapshot.transactions.map((transaction) => [
      transaction.date,
      transaction.kind === 'reversal' ? `${transaction.category} · reversal` : transaction.category,
      transaction.amountCents < 0n ? `-${formatUsd(-transaction.amountCents)}` : formatUsd(transaction.amountCents),
      transaction.accountName,
      transaction.description,
    ]),
  ];
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export async function cashBasisReportFromDatabase(database: Database, businessId: string, fromDate: string, throughDate: string): Promise<CashBasisReport> {
  const totals = await cashBasisForPeriod(database, businessId, fromDate, throughDate);
  return { ...totals, fromDate, throughDate };
}
