# Bookkeeping Dataset Coverage & Schema-13 Contract Specification

- Status: **Complete for RECOVERY-001 (Host SQLite Synthetic Validation Only)**
- Milestone / Capability: **CAP-BOOK-RECOVERY-001 — Complete Bookkeeping Recovery**
- Authorization: **Owner authorization 2026-11-16 (`docs/recovery/AUTHORIZATION-20261116.md`)**
Source Modules:
- Contract, Inventory & Validation: [`packages/backup/src/bookkeeping-dataset.ts`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/backup/src/bookkeeping-dataset.ts)
- SQL Export & Isolated Import: [`packages/backup/src/bookkeeping-snapshot.ts`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/backup/src/bookkeeping-snapshot.ts)
- File-Backed Test Suite: [`packages/backup/test/bookkeeping-snapshot.test.mjs`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/backup/test/bookkeeping-snapshot.test.mjs)

---

## 1. Scope, Status & Governance Boundaries

This document defines the exact scope, schema-13 inventory, serialization format, and execution limits of the lossless bookkeeping dataset snapshot and isolated SQL restore engine delivered under Story **RECOVERY-001**.

### Evidence Boundaries & Unverified Gates
- **Host Evidence Only**: Current validation runs against real, file-backed SQLite databases via the Node `DatabaseSync` adapter in [`packages/backup/test/bookkeeping-snapshot.test.mjs`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/backup/test/bookkeeping-snapshot.test.mjs). This certifies SQL query logic, schema consistency, foreign key enforcement, and deterministic serialization on host runtimes.
- **No Native Certification**: Host tests **do not** certify native SQLCipher encryption, iOS Keychain or Android Keystore integration, OS-level crash durability, power-loss resilience, or physical-device recovery.
- **Subsequent Story Gates**:
  - **RECOVERY-002**: Passphrase-authenticated payload encryption, envelope generation, and tamper/truncation rejection.
  - **RECOVERY-003**: Isolated restore orchestration, accounting report parity verification (balance sheet, cash basis, general ledger), migration handling, and native storage integration.
- **No Production or Real Financial Use**: All data exercised is synthetic. Real financial records, actual banking feeds, and production deployment remain strictly barred pending full gate completion.
- **No Independent Acceptance Claimed**: Independent bookkeeping review, CPA verification, and product owner acceptance remain distinct external gates.
- **Visual & UI Immutability**: All 64 owner change receipts and UI baselines remain preserved and unchanged. This milestone is strictly non-UI.

---

## 2. Schema & Versioning Policy

The bookkeeping dataset payload format is strictly versioned and immutable:
- **Format Identifier**: `llc-bookkeeping-dataset` (`BOOKKEEPING_DATASET_FORMAT`)
- **Format Version**: `1` (`BOOKKEEPING_DATASET_FORMAT_VERSION`)
- **Supported Accounting Schema Version**: Exactly `13` (`BOOKKEEPING_DATASET_SCHEMA_VERSION`)

### Fail-Closed Version Rules
1. **Newer Schema Versions (`> 13`)**: Rejected immediately with error code `newer-schema-version`. The engine will never attempt forward compatibility on unknown schemas.
2. **Older Schema Versions (`< 13`)**: Rejected with error code `unsupported-schema-version`. Snapshot export **never migrates or writes** to the source database. Migration is an explicit storage-layer operation.
3. **Format Mismatches**: Payloads with unexpected `format` or `formatVersion` are rejected with `unsupported-format-version` or `malformed-snapshot`.
4. **Non-Destructive Guarantee**: Export operates inside a read-only transaction (`BEGIN IMMEDIATE` ending in `ROLLBACK`), blocking concurrent writers while ensuring zero writes, zero schema alterations, and zero side effects on the source database.

---

## 3. Complete Schema-13 Table & Column Inventory

The inventory covers every table, column, data kind, and foreign key created by `ensureBookkeepingSchema` and migrations V1 through V13 in [`packages/storage-native/src/bookkeeping-store.ts`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/storage-native/src/bookkeeping-store.ts).

Tables are ordered in **foreign-key-safe dependency sequence** (parent records are guaranteed to be exported and restored before any referencing child records).

### Summary Table

