# Feature Preservation Matrix

This matrix records checked-in source capabilities against the approved UX. “Implemented” means visible in a component and connected to existing service/store calls; it is not simulator, physical-device, accessibility, or production acceptance. The redesign must preserve behavior unless a separate product decision explicitly changes scope.

## Implementation progress — UX branch checkpoint

Implemented in source on `feature/ux-modernization-20261101-2b4ad87`:

- Shared warm-neutral/navy/emerald tokens; refreshed page/card/type/form/button/status/money primitives and minimum native touch sizing.
- Six onboarding states, explicit ownership confirmation, optional first account, review and completion. When an account is included, business/member/account creation now shares one SQL transaction; the opening entry remains Opening Balance Equity.
- Five primary tabs; global search action; Accounts and Settings under More; member-specific loan entry opens from a member row. Existing screen/service calls remain connected.
- Dashboard now groups live account balances, cash-basis summaries, quick actions, recent transactions, members, reminders, and reports; quick actions route to the existing transaction form. The action card is above the balance summary so income and expense entry are visible without scrolling on the tested iPhone.
- Transactions now offer selected-record detail and correction lineage, visible clear-filters action, and a deep link from dashboard quick actions. Posting and correction services are unchanged.
- Global search was exercised against persisted synthetic data: searching for “Rent” returned both the Rent account and November rent transaction. Transaction type filtering selected Expenses, showed 2 of 5 records, and Clear filters restored all 5 records.
- Transactions now has History, Recurring, and Import CSV sections; their existing local records/forms stay mounted while switching sections. Quick entry and correction return to History.
- Members now separates member/ownership editing, capital activity/ledger, and guaranteed-payment/payment history into local workspace sections. Draft state and storage calls remain in the existing screen.
- Reports now selects one persisted report at a time and keeps the reporting period controls shared across P&L, cash movement, book-basis reports, capital, payments, and loans. Export serializers and calculations are unchanged.
- Settings and More copy no longer implies unverified encryption status.

Automated verification on this checkpoint: `npm test` passed (157 tests); `npm run typecheck` passed; `git diff --check` passed. Native iOS evidence is captured on the iPhone 17 simulator after a successful XcodeBuildMCP build. Synthetic Northstar Studio LLC data persisted through app termination and relaunch. Android remains unverified: `adb devices -l` reported no attached device. An offline API 36 Gradle build started but was stopped before completion when free disk space fell from 1.7 GiB to 173 MiB; no APK was produced and the AVD was not booted. Screenshots are outside Git at `~/Downloads/LLCBookKeepingPrivate/UX-Implementation-20261101/screenshots/ios/`. They include onboarding review/completion, account setup, dashboard before/after correction and relaunch, transaction form/history/audit lineage, History/Recurring/Import CSV, members, capital, payments, a loan screen, Reports, More, Accounts, and Settings. The development-tool floating button is visible in simulator captures and is not application chrome. iOS simulator verification is not physical-device or production acceptance.

### Native iOS workflow verified on synthetic data

- Created Northstar Studio LLC (CA; formed/books begin 2025-01-10), confirmed four members at 40/20/20/20, and created Operating checking with a $1,250 opening entry against Opening Balance Equity.
- Posted $400 Design project revenue and a $75 initial expense, then used the correction screen to retain the original and post a $75 reversal plus a $90 Rent replacement.
- Transaction history displayed five persisted records, including the original, reversal, and replacement. Dashboard showed $1,560 cash, $400 cash-basis income, $90 cash-basis expenses, and $310 net income.
- Terminated and relaunched the app. The business, account balance, and report totals remained present.
- The onboarding start-date/opening-date linkage bug reproduced during UI entry and was fixed: the opening date now falls back to the complete bookkeeping start date rather than retaining its first typed character. Review displayed the full 2025-01-10 date.
- Bottom navigation labels were tightened to stay on one line at iPhone width. Dashboard → Accounts → More and More → Settings were exercised on the simulator.

### Current platform status

