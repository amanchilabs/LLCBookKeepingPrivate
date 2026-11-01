import type { DatabaseLease } from './database-lease';
import {
  assertOwnershipTotals,
  assertValidBusinessSetup,
  cashCapitalContributionLines,
  cashExpenseLines,
  cashIncomeLines,
  guaranteedPaymentDueDates,
  type GuaranteedPaymentRecurrence,
  memberDistributionLines,
  openingBalanceLines,
  propertyCapitalContributionLines,
  reverseLines,
  type BusinessSetupInput,
  type MemberInterestInput,
} from '../../domain/src/bookkeeping';
import { accountTransferLines, assertBalancedEntry, loanAdvanceLines, loanRepaymentLines, type JournalLine } from '../../domain/src/journal';
import { calculateUnpaidLoanInterestCents, type DatedAmount, type LoanDayCount } from '../../domain/src/loan-interest';
import { formatUsd } from '../../domain/src/money';

const SCHEMA_VERSION = 8;

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

export interface TransferInput {
  transactionId: string;
  journalEntryId: string;
  businessId: string;
  date: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: bigint;
  description: string;
}

export interface TransferTransactionInput extends Omit<CashTransactionInput, 'kind'> {
  kind: 'transfer';
}

export interface CreateAccountReconciliationInput {
  id: string;
  businessId: string;
  accountId: string;
  periodStartDate: string;
  statementDate: string;
  beginningBalanceCents: bigint;
  endingBalanceCents: bigint;
}

export interface AccountReconciliationActivity {
  transactionId: string;
  date: string;
  description: string;
  amountCents: bigint;
  cleared: boolean;
}

export interface AccountReconciliationRecord {
  id: string;
  accountId: string;
  accountName: string;
  periodStartDate: string;
  statementDate: string;
  beginningBalanceCents: bigint;
  endingBalanceCents: bigint;
  clearedMovementCents: bigint;
  differenceCents: bigint;
  status: 'draft' | 'completed';
  activities: AccountReconciliationActivity[];
}

export interface AccountReconciliationEvent {
  id: string;
  reconciliationId: string;
  eventType: 'created' | 'item-cleared' | 'item-uncleared' | 'completed' | 'reopened';
  transactionId: string | null;
  createdAt: string;
}

export interface CorrectCashTransactionInput {
  correctionId: string;
  originalTransactionId: string;
  reversalTransactionId: string;
  reversalJournalEntryId: string;
  replacement: CashTransactionInput | TransferTransactionInput;
}

export interface ReplaceMembersInput {
  businessId: string;
  effectiveDate: string;
  ownershipConfirmed: boolean;
  members: readonly MemberInterestInput[];
}

export type MemberCapitalActivityKind = 'cash-contribution' | 'property-contribution' | 'distribution';

export interface MemberCapitalActivityInput {
  id: string;
  journalEntryId: string;
  businessId: string;
  memberId: string;
  date: string;
  kind: MemberCapitalActivityKind;
  amountCents: bigint;
  description: string;
  cashAccountId?: string;
  propertyDescription?: string;
}

export interface MemberCapitalActivityRecord {
  id: string;
  journalEntryId: string;
  memberId: string;
  memberName: string;
  date: string;
  kind: MemberCapitalActivityKind;
  amountCents: bigint;
  description: string;
  cashAccountName: string | null;
  propertyDescription: string | null;
  requiresCpaReview: boolean;
}

export interface MemberCapitalSummary {
  memberId: string;
  memberName: string;
  cashContributionsCents: bigint;
  propertyContributionsCents: bigint;
  distributionsCents: bigint;
  bookCapitalActivityCents: bigint;
}

export type GuaranteedPaymentClassification = 'services' | 'use-of-capital';
export type LoanLenderType = 'member' | 'third-party';
export type { LoanDayCount } from '../../domain/src/loan-interest';

export interface CreateLoanAgreementInput {
  id: string;
  businessId: string;
  lenderType: LoanLenderType;
  memberId?: string;
  lenderName?: string;
  agreementDate: string;
  commitmentCents: bigint;
  annualRateBasisPoints: number;
  dayCount: LoanDayCount;
  description: string;
}

export interface RecordLoanAdvanceInput {
  id: string;
  transactionId: string;
  journalEntryId: string;
  loanId: string;
  date: string;
  cashAccountId: string;
  amountCents: bigint;
  description: string;
}

export interface RecordLoanRepaymentInput {
  id: string;
  transactionId: string;
  journalEntryId: string;
  loanId: string;
  date: string;
  cashAccountId: string;
  principalCents: bigint;
  interestCents: bigint;
  description: string;
}

export interface LoanAgreementRecord {
  id: string;
  lenderType: LoanLenderType;
  memberId: string | null;
  lenderName: string;
  agreementDate: string;
  commitmentCents: bigint;
  annualRateBasisPoints: number;
  dayCount: LoanDayCount;
  description: string;
  liabilityAccountId: string;
}

export interface LoanActivityRecord {
  id: string;
  loanId: string;
  transactionId: string;
  journalEntryId: string;
  date: string;
  kind: 'advance' | 'repayment';
  cashAccountId: string;
  cashAccountName: string;
  amountCents: bigint;
  principalCents: bigint;
  interestCents: bigint;
  description: string;
}

export interface CreateGuaranteedPaymentObligationInput {
  id: string;
  businessId: string;
  memberId: string;
  classification: GuaranteedPaymentClassification;
  recurrence: GuaranteedPaymentRecurrence;
  firstDueDate: string;
  installmentCount: number;
  installmentAmountCents: bigint;
  description: string;
}

export interface GuaranteedPaymentAllocationInput {
  installmentId: string;
  amountCents: bigint;
}

export interface RecordGuaranteedPaymentInput {
  id: string;
  transactionId: string;
  journalEntryId: string;
  businessId: string;
  memberId: string;
  date: string;
  cashAccountId: string;
  description: string;
  allocations: readonly GuaranteedPaymentAllocationInput[];
}

export interface ReverseGuaranteedPaymentInput {
  id: string;
  paymentId: string;
  reversalTransactionId: string;
  reversalJournalEntryId: string;
  date: string;
  returnCashAccountId: string;
  reason: string;
}

export interface GuaranteedPaymentInstallmentRecord {
  id: string;
  obligationId: string;
  memberId: string;
  memberName: string;
  classification: GuaranteedPaymentClassification;
  description: string;
  dueDate: string;
  scheduledAmountCents: bigint;
  paidAmountCents: bigint;
  outstandingAmountCents: bigint;
}

export interface GuaranteedPaymentCashEvent {
  id: string;
  paymentId: string;
  transactionId: string;
  memberId: string;
  memberName: string;
  classification: GuaranteedPaymentClassification;
  date: string;
  kind: 'payment' | 'reversal';
  amountCents: bigint;
  cashAccountName: string;
  description: string;
  reason: string | null;
}

type JournalEntryKind = 'opening-balance' | 'income' | 'expense' | 'reversal' | 'transfer'
  | 'cash-contribution' | 'property-contribution' | 'member-distribution' | 'loan-advance' | 'loan-repayment';

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
  kind: 'bank' | 'cash' | 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  category: string;
  isSystem: boolean;
  balanceCents: bigint;
}

export interface TransactionRecord {
  id: string;
  journalEntryId: string;
  date: string;
  kind: 'opening-balance' | 'income' | 'expense' | 'reversal' | 'transfer' | 'loan-advance' | 'loan-repayment';
  accountId: string;
  accountName: string;
  categoryAccountId: string;
  category: string;
  amountCents: bigint;
  description: string;
  originalTransactionId: string | null;
  correctionRole: 'reversal' | 'replacement' | null;
  isGuaranteedPayment: boolean;
  transferRole: 'transfer' | 'transfer-reversal' | null;
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
  capitalActivities: MemberCapitalActivityRecord[];
  memberCapitalSummaries: MemberCapitalSummary[];
  guaranteedPaymentInstallments: GuaranteedPaymentInstallmentRecord[];
  guaranteedPaymentCashEvents: GuaranteedPaymentCashEvent[];
  loanAgreements: LoanAgreementRecord[];
  loanActivities: LoanActivityRecord[];
  accountReconciliations: AccountReconciliationRecord[];
  accountReconciliationEvents: AccountReconciliationEvent[];
  cashBasis: CashBasisTotals;
}

export interface CashBasisReport extends CashBasisTotals {
  fromDate: string;
  throughDate: string;
}

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  kind: AccountRecord['kind'];
  debitCents: bigint;
  creditCents: bigint;
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  balanceCents: bigint;
}

export interface JournalBalanceReport {
  asOfDate: string;
  trialBalance: TrialBalanceLine[];
  totalDebitsCents: bigint;
  totalCreditsCents: bigint;
  balanceSheet: {
    assets: BalanceSheetLine[];
    liabilities: BalanceSheetLine[];
    equity: BalanceSheetLine[];
    currentEarningsCents: bigint;
    totalAssetsCents: bigint;
    totalLiabilitiesCents: bigint;
    bookEquityCents: bigint;
    totalEquityCents: bigint;
    differenceCents: bigint;
  };
}

export interface GeneralLedgerLine {
  journalEntryId: string;
  date: string;
  description: string;
  debitCents: bigint;
  creditCents: bigint;
  runningBalanceCents: bigint;
}

export interface GeneralLedgerReport {
  accountId: string;
  accountName: string;
  accountKind: AccountRecord['kind'];
  asOfDate: string;
  lines: GeneralLedgerLine[];
  totalDebitsCents: bigint;
  totalCreditsCents: bigint;
  endingBalanceCents: bigint;
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

interface DbTransaction extends Omit<TransactionRecord, 'amountCents' | 'isGuaranteedPayment'> {
  amountCents: string;
  isGuaranteedPayment: number;
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
  let version = current?.version ?? 0;
  if (version >= SCHEMA_VERSION) return;
  if (version < 1) {
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
      kind TEXT NOT NULL CHECK (kind IN ('bank', 'cash', 'asset', 'liability', 'equity', 'income', 'expense')),
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
      entry_type TEXT NOT NULL CHECK (entry_type IN ('opening-balance', 'income', 'expense', 'reversal', 'transfer', 'loan-advance', 'loan-repayment')),
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
      kind TEXT NOT NULL CHECK (kind IN ('opening-balance', 'income', 'expense', 'reversal', 'transfer', 'loan-advance', 'loan-repayment')),
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
      UPDATE bookkeeping_schema SET version = 1 WHERE singleton = 1;
    `);
    version = 1;
  }
  if (version < 2) {
    await migrateBookkeepingV1ToV2(database);
    version = 2;
  }
  if (version < 3) {
    await migrateBookkeepingV2ToV3(database);
    version = 3;
  }
  if (version < 4) {
    await migrateBookkeepingV3ToV4(database);
    version = 4;
  }
  if (version < 5) {
    await migrateBookkeepingV4ToV5(database);
    version = 5;
  }
  if (version < 6) await migrateBookkeepingV5ToV6(database);
  if (version < 7) await migrateBookkeepingV6ToV7(database);
  if (version < 8) await migrateBookkeepingV7ToV8(database);
}

async function migrateBookkeepingV7ToV8(database: Database): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS account_reconciliations (
        id TEXT PRIMARY KEY NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        period_start_date TEXT NOT NULL,
        statement_date TEXT NOT NULL,
        beginning_minor TEXT NOT NULL,
        ending_minor TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'completed')),
        created_at TEXT NOT NULL,
        completed_at TEXT,
        CHECK (statement_date > period_start_date),
        UNIQUE (business_id, account_id, statement_date)
      );
      CREATE INDEX IF NOT EXISTS account_reconciliations_account_date
        ON account_reconciliations (business_id, account_id, statement_date);
      CREATE UNIQUE INDEX IF NOT EXISTS account_reconciliations_one_draft_per_account
        ON account_reconciliations (account_id) WHERE status = 'draft';
      CREATE TABLE IF NOT EXISTS account_reconciliation_items (
        reconciliation_id TEXT NOT NULL REFERENCES account_reconciliations(id),
        transaction_id TEXT NOT NULL REFERENCES transactions(id),
        created_at TEXT NOT NULL,
        PRIMARY KEY (reconciliation_id, transaction_id)
      );
      CREATE INDEX IF NOT EXISTS account_reconciliation_items_transaction
        ON account_reconciliation_items (transaction_id);
      CREATE TABLE IF NOT EXISTS account_reconciliation_events (
        id TEXT PRIMARY KEY NOT NULL,
        reconciliation_id TEXT NOT NULL REFERENCES account_reconciliations(id),
        event_type TEXT NOT NULL CHECK (event_type IN ('created', 'item-cleared', 'item-uncleared', 'completed', 'reopened')),
        transaction_id TEXT REFERENCES transactions(id),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS account_reconciliation_events_history
        ON account_reconciliation_events (reconciliation_id, created_at);
      UPDATE bookkeeping_schema SET version = 8 WHERE singleton = 1;
    `);
    const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
      'PRAGMA foreign_key_check',
    );
    if (violations.length > 0) throw new Error('The reconciliation schema migration found invalid record references.');
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}

