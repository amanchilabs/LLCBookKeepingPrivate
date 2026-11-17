# Complete Bookkeeping Recovery Validation & Verification Specification

- Status: **Builder-delivered for RECOVERY-003; review findings addressed; coordinator validation and independent review pending; host SQLite synthetic evidence only**
- Milestone / Capability: **CAP-BOOK-RECOVERY-001 — Complete Bookkeeping Recovery**
- Story: **RECOVERY-003 — Complete dataset recovery parity, isolated restore lifecycle, failure injection, legacy migration, and native storage integration**
- Authorization: **Owner authorization 2026-11-16 ([`AUTHORIZATION-20261116.md`](AUTHORIZATION-20261116.md))**
- Implementation Plan: **[`IMPLEMENTATION-PLAN-20261116.md`](IMPLEMENTATION-PLAN-20261116.md)**
- Dataset Contract Specification: **[`DATASET-COVERAGE.md`](DATASET-COVERAGE.md)**
- Portable Backup Format Specification: **[`BACKUP-FORMAT.md`](BACKUP-FORMAT.md)**
- Source Modules:
  - Recovery Orchestration & Parity Engine: [`packages/backup/src/bookkeeping-recovery.ts`](../../packages/backup/src/bookkeeping-recovery.ts)
  - Native Platform Candidate Store Adapter: [`packages/backup/src/native-bookkeeping-recovery.ts`](../../packages/backup/src/native-bookkeeping-recovery.ts)
  - Host Integration & Failure Injection Test Suite: [`packages/backup/test/bookkeeping-recovery.test.mjs`](../../packages/backup/test/bookkeeping-recovery.test.mjs)
  - Synthetic Multi-Workspace Fixture: [`packages/backup/test/bookkeeping-recovery-fixture.mjs`](../../packages/backup/test/bookkeeping-recovery-fixture.mjs)

---

## 1. Scope, Status & Governance Boundaries

This document defines the validation criteria, lifecycle invariants, failure-injection matrix, known limits, and coordinator verification commands for Story **RECOVERY-003**, completing the non-UI full-dataset bookkeeping backup and restore milestone authorized under **CAP-BOOK-RECOVERY-001**.

### Evidence Boundaries & Unverified Gates
- **Host SQLite Evidence Only**: All automated test execution in [`packages/backup/test/bookkeeping-recovery.test.mjs`](../../packages/backup/test/bookkeeping-recovery.test.mjs) runs against real, file-backed, unencrypted SQLite via Node `DatabaseSync` (`node:sqlite`). This validates SQL relational behavior, schema migration, foreign key checks, SQLite integrity checks, and report calculations.
- **No Native or Physical-Device Certification**: Host tests **do not** certify native SQLCipher encryption (`PRAGMA key`), native hardware keystores (iOS Keychain, Android Keystore), OS-level crash durability, power-loss resilience, or physical-device recovery. Physical-device recovery and native SQLCipher verification remain distinct evidence gates requiring physical-device builds.
- **Strictly Non-UI Milestone**: Zero UI files or visual layouts are modified. All 64 owner change receipts and visual baseline designs remain binding and untouched.
- **Synthetic Data Only**: All test fixtures use synthetic LLC entities, accounts, and transactions. Real financial records, receipts, and production deployment remain strictly barred pending full gate completion. Bank connections or automated scraping remain permanently unauthorized under the canonical vision ([`CLAUDE.md`](../../CLAUDE.md)).
- **Separation from Proof Utilities**: The existing synthetic proof backup utility ([`packages/backup/src/native-portable-backup.ts`](../../packages/backup/src/native-portable-backup.ts)) remains distinct. No UI controls are wired to recovery orchestration.

---

## 2. Isolated Restore Lifecycle & Candidate State Machine

Recovery enforces a strict lifecycle contract ensuring that no active database or catalog generation is ever modified during candidate staging.