| Platform/workflow | Status | Evidence or gap |
|---|---|---|
| iOS build | PASS | XcodeBuildMCP build and launch succeeded on iPhone 17 simulator. |
| iOS synthetic onboarding, transaction correction, reconciliation totals, relaunch persistence | PASS | Native UI; screenshots listed above; displayed values reconciled. |
| iOS Dashboard quick expense entry | SIMULATOR PASS | Maestro confirmed the expense action is visible in the initial dashboard viewport and opens the existing Operating expense form; no transaction was posted by this navigation check. |
| iOS Transactions History, Recurring, Import CSV | SIMULATOR PASS | Maestro switched each section and asserted its intended content; screenshots are in the external iOS gallery. Existing synthetic transaction records remained visible in History. |
| iOS global search and transaction filter/clear | SIMULATOR PASS | Native UI search for “Rent” returned the Rent account and November rent transaction. Expenses filter showed 2 of 5 records; Clear filters restored all 5, including the reversal lineage. Screenshot of category search is `global-search-category-results.png` in the external iOS gallery. |
| iOS Reports, Members, Capital, Payments, Accounts, More, Settings, Loans | SIMULATOR CAPTURED | Native screens opened and captured; Maestro confirmed Members → Capital and Members → Payments render their intended sections, and Members → Loans opens the member-specific loan screen. Remaining advanced forms and accessibility states still need dedicated interaction checks. |
| Android build/UI | NOT VERIFIED | `adb devices -l` returned no devices. Offline Gradle build was stopped at 173 MiB free disk; no APK was produced and the API 36 AVD was not booted. |
| Physical-device beta | NOT VERIFIED | No physical-device run or signed beta is claimed. |

