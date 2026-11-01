# Feature Preservation Matrix

This matrix records current source capabilities against proposed UX. “Current” means visible in the checked-in component and connected to service/store calls; it is not a simulator/device acceptance claim. The redesign must preserve behavior unless a separate product decision explicitly changes scope.

## Implementation progress — UX branch checkpoint

Implemented in source on `feature/ux-modernization-20261101-2b4ad87`:

- Shared warm-neutral/navy/emerald tokens; refreshed page/card/type/form/button/status/money primitives and minimum native touch sizing.
- Six onboarding states, explicit ownership confirmation, optional first account, review and completion. When an account is included, business/member/account creation now shares one SQL transaction; the opening entry remains Opening Balance Equity.
- Five primary tabs; global search action; Accounts and Settings under More; member-specific loan entry opens from a member row. Existing screen/service calls remain connected.

Automated baseline after this slice: `npm test` and `npm run typecheck` passed; 156 tests ran in the full suite. Native iOS/Android visual verification has not yet been recorded. The matrix below remains the preservation checklist; implementation status does not imply platform acceptance.

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