async function migrateBookkeepingV6ToV7(database: Database): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await database.execAsync(`
        CREATE TABLE journal_entries_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          entry_date TEXT NOT NULL,
          entry_type TEXT NOT NULL CHECK (entry_type IN (
            'opening-balance', 'income', 'expense', 'reversal', 'transfer',
            'cash-contribution', 'property-contribution', 'member-distribution',
            'loan-advance', 'loan-repayment'
          )),
          description TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO journal_entries_v7 (id, business_id, entry_date, entry_type, description, created_at)
        SELECT id, business_id, entry_date, entry_type, description, created_at FROM journal_entries;

        CREATE TABLE transactions_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
          entry_date TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN (
            'opening-balance', 'income', 'expense', 'reversal', 'transfer', 'loan-advance', 'loan-repayment'
          )),
          account_id TEXT NOT NULL REFERENCES accounts(id),
          category_account_id TEXT NOT NULL REFERENCES accounts(id),
          amount_minor TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO transactions_v7
          (id, business_id, journal_entry_id, entry_date, kind, account_id, category_account_id, amount_minor, description, created_at)
        SELECT id, business_id, journal_entry_id, entry_date, kind, account_id, category_account_id, amount_minor, description, created_at
        FROM transactions;

        DROP TABLE transactions;
        DROP TABLE journal_entries;
        ALTER TABLE journal_entries_v7 RENAME TO journal_entries;
        ALTER TABLE transactions_v7 RENAME TO transactions;
        CREATE INDEX journal_entries_business_date ON journal_entries (business_id, entry_date);
        CREATE INDEX transactions_business_date ON transactions (business_id, entry_date);
        UPDATE bookkeeping_schema SET version = 7 WHERE singleton = 1;
      `);
      const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
        'PRAGMA foreign_key_check',
      );
      if (violations.length > 0) throw new Error('The transfer schema migration found invalid record references.');
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function migrateBookkeepingV1ToV2(database: Database): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await database.execAsync(`
        CREATE TABLE accounts_v2 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('bank', 'cash', 'asset', 'equity', 'income', 'expense')),
          category TEXT NOT NULL,
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          UNIQUE (business_id, code),
          UNIQUE (business_id, name)
        );
        INSERT INTO accounts_v2
          (id, business_id, code, name, kind, category, is_system, is_active, created_at)
        SELECT id, business_id, code, name, kind, category, is_system, is_active, created_at FROM accounts;
        DROP TABLE accounts;
        ALTER TABLE accounts_v2 RENAME TO accounts;

        CREATE TABLE journal_entries_v2 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          entry_date TEXT NOT NULL,
          entry_type TEXT NOT NULL CHECK (entry_type IN (
            'opening-balance', 'income', 'expense', 'reversal',
            'cash-contribution', 'property-contribution', 'member-distribution'
          )),
          description TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO journal_entries_v2 (id, business_id, entry_date, entry_type, description, created_at)
        SELECT id, business_id, entry_date, entry_type, description, created_at FROM journal_entries;
        DROP TABLE journal_entries;
        ALTER TABLE journal_entries_v2 RENAME TO journal_entries;
        CREATE INDEX journal_entries_business_date ON journal_entries (business_id, entry_date);

        CREATE TABLE member_capital_activity (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          member_id TEXT NOT NULL REFERENCES members(id),
          journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
          activity_date TEXT NOT NULL,
          activity_kind TEXT NOT NULL CHECK (activity_kind IN ('cash-contribution', 'property-contribution', 'distribution')),
          amount_minor TEXT NOT NULL,
          cash_account_id TEXT REFERENCES accounts(id),
          property_asset_account_id TEXT REFERENCES accounts(id),
          property_description TEXT,
          description TEXT NOT NULL,
          requires_cpa_review INTEGER NOT NULL CHECK (requires_cpa_review IN (0, 1)),
          created_at TEXT NOT NULL,
          CHECK (
            (activity_kind IN ('cash-contribution', 'distribution')
              AND cash_account_id IS NOT NULL AND property_asset_account_id IS NULL AND property_description IS NULL
              AND requires_cpa_review = 0)
            OR
            (activity_kind = 'property-contribution'
              AND cash_account_id IS NULL AND property_asset_account_id IS NOT NULL AND property_description IS NOT NULL
              AND requires_cpa_review = 1)
          )
        );
        CREATE INDEX member_capital_activity_member_date
          ON member_capital_activity (business_id, member_id, activity_date, created_at);
        UPDATE bookkeeping_schema SET version = 2 WHERE singleton = 1;
      `);
      const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
        'PRAGMA foreign_key_check',
      );
      if (violations.length > 0) throw new Error('The bookkeeping schema migration found invalid record references.');
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function migrateBookkeepingV2ToV3(database: Database): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    await database.execAsync(`
      CREATE TABLE guaranteed_payment_obligations (
        id TEXT PRIMARY KEY NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        member_id TEXT NOT NULL REFERENCES members(id),
        classification TEXT NOT NULL CHECK (classification IN ('services', 'use-of-capital')),
        recurrence TEXT NOT NULL CHECK (recurrence IN ('one-time', 'monthly', 'quarterly')),
        first_due_date TEXT NOT NULL,
        installment_count INTEGER NOT NULL CHECK (installment_count BETWEEN 1 AND 120),
        installment_amount_minor TEXT NOT NULL CHECK (CAST(installment_amount_minor AS INTEGER) > 0),
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX guaranteed_payment_obligations_member
        ON guaranteed_payment_obligations (business_id, member_id, first_due_date);
      CREATE TABLE guaranteed_payment_installments (
        id TEXT PRIMARY KEY NOT NULL,
        obligation_id TEXT NOT NULL REFERENCES guaranteed_payment_obligations(id),
        due_date TEXT NOT NULL,
        amount_minor TEXT NOT NULL CHECK (CAST(amount_minor AS INTEGER) > 0),
        installment_number INTEGER NOT NULL CHECK (installment_number BETWEEN 1 AND 120),
        created_at TEXT NOT NULL,
        UNIQUE (obligation_id, installment_number),
        UNIQUE (obligation_id, due_date)
      );
      CREATE INDEX guaranteed_payment_installments_due
        ON guaranteed_payment_installments (due_date, obligation_id);
      CREATE TABLE guaranteed_payment_payments (
        id TEXT PRIMARY KEY NOT NULL,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        member_id TEXT NOT NULL REFERENCES members(id),
        classification TEXT NOT NULL CHECK (classification IN ('services', 'use-of-capital')),
        transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
        payment_date TEXT NOT NULL,
        cash_account_id TEXT NOT NULL REFERENCES accounts(id),
        amount_minor TEXT NOT NULL CHECK (CAST(amount_minor AS INTEGER) > 0),
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX guaranteed_payment_payments_member_date
        ON guaranteed_payment_payments (business_id, member_id, payment_date);
      CREATE TABLE guaranteed_payment_allocations (
        payment_id TEXT NOT NULL REFERENCES guaranteed_payment_payments(id),
        installment_id TEXT NOT NULL REFERENCES guaranteed_payment_installments(id),
        amount_minor TEXT NOT NULL CHECK (CAST(amount_minor AS INTEGER) > 0),
        created_at TEXT NOT NULL,
        PRIMARY KEY (payment_id, installment_id)
      );
      CREATE INDEX guaranteed_payment_allocations_installment
        ON guaranteed_payment_allocations (installment_id, payment_id);
      CREATE TABLE guaranteed_payment_reversals (
        id TEXT PRIMARY KEY NOT NULL,
        payment_id TEXT NOT NULL UNIQUE REFERENCES guaranteed_payment_payments(id),
        reversal_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
        reversal_journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
        reversal_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      UPDATE bookkeeping_schema SET version = 3 WHERE singleton = 1;
    `);
    const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
      'PRAGMA foreign_key_check',
    );
    if (violations.length > 0) throw new Error('The guaranteed payment migration found invalid record references.');
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}

async function migrateBookkeepingV3ToV4(database: Database): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    await database.execAsync(`
      ALTER TABLE guaranteed_payment_reversals RENAME TO guaranteed_payment_reversals_v3;
      CREATE TABLE guaranteed_payment_reversals (
        id TEXT PRIMARY KEY NOT NULL,
        payment_id TEXT NOT NULL UNIQUE REFERENCES guaranteed_payment_payments(id),
        reversal_transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
        reversal_journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
        return_cash_account_id TEXT NOT NULL REFERENCES accounts(id),
        reversal_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO guaranteed_payment_reversals
        (id, payment_id, reversal_transaction_id, reversal_journal_entry_id,
         return_cash_account_id, reversal_date, reason, created_at)
      SELECT reversal.id, reversal.payment_id, reversal.reversal_transaction_id,
             reversal.reversal_journal_entry_id, payment.cash_account_id,
             reversal.reversal_date, reversal.reason, reversal.created_at
      FROM guaranteed_payment_reversals_v3 reversal
      JOIN guaranteed_payment_payments payment ON payment.id = reversal.payment_id;
      DROP TABLE guaranteed_payment_reversals_v3;
      UPDATE bookkeeping_schema SET version = 4 WHERE singleton = 1;
    `);
    const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
      'PRAGMA foreign_key_check',
    );
    if (violations.length > 0) throw new Error('The guaranteed payment reversal migration found invalid record references.');
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}

