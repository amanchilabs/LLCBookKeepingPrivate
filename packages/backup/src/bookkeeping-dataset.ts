/**
 * Strict, versioned, portable contract for the complete supported bookkeeping
 * SQL dataset (accounting schema 13). This module is pure: it contains the
 * table/column inventory, payload validation, canonical serialization and
 * deterministic comparison. SQL access lives in `bookkeeping-snapshot.ts`.
 *
 * The contract fails closed. Anything the inventory does not describe (a newer
 * schema, an unknown table or column, an unexpected value shape, a duplicate or
 * dangling row) is rejected instead of being dropped or coerced.
 *
 * Error messages identify tables, columns and row positions only. They never
 * include row values, so financial data does not leak into logs.
 */

export const BOOKKEEPING_DATASET_FORMAT = 'llc-bookkeeping-dataset';
export const BOOKKEEPING_DATASET_FORMAT_VERSION = 1;
/** The only accounting schema version this payload format can carry. */
export const BOOKKEEPING_DATASET_SCHEMA_VERSION = 13;

/**
 * Holds only the accounting schema version. It is represented by the payload's
 * `schemaVersion` field and recreated by the existing schema function, so it is
 * inventoried here but carries no payload rows.
 */
export const BOOKKEEPING_SCHEMA_METADATA_TABLE = 'bookkeeping_schema';

/**
 * Known tables that may share the SQLite file with the books but are NOT
 * bookkeeping data: the synthetic storage/restore proof utilities. They are
 * explicitly excluded from export. Any other unlisted table fails closed.
 */
export const BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES: readonly string[] = Object.freeze([
  'proof_records',
  'restore_manifest',
]);

export type BookkeepingDatasetErrorCode =
  | 'malformed-snapshot'
  | 'unsupported-format-version'
  | 'unsupported-schema-version'
  | 'newer-schema-version'
  | 'unsupported-source-structure'
  | 'nonempty-destination'
  | 'restore-verification-failed'
  | 'destination-cleanup-failed';

export class BookkeepingDatasetError extends Error {
  readonly code: BookkeepingDatasetErrorCode;

  constructor(code: BookkeepingDatasetErrorCode, message: string) {
    super(message);
    this.name = 'BookkeepingDatasetError';
    this.code = code;
  }
}

/**
 * - `id`: non-empty TEXT identifier, preserved exactly.
 * - `text`: TEXT, may be empty.
 * - `date`: TEXT calendar date `YYYY-MM-DD`.
 * - `timestamp`: non-empty TEXT instant, preserved exactly as stored.
 * - `minor`: TEXT canonical base-10 integer of minor units (cents); never a
 *   JSON number, so amounts beyond 2^53 survive unchanged.
 * - `integer`: SQLite INTEGER within the JavaScript safe-integer range.
 * - `flag`: SQLite INTEGER 0 or 1.
 */
export type BookkeepingDatasetColumnKind = 'id' | 'text' | 'date' | 'timestamp' | 'minor' | 'integer' | 'flag';

export interface BookkeepingDatasetColumn {
  readonly name: string;
  readonly kind: BookkeepingDatasetColumnKind;
  readonly nullable: boolean;
  /** 1-based position within the primary key; 0 when not part of it. */
  readonly primaryKeyPosition: number;
  /** Table whose `id` column this column references, if any. */
  readonly references: string | null;
}

export interface BookkeepingDatasetTable {
  readonly name: string;
  readonly columns: readonly BookkeepingDatasetColumn[];
}

export type BookkeepingDatasetValue = string | number | null;

export interface BookkeepingDatasetTableSnapshot {
  name: string;
  columns: string[];
  rowCount: number;
  /** Rows in `columns` order, sorted strictly ascending by primary key. */
  rows: BookkeepingDatasetValue[][];
}

export interface BookkeepingDatasetSnapshot {
  format: typeof BOOKKEEPING_DATASET_FORMAT;
  formatVersion: typeof BOOKKEEPING_DATASET_FORMAT_VERSION;
  schemaVersion: typeof BOOKKEEPING_DATASET_SCHEMA_VERSION;
  tables: BookkeepingDatasetTableSnapshot[];
}

export interface BookkeepingDatasetDifference {
  table: string;
  kind: 'row-count' | 'row-content';
  /** Row count, or number of expected rows absent from the actual dataset. */
  expected: number;
  /** Row count, or number of actual rows absent from the expected dataset. */
  actual: number;
}

