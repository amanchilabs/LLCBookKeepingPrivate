# Bookkeeping Dataset Coverage & Schema-13 Contract Specification

- Status: **Builder-delivered for RECOVERY-001; coordinator validation and independent review pending; host SQLite synthetic evidence only**
- Milestone / Capability: **CAP-BOOK-RECOVERY-001 — Complete Bookkeeping Recovery**
- Authorization: **Owner authorization 2026-11-16 ([`AUTHORIZATION-20261116.md`](AUTHORIZATION-20261116.md))**
- Implementation Plan: **[`IMPLEMENTATION-PLAN-20261116.md`](IMPLEMENTATION-PLAN-20261116.md)**
- Milestone Status: **[`STATUS-20261116.md`](STATUS-20261116.md)**
- Source Modules:
  - Contract, Inventory & Validation: [`packages/backup/src/bookkeeping-dataset.ts`](../../packages/backup/src/bookkeeping-dataset.ts)
  - SQL Export & Isolated Import: [`packages/backup/src/bookkeeping-snapshot.ts`](../../packages/backup/src/bookkeeping-snapshot.ts)
  - File-Backed Test Suite: [`packages/backup/test/bookkeeping-snapshot.test.mjs`](../../packages/backup/test/bookkeeping-snapshot.test.mjs)

---

## 1. Scope, Status & Governance Boundaries

This document defines the exact scope, schema-13 inventory, serialization format, and execution limits of the lossless bookkeeping dataset snapshot and isolated SQL restore engine delivered under Story **RECOVERY-001**.

### Evidence Boundaries & Unverified Gates
- **Host Evidence Only**: Current validation runs against real, file-backed SQLite databases via the Node `DatabaseSync` adapter in [`packages/backup/test/bookkeeping-snapshot.test.mjs`](../../packages/backup/test/bookkeeping-snapshot.test.mjs). This exercises SQL query logic, schema consistency, foreign key enforcement, and deterministic serialization on host runtimes.
- **No Native Certification**: Host tests **do not** certify native SQLCipher encryption, iOS Keychain or Android Keystore integration, OS-level crash durability, power-loss resilience, or physical-device recovery.
- **Subsequent Story Gates**:
  - **RECOVERY-002**: Passphrase-authenticated payload encryption, envelope generation, and tamper/truncation rejection.
  - **RECOVERY-003**: Isolated restore orchestration, accounting report parity verification (balance sheet, cash basis, general ledger), migration handling, and native storage integration.
- **No Production or Real Financial Use**: All data exercised is synthetic. Real financial records and production deployment remain strictly barred pending full gate completion. Under the canonical product contract ([`CLAUDE.md`](../../CLAUDE.md)), bank connections or banking feeds are never authorized under any gate (the app is strictly local, offline, and manual entry/import only).
- **No Independent Acceptance Claimed**: Independent reviewer verification, physical-device recovery evidence, and product owner acceptance remain distinct external gates specified in [`AUTHORIZATION-20261116.md`](AUTHORIZATION-20261116.md) and [`IMPLEMENTATION-PLAN-20261116.md`](IMPLEMENTATION-PLAN-20261116.md).
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
4. **Non-Destructive Guarantee**: Export operates inside a read-only transaction (`BEGIN IMMEDIATE` ending in `ROLLBACK`), blocking concurrent write transactions while ensuring zero writes, zero schema alterations, and zero side effects on the source database. If rollback cleanup fails, the failure is rejected (never suppressed), ensuring that a broken transaction state is never reported as success.

---

## 3. Complete Schema-13 Table & Column Inventory

The inventory covers every table, column, data kind, nullability, primary key position, and foreign key reference created by `ensureBookkeepingSchema` and migrations V1 through V13 in [`packages/storage-native/src/bookkeeping-store.ts`](../../packages/storage-native/src/bookkeeping-store.ts).

The authoritative in-code definition is `BOOKKEEPING_DATASET_TABLES` in [`packages/backup/src/bookkeeping-dataset.ts`](../../packages/backup/src/bookkeeping-dataset.ts). Tables are arranged in **foreign-key-safe dependency sequence** (parent records are guaranteed to be exported and restored before any referencing child records).

### 3.1 Table Sequence & Dependency Order Summary