async function migrateBookkeepingV4ToV5(database: Database): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await database.execAsync(`
        CREATE TABLE accounts_v5 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('bank', 'cash', 'asset', 'liability', 'equity', 'income', 'expense')),
          category TEXT NOT NULL,
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          UNIQUE (business_id, code),
          UNIQUE (business_id, name)
        );
        INSERT INTO accounts_v5
          (id, business_id, code, name, kind, category, is_system, is_active, created_at)
        SELECT id, business_id, code, name, kind, category, is_system, is_active, created_at FROM accounts;
        DROP TABLE accounts;
        ALTER TABLE accounts_v5 RENAME TO accounts;

        CREATE TABLE journal_entries_v5 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          entry_date TEXT NOT NULL,
          entry_type TEXT NOT NULL CHECK (entry_type IN (
            'opening-balance', 'income', 'expense', 'reversal',
            'cash-contribution', 'property-contribution', 'member-distribution', 'loan-advance', 'loan-repayment'
          )),
          description TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO journal_entries_v5 (id, business_id, entry_date, entry_type, description, created_at)
        SELECT id, business_id, entry_date, entry_type, description, created_at FROM journal_entries;
        DROP TABLE journal_entries;
        ALTER TABLE journal_entries_v5 RENAME TO journal_entries;
        CREATE INDEX journal_entries_business_date ON journal_entries (business_id, entry_date);

        CREATE TABLE transactions_v5 (
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
        INSERT INTO transactions_v5
          (id, business_id, journal_entry_id, entry_date, kind, account_id, category_account_id, amount_minor, description, created_at)
        SELECT id, business_id, journal_entry_id, entry_date, kind, account_id, category_account_id, amount_minor, description, created_at
        FROM transactions;
        DROP TABLE transactions;
        ALTER TABLE transactions_v5 RENAME TO transactions;
        CREATE INDEX transactions_business_date ON transactions (business_id, entry_date);

        CREATE TABLE loan_agreements (
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
        CREATE INDEX loan_agreements_business_lender ON loan_agreements (business_id, lender_type, member_id, agreement_date);
        CREATE TABLE loan_advances (
          id TEXT PRIMARY KEY NOT NULL,
          loan_id TEXT NOT NULL REFERENCES loan_agreements(id),
          transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
          journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
          advance_date TEXT NOT NULL,
          cash_account_id TEXT NOT NULL REFERENCES accounts(id),
          amount_minor TEXT NOT NULL CHECK (CAST(amount_minor AS INTEGER) > 0),
          description TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX loan_advances_loan_date ON loan_advances (loan_id, advance_date, created_at);
        CREATE TABLE loan_repayments (
          id TEXT PRIMARY KEY NOT NULL,
          loan_id TEXT NOT NULL REFERENCES loan_agreements(id),
          transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
          journal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
          repayment_date TEXT NOT NULL,
          cash_account_id TEXT NOT NULL REFERENCES accounts(id),
          principal_minor TEXT NOT NULL CHECK (CAST(principal_minor AS INTEGER) >= 0),
          interest_minor TEXT NOT NULL CHECK (CAST(interest_minor AS INTEGER) >= 0),
          description TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (loan_id, repayment_date),
          CHECK (CAST(principal_minor AS INTEGER) > 0 OR CAST(interest_minor AS INTEGER) > 0)
        );
        CREATE INDEX loan_repayments_loan_date ON loan_repayments (loan_id, repayment_date, created_at);
        UPDATE bookkeeping_schema SET version = 5 WHERE singleton = 1;
      `);
      const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
        'PRAGMA foreign_key_check',
      );
      if (violations.length > 0) throw new Error('The loan schema migration found invalid record references.');
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function migrateBookkeepingV5ToV6(database: Database): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await database.execAsync(`
        CREATE TABLE loan_agreements_v6 (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          lender_type TEXT NOT NULL CHECK (lender_type IN ('member', 'third-party')),
          member_id TEXT REFERENCES members(id),
          lender_name TEXT NOT NULL,
          agreement_date TEXT NOT NULL,
          commitment_minor TEXT NOT NULL CHECK (CAST(commitment_minor AS INTEGER) > 0),
          annual_rate_basis_points INTEGER NOT NULL CHECK (annual_rate_basis_points BETWEEN 0 AND 100000),
          day_count TEXT NOT NULL CHECK (day_count IN ('ACT/365F', 'ACT/ACT ISDA')),
          description TEXT NOT NULL,
          liability_account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
          created_at TEXT NOT NULL,
          CHECK ((lender_type = 'member' AND member_id IS NOT NULL) OR (lender_type = 'third-party' AND member_id IS NULL))
        );
        INSERT INTO loan_agreements_v6
          (id, business_id, lender_type, member_id, lender_name, agreement_date, commitment_minor,
           annual_rate_basis_points, day_count, description, liability_account_id, created_at)
        SELECT id, business_id, lender_type, member_id, lender_name, agreement_date, commitment_minor,
               annual_rate_basis_points,
               CASE day_count WHEN 'ACT/ACT' THEN 'ACT/ACT ISDA' ELSE day_count END,
               description, liability_account_id, created_at
        FROM loan_agreements;
        DROP TABLE loan_agreements;
        ALTER TABLE loan_agreements_v6 RENAME TO loan_agreements;
        CREATE INDEX loan_agreements_business_lender
          ON loan_agreements (business_id, lender_type, member_id, agreement_date);
        UPDATE bookkeeping_schema SET version = 6 WHERE singleton = 1;
      `);
      const violations = await database.getAllAsync<{ table: string; rowid: number | null; parent: string; fkid: number }>(
        'PRAGMA foreign_key_check',
      );
      if (violations.length > 0) throw new Error('The loan day-count migration found invalid record references.');
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
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

async function requireMemberAtDate(database: Database, businessId: string, memberId: string, date: string): Promise<{ id: string; name: string }> {
  const member = await database.getFirstAsync<{ id: string; name: string }>(
    `SELECT m.id, m.name FROM members m
     JOIN member_interest_history h ON h.member_id = m.id
     WHERE m.id = ? AND m.business_id = ? AND h.effective_from <= ?
       AND (h.effective_to IS NULL OR h.effective_to >= ?)
     LIMIT 1`, memberId, businessId, date, date,
  );
  if (!member) throw new Error('Choose a member whose LLC interest is active on the activity date.');
  return member;
}

async function ensureMemberCapitalAccount(database: Database, businessId: string, member: { id: string; name: string }): Promise<string> {
  const id = `member-capital:${member.id}`;
  const existing = await database.getFirstAsync<{ businessId: string; kind: string }>(
    'SELECT business_id AS businessId, kind FROM accounts WHERE id = ?', id,
  );
  if (existing) {
    if (existing.businessId !== businessId || existing.kind !== 'equity') {
      throw new Error('The member capital account has an invalid business or account type.');
    }
    await database.runAsync(
      'UPDATE accounts SET name = ? WHERE id = ?',
      `Member capital · ${member.name} · ${member.id.slice(0, 8)}`, id,
    );
    return id;
  }
  await database.runAsync(
    `INSERT INTO accounts (id, business_id, code, name, kind, category, created_at)
     VALUES (?, ?, ?, ?, 'equity', 'Member capital', ?)`,
    id, businessId, id, `Member capital · ${member.name} · ${member.id.slice(0, 8)}`, new Date().toISOString(),
  );
  return id;
}

async function ensureGuaranteedPaymentExpenseAccount(
  database: Database,
  businessId: string,
  classification: GuaranteedPaymentClassification,
): Promise<string> {
  const suffix = classification === 'services' ? 'services' : 'capital';
  const id = `guaranteed-payment-${suffix}:${businessId}`;
  const existing = await database.getFirstAsync<{ kind: string }>(
    'SELECT kind FROM accounts WHERE id = ? AND business_id = ?', id, businessId,
  );
  if (existing) {
    if (existing.kind !== 'expense') throw new Error('The guaranteed payment category has an invalid account type.');
    return id;
  }
  const code = classification === 'services' ? 'GP-SERVICES' : 'GP-CAPITAL';
  const name = classification === 'services' ? 'Guaranteed payments · services' : 'Guaranteed payments · use of capital';
  await database.runAsync(
    `INSERT INTO accounts (id, business_id, code, name, kind, category, is_system, created_at)
     VALUES (?, ?, ?, ?, 'expense', 'Guaranteed payment', 1, ?)`,
    id, businessId, code, name, new Date().toISOString(),
  );
  return id;
}