| Capability | Current component / source | Persistence or calculation | Proposed UX | Preservation / gap |
|---|---|---|---|---|
| Create LLC profile | `BusinessSetupScreen.tsx` | `createBusiness`; local encrypted bookkeeping store | Multi-step onboarding | Preserve name, formation state/date, bookkeeping start date and atomic create. Add only presentation steps; no tax-classification selector. |
| Initial members / ownership | `BusinessSetupScreen.tsx`, `MembersScreen.tsx` | ownership basis points; total validation; dated `memberHistory`; `replaceMembers` | Setup member step and Members | Preserve explicit 100% rule, dates and history. Four-member 40/20/20/20 is suggested only and must be confirmed. No allocation inferred. |
| Multiple local LLC workspaces | `WorkspacesSection.tsx`, `BookkeepingApp.tsx` | local business profiles and selected business | More/workspace selector | Present in source. Keep local-only and avoid login, sharing or synchronization claims. |
| Bank/cash accounts | `AccountsScreen.tsx` | `createCashAccount`; balance from journal lines | More → Accounts; Dashboard summary | Preserve opening date/amount and calculated balance. Opening offset is Opening Balance Equity. No connected account/bank credentials. |
| Income/operating expenses | `TransactionsScreen.tsx` | fixed-precision `parseUsd`; balanced journal posting | Transactions | Preserve account/category/date/description/amount validation and balanced posting. No member allocation. |
| Category-split transactions | `TransactionsScreen.tsx` | split category lines must sum to transaction total | Transaction form | Preserve. These are accounting category splits, not member distributions or ownership allocations. |
| Transfers | `TransactionsScreen.tsx` | balanced source/destination account posting; excluded from P&L | Transactions | Preserve both account movements; net zero across accounts. Never classify as income/expense. |
| Search and filters | `SearchScreen.tsx`, `TransactionsScreen.tsx`, `bookkeeping-search.ts` | search snapshot and transaction filters | Header global search plus transaction filters | Preserve cross-record search and filters. A five-tab shell must not make search undiscoverable. |
| Corrections / audit | `TransactionsScreen.tsx` | `correctCashTransaction`; linked reversal and replacement | Transaction detail + correction flow | Preserve original plus reversal/replacement, dates and links. No direct edit/delete. |
| CSV import / recurring templates | `TransactionCsvImportPanel.tsx`, `RecurringTransactionsSection.tsx` | validation/import and recurring template records; post remains user initiated | Not pictured in canonical mockups | Preserve and give explicit Transactions sub-navigation or section. Import must remain previewed/validated and not partially commit; schedules do not auto-post. |
| Dashboard totals | `DashboardScreen.tsx` | snapshot cash balances, cash-basis report totals, activity | Dashboard | Preserve calculated values. Opening equity is not income or contribution; label date/context; no mock hard-coded metrics. |
| Member capital activity | `MembersScreen.tsx` | `recordMemberCapitalActivity`; dated cash/property contributions and distributions; journal and member summaries | Members → member → Capital | Preserve balanced entries and subledger. Contributions are not income; distributions are not operating expenses. Book capital is not tax/outside basis. |
| Guaranteed-payment obligations | `MembersScreen.tsx` | `createGuaranteedPaymentObligation`; dated installments/obligation states | Members → member → Payments | Preserve services/use-of-capital, recurrence, due/overdue and balances. Obligation alone posts no journal/cash or cash-basis expense. |
| Actual guaranteed payments | `MembersScreen.tsx` | `recordGuaranteedPayment`, allocations, reversal cash events | Members → member → Payments | Preserve explicit actual payment, balanced posting, cash movement, member history and reversal. Never add to capital ledger. |
| Member/third-party loans | `LoansScreen.tsx` | agreement, commitment ceiling, multiple advances, repayment, simple-interest summary | Members → Loans; report summary | Preserve distinct commitment, advances, principal and paid interest; ACT/365F or ACT/ACT ISDA basis; loans excluded from income/capital; principal excluded from expense. |
| Manual reconciliation | `AccountsScreen.tsx` | reconciliation statement, cleared items/events, complete/reopen | More → Accounts → Reconcile | Preserve manual-only workflow. Difference is visible; reconciliation does not alter journal or balance. No bank feed. |
| Cash-basis P&L | `ReportsScreen.tsx` | `getCashBasisReport` from journal lines; CSV/PDF | Reports → P&L | Preserve report period and basis; income/expenses/net must reconcile. Not a tax return. |
| Cash movement | `ReportsScreen.tsx` | `getCashMovementReport` | Reports → Cash movement | Preserve beginning + net movement = ending balances and transfer behavior. Distinguish movement from current cash balance. |
| Book Balance Sheet / Trial Balance | `ReportsScreen.tsx` | `getJournalBalanceReport`; journal-derived balances | Reports | Preserve assets-liabilities-equity difference and current earnings; no “final” claim or tax-basis implication. |
| General Ledger | `ReportsScreen.tsx` | `getGeneralLedgerReport` by selected account | Reports | Already present in source even though not pictured. Keep discoverable; no new accounting behavior required for presentation. |
| Member capital report | `ReportsScreen.tsx` | date-filtered contribution/distribution movements | Reports | Preserve member-level movement totals; exclude GP/loan flows and do not infer tax basis. |
| GP and loan workpapers | `ReportsScreen.tsx` | persisted payment cash events and loan activities, independent summaries | Reports | Preserve period/as-of dates, reversal behavior, principal vs interest, and basis/estimate labels. No tax assertions. |
| CSV/PDF export | `TransactionsScreen.tsx`, `ReportsScreen.tsx` | serialized from persisted records; explicit system share sheet | Transaction/report export | Preserve reconciliation and explicit destination selection. Replace “email,” scheduled delivery, or cloud actions with OS share. |
| Reminders | `RemindersSection.tsx`, `DashboardScreen.tsx` | local reminder records; no journal effects | More and Dashboard preview | Preserve local-only, non-posting state. Do not imply system notifications unless implemented. |
| Period close/reopen | `SettingsScreen.tsx` | period event history and posting lock through date | More → Settings → Bookkeeping periods | Preserve audited reason and locked posting dates; no closing entries or changed historic balances. |
| Privacy statement | `SettingsScreen.tsx` | static product copy | More → Privacy | Keep exact claims tied to product. No cloud sync, bank connection, analytics/ads, or backend. |
| Encrypted storage / key storage / backup proof | `App.tsx`, native proof screen and backup modules | SQLCipher/local platform keys; explicit encrypted backup/restore path | More → Privacy & recovery | Preserve existing controls and recovery entry. Do not redesign internals or imply app lock/biometrics/cloud. Security release gates remain separate. |
| App lock / biometrics | No current bookkeeping screen/capability | Not implemented | Appears in security mockups | Must not show as enabled or available. It is a future security/release-gate item. |
| Roles / shared member access | No implementation | No roles/permissions model | Appears in member/settings/security mockups | Remove. Member records are bookkeeping subjects, not app users. |
| Tax classification / tax-ready output | No approved current model or tax engine | No tax calculation | Appears in onboarding/reports mockups | Remove or clearly show CPA review note; never label output tax-ready or filing-ready. |

