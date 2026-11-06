# STORY-BOOK-002 — VALIDATED

Capability: CAP-BOOK-EXCHANGE-001

Branch: feature/bookkeeping-tax-exchange-20261105

Exact source revision: db2fa91659327051a803a3bcb662902971df214c

Outcome: Integrate the existing v1 exchange serializer into a bounded Reports Bookkeeping exchange section. Use a new BookkeepingExchangePanel component with meaningful component tests via existing react-dom/server and React Native mocks (no new dependencies). Reports passes current source/business + existing computed report, requested dates, loading/error state and a JSON share callback. Never fetch or mutate ledger in the panel. Show source, period, cash basis, unreviewed/review needed, amounts and exclusions; missing data, bad dates, mismatched/stale report period or report failure disable export with a clear explanation. Explicit button Prepare bookkeeping JSON (accessibilityLabel same) invokes only the validated payload. Use explicit OS share action with application/json via existing expo File/Paths and Sharing patterns, handle errors and cancellation honestly (prepared/share-sheet opened, not delivered/sent). Preserve existing CSV/PDF/report flows. No tax calculations, import, sync, persistence/security changes. Minimum 48 native target for new buttons using existing Button. Add component tests for valid/empty/error/stale/loading states, exact payload callback/disabled behavior. Keep the new report section title Bookkeeping exchange and control label Exchange so the dedicated native test can find it. Coordinator native evidence at .foundry-host/parallel-pilot-20261105/native/<source SHA>/ in the Foundry root must be inspected during review; no physical-device or assistive-tech pass inferred.

Validation tier: product-defined; see approved command list.

Checks and independent review: [STORY-BOOK-002.json](STORY-BOOK-002.json).

Limitations: local checks only; no merge, deployment or product acceptance implied.

Next action: next approved Story, or stop at the capability boundary.