| Sequence | Table Name | Primary Key | Key Foreign References | Domain Purpose |
| :--- | :--- | :--- | :--- | :--- |
| *Metadata* | `bookkeeping_schema` | `singleton` | None | Tracks accounting schema version (13). Carried in payload header. |
| 1 | `businesses` | `id` | None | Legal LLC entities / multi-tenant workspaces. |
| 2 | `members` | `id` | `business_id` -> `businesses` | LLC members and retirement tracking. |
| 3 | `member_interest_history` | `id` | `business_id`, `member_id` | Historical ownership percentages (basis points) over time. |
| 4 | `accounts` | `id` | `business_id` | Chart of accounts (assets, liabilities, equity, income, expense). |
| 5 | `journal_entries` | `id` | `business_id` | Double-entry journal entry headers with entry types. |
| 6 | `journal_lines` | `id` | `journal_entry_id`, `account_id` | Balanced debit/credit lines in integer cents (minor units). |
| 7 | `transactions` | `id` | `business_id`, `journal_entry_id`, `account_id`, `category_account_id` | Cash/bank transactions mapped to double-entry journals. |
| 8 | `transaction_corrections` | `id` | `business_id`, `original_transaction_id`, `reversal_transaction_id`, `replacement_transaction_id` | Immutable correction chains preserving original, reversal, and replacement. |
| 9 | `transaction_correction_roles` | `transaction_id` | `transaction_id`, `correction_id` | Transaction role tagging (`reversal` or `replacement`). |
| 10 | `transaction_splits` | `(transaction_id, line_number)` | `transaction_id`, `category_account_id` | Multi-category expense or income splits for a single transaction. |
| 11 | `member_capital_activity` | `id` | `business_id`, `member_id`, `journal_entry_id`, `cash_account_id`, `property_asset_account_id` | Capital contributions (cash/property) and member distributions; CPA review flags. |
| 12 | `guaranteed_payment_obligations` | `id` | `business_id`, `member_id` | Contractual member guaranteed payment agreements and recurrence schedules. |
| 13 | `guaranteed_payment_installments` | `id` | `obligation_id` | Scheduled installment amounts and due dates. |
| 14 | `guaranteed_payment_payments` | `id` | `business_id`, `member_id`, `transaction_id`, `cash_account_id` | Executed cash disbursements for guaranteed payments. |
| 15 | `guaranteed_payment_allocations` | `(payment_id, installment_id)` | `payment_id`, `installment_id` | Settlement allocation linking cash payments to installments. |
| 16 | `guaranteed_payment_reversals` | `id` | `payment_id`, `reversal_transaction_id`, `reversal_journal_entry_id`, `return_cash_account_id` | Formal reversal records restoring unpaid installment obligations. |
| 17 | `loan_agreements` | `id` | `business_id`, `member_id`, `liability_account_id` | Promissory notes (member or 3rd-party) with commitment, rate, and day-count. |
| 18 | `loan_advances` | `id` | `loan_id`, `transaction_id`, `journal_entry_id`, `cash_account_id` | Cash draws against established loan commitments. |
| 19 | `loan_repayments` | `id` | `loan_id`, `transaction_id`, `journal_entry_id`, `cash_account_id` | Loan repayments split into principal and interest minor units. |
| 20 | `recurring_transaction_templates` | `id` | `business_id`, `account_id`, `category_account_id` | Scheduled templates with cadence (weekly, monthly, quarterly, yearly). |
| 21 | `recurring_transaction_occurrences` | `id` | `template_id`, `transaction_id` | History of generated transactions posted from recurring templates. |
| 22 | `account_reconciliations` | `id` | `business_id`, `account_id` | Monthly bank reconciliation statements, beginning/ending balances, status. |
| 23 | `account_reconciliation_items` | `(reconciliation_id, transaction_id)` | `reconciliation_id`, `transaction_id` | Reconciled/cleared transaction associations. |
| 24 | `account_reconciliation_events` | `id` | `reconciliation_id`, `transaction_id` | Audit event history for reconciliation lifecycle. |
| 25 | `accounting_period_events` | `id` | `business_id`, `target_close_event_id` | Period closing and reopening events with self-referential reopening links. |
| 26 | `bookkeeping_reminders` | `id` | `business_id` | Task reminders, due dates, and completion timestamps. |
| 27 | `bookkeeping_preferences` | `preference_key` | `preference_value` -> `businesses` | Global app preferences (e.g. `active_business_id`). |

### Column Details & Type Representations