## Invariants for presentation-only changes

- Do not change service call arguments, domain validators, journal line generation, date semantics, rounding, report formulas, store schema, migrations, or backup format.
- A value displayed in a new card must be sourced from the same persisted snapshot/report as before; no fixture constants in production screen components.
- If a component is split into routes, pass stable IDs and re-read persisted state; do not create a parallel in-memory ledger.
- Keep local privacy and explicit export boundaries visible at each external share/backup action.
- The feature is preserved only after end-to-end UI behavior and reconciliation are reverified on both platforms.


<!-- Foundry run-1b29df1ff539427b STORY-BOOK-001 -->
### STORY-BOOK-001 — validated

Capability: `CAP-BOOK-EXCHANGE-001`. Branch: `feature/bookkeeping-tax-exchange-20261105`.

Exact validated source: `c33f72765fd3756dc9f085e51074dd6552a56ebb`. Profile: `claude-m5-subscription-canonical`.

Outcome: Create the sole versioned bookkeeping-to-tax exchange v1 JSON schema, synthetic example fixture, TS validator/serializer and meaningful automated tests. Read the approved pilot document. Expose a lossless serialized record with schemaVersion=1, product LLCBookKeepingPrivate, basis cash, currency USD, source business ID/name and source reference, period fromDate/throughDate, reviewStatus unreviewed, and incomeCents/expenseCents/netIncomeCents decimal integer strings copied exactly from an existing CashBasisReport; never recompute journal totals, allocate or classify tax. Explicit limitations: book figures only, not a tax return or deductibility/tax-basis determination; no sync/import implemented. Support negative book totals without floating-point coercion. Fail closed on unknown versions, malformed/leap-day dates, reversed period, unsupported currency, invalid cents (including unsafe numeric input), missing/invalid source/review status or mismatched report period; reject extra unknown schema fields to avoid silently losing semantics. Export typed APIs usable by the next UI Story; use existing report date validator if sufficient, strengthen only the new module otherwise. Fixture must clearly be synthetic. Tests validate fixture parity and roundtrip >MAX_SAFE_INTEGER strings, boundaries and malformed inputs; do not test source strings. Do not modify package manifests, existing domain/storage or report calculation code.

Required checks passed; independent review: PASS. See `.foundry/evidence/CAP-BOOK-EXCHANGE-001/run-1b29df1ff539427b/STORY-BOOK-001.json`. No merge, deployment or release acceptance implied.


<!-- Foundry run-1b29df1ff539427b STORY-BOOK-002 -->
### STORY-BOOK-002 — validated

Capability: `CAP-BOOK-EXCHANGE-001`. Branch: `feature/bookkeeping-tax-exchange-20261105`.

Exact validated source: `db2fa91659327051a803a3bcb662902971df214c`. Profile: `claude-m5-subscription-canonical`.