| Sequence | Table Name | Primary Key | Key Foreign References | Domain Purpose |
| :--- | :--- | :--- | :--- | :--- |
| *Metadata* | `bookkeeping_schema` | `singleton` | None | Tracks accounting schema version (13). Carried in payload header. |
| 1 | `businesses` | `id` | None | Legal LLC entities / multi-tenant workspaces. |
| 2 | `members` | `id` | `business_id` -> `businesses` | LLC members and retirement tracking. |
| 3 | `member_interest_history` | `id` | `business_id` -> `businesses`, `member_id` -> `members` | Historical ownership percentages (basis points) over time. |
| 4 | `accounts` | `id` | `business_id` -> `businesses` | Chart of accounts (assets, liabilities, equity, income, expense). |
| 5 | `journal_entries` | `id` | `business_id` -> `businesses` | Double-entry journal entry headers with entry types. |
| 6 | `journal_lines` | `id` | `journal_entry_id` -> `journal_entries`, `account_id` -> `accounts` | Balanced debit/credit lines in integer cents (minor units). |
| 7 | `transactions` | `id` | `business_id` -> `businesses`, `journal_entry_id` -> `journal_entries`, `account_id` -> `accounts`, `category_account_id` -> `accounts` | Cash/bank transactions mapped to double-entry journals. |
| 8 | `transaction_corrections` | `id` | `business_id` -> `businesses`, `original_transaction_id` -> `transactions`, `reversal_transaction_id` -> `transactions`, `replacement_transaction_id` -> `transactions` | Immutable correction chains preserving original, reversal, and replacement. |
| 9 | `transaction_correction_roles` | `transaction_id` | `transaction_id` -> `transactions`, `correction_id` -> `transaction_corrections` | Transaction role tagging (`reversal` or `replacement`). |
| 10 | `transaction_splits` | `(transaction_id, line_number)` | `transaction_id` -> `transactions`, `category_account_id` -> `accounts` | Multi-category expense or income splits for a single transaction. |
| 11 | `member_capital_activity` | `id` | `business_id` -> `businesses`, `member_id` -> `members`, `journal_entry_id` -> `journal_entries`, `cash_account_id` -> `accounts`, `property_asset_account_id` -> `accounts` | Capital contributions (cash/property) and member distributions; CPA review flags. |
| 12 | `guaranteed_payment_obligations` | `id` | `business_id` -> `businesses`, `member_id` -> `members` | Contractual member guaranteed payment agreements and recurrence schedules. |
| 13 | `guaranteed_payment_installments` | `id` | `obligation_id` -> `guaranteed_payment_obligations` | Scheduled installment amounts and due dates. |
| 14 | `guaranteed_payment_payments` | `id` | `business_id` -> `businesses`, `member_id` -> `members`, `transaction_id` -> `transactions`, `cash_account_id` -> `accounts` | Executed cash disbursements for guaranteed payments. |
| 15 | `guaranteed_payment_allocations` | `(payment_id, installment_id)` | `payment_id` -> `guaranteed_payment_payments`, `installment_id` -> `guaranteed_payment_installments` | Settlement allocation linking cash payments to installments. |
| 16 | `guaranteed_payment_reversals` | `id` | `payment_id` -> `guaranteed_payment_payments`, `reversal_transaction_id` -> `transactions`, `reversal_journal_entry_id` -> `journal_entries`, `return_cash_account_id` -> `accounts` | Formal reversal records restoring unpaid installment obligations. |
| 17 | `loan_agreements` | `id` | `business_id` -> `businesses`, `member_id` -> `members`, `liability_account_id` -> `accounts` | Promissory notes (member or 3rd-party) with commitment, rate, and day-count. |
| 18 | `loan_advances` | `id` | `loan_id` -> `loan_agreements`, `transaction_id` -> `transactions`, `journal_entry_id` -> `journal_entries`, `cash_account_id` -> `accounts` | Cash draws against established loan commitments. |
| 19 | `loan_repayments` | `id` | `loan_id` -> `loan_agreements`, `transaction_id` -> `transactions`, `journal_entry_id` -> `journal_entries`, `cash_account_id` -> `accounts` | Loan repayments split into principal and interest minor units. |
| 20 | `recurring_transaction_templates` | `id` | `business_id` -> `businesses`, `account_id` -> `accounts`, `category_account_id` -> `accounts` | Scheduled templates with cadence (weekly, monthly, quarterly, yearly). |
| 21 | `recurring_transaction_occurrences` | `id` | `template_id` -> `recurring_transaction_templates`, `transaction_id` -> `transactions` | History of generated transactions posted from recurring templates. |
| 22 | `account_reconciliations` | `id` | `business_id` -> `businesses`, `account_id` -> `accounts` | Monthly bank reconciliation statements, beginning/ending balances, status. |
| 23 | `account_reconciliation_items` | `(reconciliation_id, transaction_id)` | `reconciliation_id` -> `account_reconciliations`, `transaction_id` -> `transactions` | Reconciled/cleared transaction associations. |
| 24 | `account_reconciliation_events` | `id` | `reconciliation_id` -> `account_reconciliations`, `transaction_id` -> `transactions` | Audit event history for reconciliation lifecycle. |
| 25 | `accounting_period_events` | `id` | `business_id` -> `businesses`, `target_close_event_id` -> `accounting_period_events` | Period closing and reopening events with self-referential reopening links. |
| 26 | `bookkeeping_reminders` | `id` | `business_id` -> `businesses` | Task reminders, due dates, and completion timestamps. |
| 27 | `bookkeeping_preferences` | `preference_key` | `preference_value` -> `businesses` | Global app preferences (e.g. `active_business_id`). |

