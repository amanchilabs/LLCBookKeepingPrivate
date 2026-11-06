# STORY-BOOK-001 — VALIDATED

Capability: CAP-BOOK-EXCHANGE-001

Branch: feature/bookkeeping-tax-exchange-20261105

Exact source revision: c33f72765fd3756dc9f085e51074dd6552a56ebb

Outcome: Create the sole versioned bookkeeping-to-tax exchange v1 JSON schema, synthetic example fixture, TS validator/serializer and meaningful automated tests. Read the approved pilot document. Expose a lossless serialized record with schemaVersion=1, product LLCBookKeepingPrivate, basis cash, currency USD, source business ID/name and source reference, period fromDate/throughDate, reviewStatus unreviewed, and incomeCents/expenseCents/netIncomeCents decimal integer strings copied exactly from an existing CashBasisReport; never recompute journal totals, allocate or classify tax. Explicit limitations: book figures only, not a tax return or deductibility/tax-basis determination; no sync/import implemented. Support negative book totals without floating-point coercion. Fail closed on unknown versions, malformed/leap-day dates, reversed period, unsupported currency, invalid cents (including unsafe numeric input), missing/invalid source/review status or mismatched report period; reject extra unknown schema fields to avoid silently losing semantics. Export typed APIs usable by the next UI Story; use existing report date validator if sufficient, strengthen only the new module otherwise. Fixture must clearly be synthetic. Tests validate fixture parity and roundtrip >MAX_SAFE_INTEGER strings, boundaries and malformed inputs; do not test source strings. Do not modify package manifests, existing domain/storage or report calculation code.

Validation tier: product-defined; see approved command list.

Checks and independent review: [STORY-BOOK-001.json](STORY-BOOK-001.json).

Limitations: local checks only; no merge, deployment or product acceptance implied.

Next action: next approved Story, or stop at the capability boundary.
