/**
 * SQL boundary for the complete bookkeeping dataset: consistent read-only
 * export from an open bookkeeping database, and isolated import into an EMPTY
 * candidate database. The payload contract is in `bookkeeping-dataset.ts`.
 *
 * Scope limits (see docs/recovery/DATASET-COVERAGE.md):
 * - Callers must hold the existing storage serialization for the connection
 *   for the whole call; statements from another task must not interleave.
 * - The caller owns the database connection: if rollback cleanup fails during
 *   export or verification, the connection may retain an uncommitted
 *   transaction or writer reservation and must be closed/discarded by the caller.
 * - Export never migrates or writes to the source. A source that is not
 *   already at the supported schema version is rejected unchanged.
 * - Import never activates a candidate and never touches a nonempty database.
 * - No encryption, device key, proof record or `sqlite_master` SQL is read
 *   into or written from the payload here.
 */
import { ensureBookkeepingSchema, type BookkeepingSqlDatabase } from '../../storage-native/src/bookkeeping-store';
import {
  assertSupportedBookkeepingSchemaVersion,
  bookkeepingDatasetColumnSqlType,
  BOOKKEEPING_DATASET_TABLES,
  BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES,
  BOOKKEEPING_SCHEMA_METADATA_TABLE,
  BookkeepingDatasetError,
  buildBookkeepingDatasetSnapshot,
  compareBookkeepingDatasets,
  validateBookkeepingDatasetSnapshot,
  type BookkeepingDatasetSnapshot,
  type BookkeepingDatasetTable,
} from './bookkeeping-dataset';

export interface BookkeepingDatasetImportResult {
  schemaVersion: number;
  tableRowCounts: Record<string, number>;
  totalRowCount: number;
}

interface ExpectedColumn {
  name: string;
  sqlType: 'INTEGER' | 'TEXT';
  primaryKeyPosition: number;
}

const METADATA_COLUMNS: readonly ExpectedColumn[] = [
  { name: 'singleton', sqlType: 'INTEGER', primaryKeyPosition: 1 },
  { name: 'version', sqlType: 'INTEGER', primaryKeyPosition: 0 },
];

const MAX_SAFE_INTEGER_SQL = '9007199254740991';

/** Identifiers come only from the fixed inventory; this is a second guard. */
function quoteIdentifier(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Unexpected SQL identifier in the bookkeeping inventory.');
  return `"${name}"`;
}

function structureError(message: string): BookkeepingDatasetError {
  return new BookkeepingDatasetError('unsupported-source-structure', message);
}

function verificationError(message: string): BookkeepingDatasetError {
  return new BookkeepingDatasetError('restore-verification-failed', message);
}

async function listUserObjects(database: BookkeepingSqlDatabase): Promise<Array<{ type: string; name: string }>> {
  const objects = await database.getAllAsync<{ type: string; name: string }>('SELECT type, name FROM sqlite_master');
  return objects.filter((entry) => !entry.name.startsWith('sqlite_'));
}

