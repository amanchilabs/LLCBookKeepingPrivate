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


<!-- Foundry pilot run-6a9ebcd4dfc04ca5 -->
## Foundry search usability pilot — 2026-11-03

Two presentation-only Stories completed on `feature/foundry-llc-pilot-20261103`; no main merge or release.

| Story | Implemented outcome | Validated/reviewed source |
|---|---|---|
| STORY-SEARCH-1 | Clearer idle, no-match and result-count feedback; polite live-region props. | `530700eab3b0511f50c07b7e207b8f9d9d56b717` |
| STORY-SEARCH-2 | Search result details in accessible labels, separate destination hints and a minimum 48-point/dp touch height. | `61ae2154abae7341f50b1219d1f7a2816cff7df0` |

Each source passed TypeScript, the full host suite, whitespace validation, a dedicated iOS Simulator/Android emulator search flow, and fresh Claude review. Search idle, no-match, clear, one-result and result navigation were exercised with existing synthetic records. Accounting, storage, schema, authentication, security and dependencies were unchanged.

Foundry automatically selected and launched Story 2 after publishing Story 1 evidence. The run/canonical evidence is in `.foundry/runs/run-6a9ebcd4dfc04ca5.json` and `.foundry/evidence/CAP-SEARCH-USABILITY/run-6a9ebcd4dfc04ca5/`. Native captures, launch/usage records and recovery evidence are in the Autonomous Foundry `feature/llc-pilot-20261103` branch under `docs/pilots/llc-20261103/`.

Limits: simulator/emulator presentation evidence only; VoiceOver/TalkBack, physical-device, security/recovery release and production/store acceptance remain separate gates. Stop at this two-Story boundary. This matrix closeout occurs after the run; the controller updated run/evidence progress at each Story boundary.