interface ColumnOptions {
  pk?: number;
  nullable?: boolean;
  references?: string;
}

function column(name: string, kind: BookkeepingDatasetColumnKind, options: ColumnOptions = {}): BookkeepingDatasetColumn {
  return Object.freeze({
    name,
    kind,
    nullable: options.nullable ?? false,
    primaryKeyPosition: options.pk ?? 0,
    references: options.references ?? null,
  });
}

const id = (): BookkeepingDatasetColumn => column('id', 'id', { pk: 1 });
const ref = (name: string, references: string, nullable = false): BookkeepingDatasetColumn =>
  column(name, 'id', { references, nullable });
const text = (name: string, nullable = false): BookkeepingDatasetColumn => column(name, 'text', { nullable });
const date = (name: string, nullable = false): BookkeepingDatasetColumn => column(name, 'date', { nullable });
const timestamp = (name: string, nullable = false): BookkeepingDatasetColumn => column(name, 'timestamp', { nullable });
const minor = (name: string): BookkeepingDatasetColumn => column(name, 'minor');
const integer = (name: string): BookkeepingDatasetColumn => column(name, 'integer');
const flag = (name: string): BookkeepingDatasetColumn => column(name, 'flag');

function table(name: string, columns: BookkeepingDatasetColumn[]): BookkeepingDatasetTable {
  return Object.freeze({ name, columns: Object.freeze(columns) });
}

/**
 * Every schema-13 bookkeeping data table and column, in foreign-key-safe insert
 * order (a table appears after every table it references).
 */