async function ensureLoanInterestExpenseAccount(database: Database, businessId: string): Promise<string> {
  const id = `loan-interest:${businessId}`;
  const existing = await database.getFirstAsync<{ kind: string }>(
    'SELECT kind FROM accounts WHERE id = ? AND business_id = ?', id, businessId,
  );
  if (existing) {
    if (existing.kind !== 'expense') throw new Error('The loan interest expense account has an invalid account type.');
    return id;
  }
  await database.runAsync(
    `INSERT INTO accounts (id, business_id, code, name, kind, category, is_system, created_at)
     VALUES (?, ?, 'LOAN-INTEREST', 'Interest expense · member and third-party loans', 'expense', 'Interest expense', 1, ?)`,
    id, businessId, new Date().toISOString(),
  );
  return id;
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
  kind: JournalEntryKind,
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
export async function createLoanAgreementInDatabase(database: Database, input: CreateLoanAgreementInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim()) throw new Error('Loan agreement identifier is required.');
  if (input.commitmentCents <= 0n) throw new Error('Loan commitment must be positive.');
  if (!Number.isInteger(input.annualRateBasisPoints) || input.annualRateBasisPoints < 0 || input.annualRateBasisPoints > 100_000) {
    throw new Error('Enter a fixed annual rate from 0.00% through 1000.00% in 0.01% increments.');
  }
  if (input.dayCount !== 'ACT/365F' && input.dayCount !== 'ACT/ACT ISDA') {
    throw new Error('Choose ACT/365F or ACT/ACT ISDA to match the loan agreement.');
  }
  if (!input.description.trim()) throw new Error('Enter a loan agreement description.');
  requireDate(input.agreementDate, 'loan agreement date');
  const business = await requireBusiness(database, input.businessId);
  if (input.agreementDate < business.bookkeepingStartDate) {
    throw new Error('Loan agreement date cannot precede the bookkeeping start date.');
  }

  let memberId: string | null = null;
  let lenderName: string;
  if (input.lenderType === 'member') {
    if (!input.memberId?.trim()) throw new Error('Choose the LLC member who made the loan.');
    const member = await requireMemberAtDate(database, input.businessId, input.memberId, input.agreementDate);
    memberId = member.id;
    lenderName = member.name;
  } else if (input.lenderType === 'third-party') {
    if (input.memberId) throw new Error('Third-party loans cannot reference an LLC member.');
    lenderName = input.lenderName?.trim() ?? '';
    if (!lenderName) throw new Error('Enter the third-party lender name.');
  } else {
    throw new Error('Choose a member or third-party lender.');
  }

  const liabilityAccountId = `loan-liability:${input.id}`;
  await inSqlTransaction(database, async () => {
    await database.runAsync(
      `INSERT INTO accounts (id, business_id, code, name, kind, category, is_system, created_at)
       VALUES (?, ?, ?, ?, 'liability', 'Loan payable', 1, ?)`,
      liabilityAccountId, input.businessId, liabilityAccountId,
      `Loan payable · ${lenderName} · ${input.id.slice(0, 8)}`, new Date().toISOString(),
    );
    await database.runAsync(
      `INSERT INTO loan_agreements
       (id, business_id, lender_type, member_id, lender_name, agreement_date, commitment_minor,
        annual_rate_basis_points, day_count, description, liability_account_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.businessId, input.lenderType, memberId, lenderName, input.agreementDate,
      input.commitmentCents.toString(), input.annualRateBasisPoints, input.dayCount,
      input.description.trim(), liabilityAccountId, new Date().toISOString(),
    );
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function recordLoanAdvanceInDatabase(database: Database, input: RecordLoanAdvanceInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim() || !input.transactionId.trim() || !input.journalEntryId.trim()) {
    throw new Error('Loan advance identifiers are required.');
  }
  if (input.amountCents <= 0n) throw new Error('Loan advance amounts must be positive.');
  if (!input.description.trim()) throw new Error('Enter a loan advance description.');
  requireDate(input.date, 'loan advance date');

  await inSqlTransaction(database, async () => {
    const agreement = await database.getFirstAsync<{
      id: string;
      businessId: string;
      agreementDate: string;
      commitmentCents: string;
      liabilityAccountId: string;
    }>(
      `SELECT id, business_id AS businessId, agreement_date AS agreementDate,
              commitment_minor AS commitmentCents, liability_account_id AS liabilityAccountId
       FROM loan_agreements WHERE id = ?`, input.loanId,
    );
    if (!agreement) throw new Error('Choose an existing loan agreement before recording an advance.');
    const business = await requireBusiness(database, agreement.businessId);
    if (input.date < business.bookkeepingStartDate) throw new Error('Loan advance date cannot precede the bookkeeping start date.');
    if (input.date < agreement.agreementDate) throw new Error('Loan advance date cannot precede the agreement date.');
    await requireCashAccount(database, agreement.businessId, input.cashAccountId);
    const liability = await database.getFirstAsync<{ kind: string; businessId: string; isActive: number }>(
      'SELECT kind, business_id AS businessId, is_active AS isActive FROM accounts WHERE id = ?', agreement.liabilityAccountId,
    );
    if (liability?.kind !== 'liability' || liability.businessId !== agreement.businessId || liability.isActive !== 1) {
      throw new Error('The loan agreement payable account is unavailable or has an invalid account type.');
    }
    const advances = await database.getAllAsync<{ amountCents: string }>(
      'SELECT amount_minor AS amountCents FROM loan_advances WHERE loan_id = ?', agreement.id,
    );
    const fundedCents = advances.reduce((sum, advance) => sum + BigInt(advance.amountCents), 0n);
    if (fundedCents + input.amountCents > BigInt(agreement.commitmentCents)) {
      throw new Error('The advance would exceed the loan commitment ceiling.');
    }

    const lines = loanAdvanceLines(input.cashAccountId, agreement.liabilityAccountId, input.amountCents);
    await insertJournalEntry(
      database, agreement.businessId, input.journalEntryId, input.date, 'loan-advance', input.description, lines,
    );
    await insertTransaction(database, {
      id: input.transactionId, journalEntryId: input.journalEntryId, businessId: agreement.businessId,
      date: input.date, kind: 'loan-advance', accountId: input.cashAccountId,
      categoryAccountId: agreement.liabilityAccountId, amountCents: input.amountCents, description: input.description,
    });
    await database.runAsync(
      `INSERT INTO loan_advances
       (id, loan_id, transaction_id, journal_entry_id, advance_date, cash_account_id, amount_minor, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, agreement.id, input.transactionId, input.journalEntryId, input.date,
      input.cashAccountId, input.amountCents.toString(), input.description.trim(), new Date().toISOString(),
    );
    await ensureCashAccountNeverNegative(database, agreement.businessId, input.cashAccountId);
  });
}

async function validateLoanRepaymentHistory(database: Database, loanId: string, terms: {
  annualRateBasisPoints: number;
  dayCount: LoanDayCount;
}): Promise<void> {
  const advances = await database.getAllAsync<{ date: string; cents: string }>(
    'SELECT advance_date AS date, amount_minor AS cents FROM loan_advances WHERE loan_id = ? ORDER BY advance_date, created_at', loanId,
  );
  const repayments = await database.getAllAsync<{
    date: string;
    principalCents: string;
    interestCents: string;
  }>(
    `SELECT repayment_date AS date, principal_minor AS principalCents, interest_minor AS interestCents
     FROM loan_repayments WHERE loan_id = ? ORDER BY repayment_date, created_at`, loanId,
  );
  const advanceEvents: DatedAmount[] = advances.map((event) => ({ date: event.date, cents: BigInt(event.cents) }));
  const principalRepayments: DatedAmount[] = repayments
    .filter((event) => BigInt(event.principalCents) > 0n)
    .map((event) => ({ date: event.date, cents: BigInt(event.principalCents) }));
  const interestRepayments: DatedAmount[] = repayments
    .filter((event) => BigInt(event.interestCents) > 0n)
    .map((event) => ({ date: event.date, cents: BigInt(event.interestCents) }));

  for (const repayment of repayments) {
    const outstandingBeforeDate = advanceEvents.filter((event) => event.date < repayment.date)
      .reduce((total, event) => total + event.cents, 0n)
      - principalRepayments.filter((event) => event.date < repayment.date)
        .reduce((total, event) => total + event.cents, 0n);
    const principalCents = BigInt(repayment.principalCents);
    if (outstandingBeforeDate < 0n || principalCents > outstandingBeforeDate) {
      throw new Error('A loan repayment exceeds outstanding principal on its recorded date.');
    }
    const accruedInterest = calculateUnpaidLoanInterestCents({
      advances: advanceEvents,
      principalRepayments,
      interestRepayments: interestRepayments.filter((event) => event.date < repayment.date),
      annualRateBasisPoints: terms.annualRateBasisPoints,
      repaymentDate: repayment.date,
      dayCount: terms.dayCount,
    });
    if (BigInt(repayment.interestCents) > accruedInterest) {
      throw new Error('A loan repayment exceeds accrued interest on its recorded date.');
    }
  }
}

/** @internal SQL-level entry point used by repository tests. */
export async function recordLoanRepaymentInDatabase(database: Database, input: RecordLoanRepaymentInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim() || !input.transactionId.trim() || !input.journalEntryId.trim()) {
    throw new Error('Loan repayment identifiers are required.');
  }
  if (input.principalCents < 0n || input.interestCents < 0n) {
    throw new Error('Loan repayment amounts cannot be negative.');
  }
  if (input.principalCents + input.interestCents <= 0n) {
    throw new Error('A loan repayment must include principal or interest.');
  }
  if (!input.description.trim()) throw new Error('Enter a loan repayment description.');
  requireDate(input.date, 'loan repayment date');

  await inSqlTransaction(database, async () => {
    const agreement = await database.getFirstAsync<{
      id: string;
      businessId: string;
      agreementDate: string;
      liabilityAccountId: string;
      annualRateBasisPoints: number;
      dayCount: LoanDayCount;
    }>(
      `SELECT id, business_id AS businessId, agreement_date AS agreementDate,
              liability_account_id AS liabilityAccountId,
              annual_rate_basis_points AS annualRateBasisPoints, day_count AS dayCount
       FROM loan_agreements WHERE id = ?`, input.loanId,
    );
    if (!agreement) throw new Error('Choose an existing loan agreement before recording a repayment.');
    const business = await requireBusiness(database, agreement.businessId);
    if (input.date < business.bookkeepingStartDate) throw new Error('Loan repayment date cannot precede the bookkeeping start date.');
    if (input.date < agreement.agreementDate) throw new Error('Loan repayment date cannot precede the agreement date.');
    await requireCashAccount(database, agreement.businessId, input.cashAccountId);
    const liability = await database.getFirstAsync<{ kind: string; businessId: string; isActive: number }>(
      'SELECT kind, business_id AS businessId, is_active AS isActive FROM accounts WHERE id = ?', agreement.liabilityAccountId,
    );
    if (liability?.kind !== 'liability' || liability.businessId !== agreement.businessId || liability.isActive !== 1) {
      throw new Error('The loan agreement payable account is unavailable or has an invalid account type.');
    }
    const repaymentOnDate = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM loan_repayments WHERE loan_id = ? AND repayment_date = ?', agreement.id, input.date,
    );
    if (repaymentOnDate) throw new Error('Record no more than one loan repayment per loan on a calendar date.');

    const interestExpenseAccountId = await ensureLoanInterestExpenseAccount(database, agreement.businessId);
    const lines = loanRepaymentLines(
      input.cashAccountId, agreement.liabilityAccountId, interestExpenseAccountId,
      input.principalCents, input.interestCents,
    );
    const totalCents = input.principalCents + input.interestCents;
    await insertJournalEntry(
      database, agreement.businessId, input.journalEntryId, input.date, 'loan-repayment', input.description, lines,
    );
    await insertTransaction(database, {
      id: input.transactionId, journalEntryId: input.journalEntryId, businessId: agreement.businessId,
      date: input.date, kind: 'loan-repayment', accountId: input.cashAccountId,
      categoryAccountId: agreement.liabilityAccountId, amountCents: -totalCents, description: input.description,
    });
    await database.runAsync(
      `INSERT INTO loan_repayments
       (id, loan_id, transaction_id, journal_entry_id, repayment_date, cash_account_id,
        principal_minor, interest_minor, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, agreement.id, input.transactionId, input.journalEntryId, input.date, input.cashAccountId,
      input.principalCents.toString(), input.interestCents.toString(), input.description.trim(), new Date().toISOString(),
    );
    await validateLoanRepaymentHistory(database, agreement.id, agreement);
    await ensureCashAccountNeverNegative(database, agreement.businessId, input.cashAccountId);
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
export async function recordTransferInDatabase(database: Database, input: TransferInput): Promise<void> {
  await ensureBookkeepingSchema(database);
  const business = await requireBusiness(database, input.businessId);
  if (input.date < business.bookkeepingStartDate) throw new Error('Transfer date cannot precede the bookkeeping start date.');
  requireDate(input.date, 'transfer date');
  if (!input.description.trim()) throw new Error('Enter a transfer description.');
  if (input.amountCents <= 0n) throw new Error('Transfer amounts must be positive.');
  if (input.sourceAccountId === input.destinationAccountId) throw new Error('Transfer accounts must be different.');
  await requireCashAccount(database, input.businessId, input.sourceAccountId);
  await requireCashAccount(database, input.businessId, input.destinationAccountId);
  const lines = accountTransferLines(input.sourceAccountId, input.destinationAccountId, input.amountCents);
  await inSqlTransaction(database, async () => {
    await insertJournalEntry(database, input.businessId, input.journalEntryId, input.date, 'transfer', input.description, lines);
    await insertTransaction(database, {
      id: input.transactionId, journalEntryId: input.journalEntryId, businessId: input.businessId,
      date: input.date, kind: 'transfer', accountId: input.sourceAccountId,
      categoryAccountId: input.destinationAccountId, amountCents: -input.amountCents, description: input.description,
    });
    await ensureCashAccountNeverNegative(database, input.businessId, input.sourceAccountId);
    await ensureCashAccountNeverNegative(database, input.businessId, input.destinationAccountId);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function createAccountReconciliationInDatabase(
  database: Database,
  input: CreateAccountReconciliationInput,
): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim()) throw new Error('Reconciliation identifier is required.');
  requireDate(input.periodStartDate, 'statement period start date');
  requireDate(input.statementDate, 'statement date');
  if (input.periodStartDate >= input.statementDate) throw new Error('The statement date must follow the period start date.');
  const business = await requireBusiness(database, input.businessId);
  if (input.periodStartDate < business.bookkeepingStartDate) throw new Error('The statement period cannot precede the bookkeeping start date.');
  const account = await database.getFirstAsync<{ kind: string; isActive: number }>(
    'SELECT kind, is_active AS isActive FROM accounts WHERE id = ? AND business_id = ?', input.accountId, input.businessId,
  );
  if (!account || account.kind !== 'bank' || account.isActive !== 1) {
    throw new Error('Choose an active bank account to reconcile.');
  }
  const prior = await database.getFirstAsync<{ statementDate: string; endingMinor: string }>(
    `SELECT statement_date AS statementDate, ending_minor AS endingMinor
     FROM account_reconciliations
     WHERE business_id = ? AND account_id = ? AND status = 'completed'
     ORDER BY statement_date DESC LIMIT 1`, input.businessId, input.accountId,
  );
  if (prior && input.periodStartDate !== prior.statementDate) {
    throw new Error('The next statement period must start on the prior statement date.');
  }
  if (prior && input.beginningBalanceCents !== BigInt(prior.endingMinor)) {
    throw new Error('The next statement beginning balance must match the prior ending balance.');
  }
  const createdAt = new Date().toISOString();
  await inSqlTransaction(database, async () => {
    await database.runAsync(
      `INSERT INTO account_reconciliations
       (id, business_id, account_id, period_start_date, statement_date, beginning_minor, ending_minor, status, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL)`,
      input.id, input.businessId, input.accountId, input.periodStartDate, input.statementDate,
      input.beginningBalanceCents.toString(), input.endingBalanceCents.toString(), createdAt,
    );
    await addAccountReconciliationEvent(database, input.id, 'created', null, createdAt);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function setAccountReconciliationItemClearedInDatabase(
  database: Database,
  reconciliationId: string,
  transactionId: string,
  cleared: boolean,
): Promise<void> {
  await ensureBookkeepingSchema(database);
  await inSqlTransaction(database, async () => {
    const reconciliation = await database.getFirstAsync<{
      businessId: string; accountId: string; statementDate: string; periodStartDate: string; status: 'draft' | 'completed';
    }>(
      `SELECT business_id AS businessId, account_id AS accountId, statement_date AS statementDate,
              period_start_date AS periodStartDate, status
       FROM account_reconciliations WHERE id = ?`, reconciliationId,
    );
    if (!reconciliation) throw new Error('Choose an existing reconciliation.');
    if (reconciliation.status !== 'draft') throw new Error('Reopen the reconciliation before changing cleared items.');
    const activities = await readAccountReconciliationActivities(database, reconciliationId, reconciliation);
    if (!activities.some((activity) => activity.transactionId === transactionId)) {
      throw new Error('Choose a posted transaction for this bank account that is available to reconcile.');
    }
    const existing = await database.getFirstAsync<{ transactionId: string }>(
      'SELECT transaction_id AS transactionId FROM account_reconciliation_items WHERE reconciliation_id = ? AND transaction_id = ?',
      reconciliationId, transactionId,
    );
    if (cleared && !existing) {
      const now = new Date().toISOString();
      await database.runAsync(
        'INSERT INTO account_reconciliation_items (reconciliation_id, transaction_id, created_at) VALUES (?, ?, ?)',
        reconciliationId, transactionId, now,
      );
      await addAccountReconciliationEvent(database, reconciliationId, 'item-cleared', transactionId, now);
    } else if (!cleared && existing) {
      const now = new Date().toISOString();
      await database.runAsync(
        'DELETE FROM account_reconciliation_items WHERE reconciliation_id = ? AND transaction_id = ?',
        reconciliationId, transactionId,
      );
      await addAccountReconciliationEvent(database, reconciliationId, 'item-uncleared', transactionId, now);
    }
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function completeAccountReconciliationInDatabase(database: Database, reconciliationId: string): Promise<void> {
  await ensureBookkeepingSchema(database);
  await inSqlTransaction(database, async () => {
    const header = await readAccountReconciliationHeader(database, reconciliationId);
    if (!header) throw new Error('Choose an existing reconciliation.');
    if (header.status !== 'draft') throw new Error('This reconciliation is already completed.');
    const activities = await readAccountReconciliationActivities(database, reconciliationId, header);
    const cleared = activities.reduce((sum, activity) => activity.cleared ? sum + activity.amountCents : sum, 0n);
    const difference = header.beginningBalanceCents + cleared - header.endingBalanceCents;
    if (difference !== 0n) throw new Error('The reconciliation difference must be zero before completion.');
    const now = new Date().toISOString();
    await database.runAsync(
      `UPDATE account_reconciliations SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'draft'`,
      now, reconciliationId,
    );
    await addAccountReconciliationEvent(database, reconciliationId, 'completed', null, now);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function reopenAccountReconciliationInDatabase(database: Database, reconciliationId: string): Promise<void> {
  await ensureBookkeepingSchema(database);
  await inSqlTransaction(database, async () => {
    const header = await readAccountReconciliationHeader(database, reconciliationId);
    if (!header || header.status !== 'completed') throw new Error('Choose a completed reconciliation to reopen.');
    const latest = await database.getFirstAsync<{ id: string }>(
      `SELECT id FROM account_reconciliations WHERE business_id = ? AND account_id = ? AND status = 'completed'
       ORDER BY statement_date DESC LIMIT 1`, header.businessId, header.accountId,
    );
    if (latest?.id !== reconciliationId) throw new Error('Only the latest completed statement can be reopened.');
    const draft = await database.getFirstAsync<{ id: string }>(
      `SELECT id FROM account_reconciliations WHERE account_id = ? AND status = 'draft'`, header.accountId,
    );
    if (draft) throw new Error('Complete or remove the active reconciliation before reopening another statement.');
    const now = new Date().toISOString();
    await database.runAsync(
      `UPDATE account_reconciliations SET status = 'draft' WHERE id = ? AND status = 'completed'`, reconciliationId,
    );
    await addAccountReconciliationEvent(database, reconciliationId, 'reopened', null, now);
  });
}

async function addAccountReconciliationEvent(
  database: Database,
  reconciliationId: string,
  eventType: AccountReconciliationEvent['eventType'],
  transactionId: string | null,
  createdAt: string,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO account_reconciliation_events (id, reconciliation_id, event_type, transaction_id, created_at)
     VALUES ('reconciliation-event:' || lower(hex(randomblob(16))), ?, ?, ?, ?)`,
    reconciliationId, eventType, transactionId, createdAt,
  );
}

interface AccountReconciliationHeader extends CreateAccountReconciliationInput {
  status: 'draft' | 'completed';
}

async function readAccountReconciliationHeader(database: Database, reconciliationId: string): Promise<AccountReconciliationHeader | null> {
  const row = await database.getFirstAsync<{
    id: string; businessId: string; accountId: string; periodStartDate: string; statementDate: string;
    beginningMinor: string; endingMinor: string; status: 'draft' | 'completed';
  }>(
    `SELECT id, business_id AS businessId, account_id AS accountId,
            period_start_date AS periodStartDate, statement_date AS statementDate,
            beginning_minor AS beginningMinor, ending_minor AS endingMinor, status
     FROM account_reconciliations WHERE id = ?`, reconciliationId,
  );
  if (!row) return null;
  return {
    id: row.id, businessId: row.businessId, accountId: row.accountId,
    periodStartDate: row.periodStartDate, statementDate: row.statementDate,
    beginningBalanceCents: BigInt(row.beginningMinor), endingBalanceCents: BigInt(row.endingMinor), status: row.status,
  };
}

async function readAccountReconciliationActivities(
  database: Database,
  reconciliationId: string,
  header: Pick<AccountReconciliationHeader, 'businessId' | 'accountId' | 'periodStartDate' | 'statementDate'>,
): Promise<AccountReconciliationActivity[]> {
  const rows = await database.getAllAsync<{
    transactionId: string; date: string; description: string; debitMinor: string; creditMinor: string; cleared: number;
  }>(
    `SELECT t.id AS transactionId, t.entry_date AS date, t.description,
            jl.debit_minor AS debitMinor, jl.credit_minor AS creditMinor,
            CASE WHEN currentItem.transaction_id IS NULL THEN 0 ELSE 1 END AS cleared
     FROM transactions t
     JOIN journal_entries je ON je.id = t.journal_entry_id
     JOIN journal_lines jl ON jl.journal_entry_id = je.id AND jl.account_id = ?
     LEFT JOIN account_reconciliation_items currentItem
       ON currentItem.transaction_id = t.id AND currentItem.reconciliation_id = ?
     WHERE t.business_id = ? AND t.entry_date <= ?
       AND NOT (t.kind = 'opening-balance' AND t.entry_date <= ?)
       AND NOT EXISTS (
         SELECT 1 FROM account_reconciliation_items priorItem
         JOIN account_reconciliations prior ON prior.id = priorItem.reconciliation_id
         WHERE priorItem.transaction_id = t.id AND prior.account_id = ?
           AND prior.status = 'completed' AND prior.id <> ?
       )
     ORDER BY t.entry_date, t.created_at, t.id`,
    header.accountId, reconciliationId, header.businessId, header.statementDate,
    header.periodStartDate, header.accountId, reconciliationId,
  );
  const activities = new Map<string, AccountReconciliationActivity>();
  for (const row of rows) {
    const current = activities.get(row.transactionId);
    activities.set(row.transactionId, {
      transactionId: row.transactionId, date: row.date, description: row.description,
      amountCents: (current?.amountCents ?? 0n) + BigInt(row.debitMinor) - BigInt(row.creditMinor),
      cleared: row.cleared === 1,
    });
  }
  return [...activities.values()];
}

async function assertTransactionNotInCompletedReconciliation(database: Database, transactionId: string): Promise<void> {
  const reconciliation = await database.getFirstAsync<{ id: string }>(
    `SELECT reconciliation.id
     FROM account_reconciliation_items item
     JOIN account_reconciliations reconciliation ON reconciliation.id = item.reconciliation_id
     WHERE item.transaction_id = ? AND reconciliation.status = 'completed' LIMIT 1`, transactionId,
  );
  if (reconciliation) throw new Error('Reopen its reconciliation before correcting a reconciled transaction.');
}

/** @internal SQL-level entry point used by repository tests. */
export async function recordMemberCapitalActivityInDatabase(
  database: Database,
  input: MemberCapitalActivityInput,
): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim()) throw new Error('Capital activity identifier is required.');
  if (input.amountCents <= 0n) throw new Error('Capital activity amounts must be positive.');
  if (!input.description.trim()) throw new Error('Enter a capital activity description.');
  requireDate(input.date, 'capital activity date');
  const business = await requireBusiness(database, input.businessId);
  if (input.date < business.bookkeepingStartDate) throw new Error('Capital activity date cannot precede the bookkeeping start date.');
  if (input.kind === 'property-contribution' && !input.propertyDescription?.trim()) {
    throw new Error('Describe the property contribution for CPA review.');
  }
  if (input.kind !== 'property-contribution' && !input.cashAccountId) {
    throw new Error('Choose a bank or cash account for this capital activity.');
  }

  await inSqlTransaction(database, async () => {
    const member = await requireMemberAtDate(database, input.businessId, input.memberId, input.date);
    const capitalAccountId = await ensureMemberCapitalAccount(database, input.businessId, member);
    let cashAccountId: string | null = null;
    let propertyAssetAccountId: string | null = null;
    let propertyDescription: string | null = null;
    let lines: JournalLine[];

    if (input.kind === 'property-contribution') {
      propertyDescription = input.propertyDescription!.trim();
      propertyAssetAccountId = `member-property:${input.id}`;
      await database.runAsync(
        `INSERT INTO accounts (id, business_id, code, name, kind, category, created_at)
         VALUES (?, ?, ?, ?, 'asset', 'Contributed property', ?)`,
        propertyAssetAccountId, input.businessId, propertyAssetAccountId,
        `Contributed property · ${propertyDescription} · ${input.id.slice(0, 8)}`, new Date().toISOString(),
      );
      lines = propertyCapitalContributionLines(propertyAssetAccountId, capitalAccountId, input.amountCents);
    } else {
      cashAccountId = input.cashAccountId!;
      await requireCashAccount(database, input.businessId, cashAccountId);
      lines = input.kind === 'cash-contribution'
        ? cashCapitalContributionLines(cashAccountId, capitalAccountId, input.amountCents)
        : memberDistributionLines(capitalAccountId, cashAccountId, input.amountCents);
    }

    const entryType = input.kind === 'distribution' ? 'member-distribution' : input.kind;
    await insertJournalEntry(database, input.businessId, input.journalEntryId, input.date, entryType, input.description, lines);
    await database.runAsync(
      `INSERT INTO member_capital_activity
       (id, business_id, member_id, journal_entry_id, activity_date, activity_kind, amount_minor,
        cash_account_id, property_asset_account_id, property_description, description,
        requires_cpa_review, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.businessId, member.id, input.journalEntryId, input.date, input.kind,
      input.amountCents.toString(), cashAccountId, propertyAssetAccountId, propertyDescription,
      input.description.trim(), input.kind === 'property-contribution' ? 1 : 0, new Date().toISOString(),
    );
    if (cashAccountId) await ensureCashAccountNeverNegative(database, input.businessId, cashAccountId);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function createGuaranteedPaymentObligationInDatabase(
  database: Database,
  input: CreateGuaranteedPaymentObligationInput,
): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim()) throw new Error('Guaranteed payment obligation identifier is required.');
  if (input.installmentAmountCents <= 0n) throw new Error('Guaranteed payment installments must be positive.');
  if (!input.description.trim()) throw new Error('Enter a guaranteed payment obligation description.');
  const dueDates = guaranteedPaymentDueDates(input.firstDueDate, input.recurrence, input.installmentCount);
  const business = await requireBusiness(database, input.businessId);
  if (input.firstDueDate < business.bookkeepingStartDate) {
    throw new Error('The first guaranteed payment due date cannot precede the bookkeeping start date.');
  }

  await inSqlTransaction(database, async () => {
    await requireMemberAtDate(database, input.businessId, input.memberId, input.firstDueDate);
    const createdAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO guaranteed_payment_obligations
       (id, business_id, member_id, classification, recurrence, first_due_date, installment_count,
        installment_amount_minor, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.businessId, input.memberId, input.classification, input.recurrence,
      input.firstDueDate, input.installmentCount, input.installmentAmountCents.toString(),
      input.description.trim(), createdAt,
    );
    for (const [index, dueDate] of dueDates.entries()) {
      await database.runAsync(
        `INSERT INTO guaranteed_payment_installments
         (id, obligation_id, due_date, amount_minor, installment_number, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        `${input.id}:installment:${index + 1}`, input.id, dueDate,
        input.installmentAmountCents.toString(), index + 1, createdAt,
      );
    }
  });
}