Outcome: Integrate the existing v1 exchange serializer into a bounded Reports Bookkeeping exchange section. Use a new BookkeepingExchangePanel component with meaningful component tests via existing react-dom/server and React Native mocks (no new dependencies). Reports passes current source/business + existing computed report, requested dates, loading/error state and a JSON share callback. Never fetch or mutate ledger in the panel. Show source, period, cash basis, unreviewed/review needed, amounts and exclusions; missing data, bad dates, mismatched/stale report period or report failure disable export with a clear explanation. Explicit button Prepare bookkeeping JSON (accessibilityLabel same) invokes only the validated payload. Use explicit OS share action with application/json via existing expo File/Paths and Sharing patterns, handle errors and cancellation honestly (prepared/share-sheet opened, not delivered/sent). Preserve existing CSV/PDF/report flows. No tax calculations, import, sync, persistence/security changes. Minimum 48 native target for new buttons using existing Button. Add component tests for valid/empty/error/stale/loading states, exact payload callback/disabled behavior. Keep the new report section title Bookkeeping exchange and control label Exchange so the dedicated native test can find it. Coordinator native evidence at .foundry-host/parallel-pilot-20261105/native/<source SHA>/ in the Foundry root must be inspected during review; no physical-device or assistive-tech pass inferred.

Required checks passed; independent review: PASS. See `.foundry/evidence/CAP-BOOK-EXCHANGE-001/run-1b29df1ff539427b/STORY-BOOK-002.json`. No merge, deployment or release acceptance implied.


<!-- Foundry run-c87cbdc3a56d458b RECOVERY-001 -->
### RECOVERY-001 — validated

Capability: `CAP-BOOK-RECOVERY-001`. Branch: `feature/bookkeeping-full-recovery-20261116`.

Exact validated source: `1e8baa7c09a492eec87a5a8ea07942e63dc98fec`. Profile: `agy-m5-llc-secondary`.

Outcome: Read docs/recovery/AUTHORIZATION-20261116.md and IMPLEMENTATION-PLAN-20261116.md. Owner-authorized non-UI only; no UI/assets/registry/approval edits, dependencies, accounting semantics changes, new agents, native commands, branch changes, commits or pushes. Write meaningful failing tests first; coordinator executes checks. Reuse existing patterns, keep files focused. Document exact limits. Complete lossless dataset snapshot and isolated SQL import. Inventory every schema-13 bookkeeping table/column from ensureBookkeepingSchema and migrations, including all workspaces/preferences, business/member and ownership history, accounts/journals/lines, transactions/splits/correction roles/history, capital, loan agreements/advances/repayments/reversals, guaranteed obligations/installments/payments/allocations/reversals, recurring templates/occurrences, reminders, accounting periods and reconciliation items/events. Define a strict versioned portable payload and exported table inventory; reject unknown newer schema, malformed/duplicate rows, unsupported column shapes and unknown bookkeeping tables rather than silently dropping. Preserve integer cents/date/reference values losslessly and stable IDs. Consistent snapshot export must use a transaction, no destructive migrations on source. Isolated import must accept ONLY empty destination, create supported schema using existing function, use parameterized statements in FK-safe order/transaction, validate FK and integrity, compare complete rows/counts deterministically. Failure leaves existing source/target unchanged; reject nonempty target. Do not serialize device keys, proof records or arbitrary sqlite_master SQL. Test real file-backed SQLite with existing Node adapter pattern; validate all inventory tables exist and unknown schema/extra tables/columns fail closed. Add coverage document explicitly distinguishing supported bookkeeping dataset from external/nonexistent receipt storage. Expose APIs for subsequent encryption/restore Stories. Accounting schema version must remain 13; no modifying the existing schema or calculations.

Required checks passed; independent review: PASS. See `.foundry/evidence/CAP-BOOK-RECOVERY-001/run-c87cbdc3a56d458b/RECOVERY-001.json`. No merge, deployment or release acceptance implied.


<!-- Foundry run-c87cbdc3a56d458b RECOVERY-002 -->
### RECOVERY-002 — validated

Capability: `CAP-BOOK-RECOVERY-001`. Branch: `feature/bookkeeping-full-recovery-20261116`.

Exact validated source: `b1db5a9aa1a7e813bbb91af099b52477f4c37869`. Profile: `claude-m5-llc-login`.