To ensure lossless portability across platforms and runtimes, column values map strictly to the following primitive representations:
- **`id` (TEXT)**: Non-empty ASCII/UTF-8 string identifier. Cannot be null; cannot contain NUL bytes or lone surrogate characters.
- **`text` (TEXT)**: Portable UTF-8 string. May be empty; nullable where specified by schema.
- **`date` (TEXT)**: Strict calendar date formatted `YYYY-MM-DD`. Validated for real calendar existence (e.g., February 30th is rejected).
- **`timestamp` (TEXT)**: ISO 8601 UTC date-time string (e.g. `2024-06-01T12:00:00.000Z`).
- **`minor` (TEXT)**: Canonical base-10 integer string representing currency in minor units (cents). Encoded as a JSON string to avoid IEEE 754 precision loss beyond $2^{53}-1$. Rejects decimals, exponents, leading plus signs, leading zeros, and negative zero (`-0`). Negative balances (e.g., overdraft reconciliation balances) are fully supported.
- **`integer` (INTEGER)**: Exact JavaScript safe integer (`-9007199254740991` to `9007199254740991`). Rejects floating-point values or values outside safe limits.
- **`flag` (INTEGER)**: Strict integer `0` or `1`. Booleans (`true`/`false`) and arbitrary integers are rejected.

---

## 4. Strict Portable Payload & Canonical Serialization

The snapshot is serialized to a deterministic canonical format:
```json
{
  "format": "llc-bookkeeping-dataset",
  "formatVersion": 1,
  "schemaVersion": 13,
  "tables": [
    {
      "name": "businesses",
      "columns": ["id", "name", "formation_state", "formation_date", "bookkeeping_start_date", "currency", "created_at"],
      "rowCount": 2,
      "rows": [
        ["business-1", "Northstar Studio LLC", "AZ", "2024-03-01", "2024-01-01", "USD", "2024-06-01T12:00:00.000Z"],
        ["business-2", "Harbor Single LLC", "CA", "2023-05-01", "2023-05-01", "USD", "2024-06-01T12:00:00.000Z"]
      ]
    }
  ]
}
```

### Determinism & Canonical JSON Rules
1. **Fixed Ordering**: Table array order follows `BOOKKEEPING_DATASET_TABLES` exactly. Columns within each table follow defined inventory order. Rows within each table are sorted strictly ascending by primary key.
2. **One Encoding**: Only the exact canonical JSON string that re-parses and re-serializes identically is accepted by `parseBookkeepingDataset`. Extra whitespace, trailing newlines, reordered object keys, and duplicate keys are rejected.
3. **Privacy-Preserving Logs & Errors**: Error messages never embed row values or financial amounts. They identify table name, column name, row index, and structural error code only (e.g., `Table transactions row 0 column amount_minor has an unsupported value.`).

---

## 5. SQL Boundary & Execution Safeguards

Export and import operations in [`packages/backup/src/bookkeeping-snapshot.ts`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/backup/src/bookkeeping-snapshot.ts) implement defense-in-depth SQL protections:

### Export Safeguards
- **Caller Serialization Lock**: Callers must hold connection-level serialization lock during export; statements from other tasks cannot interleave.
- **Read-Only Immediate Transaction**: Begins with `BEGIN IMMEDIATE;` to acquire an exclusive write lock on SQLite, preventing concurrent writes from other processes. Always finishes with `ROLLBACK;`.
- **Source Immutability**: Source is never altered, dropped, or migrated.
- **Structural Introspection**: Verifies schema version in `bookkeeping_schema`, audits `sqlite_master` for unlisted tables, checks `PRAGMA table_xinfo` for column counts, names, declared types, and primary key positions, and asserts the absence of unexpected views, triggers, and unknown tables.
- **Storage Class Verification**: Uses SQL `typeof()` queries to prove all values match expected SQLite storage classes (no `blob`, no `real`, no out-of-range integer).

### Import Safeguards
- **Empty Destination Enforced**: Destination SQLite file must contain zero user tables, views, triggers, or indexes. Any existing user objects trigger `nonempty-destination` error immediately without modifying the database.
- **Schema Creation via Canonical Function**: Schema is created from scratch using `ensureBookkeepingSchema`, ensuring indexes, check constraints, default values, and foreign keys are canonical.
- **Parameterized Inserts in FK-Safe Sequence**: All rows are inserted using parameterized SQL statements (`INSERT INTO "table" (...) VALUES (?, ...)`). No string interpolation or raw DDL execution is permitted.
- **Self-Reference Deferral**: Executes `PRAGMA defer_foreign_keys = ON;` inside the transaction to allow self-referential tables (such as `accounting_period_events` where a reopening event may sort before its target close event) while guaranteeing 100% foreign key enforcement at `COMMIT`.
- **Pre-Commit Verification**:
  - `PRAGMA foreign_key_check` must return 0 violations.
  - `PRAGMA integrity_check` must return `ok`.
  - Re-read dataset snapshot must match input snapshot row-for-row and count-for-count via `compareBookkeepingDatasets`.
- **Clean Cleanup on Error**: Any insert or verification failure initiates an immediate `ROLLBACK;` and invokes `returnDestinationToEmpty`, dropping all created tables to restore the database to an empty state. If cleanup fails, `destination-cleanup-failed` is thrown, warning callers never to activate the candidate database.
- **No Activation**: The import function only populates a candidate database; it never activates the database or swaps pointers.