async function outstandingInstallmentAmount(database: Database, installmentId: string, scheduledCents: bigint): Promise<bigint> {
  const allocations = await database.getAllAsync<{ amountMinor: string }>(
    `SELECT allocation.amount_minor AS amountMinor
     FROM guaranteed_payment_allocations allocation
     JOIN guaranteed_payment_payments payment ON payment.id = allocation.payment_id
     LEFT JOIN guaranteed_payment_reversals reversal ON reversal.payment_id = payment.id
     WHERE allocation.installment_id = ? AND reversal.id IS NULL`, installmentId,
  );
  const paidCents = allocations.reduce((sum, allocation) => sum + BigInt(allocation.amountMinor), 0n);
  return scheduledCents - paidCents;
}

/** @internal SQL-level entry point used by repository tests. */
export async function recordGuaranteedPaymentInDatabase(
  database: Database,
  input: RecordGuaranteedPaymentInput,
): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim() || !input.transactionId.trim() || !input.journalEntryId.trim()) {
    throw new Error('Guaranteed payment identifiers are required.');
  }
  if (!input.description.trim()) throw new Error('Enter a guaranteed payment description.');
  requireDate(input.date, 'guaranteed payment date');
  if (input.allocations.length === 0) throw new Error('Allocate the payment to at least one installment.');
  const allocationIds = new Set<string>();
  let amountCents = 0n;
  for (const allocation of input.allocations) {
    if (!allocation.installmentId.trim()) throw new Error('Choose an installment for every payment allocation.');
    if (allocationIds.has(allocation.installmentId)) throw new Error('Allocate each installment only once per payment.');
    allocationIds.add(allocation.installmentId);
    if (allocation.amountCents <= 0n) throw new Error('Payment allocation amounts must be positive.');
    amountCents += allocation.amountCents;
  }
  const business = await requireBusiness(database, input.businessId);
  if (input.date < business.bookkeepingStartDate) throw new Error('Payment date cannot precede the bookkeeping start date.');
  await requireCashAccount(database, input.businessId, input.cashAccountId);

  await inSqlTransaction(database, async () => {
    let classification: GuaranteedPaymentClassification | null = null;
    for (const allocation of input.allocations) {
      const installment = await database.getFirstAsync<{
        installmentId: string;
        obligationId: string;
        businessId: string;
        memberId: string;
        classification: GuaranteedPaymentClassification;
        dueDate: string;
        amountMinor: string;
      }>(
        `SELECT installment.id AS installmentId, obligation.id AS obligationId,
                obligation.business_id AS businessId, obligation.member_id AS memberId,
                obligation.classification, installment.due_date AS dueDate,
                installment.amount_minor AS amountMinor
         FROM guaranteed_payment_installments installment
         JOIN guaranteed_payment_obligations obligation ON obligation.id = installment.obligation_id
         WHERE installment.id = ?`, allocation.installmentId,
      );
      if (!installment || installment.businessId !== input.businessId || installment.memberId !== input.memberId) {
        throw new Error('Choose an outstanding installment for this LLC member.');
      }
      if (classification !== null && classification !== installment.classification) {
        throw new Error('A payment can allocate to installments with only one guaranteed payment classification.');
      }
      classification = installment.classification;
      const outstanding = await outstandingInstallmentAmount(database, installment.installmentId, BigInt(installment.amountMinor));
      if (outstanding <= 0n) throw new Error('This installment is already fully paid.');
      if (allocation.amountCents > outstanding) throw new Error('A payment allocation cannot exceed the installment balance.');
    }
    const categoryAccountId = await ensureGuaranteedPaymentExpenseAccount(database, input.businessId, classification!);
    const lines = cashExpenseLines(input.cashAccountId, categoryAccountId, amountCents);
    await insertJournalEntry(
      database, input.businessId, input.journalEntryId, input.date, 'expense', input.description, lines,
    );
    await insertTransaction(database, {
      id: input.transactionId, journalEntryId: input.journalEntryId, businessId: input.businessId,
      date: input.date, kind: 'expense', accountId: input.cashAccountId, categoryAccountId,
      amountCents: -amountCents, description: input.description,
    });
    const createdAt = new Date().toISOString();
    await database.runAsync(
      `INSERT INTO guaranteed_payment_payments
       (id, business_id, member_id, classification, transaction_id, payment_date, cash_account_id,
        amount_minor, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.businessId, input.memberId, classification, input.transactionId,
      input.date, input.cashAccountId, amountCents.toString(), input.description.trim(), createdAt,
    );
    for (const allocation of input.allocations) {
      await database.runAsync(
        `INSERT INTO guaranteed_payment_allocations (payment_id, installment_id, amount_minor, created_at)
         VALUES (?, ?, ?, ?)`,
        input.id, allocation.installmentId, allocation.amountCents.toString(), createdAt,
      );
    }
    await ensureCashAccountNeverNegative(database, input.businessId, input.cashAccountId);
  });
}

/** @internal SQL-level entry point used by repository tests. */
export async function reverseGuaranteedPaymentInDatabase(
  database: Database,
  input: ReverseGuaranteedPaymentInput,
): Promise<void> {
  await ensureBookkeepingSchema(database);
  if (!input.id.trim() || !input.reversalTransactionId.trim() || !input.reversalJournalEntryId.trim()) {
    throw new Error('Guaranteed payment reversal identifiers are required.');
  }
  if (!input.returnCashAccountId.trim()) throw new Error('Choose the bank or cash account that received the returned funds.');
  if (!input.reason.trim()) throw new Error('Enter a reason for the payment reversal.');
  requireDate(input.date, 'guaranteed payment reversal date');

  await inSqlTransaction(database, async () => {
    const payment = await database.getFirstAsync<{
      id: string;
      businessId: string;
      transactionId: string;
      date: string;
      accountId: string;
      categoryAccountId: string;
      amountMinor: string;
      description: string;
    }>(
      `SELECT payment.id, payment.business_id AS businessId, payment.transaction_id AS transactionId,
              payment.payment_date AS date, t.account_id AS accountId,
              t.category_account_id AS categoryAccountId,
              payment.amount_minor AS amountMinor, payment.description
       FROM guaranteed_payment_payments payment
       JOIN transactions t ON t.id = payment.transaction_id
       WHERE payment.id = ?`, input.paymentId,
    );
    if (!payment) throw new Error('Choose a guaranteed payment to reverse.');
    await assertTransactionNotInCompletedReconciliation(database, payment.transactionId);
    if (input.date < payment.date) throw new Error('A payment reversal date cannot precede the payment date.');
    const business = await requireBusiness(database, payment.businessId);
    if (input.date < business.bookkeepingStartDate) throw new Error('Reversal date cannot precede the bookkeeping start date.');
    await requireCashAccount(database, payment.businessId, input.returnCashAccountId);
    const existing = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM guaranteed_payment_reversals WHERE payment_id = ?', payment.id,
    );
    if (existing) throw new Error('This guaranteed payment has already been reversed.');
    const originalLines = await database.getAllAsync<{ accountId: string; debitMinor: string; creditMinor: string }>(
      `SELECT account_id AS accountId, debit_minor AS debitMinor, credit_minor AS creditMinor
       FROM journal_lines WHERE journal_entry_id = (SELECT journal_entry_id FROM transactions WHERE id = ?)`, payment.transactionId,
    );
    const reversalDescription = `Reversal of: ${payment.description}`;
    const reversalLines = reverseLines(originalLines.map((line) => ({
      account: line.accountId === payment.accountId ? input.returnCashAccountId : line.accountId,
      debitCents: BigInt(line.debitMinor),
      creditCents: BigInt(line.creditMinor),
    })));
    await insertJournalEntry(
      database, payment.businessId, input.reversalJournalEntryId, input.date, 'reversal', reversalDescription, reversalLines,
    );
    await insertTransaction(database, {
      id: input.reversalTransactionId,
      journalEntryId: input.reversalJournalEntryId,
      businessId: payment.businessId,
      date: input.date,
      kind: 'reversal',
      accountId: input.returnCashAccountId,
      categoryAccountId: payment.categoryAccountId,
      amountCents: BigInt(payment.amountMinor),
      description: reversalDescription,
    });
    await database.runAsync(
      `INSERT INTO guaranteed_payment_reversals
       (id, payment_id, reversal_transaction_id, reversal_journal_entry_id, return_cash_account_id,
        reversal_date, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.paymentId, input.reversalTransactionId, input.reversalJournalEntryId,
      input.returnCashAccountId, input.date, input.reason.trim(), new Date().toISOString(),
    );
    await ensureCashAccountNeverNegative(database, payment.businessId, input.returnCashAccountId);
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
  if (replacement.kind === 'transfer') {
    if (replacement.accountId === replacement.categoryAccountId) throw new Error('Transfer accounts must be different.');
    await requireCashAccount(database, replacement.businessId, replacement.accountId);
    await requireCashAccount(database, replacement.businessId, replacement.categoryAccountId);
  } else {
    await requireCashAccount(database, replacement.businessId, replacement.accountId);
    await requireCategoryAccount(database, replacement.businessId, replacement.categoryAccountId, replacement.kind);
  }

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
    const guaranteedPayment = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM guaranteed_payment_payments WHERE transaction_id = ?', input.originalTransactionId,
    );
    if (guaranteedPayment) throw new Error('Use the guaranteed payment reversal workflow to correct this payment.');
    if (!original || (original.kind !== 'income' && original.kind !== 'expense' && original.kind !== 'transfer')) {
      throw new Error('Choose an original income or expense transaction, or a transfer, to correct.');
    }
    await assertTransactionNotInCompletedReconciliation(database, original.id);
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

    const replacementLines = replacement.kind === 'transfer'
      ? accountTransferLines(replacement.accountId, replacement.categoryAccountId, replacement.amountCents)
      : replacement.kind === 'income'
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
    for (const accountId of new Set([
      original.accountId, original.categoryAccountId, replacement.accountId, replacement.categoryAccountId,
    ])) {
      await ensureCashAccountNeverNegative(database, original.businessId, accountId);
    }
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
    balanceCents: account.kind === 'liability'
      ? -(balances.get(account.id) ?? 0n)
      : balances.get(account.id) ?? 0n,
  }));
}