async function readSchemaVersion(database: BookkeepingSqlDatabase): Promise<number> {
  const metadata = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?`,
    BOOKKEEPING_SCHEMA_METADATA_TABLE,
  );
  if (metadata?.count !== 1) throw structureError('The database does not contain a bookkeeping schema.');
  const rows = await database.getAllAsync<{ singleton: number; version: number; versionType: string }>(
    `SELECT singleton, version, typeof(version) AS versionType FROM ${quoteIdentifier(BOOKKEEPING_SCHEMA_METADATA_TABLE)}`,
  );
  if (rows.length !== 1 || rows[0].singleton !== 1 || rows[0].versionType !== 'integer') {
    throw structureError('The bookkeeping schema version record is malformed.');
  }
  assertSupportedBookkeepingSchemaVersion(rows[0].version);
  return rows[0].version;
}

async function assertTableShape(
  database: BookkeepingSqlDatabase,
  tableName: string,
  expected: readonly ExpectedColumn[],
): Promise<void> {
  const actual = await database.getAllAsync<{ name: string; type: string; pk: number; hidden: number }>(
    `PRAGMA table_xinfo(${quoteIdentifier(tableName)})`,
  );
  if (actual.length !== expected.length) {
    throw structureError(`Table ${tableName} has unknown or missing columns.`);
  }
  for (const column of expected) {
    const found = actual.find((entry) => entry.name === column.name);
    if (!found
      || found.hidden !== 0
      || String(found.type).toUpperCase() !== column.sqlType
      || found.pk !== column.primaryKeyPosition) {
      throw structureError(`Table ${tableName} column ${column.name} has an unsupported shape.`);
    }
  }
}

/**
 * Every table must be inventoried (or, when allowed, a documented proof-only
 * exclusion), every inventoried table and column must exist with the supported
 * shape, and no view or trigger may exist. Indexes hold no independent data.
 */
async function assertSupportedStructure(database: BookkeepingSqlDatabase, allowExcludedTables: boolean): Promise<void> {
  const inventoried = new Set<string>([
    BOOKKEEPING_SCHEMA_METADATA_TABLE,
    ...BOOKKEEPING_DATASET_TABLES.map((entry) => entry.name),
  ]);
  const present = new Set<string>();
  for (const entry of await listUserObjects(database)) {
    if (entry.type === 'index') continue;
    if (entry.type !== 'table') {
      throw structureError(`The database contains an unsupported ${entry.type}; it cannot be captured completely.`);
    }
    if (inventoried.has(entry.name)) {
      present.add(entry.name);
    } else if (!(allowExcludedTables && BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES.includes(entry.name))) {
      throw structureError('The database contains an unknown table; it cannot be captured completely.');
    }
  }
  for (const name of inventoried) {
    if (!present.has(name)) throw structureError(`Bookkeeping table ${name} is missing.`);
  }
  await assertTableShape(database, BOOKKEEPING_SCHEMA_METADATA_TABLE, METADATA_COLUMNS);
  for (const entry of BOOKKEEPING_DATASET_TABLES) {
    await assertTableShape(database, entry.name, entry.columns.map((column) => ({
      name: column.name,
      sqlType: bookkeepingDatasetColumnSqlType(column.kind),
      primaryKeyPosition: column.primaryKeyPosition,
    })));
  }
}

/**
 * Reads complete rows after proving, in SQL, that every stored value has the
 * exact storage class the payload can carry losslessly (no BLOB, REAL,
 * mistyped or out-of-safe-range INTEGER values).
 */
async function readTableRows(
  database: BookkeepingSqlDatabase,
  definition: BookkeepingDatasetTable,
): Promise<Array<Record<string, unknown>>> {
  const tableName = quoteIdentifier(definition.name);
  const conditions = definition.columns.map((column) => {
    const name = quoteIdentifier(column.name);
    const supported = bookkeepingDatasetColumnSqlType(column.kind) === 'INTEGER'
      ? `(typeof(${name}) = 'integer' AND ${name} BETWEEN -${MAX_SAFE_INTEGER_SQL} AND ${MAX_SAFE_INTEGER_SQL})`
      : `typeof(${name}) = 'text'`;
    return column.nullable ? `(typeof(${name}) = 'null' OR ${supported})` : supported;
  });
  const unsupported = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE NOT (${conditions.join(' AND ')})`,
  );
  if (unsupported?.count !== 0) {
    throw structureError(`Table ${definition.name} contains values with an unsupported storage type.`);
  }
  return await database.getAllAsync<Record<string, unknown>>(
    `SELECT ${definition.columns.map((column) => quoteIdentifier(column.name)).join(', ')} FROM ${tableName}`,
  );
}

async function readDataset(database: BookkeepingSqlDatabase, allowExcludedTables: boolean): Promise<BookkeepingDatasetSnapshot> {
  const schemaVersion = await readSchemaVersion(database);
  await assertSupportedStructure(database, allowExcludedTables);
  const rowsByTable = new Map<string, Array<Record<string, unknown>>>();
  for (const definition of BOOKKEEPING_DATASET_TABLES) {
    rowsByTable.set(definition.name, await readTableRows(database, definition));
  }
  return buildBookkeepingDatasetSnapshot(schemaVersion, rowsByTable);
}