Outcome: Read docs/recovery/AUTHORIZATION-20261116.md and IMPLEMENTATION-PLAN-20261116.md. Owner-authorized non-UI only; no UI/assets/registry/approval edits, dependencies, accounting semantics changes, new agents, native commands, branch changes, commits or pushes. Write meaningful failing tests first; coordinator executes checks. Reuse existing patterns, keep files focused. Document exact limits. Passphrase-encrypted complete dataset backup APIs. Use RECOVERY-001 APIs to encode/decode a complete bookkeeping payload under the EXISTING authenticated portable AES-GCM/PBKDF2 envelope (600000 iterations and existing bounds), with a separate explicit bookkeeping payload discriminator/version so proof-only payloads cannot be restored as books or vice versa. Add pure non-UI create/decrypt backup APIs using an injected crypto interface and native adapter reusing existing crypto.native.ts production encrypt/decrypt implementation; browser unavailable behavior remains unchanged. Validate payload before encryption and strict decode/schema/manifest after authentication; enforce bounds before expensive work, zero transient plaintext buffers when owned, no keys/passphrases in logs/errors/payload. Restore works with passphrase and backup bytes, not original Keychain. Tests must perform real AES-GCM/PBKDF2 roundtrips using Node crypto adapter with identical production envelope/authenticated metadata; mock-only roundtrips are insufficient. Cover different ciphertext for same data, exact restored payload, wrong password, bit flips in header/salt/nonce/ciphertext/tag, truncation, unsupported envelope/payload/schema, oversized input, weak passwords and proof-payload rejection. Clearly label host crypto conformance tests versus unexecuted native implementation. Do not wire UI or replace proof backup.

Required checks passed; independent review: PASS. See `.foundry/evidence/CAP-BOOK-RECOVERY-001/run-c87cbdc3a56d458b/RECOVERY-002.json`. No merge, deployment or release acceptance implied.


<!-- Foundry run-c87cbdc3a56d458b RECOVERY-003 -->
### RECOVERY-003 — validated

Capability: `CAP-BOOK-RECOVERY-001`. Branch: `feature/bookkeeping-full-recovery-20261116`.

Exact validated source: `664a4983e0c5e2f25aed26d7b5fd37918d07024e`. Profile: `agy-m5-llc-secondary`.

Outcome: Read docs/recovery/AUTHORIZATION-20261116.md and IMPLEMENTATION-PLAN-20261116.md. Owner-authorized non-UI only; no UI/assets/registry/approval edits, dependencies, accounting semantics changes, new agents, native commands, branch changes, commits or pushes. Write meaningful failing tests first; coordinator executes checks. Reuse existing patterns, keep files focused. Document exact limits. Complete recovery parity, isolated lifecycle and failure injection. Build non-UI restore orchestration around new modules. Always authenticate+validate before requesting isolated fresh candidate. Candidate local key comes from destination provisioning, never source key. No active catalog/device DB mutation or production activation in this milestone; return verified candidate only through explicit lifecycle contract, dispose rejected candidates and leave active source unchanged. Add native factory/non-UI integration if possible using existing SQLCipher/storage lease APIs WITHOUT altering proof store or UI; do not invent unsafe default adapter. A checked candidate must have complete row/relationship/history parity and balanced existing journal/report/reconciliation totals before eligibility. Create deterministic multi-workspace synthetic fixtures via existing domain/store APIs covering every supported table including reversal/correction, capital, guaranteed payments, loans/reversals, recurring, splits, reconciliation events and closed/reopened periods. Restore an actual encrypted backup into an isolated fresh file-backed DB with different synthetic destination key identity; compare complete rows and existing cash/P&L, balance/trial/general ledger and reconciliation reports. Tests inject failures at decrypt, candidate provision, schema, row import, verification and cleanup; verify original files/rows not modified, rejected target not published, cleanup failure surfaced and no active switch. Exercise meaningful supported legacy schema migration using existing migrations only on isolated candidate; unsupported newer schemas fail closed and source bytes stay unchanged. If legacy payload migration is not implemented, reject explicitly and document rather than claiming support. Document host plain SQLite versus native SQLCipher/device limits and exact reproducible coordinator validation commands. No user accessible controls; no simulator/physical-device commands or modifications.

Required checks passed; independent review: PASS. See `.foundry/evidence/CAP-BOOK-RECOVERY-001/run-c87cbdc3a56d458b/RECOVERY-003.json`. No merge, deployment or release acceptance implied.