async function readTransactions(database: Database, businessId: string): Promise<TransactionRecord[]> {
  const rows = await database.getAllAsync<DbTransaction>(
    `SELECT t.id, t.journal_entry_id AS journalEntryId, t.entry_date AS date, t.kind,
            t.account_id AS accountId, a.name AS accountName,
            t.category_account_id AS categoryAccountId,
            CASE t.kind WHEN 'loan-advance' THEN 'Loan proceeds' WHEN 'loan-repayment' THEN 'Loan repayment' ELSE c.name END AS category,
            t.amount_minor AS amountCents, t.description,
            COALESCE(original.original_transaction_id, correction.original_transaction_id,
                     guaranteedPaymentOriginal.transaction_id,
                     CASE WHEN paymentReversal.id IS NOT NULL THEN guaranteedPayment.transaction_id END) AS originalTransactionId,
            CASE WHEN guaranteedPaymentReversal.id IS NOT NULL THEN 'reversal' ELSE role.role END AS correctionRole,
            CASE WHEN guaranteedPayment.id IS NOT NULL OR guaranteedPaymentOriginal.id IS NOT NULL THEN 1 ELSE 0 END AS isGuaranteedPayment,
            CASE WHEN t.kind = 'transfer' THEN 'transfer'
                 WHEN t.kind = 'reversal' AND correctionOriginal.kind = 'transfer' THEN 'transfer-reversal'
                 ELSE NULL END AS transferRole
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN accounts c ON c.id = t.category_account_id
     LEFT JOIN transaction_correction_roles role ON role.transaction_id = t.id
     LEFT JOIN transaction_corrections original ON original.original_transaction_id = t.id
     LEFT JOIN transaction_corrections correction ON correction.id = role.correction_id
     LEFT JOIN transactions correctionOriginal ON correctionOriginal.id = correction.original_transaction_id
     LEFT JOIN guaranteed_payment_payments guaranteedPayment ON guaranteedPayment.transaction_id = t.id
     LEFT JOIN guaranteed_payment_reversals paymentReversal ON paymentReversal.payment_id = guaranteedPayment.id
     LEFT JOIN guaranteed_payment_reversals guaranteedPaymentReversal ON guaranteedPaymentReversal.reversal_transaction_id = t.id
     LEFT JOIN guaranteed_payment_payments guaranteedPaymentOriginal ON guaranteedPaymentOriginal.id = guaranteedPaymentReversal.payment_id
     WHERE t.business_id = ? ORDER BY t.entry_date DESC, t.created_at DESC, t.id`, businessId,
  );
  return rows.map((row) => ({
    ...row,
    amountCents: BigInt(row.amountCents),
    isGuaranteedPayment: row.isGuaranteedPayment === 1,
  }));
}

