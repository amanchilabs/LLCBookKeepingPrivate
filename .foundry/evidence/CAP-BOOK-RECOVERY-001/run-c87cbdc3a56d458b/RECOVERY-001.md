# RECOVERY-001 — FAILED_REVIEW

Capability: CAP-BOOK-RECOVERY-001

Branch: feature/bookkeeping-full-recovery-20261116

Exact source revision: 21597dd1f45e02bf9416299566751050284b63a2

Outcome: Read docs/recovery/AUTHORIZATION-20261116.md and IMPLEMENTATION-PLAN-20261116.md. Owner-authorized non-UI only; no UI/assets/registry/approval edits, dependencies, accounting semantics changes, new agents, native commands, branch changes, commits or pushes. Write meaningful failing tests first; coordinator executes checks. Reuse existing patterns, keep files focused. Document exact limits. Complete lossless dataset snapshot and isolated SQL import. Inventory every schema-13 bookkeeping table/column from ensureBookkeepingSchema and migrations, including all workspaces/preferences, business/member and ownership history, accounts/journals/lines, transactions/splits/correction roles/history, capital, loan agreements/advances/repayments/reversals, guaranteed obligations/installments/payments/allocations/reversals, recurring templates/occurrences, reminders, accounting periods and reconciliation items/events. Define a strict versioned portable payload and exported table inventory; reject unknown newer schema, malformed/duplicate rows, unsupported column shapes and unknown bookkeeping tables rather than silently dropping. Preserve integer cents/date/reference values losslessly and stable IDs. Consistent snapshot export must use a transaction, no destructive migrations on source. Isolated import must accept ONLY empty destination, create supported schema using existing function, use parameterized statements in FK-safe order/transaction, validate FK and integrity, compare complete rows/counts deterministically. Failure leaves existing source/target unchanged; reject nonempty target. Do not serialize device keys, proof records or arbitrary sqlite_master SQL. Test real file-backed SQLite with existing Node adapter pattern; validate all inventory tables exist and unknown schema/extra tables/columns fail closed. Add coverage document explicitly distinguishing supported bookkeeping dataset from external/nonexistent receipt storage. Expose APIs for subsequent encryption/restore Stories. Accounting schema version must remain 13; no modifying the existing schema or calculations.

Validation tier: product-defined; see approved command list.

Checks and independent review: [RECOVERY-001.json](RECOVERY-001.json).

Limitations: validation blocked; no progression.

Next action: reconcile failure before resume.