const ROLLBACK_CLEANUP_FAILURE_MESSAGE = 'Rollback cleanup failed.';

function createRollbackCleanupError(cleanupError: unknown, operationError: unknown): Error {
  const wrapper = new Error(ROLLBACK_CLEANUP_FAILURE_MESSAGE);
  Object.defineProperty(wrapper, 'cleanupError', {
    value: cleanupError,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(wrapper, 'originalError', {
    value: operationError,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(wrapper, 'cause', {
    value: operationError,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return wrapper;
}

/**
 * Executes an operation inside a read-only transaction (BEGIN IMMEDIATE) and
 * always concludes with ROLLBACK to ensure zero persistence.
 *
 * If rollback cleanup fails, the rejection is propagated so callers never
 * mistake a failed cleanup for success. If rollback fails while unwinding an
 * earlier operation error, both failures are preserved in a wrapper with a
 * fixed contextual message, non-enumerable references to the rollback failure
 * on `.cleanupError` and the earlier operation error on `.originalError` (and
 * `.cause`), without copying arbitrary properties or leaking record values.
 * If the operation fails and rollback succeeds, the operation's rejection is
 * preserved exactly (including undefined). The caller owns the connection: if
 * cleanup fails, the caller must close or discard the unusable connection.
 */
async function inReadOnlyTransaction<T>(database: BookkeepingSqlDatabase, operation: () => Promise<T>): Promise<T> {
  await database.execAsync('BEGIN IMMEDIATE;');
  let operationFailed = false;
  let operationError: unknown;
  let result: T | undefined;
  try {
    result = await operation();
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }

  try {
    await database.execAsync('ROLLBACK;');
  } catch (cleanupError) {
    if (operationFailed) {
      throw createRollbackCleanupError(cleanupError, operationError);
    }
    throw cleanupError;
  }

  if (operationFailed) {
    throw operationError;
  }

  return result as T;
}

async function assertDatabaseChecks(database: BookkeepingSqlDatabase): Promise<void> {
  const violations = await database.getAllAsync<{ table: string }>('PRAGMA foreign_key_check');
  if (violations.length > 0) throw verificationError('The database contains invalid record references.');
  const integrity = await database.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw verificationError('The database failed the SQLite integrity check.');
  }
}

async function assertMatchesExpected(
  database: BookkeepingSqlDatabase,
  expected: BookkeepingDatasetSnapshot,
  allowExcludedTables: boolean,
): Promise<void> {
  await assertDatabaseChecks(database);
  const actual = await readDataset(database, allowExcludedTables);
  const differences = compareBookkeepingDatasets(expected, actual);
  if (differences.length > 0) {
    const tables = [...new Set(differences.map((difference) => difference.table))].join(', ');
    throw verificationError(`The database does not match the expected bookkeeping dataset (tables: ${tables}).`);
  }
}

/**
 * Captures every supported bookkeeping row in one consistent transaction.
 * The source is never migrated or modified. An unknown or newer schema, an
 * unknown table/column/view/trigger, an unsupported value shape, a duplicate
 * key or a dangling reference rejects the export; nothing is silently omitted.
 *
 * Operates inside a read-only transaction ending in ROLLBACK. If rollback
 * cleanup fails, the call rejects with the cleanup error. The caller owns the
 * database connection and must close/discard any connection whose cleanup failed.
 */
export async function exportBookkeepingDataset(database: BookkeepingSqlDatabase): Promise<BookkeepingDatasetSnapshot> {
  return await inReadOnlyTransaction(database, () => readDataset(database, true));
}

/**
 * Re-reads a database inside a read-only transaction and proves foreign keys,
 * SQLite integrity, and complete row/count equality with `expected`.
 *
 * Concludes with ROLLBACK. If rollback cleanup fails, the call rejects with the
 * cleanup error. The caller owns the database connection and must close/discard
 * any connection whose cleanup failed.
 */
export async function verifyBookkeepingDatasetInDatabase(database: BookkeepingSqlDatabase, expected: unknown): Promise<void> {
  const snapshot = validateBookkeepingDatasetSnapshot(expected);
  await inReadOnlyTransaction(database, () => assertMatchesExpected(database, snapshot, true));
}

async function assertEmptyDestination(database: BookkeepingSqlDatabase): Promise<void> {
  if ((await listUserObjects(database)).length > 0) {
    throw new BookkeepingDatasetError(
      'nonempty-destination',
      'The destination database is not empty. A bookkeeping dataset can only be imported into an empty candidate database.',
    );
  }
}

/** Only called for a destination this import found empty, so every table here was created by it. */
async function returnDestinationToEmpty(database: BookkeepingSqlDatabase): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    const created = [...BOOKKEEPING_DATASET_TABLES.map((entry) => entry.name).reverse(), BOOKKEEPING_SCHEMA_METADATA_TABLE];
    for (const name of created) await database.execAsync(`DROP TABLE IF EXISTS ${quoteIdentifier(name)};`);
    await assertEmptyDestination(database);
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}

async function insertAndVerify(database: BookkeepingSqlDatabase, snapshot: BookkeepingDatasetSnapshot): Promise<void> {
  await readSchemaVersion(database);
  await assertSupportedStructure(database, false);
  for (const definition of BOOKKEEPING_DATASET_TABLES) {
    const existing = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(definition.name)}`,
    );
    if (existing?.count !== 0) throw verificationError(`Candidate table ${definition.name} was not empty before import.`);
  }
  // Rows are inserted parents-first; deferral additionally lets a row reference
  // a later row of its own table. Every reference is still enforced at COMMIT.
  await database.execAsync('PRAGMA defer_foreign_keys = ON;');
  for (const [index, definition] of BOOKKEEPING_DATASET_TABLES.entries()) {
    const columns = definition.columns.map((column) => quoteIdentifier(column.name));
    const statement = `INSERT INTO ${quoteIdentifier(definition.name)} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
    for (const row of snapshot.tables[index].rows) {
      const result = await database.runAsync(statement, ...row);
      if (result.changes !== 1) throw verificationError(`A ${definition.name} row was not written exactly once.`);
    }
  }
  await assertMatchesExpected(database, snapshot, false);
}

/**
 * Restores a dataset into an isolated, EMPTY candidate database.
 *
 * The payload is strictly validated before the database is touched. A
 * destination containing any table, index, view or trigger is rejected
 * unchanged. The supported schema is created with the existing schema
 * function, rows are written with parameterized statements in one
 * transaction, and foreign keys, SQLite integrity and complete row/count
 * equality are proven before COMMIT. On any failure the transaction is rolled
 * back and the schema this call created is removed, leaving the candidate
 * empty. This function never activates the candidate.
 */
export async function importBookkeepingDatasetIntoEmptyDatabase(
  database: BookkeepingSqlDatabase,
  input: unknown,
): Promise<BookkeepingDatasetImportResult> {
  const snapshot = validateBookkeepingDatasetSnapshot(input);
  await assertEmptyDestination(database);
  try {
    await ensureBookkeepingSchema(database);
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await insertAndVerify(database, snapshot);
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  } catch (error) {
    try {
      await returnDestinationToEmpty(database);
    } catch {
      const failure = new BookkeepingDatasetError(
        'destination-cleanup-failed',
        'The import failed and the candidate database could not be returned to empty. Discard the candidate; it must not be activated.',
      );
      Object.defineProperty(failure, 'originalError', { value: error, enumerable: false });
      (failure as { cause?: unknown }).cause = error;
      throw failure;
    }
    throw error;
  }
  const tableRowCounts: Record<string, number> = {};
  let totalRowCount = 0;
  for (const entry of snapshot.tables) {
    tableRowCounts[entry.name] = entry.rowCount;
    totalRowCount += entry.rowCount;
  }
  return { schemaVersion: snapshot.schemaVersion, tableRowCounts, totalRowCount };
}