async function readCapitalActivities(database: Database, businessId: string): Promise<MemberCapitalActivityRecord[]> {
  const rows = await database.getAllAsync<{
    id: string;
    journalEntryId: string;
    memberId: string;
    memberName: string;
    date: string;
    kind: MemberCapitalActivityKind;
    amountCents: string;
    description: string;
    cashAccountName: string | null;
    propertyDescription: string | null;
    requiresCpaReview: number;
  }>(
    `SELECT activity.id, activity.journal_entry_id AS journalEntryId,
            activity.member_id AS memberId, member.name AS memberName,
            activity.activity_date AS date, activity.activity_kind AS kind,
            activity.amount_minor AS amountCents, activity.description,
            cash.name AS cashAccountName, activity.property_description AS propertyDescription,
            activity.requires_cpa_review AS requiresCpaReview
     FROM member_capital_activity activity
     JOIN members member ON member.id = activity.member_id
     LEFT JOIN accounts cash ON cash.id = activity.cash_account_id
     WHERE activity.business_id = ?
     ORDER BY activity.activity_date, activity.created_at, activity.id`, businessId,
  );
  return rows.map((row) => ({
    ...row,
    amountCents: BigInt(row.amountCents),
    requiresCpaReview: row.requiresCpaReview === 1,
  }));
}

async function readMemberCapitalSummaries(database: Database, businessId: string): Promise<MemberCapitalSummary[]> {
  const rows = await database.getAllAsync<{
    memberId: string;
    memberName: string;
    kind: MemberCapitalActivityKind | null;
    amountCents: string | null;
  }>(
    `SELECT member.id AS memberId, member.name AS memberName,
            activity.activity_kind AS kind, activity.amount_minor AS amountCents
     FROM members member
     LEFT JOIN member_capital_activity activity
       ON activity.member_id = member.id AND activity.business_id = member.business_id
     WHERE member.business_id = ?
     ORDER BY member.rowid, activity.activity_date, activity.created_at, activity.id`, businessId,
  );
  const summaries = new Map<string, MemberCapitalSummary>();
  for (const row of rows) {
    let summary = summaries.get(row.memberId);
    if (!summary) {
      summary = {
        memberId: row.memberId,
        memberName: row.memberName,
        cashContributionsCents: 0n,
        propertyContributionsCents: 0n,
        distributionsCents: 0n,
        bookCapitalActivityCents: 0n,
      };
      summaries.set(row.memberId, summary);
    }
    if (!row.kind || row.amountCents === null) continue;
    const amount = BigInt(row.amountCents);
    if (row.kind === 'cash-contribution') summary.cashContributionsCents += amount;
    if (row.kind === 'property-contribution') summary.propertyContributionsCents += amount;
    if (row.kind === 'distribution') summary.distributionsCents += amount;
    summary.bookCapitalActivityCents += row.kind === 'distribution' ? -amount : amount;
  }
  return [...summaries.values()];
}

async function readGuaranteedPaymentInstallments(database: Database, businessId: string): Promise<GuaranteedPaymentInstallmentRecord[]> {
  const rows = await database.getAllAsync<{
    id: string;
    obligationId: string;
    memberId: string;
    memberName: string;
    classification: GuaranteedPaymentClassification;
    description: string;
    dueDate: string;
    scheduledAmountCents: string;
    allocationAmountCents: string | null;
    reversedPaymentId: string | null;
  }>(
    `SELECT installment.id, obligation.id AS obligationId, obligation.member_id AS memberId,
            member.name AS memberName, obligation.classification, obligation.description,
            installment.due_date AS dueDate, installment.amount_minor AS scheduledAmountCents,
            allocation.amount_minor AS allocationAmountCents, reversal.payment_id AS reversedPaymentId
     FROM guaranteed_payment_installments installment
     JOIN guaranteed_payment_obligations obligation ON obligation.id = installment.obligation_id
     JOIN members member ON member.id = obligation.member_id
     LEFT JOIN guaranteed_payment_allocations allocation ON allocation.installment_id = installment.id
     LEFT JOIN guaranteed_payment_reversals reversal ON reversal.payment_id = allocation.payment_id
     WHERE obligation.business_id = ?
     ORDER BY installment.due_date, obligation.id, installment.installment_number, allocation.created_at`, businessId,
  );
  const installments = new Map<string, GuaranteedPaymentInstallmentRecord>();
  for (const row of rows) {
    let installment = installments.get(row.id);
    if (!installment) {
      installment = {
        id: row.id,
        obligationId: row.obligationId,
        memberId: row.memberId,
        memberName: row.memberName,
        classification: row.classification,
        description: row.description,
        dueDate: row.dueDate,
        scheduledAmountCents: BigInt(row.scheduledAmountCents),
        paidAmountCents: 0n,
        outstandingAmountCents: BigInt(row.scheduledAmountCents),
      };
      installments.set(row.id, installment);
    }
    if (row.allocationAmountCents !== null && row.reversedPaymentId === null) {
      installment.paidAmountCents += BigInt(row.allocationAmountCents);
      installment.outstandingAmountCents -= BigInt(row.allocationAmountCents);
    }
  }
  return [...installments.values()];
}