---

### 3.2 Per-Table Column Inventory

The following tables enumerate every supported column for all 27 dataset tables in exact `BOOKKEEPING_DATASET_TABLES` sequence, plus the schema metadata table:

#### Metadata: `bookkeeping_schema`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `singleton` | `integer` | No | 1 | None | Table singleton key (`CHECK (singleton = 1)`) |
| `version` | `integer` | No | 0 | None | Schema version (must equal 13; carried in snapshot header) |

#### Table 1: `businesses`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique business identifier |
| `name` | `text` | No | 0 | None | Legal business name |
| `formation_state` | `text` | No | 0 | None | Two-letter state postal abbreviation |
| `formation_date` | `date` | No | 0 | None | State formation date (`YYYY-MM-DD`) |
| `bookkeeping_start_date` | `date` | No | 0 | None | Books start date (`YYYY-MM-DD`) |
| `currency` | `text` | No | 0 | None | Three-letter currency code (e.g. `USD`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 2: `members`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique member identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `name` | `text` | No | 0 | None | Member legal name |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |
| `retired_at` | `timestamp` | Yes | 0 | None | Member retirement timestamp (nullable) |

#### Table 3: `member_interest_history`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique interest record identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `member_id` | `id` | No | 0 | `members` | Referencing member |
| `ownership_basis_points` | `integer` | No | 0 | None | Ownership percentage in basis points (10000 = 100%) |
| `effective_from` | `date` | No | 0 | None | Start date of ownership tier (`YYYY-MM-DD`) |
| `effective_to` | `date` | Yes | 0 | None | End date of ownership tier (`YYYY-MM-DD`, nullable) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 4: `accounts`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique account identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `code` | `text` | No | 0 | None | Chart of accounts code (e.g. `1000`) |
| `name` | `text` | No | 0 | None | Account display name |
| `kind` | `text` | No | 0 | None | Account kind (`asset`, `liability`, `equity`, `income`, `expense`) |
| `category` | `text` | No | 0 | None | Detailed subcategory |
| `is_system` | `flag` | No | 0 | None | System account indicator (`0` or `1`) |
| `is_active` | `flag` | No | 0 | None | Active status flag (`0` or `1`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 5: `journal_entries`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique journal entry identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `entry_date` | `date` | No | 0 | None | Accounting entry date (`YYYY-MM-DD`) |
| `entry_type` | `text` | No | 0 | None | Entry classification type |
| `description` | `text` | No | 0 | None | Memo or entry description |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 6: `journal_lines`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique line item identifier |
| `journal_entry_id` | `id` | No | 0 | `journal_entries` | Parent journal entry |
| `account_id` | `id` | No | 0 | `accounts` | Chart of accounts posting target |
| `line_number` | `integer` | No | 0 | None | Zero- or one-based line sequence within entry |
| `debit_minor` | `minor` | No | 0 | None | Debit amount in cents (base-10 string) |
| `credit_minor` | `minor` | No | 0 | None | Credit amount in cents (base-10 string) |

#### Table 7: `transactions`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique transaction identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `journal_entry_id` | `id` | No | 0 | `journal_entries` | Linked double-entry journal entry |
| `entry_date` | `date` | No | 0 | None | Transaction posting date (`YYYY-MM-DD`) |
| `kind` | `text` | No | 0 | None | Transaction kind (`income`, `expense`, `transfer`, etc.) |
| `account_id` | `id` | No | 0 | `accounts` | Primary cash/bank account |
| `category_account_id` | `id` | No | 0 | `accounts` | Counterpart category/offset account |
| `amount_minor` | `minor` | No | 0 | None | Total transaction amount in cents |
| `description` | `text` | No | 0 | None | Payee, vendor, or memo text |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 8: `transaction_corrections`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique correction chain identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `original_transaction_id` | `id` | No | 0 | `transactions` | Superseded original transaction |
| `reversal_transaction_id` | `id` | No | 0 | `transactions` | Linked reversing transaction |
| `replacement_transaction_id` | `id` | No | 0 | `transactions` | Linked replacement transaction |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 9: `transaction_correction_roles`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `transaction_id` | `id` | No | 1 | `transactions` | Corrected or role-tagged transaction |
| `correction_id` | `id` | No | 0 | `transaction_corrections` | Parent correction record |
| `role` | `text` | No | 0 | None | Correction role (`reversal` or `replacement`) |

#### Table 10: `transaction_splits`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `transaction_id` | `id` | No | 1 | `transactions` | Parent transaction identifier (composite PK part 1) |
| `line_number` | `integer` | No | 2 | None | Line sequence index (composite PK part 2) |
| `category_account_id` | `id` | No | 0 | `accounts` | Category account for this split line |
| `amount_minor` | `minor` | No | 0 | None | Split line amount in cents |

#### Table 11: `member_capital_activity`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique activity record identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `member_id` | `id` | No | 0 | `members` | Member associated with capital movement |
| `journal_entry_id` | `id` | No | 0 | `journal_entries` | Associated double-entry journal entry |
| `activity_date` | `date` | No | 0 | None | Date of capital event (`YYYY-MM-DD`) |
| `activity_kind` | `text` | No | 0 | None | Event kind (`contribution_cash`, `contribution_property`, `distribution`) |
| `amount_minor` | `minor` | No | 0 | None | Capital event value in cents |
| `cash_account_id` | `id` | Yes | 0 | `accounts` | Source/destination cash account (nullable for property) |
| `property_asset_account_id` | `id` | Yes | 0 | `accounts` | Asset account for property contribution (nullable for cash) |
| `property_description` | `text` | Yes | 0 | None | Description of contributed property (nullable) |
| `description` | `text` | No | 0 | None | Memo or activity explanation |
| `requires_cpa_review` | `flag` | No | 0 | None | Audit flag for tax/workpaper review (`0` or `1`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 12: `guaranteed_payment_obligations`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique obligation agreement identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `member_id` | `id` | No | 0 | `members` | Entitled partner/member |
| `classification` | `text` | No | 0 | None | Service classification |
| `recurrence` | `text` | No | 0 | None | Recurrence cadence (e.g. `monthly`) |
| `first_due_date` | `date` | No | 0 | None | Initial installment due date (`YYYY-MM-DD`) |
| `installment_count` | `integer` | No | 0 | None | Total scheduled installment count |
| `installment_amount_minor` | `minor` | No | 0 | None | Per-installment payment obligation in cents |
| `description` | `text` | No | 0 | None | Agreement summary or memo |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 13: `guaranteed_payment_installments`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique installment identifier |
| `obligation_id` | `id` | No | 0 | `guaranteed_payment_obligations` | Parent contractual obligation |
| `due_date` | `date` | No | 0 | None | Scheduled due date (`YYYY-MM-DD`) |
| `amount_minor` | `minor` | No | 0 | None | Scheduled installment amount in cents |
| `installment_number` | `integer` | No | 0 | None | Sequential installment number |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 14: `guaranteed_payment_payments`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique payment disbursement identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `member_id` | `id` | No | 0 | `members` | Payee partner/member |
| `classification` | `text` | No | 0 | None | Service classification |
| `transaction_id` | `id` | No | 0 | `transactions` | Linked cash disbursement transaction |
| `payment_date` | `date` | No | 0 | None | Disbursement date (`YYYY-MM-DD`) |
| `cash_account_id` | `id` | No | 0 | `accounts` | Disbursing cash/bank account |
| `amount_minor` | `minor` | No | 0 | None | Payment amount disbursed in cents |
| `description` | `text` | No | 0 | None | Payment description or memo |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 15: `guaranteed_payment_allocations`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `payment_id` | `id` | No | 1 | `guaranteed_payment_payments` | Disbursed payment (composite PK part 1) |
| `installment_id` | `id` | No | 2 | `guaranteed_payment_installments` | Satisfied installment (composite PK part 2) |
| `amount_minor` | `minor` | No | 0 | None | Allocated settlement portion in cents |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 16: `guaranteed_payment_reversals`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique reversal record identifier |
| `payment_id` | `id` | No | 0 | `guaranteed_payment_payments` | Reversal target payment |
| `reversal_transaction_id` | `id` | No | 0 | `transactions` | Reversing cash transaction |
| `reversal_journal_entry_id` | `id` | No | 0 | `journal_entries` | Reversing double-entry journal entry |
| `return_cash_account_id` | `id` | No | 0 | `accounts` | Cash account receiving returned funds |
| `reversal_date` | `date` | No | 0 | None | Reversal effective date (`YYYY-MM-DD`) |
| `reason` | `text` | No | 0 | None | Justification for reversal |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 17: `loan_agreements`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique loan agreement identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `lender_type` | `text` | No | 0 | None | Lender category (`member` or `third_party`) |
| `member_id` | `id` | Yes | 0 | `members` | Member lender identifier (nullable for third-party loans) |
| `lender_name` | `text` | No | 0 | None | Legal name of lender |
| `agreement_date` | `date` | No | 0 | None | Note execution date (`YYYY-MM-DD`) |
| `commitment_minor` | `minor` | No | 0 | None | Total committed facility amount in cents |
| `annual_rate_basis_points` | `integer` | No | 0 | None | Annual interest rate in basis points (e.g. 650 = 6.50%) |
| `day_count` | `text` | No | 0 | None | Day count convention (e.g. `actual/365`) |
| `description` | `text` | No | 0 | None | Facility description or terms |
| `liability_account_id` | `id` | No | 0 | `accounts` | Principal liability account |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 18: `loan_advances`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique draw/advance identifier |
| `loan_id` | `id` | No | 0 | `loan_agreements` | Parent loan agreement |
| `transaction_id` | `id` | No | 0 | `transactions` | Linked cash transaction |
| `journal_entry_id` | `id` | No | 0 | `journal_entries` | Associated journal entry |
| `advance_date` | `date` | No | 0 | None | Draw date (`YYYY-MM-DD`) |
| `cash_account_id` | `id` | No | 0 | `accounts` | Receiving cash/bank account |
| `amount_minor` | `minor` | No | 0 | None | Funded principal draw in cents |
| `description` | `text` | No | 0 | None | Draw purpose or memo |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 19: `loan_repayments`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique repayment identifier |
| `loan_id` | `id` | No | 0 | `loan_agreements` | Parent loan agreement |
| `transaction_id` | `id` | No | 0 | `transactions` | Linked repayment cash transaction |
| `journal_entry_id` | `id` | No | 0 | `journal_entries` | Associated journal entry |
| `repayment_date` | `date` | No | 0 | None | Payment execution date (`YYYY-MM-DD`) |
| `cash_account_id` | `id` | No | 0 | `accounts` | Disbursing cash/bank account |
| `principal_minor` | `minor` | No | 0 | None | Repaid principal portion in cents |
| `interest_minor` | `minor` | No | 0 | None | Paid interest portion in cents |
| `description` | `text` | No | 0 | None | Payment memo or details |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 20: `recurring_transaction_templates`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique template identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `kind` | `text` | No | 0 | None | Transaction kind (`income`, `expense`, etc.) |
| `account_id` | `id` | No | 0 | `accounts` | Primary cash/bank account |
| `category_account_id` | `id` | No | 0 | `accounts` | Offsetting category account |
| `amount_minor` | `minor` | No | 0 | None | Template transaction amount in cents |
| `description` | `text` | No | 0 | None | Recurring payee or memo |
| `cadence` | `text` | No | 0 | None | Schedule frequency (`weekly`, `monthly`, `quarterly`, `yearly`) |
| `next_date` | `date` | No | 0 | None | Next generation target date (`YYYY-MM-DD`) |
| `anchor_day` | `integer` | No | 0 | None | Recurring day of month or week |
| `is_active` | `flag` | No | 0 | None | Template active flag (`0` or `1`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 21: `recurring_transaction_occurrences`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique occurrence log identifier |
| `template_id` | `id` | No | 0 | `recurring_transaction_templates` | Originating recurring template |
| `transaction_id` | `id` | No | 0 | `transactions` | Generated and posted transaction |
| `scheduled_date` | `date` | No | 0 | None | Scheduled target date (`YYYY-MM-DD`) |
| `posted_date` | `date` | No | 0 | None | Actual posted date (`YYYY-MM-DD`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 22: `account_reconciliations`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique reconciliation statement identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `account_id` | `id` | No | 0 | `accounts` | Reconciled bank/cash account |
| `period_start_date` | `date` | No | 0 | None | Statement opening date (`YYYY-MM-DD`) |
| `statement_date` | `date` | No | 0 | None | Statement closing date (`YYYY-MM-DD`) |
| `beginning_minor` | `minor` | No | 0 | None | Statement starting balance in cents |
| `ending_minor` | `minor` | No | 0 | None | Statement ending balance in cents |
| `status` | `text` | No | 0 | None | Status (`in_progress`, `completed`, `canceled`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |
| `completed_at` | `timestamp` | Yes | 0 | None | Statement completion timestamp (nullable) |

#### Table 23: `account_reconciliation_items`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `reconciliation_id` | `id` | No | 1 | `account_reconciliations` | Parent reconciliation statement (composite PK part 1) |
| `transaction_id` | `id` | No | 2 | `transactions` | Reconciled/cleared transaction (composite PK part 2) |
| `created_at` | `timestamp` | No | 0 | None | Association timestamp string |

#### Table 24: `account_reconciliation_events`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique reconciliation audit event identifier |
| `reconciliation_id` | `id` | No | 0 | `account_reconciliations` | Associated reconciliation statement |
| `event_type` | `text` | No | 0 | None | Event lifecycle type (`opened`, `item_cleared`, `completed`, etc.) |
| `transaction_id` | `id` | Yes | 0 | `transactions` | Relevant cleared transaction (nullable) |
| `created_at` | `timestamp` | No | 0 | None | Event timestamp string |

#### Table 25: `accounting_period_events`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique period event identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `event_type` | `text` | No | 0 | None | Lifecycle type (`close` or `reopen`) |
| `period_start_date` | `date` | No | 0 | None | Period start date (`YYYY-MM-DD`) |
| `period_end_date` | `date` | No | 0 | None | Period end date (`YYYY-MM-DD`) |
| `reason` | `text` | No | 0 | None | Audit memo or close/reopen justification |
| `target_close_event_id` | `id` | Yes | 0 | `accounting_period_events` | Self-referential link to closed event being reopened (nullable) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |

#### Table 26: `bookkeeping_reminders`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | No | 1 | None | Unique reminder identifier |
| `business_id` | `id` | No | 0 | `businesses` | Parent business workspace |
| `due_date` | `date` | No | 0 | None | Task due date (`YYYY-MM-DD`) |
| `title` | `text` | No | 0 | None | Reminder headline |
| `details` | `text` | No | 0 | None | Full reminder details or instructions |
| `is_complete` | `flag` | No | 0 | None | Completion status flag (`0` or `1`) |
| `created_at` | `timestamp` | No | 0 | None | Creation timestamp string |
| `updated_at` | `timestamp` | No | 0 | None | Last modification timestamp string |
| `completed_at` | `timestamp` | Yes | 0 | None | Completion timestamp string (nullable) |

#### Table 27: `bookkeeping_preferences`
| Column Name | Kind | Nullable | PK Position | Referenced Table | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `preference_key` | `id` | No | 1 | None | Preference identifier key (e.g. `active_business_id`) |
| `preference_value` | `id` | No | 0 | `businesses` | Stored foreign reference value |

---

### 3.3 Column Details & Type Representations

To ensure lossless portability across platforms and runtimes, column values map strictly to the following primitive representations:
- **`id` (TEXT)**: Non-empty portable ASCII/UTF-8 string identifier. Cannot be null for primary keys; nullable only where the inventory marks a foreign-key reference as nullable (`nullable: true`, e.g., `member_capital_activity.cash_account_id`, `member_capital_activity.property_asset_account_id`, `loan_agreements.member_id`, `account_reconciliation_events.transaction_id`, `accounting_period_events.target_close_event_id`). Cannot contain NUL bytes or lone surrogate characters.
- **`text` (TEXT)**: Portable UTF-8 string. May be empty; nullable where specified by schema.
- **`date` (TEXT)**: Strict calendar date formatted `YYYY-MM-DD`. Validated for real calendar existence (e.g., February 30th is rejected).
- **`timestamp` (TEXT)**: Non-empty portable UTF-8 text value preserved exactly as stored. The dataset validator checks that `value.length > 0` and text is portable UTF-8 without NUL bytes or lone surrogate characters; it does not parse or validate an ISO 8601 UTC date-time format.
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

Export and import operations in [`packages/backup/src/bookkeeping-snapshot.ts`](../../packages/backup/src/bookkeeping-snapshot.ts) implement defense-in-depth SQL protections:

### Export Safeguards
- **Caller Serialization Lock**: Callers must hold connection-level serialization lock during export; statements from other tasks cannot interleave.
- **Read-Only Immediate Transaction & Cleanup Error Propagation**: Begins with `BEGIN IMMEDIATE;` which acquires a RESERVED lock on SQLite, blocking concurrent write transactions while allowing concurrent readers. Always concludes with `ROLLBACK;`. If rollback cleanup fails, export and verification reject the cleanup error (never suppressing it or leaking a successful result on an unreleased transaction state). When rollback fails while unwinding an earlier operation error, both failures are preserved in a safe error wrapper with a fixed contextual message and non-enumerable properties without mutating the cleanup error (supporting frozen, null-prototype, or primitive cleanup errors), holding the cleanup failure on `.cleanupError` and the original operation error on `.originalError` (and `.cause`). Neither the wrapper message nor `JSON.stringify` leaks private markers from the underlying errors. If the operation fails and rollback succeeds, the operation failure is preserved exactly (including `undefined` rejections). The caller owns the database connection: if rollback cleanup fails, the connection may retain an uncommitted transaction or writer reservation and must be closed or discarded by the caller.
- **Source Immutability**: Source is never altered, dropped, or migrated.
- **Structural Introspection**: Verifies schema version in `bookkeeping_schema`, audits `sqlite_master` for unlisted tables, checks `PRAGMA table_xinfo` for column counts, names, declared types, primary key positions, and `hidden = 0`, and asserts the absence of unexpected views, triggers, and unknown tables.
- **Storage Class Verification**: Uses SQL `typeof()` queries to prove all values match expected SQLite storage classes (no `blob`, no `real`, no out-of-range integer).

### Import Safeguards
- **Empty Destination Enforced**: Destination SQLite file must contain zero user tables, views, triggers, or indexes. Any existing user objects trigger `nonempty-destination` error immediately without modifying the database.
- **Schema Creation via Canonical Function**: Schema is created from scratch using `ensureBookkeepingSchema`, ensuring indexes, check constraints, default values, and foreign keys are canonical.
- **Parameterized Inserts in FK-Safe Sequence**: All row values are inserted using parameterized SQL statements (`INSERT INTO "table" (...) VALUES (?, ...)`). Table and column identifiers come strictly from the fixed inventory quoted via `quoteIdentifier`. DDL execution is strictly limited to canonical schema creation via `ensureBookkeepingSchema` and rollback cleanup `DROP TABLE IF EXISTS` on inventory tables.
- **Self-Reference Deferral**: Executes `PRAGMA defer_foreign_keys = ON;` inside the transaction to allow self-referential tables (such as `accounting_period_events` where a reopening event may sort before its target close event) while guaranteeing 100% foreign key enforcement at `COMMIT`.
- **Pre-Commit Verification**:
  - `PRAGMA foreign_key_check` must return 0 violations.
  - `PRAGMA integrity_check` must return `ok`.
  - Re-read dataset snapshot must match input snapshot row-for-row and count-for-count via `compareBookkeepingDatasets`.
- **Clean Cleanup on Error**: Any insert or verification failure initiates an immediate `ROLLBACK;` and invokes `returnDestinationToEmpty`, dropping all created tables to restore the database to an empty state. If cleanup fails, `destination-cleanup-failed` is thrown, warning callers never to activate the candidate database.
- **No Activation**: The import function only populates a candidate database; it never activates the database or swaps pointers.

---

## 6. Documented Exclusions & Proof Utility Separation

To maintain strict boundaries between bookkeeping data and storage proof utilities:
1. **Excluded Proof Tables**:
   - `proof_records`: Synthetic proof-only table created by [`packages/storage-native/src/native-storage-proof.ts`](../../packages/storage-native/src/native-storage-proof.ts) (lines 24-36) in the active encrypted database from application source for synthetic attachments.
   - `restore_manifest`: Utility table created by the synthetic proof-only `NativeRestoreStore` ([`packages/backup/src/native-restore-store.ts`](../../packages/backup/src/native-restore-store.ts), lines 105-128) and read during startup validation ([`packages/storage-native/src/storage-access.ts`](../../packages/storage-native/src/storage-access.ts), lines 101-104).
   These two tables belong to existing synthetic proof-only storage and restore utilities that can share the active database file. They are recognized by `BOOKKEEPING_EXCLUDED_NON_BOOKKEEPING_TABLES` and are intentionally ignored during export without failing the export, but their contents are **never** exported into the bookkeeping dataset payload.
2. **Unknown Tables Fail Closed**: Any other table in `sqlite_master` not in the 27 bookkeeping tables, the metadata table, or the 2 excluded proof tables causes an immediate `unsupported-source-structure` error.
3. **Exclusion of System Data & External Databases**:
   - **No Device Keys**: This payload format and these two modules (`bookkeeping-dataset.ts`, `bookkeeping-snapshot.ts`) never read, write, or serialize device encryption keys, Keychain secrets, or Keystore data.
   - **Generation Catalog Database Excluded**: The separate catalog database (`llc-database-catalog.db`, containing `restore_generations`, `restore_control`, and `restore_journal` with key aliases) is a distinct SQLite file outside the active bookkeeping database and is not covered by or serialized in this dataset.
   - **No Raw DDL Serialized**: Raw `sqlite_master` SQL definitions are never serialized into payloads or executed.

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

The test suite in [`packages/backup/test/bookkeeping-snapshot.test.mjs`](../../packages/backup/test/bookkeeping-snapshot.test.mjs) exercises all test conditions:

### Test Suites Summary
1. **Inventory & Schema Reflection**: Validates all 27 bookkeeping tables, column types, primary keys, and foreign-key references against live SQLite tables generated by `ensureBookkeepingSchema`.
2. **Lossless Snapshot Export**: Tests a comprehensive synthetic dataset containing two workspaces, multiple members, retired member ownership history, split transactions, corrections (reversals/replacements), cash and property capital contributions, guaranteed payment obligations, installments, payments, reversals, loan agreements, advances, repayments, recurring templates, posted occurrences, negative-balance reconciliations, reconciliation event histories, period close/reopen chains, reminders, and preferences.
3. **Concurrent Writer Protection & Rollback Cleanup Failure**: Verifies that concurrent write attempts while export is in progress are locked out by SQLite's transaction model (blocking concurrent write transactions under `BEGIN IMMEDIATE`). Targeted fault-injection tests prove that export and verification reject when rollback cleanup fails (preventing success leaks), preserve rejections even when undefined, wrap and preserve both the cleanup failure and any underlying error being unwound on non-enumerable `.cleanupError`, `.originalError`, and `.cause` properties under a fixed contextual message without leaking markers or mutating the cleanup error (supporting frozen, null-prototype, or primitive cleanup errors), and require the caller to close/discard the unusable connection. Focused tests prove that neither the wrapper message nor JSON.stringify leaks synthetic private markers, that references are retained, and that null-prototype objects and objects with throwing getters cannot prevent error wrapping.
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
6. **Isolated Candidate Import**: Tests restoring complete synthetic books into fresh empty databases, proving post-reopening parity, identical record counts, clean integrity check, zero foreign key violations, and per-account debit and credit totals from journal_lines match.
7. **Destination Protections & Rollback**: Verifies rejection of non-empty destination databases, payload pre-validation before disk touches, rollback and cleanup upon constraint failures, and detection of candidate divergence.

### Known Limits & Untested Paths (RECOVERY-001 Scope)
The following boundaries and edge cases are known limits of RECOVERY-001:
1. **Candidate Destination Cleanup Failure Path**: The `destination-cleanup-failed` error branch ([`bookkeeping-snapshot.ts`](../../packages/backup/src/bookkeeping-snapshot.ts), lines 305-315) during candidate import rollback cleanup requires deeper SQLite driver fault injection and remains an external candidate discard boundary. In contrast, read-only transaction rollback cleanup failure for export and verification is verified by targeted fault injection.
2. **Untested Verification Mismatch & Corrupt Version Metadata**: A post-insert verification discrepancy inside `importBookkeepingDatasetIntoEmptyDatabase` (`assertMatchesExpected` failure after insert) and a malformed `bookkeeping_schema` record (e.g. non-integer version or singleton != 1 in `readSchemaVersion`, lines 77-79) have no dedicated test cases.
3. **No Migration or Older-Schema Import Tests**: No import test begins from an older or migrated database schema; the isolated restore engine accepts only an empty destination, and export from schema versions `< 13` fails closed with `unsupported-schema-version`.
4. **Structural Introspection Boundary**: Export introspects `sqlite_master` and `PRAGMA table_xinfo` checking column counts, column names, declared types, primary key positions, and `hidden = 0` ([`bookkeeping-snapshot.ts`](../../packages/backup/src/bookkeeping-snapshot.ts), lines 84-104). It does not assert source `NOT NULL`, `CHECK`, `UNIQUE`, or foreign-key DDL declarations at the introspection boundary (these constraints are enforced by SQLite runtime and `ensureBookkeepingSchema` upon import).
5. **Payload Contract Balance Validation**: Per-entry double-entry balancing is an accounting domain invariant verified by journal constraints and reports; the portable payload contract (`validateBookkeepingDatasetSnapshot`) validates structural types and column shapes rather than calculating entry balances across journal lines.
6. **Schema Creation Transaction Boundary & Process Interruption**: Schema creation (`ensureBookkeepingSchema`) executes prior to the insert transaction ([`bookkeeping-snapshot.ts`](../../packages/backup/src/bookkeeping-snapshot.ts), lines 296-297). If a process is terminated mid-import after schema creation but before `COMMIT` or cleanup, an unpopulated or partial candidate database may remain on disk. Such candidate databases must never be activated without `verifyBookkeepingDatasetInDatabase` or explicit restore verification.
7. **Unverified Subsequent Capabilities**: Crash/interruption recovery, historical schema migration handling, high-level accounting report parity (balance sheet, cash basis, general ledger workpapers), and activation safety orchestration belong to RECOVERY-003 and native release gates and remain unverified at RECOVERY-001.

---

## 9. Next Steps in the Recovery Milestone

Subsequent Stories build on these APIs once RECOVERY-001 is independently accepted:
- **RECOVERY-002**: Encrypted backup packaging wrapping this validated payload in an authenticated envelope with key derivation and tamper resistance.
- **RECOVERY-003**: Isolated restore orchestration comparing pre/post accounting report outputs across candidate and active databases.
