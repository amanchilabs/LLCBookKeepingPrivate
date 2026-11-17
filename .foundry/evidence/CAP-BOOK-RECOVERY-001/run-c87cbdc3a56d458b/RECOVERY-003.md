# RECOVERY-003 — FAILED_REVIEW

Capability: CAP-BOOK-RECOVERY-001

Branch: feature/bookkeeping-full-recovery-20261116

Exact source revision: 0f010aa6fa77ffd7cc466b3366e7bcb74d693290

Outcome: Read docs/recovery/AUTHORIZATION-20261116.md and IMPLEMENTATION-PLAN-20261116.md. Owner-authorized non-UI only; no UI/assets/registry/approval edits, dependencies, accounting semantics changes, new agents, native commands, branch changes, commits or pushes. Write meaningful failing tests first; coordinator executes checks. Reuse existing patterns, keep files focused. Document exact limits. Complete recovery parity, isolated lifecycle and failure injection. Build non-UI restore orchestration around new modules. Always authenticate+validate before requesting isolated fresh candidate. Candidate local key comes from destination provisioning, never source key. No active catalog/device DB mutation or production activation in this milestone; return verified candidate only through explicit lifecycle contract, dispose rejected candidates and leave active source unchanged. Add native factory/non-UI integration if possible using existing SQLCipher/storage lease APIs WITHOUT altering proof store or UI; do not invent unsafe default adapter. A checked candidate must have complete row/relationship/history parity and balanced existing journal/report/reconciliation totals before eligibility. Create deterministic multi-workspace synthetic fixtures via existing domain/store APIs covering every supported table including reversal/correction, capital, guaranteed payments, loans/reversals, recurring, splits, reconciliation events and closed/reopened periods. Restore an actual encrypted backup into an isolated fresh file-backed DB with different synthetic destination key identity; compare complete rows and existing cash/P&L, balance/trial/general ledger and reconciliation reports. Tests inject failures at decrypt, candidate provision, schema, row import, verification and cleanup; verify original files/rows not modified, rejected target not published, cleanup failure surfaced and no active switch. Exercise meaningful supported legacy schema migration using existing migrations only on isolated candidate; unsupported newer schemas fail closed and source bytes stay unchanged. If legacy payload migration is not implemented, reject explicitly and document rather than claiming support. Document host plain SQLite versus native SQLCipher/device limits and exact reproducible coordinator validation commands. No user accessible controls; no simulator/physical-device commands or modifications.

Validation tier: product-defined; see approved command list.

Checks and independent review: [RECOVERY-003.json](RECOVERY-003.json).

Limitations: validation blocked; no progression.

Next action: reconcile failure before resume.