async function readGuaranteedPaymentCashEvents(database: Database, businessId: string): Promise<GuaranteedPaymentCashEvent[]> {
  const payments = await database.getAllAsync<{
    id: string;
    transactionId: string;
    memberId: string;
    memberName: string;
    classification: GuaranteedPaymentClassification;
    date: string;
    amountCents: string;
    cashAccountName: string;
    description: string;
  }>(
    `SELECT payment.id, payment.transaction_id AS transactionId, payment.member_id AS memberId,
            member.name AS memberName, payment.classification, payment.payment_date AS date,
            payment.amount_minor AS amountCents, cash.name AS cashAccountName, payment.description
     FROM guaranteed_payment_payments payment
     JOIN members member ON member.id = payment.member_id
     JOIN accounts cash ON cash.id = payment.cash_account_id
     WHERE payment.business_id = ?`, businessId,
  );
  const reversals = await database.getAllAsync<{
    id: string;
    paymentId: string;
    transactionId: string;
    memberId: string;
    memberName: string;
    classification: GuaranteedPaymentClassification;
    date: string;
    amountCents: string;
    cashAccountName: string;
    description: string;
    reason: string;
  }>(
    `SELECT reversal.id, reversal.payment_id AS paymentId,
            reversal.reversal_transaction_id AS transactionId, payment.member_id AS memberId,
            member.name AS memberName, payment.classification, reversal.reversal_date AS date,
            payment.amount_minor AS amountCents, returnedCash.name AS cashAccountName,
            payment.description, reversal.reason
     FROM guaranteed_payment_reversals reversal
     JOIN guaranteed_payment_payments payment ON payment.id = reversal.payment_id
     JOIN members member ON member.id = payment.member_id
     JOIN accounts returnedCash ON returnedCash.id = reversal.return_cash_account_id
     WHERE payment.business_id = ?`, businessId,
  );
  return [
    ...payments.map((payment): GuaranteedPaymentCashEvent => ({
      id: payment.id,
      paymentId: payment.id,
      transactionId: payment.transactionId,
      memberId: payment.memberId,
      memberName: payment.memberName,
      classification: payment.classification,
      date: payment.date,
      kind: 'payment',
      amountCents: BigInt(payment.amountCents),
      cashAccountName: payment.cashAccountName,
      description: payment.description,
      reason: null,
    })),
    ...reversals.map((reversal): GuaranteedPaymentCashEvent => ({
      id: reversal.id,
      paymentId: reversal.paymentId,
      transactionId: reversal.transactionId,
      memberId: reversal.memberId,
      memberName: reversal.memberName,
      classification: reversal.classification,
      date: reversal.date,
      kind: 'reversal',
      amountCents: -BigInt(reversal.amountCents),
      cashAccountName: reversal.cashAccountName,
      description: reversal.description,
      reason: reversal.reason,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

async function readLoanAgreements(database: Database, businessId: string): Promise<LoanAgreementRecord[]> {
  const rows = await database.getAllAsync<Omit<LoanAgreementRecord, 'commitmentCents'> & { commitmentCents: string }>(
    `SELECT id, lender_type AS lenderType, member_id AS memberId, lender_name AS lenderName,
            agreement_date AS agreementDate, commitment_minor AS commitmentCents,
            annual_rate_basis_points AS annualRateBasisPoints, day_count AS dayCount,
            description, liability_account_id AS liabilityAccountId
     FROM loan_agreements WHERE business_id = ? ORDER BY agreement_date, created_at, id`, businessId,
  );
  return rows.map((row) => ({ ...row, commitmentCents: BigInt(row.commitmentCents) }));
}

async function readLoanActivities(database: Database, businessId: string): Promise<LoanActivityRecord[]> {
  const rows = await database.getAllAsync<Omit<LoanActivityRecord, 'amountCents' | 'principalCents' | 'interestCents'> & {
    amountCents: string;
    principalCents: string;
    interestCents: string;
  }>(
    `SELECT * FROM (
     SELECT advance.id, advance.loan_id AS loanId, advance.transaction_id AS transactionId,
            advance.journal_entry_id AS journalEntryId, advance.advance_date AS date, 'advance' AS kind,
            advance.cash_account_id AS cashAccountId, cash.name AS cashAccountName,
            advance.amount_minor AS amountCents, '0' AS principalCents, '0' AS interestCents,
            advance.description
     FROM loan_advances advance
     JOIN loan_agreements agreement ON agreement.id = advance.loan_id
     JOIN accounts cash ON cash.id = advance.cash_account_id
     WHERE agreement.business_id = ?
     UNION ALL
     SELECT repayment.id, repayment.loan_id AS loanId, repayment.transaction_id AS transactionId,
            repayment.journal_entry_id AS journalEntryId, repayment.repayment_date AS date, 'repayment' AS kind,
            repayment.cash_account_id AS cashAccountId, cash.name AS cashAccountName,
            '-' || CAST(CAST(repayment.principal_minor AS INTEGER) + CAST(repayment.interest_minor AS INTEGER) AS TEXT) AS amountCents,
            repayment.principal_minor AS principalCents, repayment.interest_minor AS interestCents,
            repayment.description
     FROM loan_repayments repayment
     JOIN loan_agreements agreement ON agreement.id = repayment.loan_id
     JOIN accounts cash ON cash.id = repayment.cash_account_id
     WHERE agreement.business_id = ?
     ) loan_activity ORDER BY date, id`, businessId, businessId,
  );
  return rows.map((row) => ({
    ...row,
    amountCents: BigInt(row.amountCents),
    principalCents: BigInt(row.principalCents),
    interestCents: BigInt(row.interestCents),
  }));
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
export async function journalBalanceReportFromDatabase(
  database: Database,
  businessId: string,
  asOfDate: string,
): Promise<JournalBalanceReport> {
  requireDate(asOfDate, 'report date');
  await requireBusiness(database, businessId);
  const accounts = await database.getAllAsync<Pick<DbAccount, 'id' | 'code' | 'name' | 'kind'>>(
    'SELECT id, code, name, kind FROM accounts WHERE business_id = ? ORDER BY code, name', businessId,
  );
  const journalLines = await database.getAllAsync<{ accountId: string; debitMinor: string; creditMinor: string }>(
    `SELECT jl.account_id AS accountId, jl.debit_minor AS debitMinor, jl.credit_minor AS creditMinor
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.business_id = ? AND je.entry_date <= ?`, businessId, asOfDate,
  );
  const totalsByAccount = new Map<string, { debits: bigint; credits: bigint }>();
  for (const line of journalLines) {
    const totals = totalsByAccount.get(line.accountId) ?? { debits: 0n, credits: 0n };
    totals.debits += BigInt(line.debitMinor);
    totals.credits += BigInt(line.creditMinor);
    totalsByAccount.set(line.accountId, totals);
  }
  const trialBalance: TrialBalanceLine[] = accounts.map((account) => {
    const totals = totalsByAccount.get(account.id) ?? { debits: 0n, credits: 0n };
    const netDebit = totals.debits - totals.credits;
    return {
      accountId: account.id, code: account.code, name: account.name, kind: account.kind,
      debitCents: netDebit > 0n ? netDebit : 0n,
      creditCents: netDebit < 0n ? -netDebit : 0n,
    };
  });
  const totalDebitsCents = trialBalance.reduce((sum, line) => sum + line.debitCents, 0n);
  const totalCreditsCents = trialBalance.reduce((sum, line) => sum + line.creditCents, 0n);
  const balanceSheetLines = (kind: AccountRecord['kind'], normalSide: 'debit' | 'credit'): BalanceSheetLine[] =>
    accounts.filter((account) => account.kind === kind).map((account) => {
      const totals = totalsByAccount.get(account.id) ?? { debits: 0n, credits: 0n };
      return {
        accountId: account.id, code: account.code, name: account.name,
        balanceCents: normalSide === 'debit' ? totals.debits - totals.credits : totals.credits - totals.debits,
      };
    });
  const bankOverdrafts = accounts.filter((account) => account.kind === 'bank').flatMap((account) => {
    const totals = totalsByAccount.get(account.id) ?? { debits: 0n, credits: 0n };
    const netDebit = totals.debits - totals.credits;
    return netDebit < 0n ? [{
      accountId: `overdraft:${account.id}`, code: account.code,
      name: `${account.name} · bank overdraft`, balanceCents: -netDebit,
    }] : [];
  });
  const overdraftAccountIds = new Set(bankOverdrafts.map((line) => line.accountId.slice('overdraft:'.length)));
  const assets = ['bank', 'cash', 'asset'].flatMap((kind) => balanceSheetLines(kind as AccountRecord['kind'], 'debit'))
    .filter((line) => !overdraftAccountIds.has(line.accountId));
  const liabilities = [...balanceSheetLines('liability', 'credit'), ...bankOverdrafts];
  const equity = balanceSheetLines('equity', 'credit');
  let currentEarningsCents = 0n;
  for (const account of accounts) {
    const totals = totalsByAccount.get(account.id) ?? { debits: 0n, credits: 0n };
    if (account.kind === 'income') currentEarningsCents += totals.credits - totals.debits;
    if (account.kind === 'expense') currentEarningsCents -= totals.debits - totals.credits;
  }
  const sumBalances = (lines: BalanceSheetLine[]) => lines.reduce((sum, line) => sum + line.balanceCents, 0n);
  const totalAssetsCents = sumBalances(assets);
  const totalLiabilitiesCents = sumBalances(liabilities);
  const bookEquityCents = sumBalances(equity);
  const totalEquityCents = bookEquityCents + currentEarningsCents;
  return {
    asOfDate, trialBalance, totalDebitsCents, totalCreditsCents,
    balanceSheet: {
      assets, liabilities, equity, currentEarningsCents, totalAssetsCents,
      totalLiabilitiesCents, bookEquityCents, totalEquityCents,
      differenceCents: totalAssetsCents - totalLiabilitiesCents - totalEquityCents,
    },
  };
}

/** @internal SQL-level entry point used by repository tests. */
export async function generalLedgerReportFromDatabase(
  database: Database,
  businessId: string,
  accountId: string,
  asOfDate: string,
): Promise<GeneralLedgerReport> {
  requireDate(asOfDate, 'report date');
  await requireBusiness(database, businessId);
  const account = await database.getFirstAsync<{ id: string; name: string; kind: AccountRecord['kind'] }>(
    'SELECT id, name, kind FROM accounts WHERE id = ? AND business_id = ?', accountId, businessId,
  );
  if (!account) throw new Error('Choose an account belonging to this business.');
  const rows = await database.getAllAsync<{
    journalEntryId: string; date: string; description: string; lineNumber: number; debitMinor: string; creditMinor: string;
  }>(
    `SELECT je.id AS journalEntryId, je.entry_date AS date, je.description, jl.line_number AS lineNumber,
            jl.debit_minor AS debitMinor, jl.credit_minor AS creditMinor
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.business_id = ? AND jl.account_id = ? AND je.entry_date <= ?
     ORDER BY je.entry_date, je.created_at, jl.line_number, je.id`,
    businessId, accountId, asOfDate,
  );
  let runningBalanceCents = 0n;
  let totalDebitsCents = 0n;
  let totalCreditsCents = 0n;
  const lines = rows.map((row) => {
    const debitCents = BigInt(row.debitMinor);
    const creditCents = BigInt(row.creditMinor);
    totalDebitsCents += debitCents;
    totalCreditsCents += creditCents;
    runningBalanceCents += debitCents - creditCents;
    return {
      journalEntryId: row.journalEntryId, date: row.date, description: row.description,
      debitCents, creditCents, runningBalanceCents,
    };
  });
  return {
    accountId, accountName: account.name, accountKind: account.kind, asOfDate,
    lines, totalDebitsCents, totalCreditsCents, endingBalanceCents: runningBalanceCents,
  };
}

async function readAccountReconciliations(database: Database, businessId: string): Promise<AccountReconciliationRecord[]> {
  const rows = await database.getAllAsync<{
    id: string; accountId: string; accountName: string; periodStartDate: string; statementDate: string;
    beginningMinor: string; endingMinor: string; status: 'draft' | 'completed';
  }>(
    `SELECT reconciliation.id, reconciliation.account_id AS accountId, account.name AS accountName,
            reconciliation.period_start_date AS periodStartDate, reconciliation.statement_date AS statementDate,
            reconciliation.beginning_minor AS beginningMinor, reconciliation.ending_minor AS endingMinor,
            reconciliation.status
     FROM account_reconciliations reconciliation
     JOIN accounts account ON account.id = reconciliation.account_id
     WHERE reconciliation.business_id = ?
     ORDER BY reconciliation.statement_date DESC, reconciliation.created_at DESC`, businessId,
  );
  const reconciliations: AccountReconciliationRecord[] = [];
  for (const row of rows) {
    const header: AccountReconciliationHeader = {
      id: row.id, businessId, accountId: row.accountId, periodStartDate: row.periodStartDate,
      statementDate: row.statementDate, beginningBalanceCents: BigInt(row.beginningMinor),
      endingBalanceCents: BigInt(row.endingMinor), status: row.status,
    };
    const activities = await readAccountReconciliationActivities(database, row.id, header);
    const clearedMovementCents = activities.reduce(
      (sum, activity) => activity.cleared ? sum + activity.amountCents : sum, 0n,
    );
    reconciliations.push({
      id: row.id, accountId: row.accountId, accountName: row.accountName,
      periodStartDate: row.periodStartDate, statementDate: row.statementDate,
      beginningBalanceCents: header.beginningBalanceCents, endingBalanceCents: header.endingBalanceCents,
      clearedMovementCents,
      differenceCents: header.beginningBalanceCents + clearedMovementCents - header.endingBalanceCents,
      status: row.status, activities,
    });
  }
  return reconciliations;
}

async function readAccountReconciliationEvents(database: Database, businessId: string): Promise<AccountReconciliationEvent[]> {
  return await database.getAllAsync<AccountReconciliationEvent>(
    `SELECT event.id, event.reconciliation_id AS reconciliationId, event.event_type AS eventType,
            event.transaction_id AS transactionId, event.created_at AS createdAt
     FROM account_reconciliation_events event
     JOIN account_reconciliations reconciliation ON reconciliation.id = event.reconciliation_id
     WHERE reconciliation.business_id = ? ORDER BY event.rowid`, businessId,
  );
}

/** @internal SQL-level entry point used by repository tests. */
export async function getBookkeepingSnapshotFromDatabase(database: Database, businessId?: string): Promise<BookkeepingSnapshot | null> {
  await ensureBookkeepingSchema(database);
  const business = await readBusiness(database, businessId);
  if (!business) return {
    business: null, members: [], memberHistory: [], accounts: [], transactions: [], capitalActivities: [],
    memberCapitalSummaries: [], guaranteedPaymentInstallments: [], guaranteedPaymentCashEvents: [],
    loanAgreements: [], loanActivities: [], accountReconciliations: [], accountReconciliationEvents: [],
    cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n },
  };
  const { members, history } = await readMembers(database, business.id);
  const accounts = await readAccounts(database, business.id);
  const transactions = await readTransactions(database, business.id);
  const capitalActivities = await readCapitalActivities(database, business.id);
  const memberCapitalSummaries = await readMemberCapitalSummaries(database, business.id);
  const guaranteedPaymentInstallments = await readGuaranteedPaymentInstallments(database, business.id);
  const guaranteedPaymentCashEvents = await readGuaranteedPaymentCashEvents(database, business.id);
  const loanAgreements = await readLoanAgreements(database, business.id);
  const loanActivities = await readLoanActivities(database, business.id);
  const accountReconciliations = await readAccountReconciliations(database, business.id);
  const accountReconciliationEvents = await readAccountReconciliationEvents(database, business.id);
  const cashBasis = await cashBasisForPeriod(database, business.id);
  return {
    business, members, memberHistory: history, accounts, transactions, capitalActivities, memberCapitalSummaries,
    guaranteedPaymentInstallments, guaranteedPaymentCashEvents, loanAgreements, loanActivities,
    accountReconciliations, accountReconciliationEvents, cashBasis,
  };
}

export function transactionsCsv(snapshot: BookkeepingSnapshot): string {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = snapshot.transactions.flatMap((transaction) => {
    const signedAmount = (amount: bigint) => amount < 0n ? `-${formatUsd(-amount)}` : formatUsd(amount);
    if (transaction.transferRole) {
      const sourceIsOutflow = transaction.amountCents < 0n;
      return [
        [
          transaction.date,
          sourceIsOutflow ? 'Transfer out' : 'Transfer in',
          signedAmount(transaction.amountCents),
          transaction.accountName,
          transaction.description,
        ],
        [
          transaction.date,
          sourceIsOutflow ? 'Transfer in' : 'Transfer out',
          signedAmount(-transaction.amountCents),
          transaction.category,
          transaction.description,
        ],
      ];
    }
    return [[
      transaction.date,
      transaction.kind === 'reversal' ? `${transaction.category} · reversal` : transaction.category,
      signedAmount(transaction.amountCents),
      transaction.accountName,
      transaction.description,
    ]];
  });
  rows.unshift(['Date', 'Category', 'Amount', 'Account', 'Description']);
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export async function cashBasisReportFromDatabase(database: Database, businessId: string, fromDate: string, throughDate: string): Promise<CashBasisReport> {
  const totals = await cashBasisForPeriod(database, businessId, fromDate, throughDate);
  return { ...totals, fromDate, throughDate };
}