```
+--------------------+
| Encrypted Backup   |
+---------+----------+
          |
          | 1. authenticateBookkeepingBackupForRecovery()
          v
+--------------------+      Fail      +---------------------+
| Authenticated Data | -------------> | backup-rejected     |
+---------+----------+ (wrong pass,   | (not-requested)     |
          |            tamper, etc.)  +---------------------+
          |
          | 2. provision candidate (destination store)
          v
+--------------------+      Fail      +---------------------+
| Isolated Candidate | -------------> | candidate-not-      |
| Destination Key    | (not empty,    | isolated / provision|
+---------+----------+  active key)   +---------------------+
          |
          | 3. import & verify
          v
+--------------------+
| verified-          |
| unpublished        |
+---------+----------+
          |
          +-----------------------------------------+
          |                                         |
          | handOff()                               | discard()
          v                                         v
+--------------------+                    +-------------------+
| handed-off         |                    | discarded         |
| (identity returned)|                    | (candidate wiped) |
+--------------------+                    +-------------------+
```

### Lifecycle Invariants
1. **Authenticate Before Provision & Genuine Branding**: The backup envelope is decrypted and authenticated against PBKDF2/AES-GCM credentials before requesting a candidate database or key identity from storage. Plaintext snapshots cannot be branded as genuine via the public `AuthenticatedBookkeepingBackup` constructor; only the internal authentication factory marks an envelope genuine. Unauthenticated or runtime forged attempts fail closed with `lifecycle-violation` and candidate outcome `not-requested`, never creating or touching candidate files.
2. **Destination Key Provisioning**: Destination keys are provisioned locally on the destination device with fresh synthetic/hardware identities. The payload never contains source device keys, and the restore process never uses source device keys.
3. **Candidate Isolation**: If the candidate store provisions an active database path, reuses a protected active key identity, or opens a candidate file that already contains database objects, the restore fails closed with `candidate-not-isolated` and candidate outcome `not-touched`. Preexisting and protected active databases are never modified or disposed.
4. **Terminal Transitions**: A candidate in state `verified-unpublished` allows exactly one terminal transition:
   - `handOff()`: transitions to `handed-off` and returns `{ candidateId, keyIdentity }`. The candidate is left untouched beside the active database without performing activation. Subsequent calls to `handOff()` or `discard()` throw `lifecycle-violation`.
   - `discard()`: transitions to `discarded` and disposes the candidate file and key from destination storage. Subsequent calls throw `lifecycle-violation`.
5. **Cleanup Failure & Resource Failure Preservation**:
   - The initial `sqlite_master` emptiness check after opening connection 1 is strictly protected: if the query fails, connection 1 is closed, the candidate is disposed, and both errors are surfaced.
   - On import failure, candidate connection 1 is closed before calling destination candidate store disposal.
   - On verification failure, candidate connection 2 is closed before disposal. If closing connection 2 fails, the close error is preserved and surfaces `candidate-cleanup-failed` with outcome `cleanup-failed`. It is never swallowed or reported clean.
   - All errors are normalized to safe Error objects with non-enumerable `cause` and `cleanupError` properties to prevent data leakage and preserve failure context.
   - If candidate disposal fails following an import or verification error, a `BookkeepingRecoveryError` with code `candidate-cleanup-failed` and outcome `cleanup-failed` is thrown, with an explicit message that the candidate must not be activated.
6. **Retryable Discard**: If `discard()` on a verified candidate fails, the state transitions to `discard-failed`. `handOff()` is disallowed, but `discard()` can be retried until disposal succeeds.
7. **Isolated Migration Cleanup Preservation**: When migrating legacy databases on an isolated copy, if migration fails and copy disposal also fails, both errors are surfaced under `candidate-cleanup-failed` with outcome `cleanup-failed`, rather than swallowing disposal errors.

---

## 3. Parity & Accounting Verification

A candidate database is only eligible for `verified-unpublished` status after passing comprehensive parity and integrity verification:

1. **Relational & Schema Integrity**:
   - `PRAGMA foreign_key_check`: must return zero violations.
   - `PRAGMA integrity_check`: must return exactly `ok`.
   - `bookkeeping_schema.version`: must equal exactly `13`.
   - Table row counts: all 27 tables must match expected row counts.
2. **Full Dataset Comparison**:
   - `compareBookkeepingDatasets(source, restored)`: must return zero differences. Every row, column, primary key, foreign key, and text/numeric value matches the exported snapshot.