export const BOOKKEEPING_DATASET_TABLES: readonly BookkeepingDatasetTable[] = Object.freeze([
  table('businesses', [
    id(), text('name'), text('formation_state'), date('formation_date'), date('bookkeeping_start_date'),
    text('currency'), timestamp('created_at'),
  ]),
  table('members', [
    id(), ref('business_id', 'businesses'), text('name'), timestamp('created_at'), timestamp('retired_at', true),
  ]),
  table('member_interest_history', [
    id(), ref('business_id', 'businesses'), ref('member_id', 'members'), integer('ownership_basis_points'),
    date('effective_from'), date('effective_to', true), timestamp('created_at'),
  ]),
  table('accounts', [
    id(), ref('business_id', 'businesses'), text('code'), text('name'), text('kind'), text('category'),
    flag('is_system'), flag('is_active'), timestamp('created_at'),
  ]),
  table('journal_entries', [
    id(), ref('business_id', 'businesses'), date('entry_date'), text('entry_type'), text('description'),
    timestamp('created_at'),
  ]),
  table('journal_lines', [
    id(), ref('journal_entry_id', 'journal_entries'), ref('account_id', 'accounts'), integer('line_number'),
    minor('debit_minor'), minor('credit_minor'),
  ]),
  table('transactions', [
    id(), ref('business_id', 'businesses'), ref('journal_entry_id', 'journal_entries'), date('entry_date'),
    text('kind'), ref('account_id', 'accounts'), ref('category_account_id', 'accounts'), minor('amount_minor'),
    text('description'), timestamp('created_at'),
  ]),
  table('transaction_corrections', [
    id(), ref('business_id', 'businesses'), ref('original_transaction_id', 'transactions'),
    ref('reversal_transaction_id', 'transactions'), ref('replacement_transaction_id', 'transactions'),
    timestamp('created_at'),
  ]),
  table('transaction_correction_roles', [
    column('transaction_id', 'id', { pk: 1, references: 'transactions' }),
    ref('correction_id', 'transaction_corrections'), text('role'),
  ]),
  table('transaction_splits', [
    column('transaction_id', 'id', { pk: 1, references: 'transactions' }),
    column('line_number', 'integer', { pk: 2 }),
    ref('category_account_id', 'accounts'), minor('amount_minor'),
  ]),
  table('member_capital_activity', [
    id(), ref('business_id', 'businesses'), ref('member_id', 'members'), ref('journal_entry_id', 'journal_entries'),
    date('activity_date'), text('activity_kind'), minor('amount_minor'), ref('cash_account_id', 'accounts', true),
    ref('property_asset_account_id', 'accounts', true), text('property_description', true), text('description'),
    flag('requires_cpa_review'), timestamp('created_at'),
  ]),
  table('guaranteed_payment_obligations', [
    id(), ref('business_id', 'businesses'), ref('member_id', 'members'), text('classification'), text('recurrence'),
    date('first_due_date'), integer('installment_count'), minor('installment_amount_minor'), text('description'),
    timestamp('created_at'),
  ]),
  table('guaranteed_payment_installments', [
    id(), ref('obligation_id', 'guaranteed_payment_obligations'), date('due_date'), minor('amount_minor'),
    integer('installment_number'), timestamp('created_at'),
  ]),
  table('guaranteed_payment_payments', [
    id(), ref('business_id', 'businesses'), ref('member_id', 'members'), text('classification'),
    ref('transaction_id', 'transactions'), date('payment_date'), ref('cash_account_id', 'accounts'),
    minor('amount_minor'), text('description'), timestamp('created_at'),
  ]),
  table('guaranteed_payment_allocations', [
    column('payment_id', 'id', { pk: 1, references: 'guaranteed_payment_payments' }),
    column('installment_id', 'id', { pk: 2, references: 'guaranteed_payment_installments' }),
    minor('amount_minor'), timestamp('created_at'),
  ]),
  table('guaranteed_payment_reversals', [
    id(), ref('payment_id', 'guaranteed_payment_payments'), ref('reversal_transaction_id', 'transactions'),
    ref('reversal_journal_entry_id', 'journal_entries'), ref('return_cash_account_id', 'accounts'),
    date('reversal_date'), text('reason'), timestamp('created_at'),
  ]),
  table('loan_agreements', [
    id(), ref('business_id', 'businesses'), text('lender_type'), ref('member_id', 'members', true),
    text('lender_name'), date('agreement_date'), minor('commitment_minor'), integer('annual_rate_basis_points'),
    text('day_count'), text('description'), ref('liability_account_id', 'accounts'), timestamp('created_at'),
  ]),
  table('loan_advances', [
    id(), ref('loan_id', 'loan_agreements'), ref('transaction_id', 'transactions'),
    ref('journal_entry_id', 'journal_entries'), date('advance_date'), ref('cash_account_id', 'accounts'),
    minor('amount_minor'), text('description'), timestamp('created_at'),
  ]),
  table('loan_repayments', [
    id(), ref('loan_id', 'loan_agreements'), ref('transaction_id', 'transactions'),
    ref('journal_entry_id', 'journal_entries'), date('repayment_date'), ref('cash_account_id', 'accounts'),
    minor('principal_minor'), minor('interest_minor'), text('description'), timestamp('created_at'),
  ]),
  table('recurring_transaction_templates', [
    id(), ref('business_id', 'businesses'), text('kind'), ref('account_id', 'accounts'),
    ref('category_account_id', 'accounts'), minor('amount_minor'), text('description'), text('cadence'),
    date('next_date'), integer('anchor_day'), flag('is_active'), timestamp('created_at'),
  ]),
  table('recurring_transaction_occurrences', [
    id(), ref('template_id', 'recurring_transaction_templates'), ref('transaction_id', 'transactions'),
    date('scheduled_date'), date('posted_date'), timestamp('created_at'),
  ]),
  table('account_reconciliations', [
    id(), ref('business_id', 'businesses'), ref('account_id', 'accounts'), date('period_start_date'),
    date('statement_date'), minor('beginning_minor'), minor('ending_minor'), text('status'),
    timestamp('created_at'), timestamp('completed_at', true),
  ]),
  table('account_reconciliation_items', [
    column('reconciliation_id', 'id', { pk: 1, references: 'account_reconciliations' }),
    column('transaction_id', 'id', { pk: 2, references: 'transactions' }),
    timestamp('created_at'),
  ]),
  table('account_reconciliation_events', [
    id(), ref('reconciliation_id', 'account_reconciliations'), text('event_type'),
    ref('transaction_id', 'transactions', true), timestamp('created_at'),
  ]),
  table('accounting_period_events', [
    id(), ref('business_id', 'businesses'), text('event_type'), date('period_start_date'), date('period_end_date'),
    text('reason'), ref('target_close_event_id', 'accounting_period_events', true), timestamp('created_at'),
  ]),
  table('bookkeeping_reminders', [
    id(), ref('business_id', 'businesses'), date('due_date'), text('title'), text('details'), flag('is_complete'),
    timestamp('created_at'), timestamp('updated_at'), timestamp('completed_at', true),
  ]),
  table('bookkeeping_preferences', [
    column('preference_key', 'id', { pk: 1 }),
    ref('preference_value', 'businesses'),
  ]),
]);