---

## 6. Documented Exclusions & Proof Utility Separation

To maintain strict boundaries between bookkeeping data and test/storage utilities:
1. **Excluded Proof Tables**:
   - `proof_records`: Test fixture table used by storage PoCs for synthetic attachments.
   - `restore_manifest`: Utility table used by legacy restore coordinators.
   These two tables are recognized by `BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES` and are intentionally ignored during export without failing the export, but their contents are **never** exported into the bookkeeping dataset payload.
2. **Unknown Tables Fail Closed**: Any other table in `sqlite_master` not in the 27 bookkeeping tables, the metadata table, or the 2 excluded proof tables causes an immediate `unsupported-source-structure` error.
3. **Exclusion of System Data**:
   - Device encryption keys and Keychain secrets are never stored in SQLite or serialized in payloads.
   - Raw `sqlite_master` SQL definitions are never serialized or executed.

---

## 7. Unsupported External Data & Absence of Receipt Storage

The boundary between bookkeeping records and external file attachments is explicitly defined:
- **No Receipt Storage in Schema 13**:
  - Schema 13 does not define any receipt attachment tables, receipt blobs, image binary stores, or document management columns.
  - Receipts, invoices, scans, PDF files, and image attachments **do not exist** in the SQLite database and are **not** part of this dataset contract.
- **Fail-Closed on Attachment Tables**:
  - If an unapproved receipt table (e.g. `receipt_attachments`, `receipt_files`) is added to the database, export will fail closed with `unsupported-source-structure`.
  - If binary BLOB data is placed into text columns (e.g. `transactions.description`), export will fail closed with `unsupported-source-structure`.
- **Future Architecture Limit**:
  - Any future file-based receipt or document storage must be defined as an independent, owner-authorized layer with its own integrity, encryption, and recovery gates. It cannot be silently bundled into the bookkeeping SQL dataset.

---

## 8. Test Coverage & Validation Limits

The test suite in [`packages/backup/test/bookkeeping-snapshot.test.mjs`](file:///Users/veerrajuamanchi/amanchi-labs/LLCBookKeepingPrivate/packages/backup/test/bookkeeping-snapshot.test.mjs) validates all 66 test conditions:

### Test Suites Summary
1. **Inventory & Schema Reflection**: Validates all 27 bookkeeping tables, column types, primary keys, and foreign-key references against live SQLite tables generated by `ensureBookkeepingSchema`.
2. **Lossless Snapshot Export**: Tests a comprehensive synthetic dataset containing two workspaces, multiple members, retired member ownership history, split transactions, corrections (reversals/replacements), cash and property capital contributions, guaranteed payment obligations, installments, payments, reversals, loan agreements, advances, repayments, recurring templates, posted occurrences, negative-balance reconciliations, reconciliation event histories, period close/reopen chains, reminders, and preferences.
3. **Concurrent Writer Protection**: Verifies that concurrent write attempts while export is in progress are locked out by SQLite's transaction model.
4. **Structural & Mutation Failures (Fail-Closed)**: Verifies rejection and source preservation on:
   - Unknown tables (e.g. receipt storage).
   - Unknown columns.
   - Unsupported views or triggers.
   - Missing bookkeeping tables.
   - BLOB in text columns or REAL in integer columns.
   - Integers exceeding safe range ($> 2^{53}-1$).
   - Decimal values in minor currency units.
   - Invalid calendar dates (e.g. 2024-02-30).
   - Dangling foreign key references.
   - Newer schema version (14) or older schema version (12).
   - Databases without bookkeeping schema.
5. **Payload Contract Validation**: Validates 40 distinct mutation scenarios, ensuring corrupted, tampered, non-canonical, or malicious payloads fail closed prior to database interaction.
6. **Isolated Candidate Import**: Tests restoring complete synthetic books into fresh empty databases, proving post-reopening parity, identical record counts, clean integrity check, zero foreign key violations, and complete double-entry journal balance parity.
7. **Destination Protections & Rollback**: Verifies rejection of non-empty destination databases, payload pre-validation before disk touches, rollback and cleanup upon constraint failures, and detection of candidate divergence.

---

## 9. Next Steps in the Recovery Milestone

With RECOVERY-001 complete, subsequent Stories build on these exposed APIs:
- **RECOVERY-002**: Encrypted backup packaging wrapping this validated payload in an authenticated envelope with key derivation and tamper resistance.
- **RECOVERY-003**: Isolated restore orchestration comparing pre/post accounting report outputs across candidate and active databases.