3. **Accounting Report Parity**:
   - Cash basis reports (`cashBasisReportFromDatabase`): matching income, expense, and net income cents.
   - Cash movement reports (`cashMovementReportFromDatabase`): matching beginning balance, inflows, outflows, and ending balances across cash accounts.
   - Journal balance reports (`journalBalanceReportFromDatabase`): matching total debits, total credits, assets, liabilities, and equity balances.
   - Trial balance & general ledger (`generalLedgerReportFromDatabase`): complete lines, debit/credit totals, and running balance parity across all accounts.
   - Reconciliations (`getBookkeepingSnapshotFromDatabase`): matching draft and completed reconciliation statuses, cleared movements, and zero difference on completed statements.
4. **Balanced Accounting Assertion (`assertBookkeepingAccountingBalanced`)**:
   - Overall journal entries: `totalDebitsCents === totalCreditsCents`.
   - **Per-Journal Entry Balancing**: Debits must equal credits for EACH individual journal entry in the database. Two offsetting unbalanced entries within the same business are strictly rejected.
   - Trial balance debits equal credits for each workspace.
   - Balance sheet difference is zero (`totalAssetsCents - totalLiabilitiesCents - totalEquityCents === 0n`).
   - Cash basis net income equals balance sheet current earnings.
   - Completed reconciliations have zero difference (`differenceCents === 0n`).

---

## 4. Known Limits & Specification Details

### 4.1 SQLite Insertion Order (rowid) Presentation Limit
- **Contract Boundary**: Format 1 dataset serialization sorts rows ascending by primary key for determinism and reproducibility. SQLite's internal `rowid` (physical insertion order) is not preserved across export and import.
- **Affected Queries**: In existing store queries that query records ordered by SQLite rowid (such as `members`, `accounting_period_events`, `member_interest_history`, `member_capital_summaries`, and `account_reconciliation_events`), restored records will be returned in primary-key order rather than initial insertion order.
- **Derivability Guarantee**: Every event and entity retains its immutable chronological timestamp (`created_at`, `effective_from`, etc.). Chronological sorting remains fully derivable across all records.

### 4.2 Legacy Schema Migration Policy
- **Disk Migration via Isolated Copy**: Legacy schema-8 databases on disk are migrated using `exportBookkeepingDatasetWithIsolatedMigration`. The migration is performed strictly on an isolated temporary copy using the existing schema migrations (V8 to V13). The source database file on disk is never modified.
- **Payload Schema Rejection**: In-payload migration of legacy serialized payloads (e.g. schema 12 payload in a backup envelope) is **not implemented** in this milestone. Any backup payload whose header indicates a schema version other than 13 is explicitly rejected with `unsupported-schema` rather than attempting in-flight payload translation.

### 4.3 Reversal Coverage
- Guaranteed payment reversals (`guaranteed_payment_reversals`) and cash transaction corrections (`transaction_corrections`, `transaction_correction_roles`) are fully covered and verified.
- Loan reversals are not part of the current bookkeeping domain model or store workflows and are therefore omitted from fixtures.