const TABLE_BY_NAME: ReadonlyMap<string, BookkeepingDatasetTable> = new Map(
  BOOKKEEPING_DATASET_TABLES.map((entry) => [entry.name, entry]),
);

const SNAPSHOT_KEYS = ['format', 'formatVersion', 'schemaVersion', 'tables'] as const;
const TABLE_KEYS = ['name', 'columns', 'rowCount', 'rows'] as const;
const MINOR_PATTERN = /^(0|-?[1-9][0-9]*)$/;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** SQLite declared type and storage class required for a column kind. */
export function bookkeepingDatasetColumnSqlType(kind: BookkeepingDatasetColumnKind): 'INTEGER' | 'TEXT' {
  return kind === 'integer' || kind === 'flag' ? 'INTEGER' : 'TEXT';
}

function fail(message: string, code: BookkeepingDatasetErrorCode = 'malformed-snapshot'): never {
  throw new BookkeepingDatasetError(code, message);
}

/** Rejects anything except exactly the supported accounting schema version. */
export function assertSupportedBookkeepingSchemaVersion(version: unknown): asserts version is 13 {
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
    fail('The bookkeeping schema version is not a valid integer.', 'unsupported-schema-version');
  }
  if (version > BOOKKEEPING_DATASET_SCHEMA_VERSION) {
    fail(
      `Bookkeeping schema version ${version} is newer than the supported version ${BOOKKEEPING_DATASET_SCHEMA_VERSION}.`,
      'newer-schema-version',
    );
  }
  if (version !== BOOKKEEPING_DATASET_SCHEMA_VERSION) {
    fail(
      `Bookkeeping schema version ${version} is not supported; only version ${BOOKKEEPING_DATASET_SCHEMA_VERSION} can be captured or restored.`,
      'unsupported-schema-version',
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/** Text must survive UTF-8 encoding and SQLite text APIs unchanged. */
function isPortableText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  parsed.setUTCFullYear(year);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isSupportedValue(definition: BookkeepingDatasetColumn, value: unknown): value is BookkeepingDatasetValue {
  if (value === null) return definition.nullable && definition.primaryKeyPosition === 0;
  if (definition.kind === 'integer') {
    return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
  }
  if (definition.kind === 'flag') return value === 1 || (value === 0 && !Object.is(value, -0));
  if (typeof value !== 'string' || !isPortableText(value)) return false;
  switch (definition.kind) {
    case 'id':
    case 'timestamp':
      return value.length > 0;
    case 'date':
      return isCalendarDate(value);
    case 'minor':
      return MINOR_PATTERN.test(value);
    default:
      return true;
  }
}

function primaryKeyIndexes(definition: BookkeepingDatasetTable): number[] {
  return definition.columns
    .map((entry, index) => ({ index, position: entry.primaryKeyPosition }))
    .filter((entry) => entry.position > 0)
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.index);
}

/** Collation-independent ordering: UTF-16 code units for text, numeric for integers. */
function comparePrimaryKeys(keyIndexes: readonly number[], left: readonly unknown[], right: readonly unknown[]): number {
  for (const index of keyIndexes) {
    const a = left[index];
    const b = right[index];
    if (typeof a === 'string' && typeof b === 'string') {
      if (a < b) return -1;
      if (a > b) return 1;
    } else if (typeof a === 'number' && typeof b === 'number') {
      if (a < b) return -1;
      if (a > b) return 1;
    }
  }
  return 0;
}

function validateTable(definition: BookkeepingDatasetTable, value: Record<string, unknown>): BookkeepingDatasetTableSnapshot {
  const name = definition.name;
  const columns = value.columns;
  if (!Array.isArray(columns)
    || columns.length !== definition.columns.length
    || definition.columns.some((entry, index) => columns[index] !== entry.name)) {
    fail(`Table ${name} has an unsupported column shape; unknown, missing or reordered columns are not accepted.`);
  }
  const sourceRows = value.rows;
  if (!Array.isArray(sourceRows)) fail(`Table ${name} rows are malformed.`);
  if (typeof value.rowCount !== 'number' || !Number.isSafeInteger(value.rowCount) || value.rowCount !== sourceRows.length) {
    fail(`Table ${name} row count does not match its rows.`);
  }

  const keyIndexes = primaryKeyIndexes(definition);
  const rows: BookkeepingDatasetValue[][] = [];
  sourceRows.forEach((sourceRow: unknown, rowIndex: number) => {
    if (!Array.isArray(sourceRow) || sourceRow.length !== definition.columns.length) {
      fail(`Table ${name} row ${rowIndex} is malformed.`);
    }
    const row = definition.columns.map((entry, columnIndex) => {
      const cell: unknown = sourceRow[columnIndex];
      if (!isSupportedValue(entry, cell)) {
        fail(`Table ${name} row ${rowIndex} column ${entry.name} has an unsupported value.`);
      }
      return cell;
    });
    if (rowIndex > 0) {
      const order = comparePrimaryKeys(keyIndexes, rows[rowIndex - 1], row);
      if (order === 0) fail(`Table ${name} row ${rowIndex} duplicates a primary key.`);
      if (order > 0) fail(`Table ${name} rows are not in canonical primary-key order.`);
    }
    rows.push(row);
  });
  return { name, columns: definition.columns.map((entry) => entry.name), rowCount: rows.length, rows };
}

function validateReferences(tables: readonly BookkeepingDatasetTableSnapshot[]): void {
  const identifiers = new Map<string, Set<BookkeepingDatasetValue>>();
  tables.forEach((entry, tableIndex) => {
    const idIndex = BOOKKEEPING_DATASET_TABLES[tableIndex].columns.findIndex((candidate) => candidate.name === 'id');
    if (idIndex >= 0) identifiers.set(entry.name, new Set(entry.rows.map((row) => row[idIndex])));
  });
  tables.forEach((entry, tableIndex) => {
    BOOKKEEPING_DATASET_TABLES[tableIndex].columns.forEach((definition, columnIndex) => {
      const referenced = definition.references;
      if (referenced === null) return;
      const targets = identifiers.get(referenced);
      entry.rows.forEach((row, rowIndex) => {
        const cell = row[columnIndex];
        if (cell !== null && !targets?.has(cell)) {
          fail(`Table ${entry.name} row ${rowIndex} column ${definition.name} references a missing ${referenced} record.`);
        }
      });
    });
  });
}

/**
 * Strictly validates an untrusted payload and returns a canonical deep copy.
 * Nothing is repaired, reordered or dropped: any deviation throws.
 */
export function validateBookkeepingDatasetSnapshot(value: unknown): BookkeepingDatasetSnapshot {
  if (!isPlainObject(value) || !hasExactKeys(value, SNAPSHOT_KEYS)) {
    fail('The bookkeeping dataset has missing or unknown top-level fields.');
  }
  if (value.format !== BOOKKEEPING_DATASET_FORMAT) fail('The payload is not a bookkeeping dataset.');
  if (value.formatVersion !== BOOKKEEPING_DATASET_FORMAT_VERSION) {
    fail('The bookkeeping dataset format version is unsupported.', 'unsupported-format-version');
  }
  assertSupportedBookkeepingSchemaVersion(value.schemaVersion);
  const sourceTables = value.tables;
  if (!Array.isArray(sourceTables)) fail('The bookkeeping dataset tables are malformed.');

  sourceTables.forEach((entry: unknown, index: number) => {
    if (!isPlainObject(entry) || !hasExactKeys(entry, TABLE_KEYS) || typeof entry.name !== 'string') {
      fail(`The bookkeeping dataset table at position ${index} is malformed.`);
    }
    if (!TABLE_BY_NAME.has(entry.name as string)) {
      fail(`The bookkeeping dataset contains an unknown table at position ${index}.`);
    }
  });
  if (sourceTables.length !== BOOKKEEPING_DATASET_TABLES.length
    || BOOKKEEPING_DATASET_TABLES.some((definition, index) => (sourceTables[index] as { name: string }).name !== definition.name)) {
    fail('The bookkeeping dataset has missing, duplicate or reordered tables.');
  }

  const tables = BOOKKEEPING_DATASET_TABLES.map((definition, index) =>
    validateTable(definition, sourceTables[index] as Record<string, unknown>));
  validateReferences(tables);
  return {
    format: BOOKKEEPING_DATASET_FORMAT,
    formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
    schemaVersion: BOOKKEEPING_DATASET_SCHEMA_VERSION,
    tables,
  };
}

/**
 * Builds a canonical snapshot from complete keyed rows of every inventory
 * table. Rows are sorted by primary key and then strictly validated; a missing
 * table, an unexpected table or an unexpected column is an error.
 */
export function buildBookkeepingDatasetSnapshot(
  schemaVersion: unknown,
  rowsByTable: ReadonlyMap<string, ReadonlyArray<Readonly<Record<string, unknown>>>>,
): BookkeepingDatasetSnapshot {
  assertSupportedBookkeepingSchemaVersion(schemaVersion);
  for (const name of rowsByTable.keys()) {
    if (!TABLE_BY_NAME.has(name)) fail('Rows were supplied for an unknown bookkeeping table.', 'unsupported-source-structure');
  }
  const tables = BOOKKEEPING_DATASET_TABLES.map((definition) => {
    const records = rowsByTable.get(definition.name);
    if (!records) fail(`Rows for table ${definition.name} are missing.`, 'unsupported-source-structure');
    const keyIndexes = primaryKeyIndexes(definition);
    const rows = records.map((record, rowIndex) => {
      if (Object.keys(record).length !== definition.columns.length) {
        fail(`Table ${definition.name} row ${rowIndex} has an unsupported column shape.`, 'unsupported-source-structure');
      }
      return definition.columns.map((entry) => {
        if (!Object.prototype.hasOwnProperty.call(record, entry.name)) {
          fail(`Table ${definition.name} row ${rowIndex} is missing column ${entry.name}.`, 'unsupported-source-structure');
        }
        return record[entry.name];
      });
    });
    rows.sort((left, right) => comparePrimaryKeys(keyIndexes, left, right));
    return { name: definition.name, columns: definition.columns.map((entry) => entry.name), rowCount: rows.length, rows };
  });
  return validateBookkeepingDatasetSnapshot({
    format: BOOKKEEPING_DATASET_FORMAT,
    formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
    schemaVersion,
    tables,
  });
}

/** Canonical, deterministic JSON text: fixed key, table, column and row order. */
export function serializeBookkeepingDataset(snapshot: unknown): string {
  return JSON.stringify(validateBookkeepingDatasetSnapshot(snapshot));
}

/**
 * Parses canonical dataset text. Text that does not re-serialize to itself
 * (duplicate keys, reordered fields, extra whitespace, alternate number or
 * escape spellings) is rejected, so one dataset has exactly one encoding.
 */
export function parseBookkeepingDataset(serialized: unknown): BookkeepingDatasetSnapshot {
  if (typeof serialized !== 'string') fail('The bookkeeping dataset payload is not text.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail('The bookkeeping dataset payload is not valid JSON.');
  }
  const snapshot = validateBookkeepingDatasetSnapshot(parsed);
  if (JSON.stringify(snapshot) !== serialized) fail('The bookkeeping dataset payload is not in canonical form.');
  return snapshot;
}

/**
 * Deterministically compares every table's counts and complete rows. The
 * result names tables and counts only, never row values. An empty array means
 * the datasets are identical.
 */
export function compareBookkeepingDatasets(expected: unknown, actual: unknown): BookkeepingDatasetDifference[] {
  const left = validateBookkeepingDatasetSnapshot(expected);
  const right = validateBookkeepingDatasetSnapshot(actual);
  const differences: BookkeepingDatasetDifference[] = [];
  left.tables.forEach((expectedTable, index) => {
    const actualTable = right.tables[index];
    if (expectedTable.rowCount !== actualTable.rowCount) {
      differences.push({ table: expectedTable.name, kind: 'row-count', expected: expectedTable.rowCount, actual: actualTable.rowCount });
    }
    const expectedRows = new Set(expectedTable.rows.map((row) => JSON.stringify(row)));
    const actualRows = new Set(actualTable.rows.map((row) => JSON.stringify(row)));
    let missing = 0;
    let unexpected = 0;
    for (const row of expectedRows) if (!actualRows.has(row)) missing += 1;
    for (const row of actualRows) if (!expectedRows.has(row)) unexpected += 1;
    if (missing > 0 || unexpected > 0) {
      differences.push({ table: expectedTable.name, kind: 'row-content', expected: missing, actual: unexpected });
    }
  });
  return differences;
}