### 4.4 Native Candidate Store Security & Isolation Contract
- **Internally Issued Identities Only**: `NativeBookkeepingCandidateStore` tracks and verifies internally provisioned identities (`issuedIdentities`). Unowned or arbitrary identities passed to `open()` or `dispose()` are rejected with access denied.
- **Strict Format & Traversal Prevention**: Candidate database IDs must conform strictly to `candidate-<timestamp>-<counter>-<hex>.db`. Path traversal characters (`..`, `/`, `\`) and active database names are rejected.
- **Owned Connection Tracking**: The native candidate store tracks active database leases and releases/closes all open connections before deleting database files upon disposal.
- **Sidecar Cleanup**: Disposal deletes the primary candidate database and all SQLite sidecars (`-wal`, `-shm`, `-journal`).
- **Surface Cleanup Failures**: File deletion, SecureStore key deletion, and connection close errors are strictly surfaced; cleanup failures throw `Error` and prevent the candidate from being considered disposed.

---

## 5. Failure Injection & Resilience Matrix

| Failure Stage | Injected Fault | Expected Error Code | Candidate Outcome | Invariant Verified |
| :--- | :--- | :--- | :--- | :--- |
| **Authenticate** | Wrong passphrase | `backup-rejected` | `not-requested` | No candidate requested; active DB untouched |
| **Authenticate** | Envelope bit flip / tamper | `backup-rejected` | `not-requested` | Tampered ciphertext rejected before storage |
| **Authenticate** | Payload truncation | `backup-rejected` | `not-requested` | Incomplete ciphertext rejected |
| **Authenticate** | Legacy payload schema (v12) | `backup-rejected` | `not-requested` | Fail closed; no payload migration assumed |
| **Authenticate** | Proof payload (`records` field) | `backup-rejected` | `not-requested` | Proof backup payloads rejected as books |
| **Authenticate** | Plaintext snapshot constructor forgery | `lifecycle-violation` | `not-requested` | Plaintext snapshot cannot be branded genuine |
| **Provision** | Injected storage provision error | `candidate-provision-failed` | `not-created` | Candidate not created; active DB untouched |
| **Provision** | Candidate is active DB | `candidate-not-isolated` | `not-touched` | Active DB protected; candidate not disposed |
| **Provision** | Candidate reuses source key | `candidate-not-isolated` | `not-touched` | Source key not reused; active DB untouched |
| **Provision** | Candidate file already has tables | `candidate-not-isolated` | `not-touched` | Preexisting data preserved; not disposed |
| **Provision** | Candidate sqlite_master query fails | `candidate-import-failed` | `disposed` | Connection closed; candidate disposed safely |
| **Import** | Injected schema creation error | `candidate-import-failed` | `disposed` | Connection closed; candidate database and key wiped |
| **Import** | Injected row insert error | `candidate-import-failed` | `disposed` | Connection closed; incomplete candidate discarded |
| **Import** | In-transaction verification fail | `candidate-verification-failed` | `disposed` | Connection closed; corrupted write caught |
| **Reopen** | Candidate open failure on call 2 | `candidate-verification-failed` | `disposed` | Reopen failure caught; candidate disposed |
| **Verification** | Post-close external write | `candidate-verification-failed` | `disposed` | External modification detected; connection closed and disposed |
| **Verification** | Unbalanced journal lines | `candidate-verification-failed` | `disposed` | Unbalanced books rejected from eligibility |
| **Verification** | Offsetting unbalanced journal entries | `candidate-verification-failed` | `disposed` | Per-journal entry balancing enforced |
| **Verification** | Unbalanced reconciliation | `candidate-verification-failed` | `disposed` | Corrupt reconciliation rejected from eligibility |
| **Verification** | Connection close failure on call 2 | `candidate-cleanup-failed` | `cleanup-failed` | Close failure not swallowed; surfaced |
| **Cleanup** | Injected disposal failure | `candidate-cleanup-failed` | `cleanup-failed` | Both errors surfaced; activation barred |
| **Source Migration**| Newer source schema (v14) | `unsupported-source-schema` | `not-requested` | Source untouched; copy not requested |
| **Source Migration**| Isolated copy is source | `candidate-not-isolated` | `not-touched` | Copy provider safety check |
| **Source Migration**| Migration SQL fails on copy | `source-migration-failed` | `disposed` | Source file byte-identical; copy disposed |
| **Source Migration**| Isolated copy disposal fails | `candidate-cleanup-failed` | `cleanup-failed` | Cleanup failure surfaced; source untouched |
| **Source Migration**| Migration fails AND disposal fails | `candidate-cleanup-failed` | `cleanup-failed` | Both failures surfaced; source untouched |

---

## 6. Reproducible Coordinator Validation Commands

The coordinator executes validation using the pinned Node toolchain and environment:

```bash
# 1. Strict TypeScript typecheck across all modules
/opt/homebrew/bin/fnm exec --using 24.22.2 npm run typecheck

# 2. Complete test suite including preview, UI, domain, security, and backup
/opt/homebrew/bin/fnm exec --using 24.22.2 npm test

# 3. Clean diff and whitespace verification
git diff --check
```
