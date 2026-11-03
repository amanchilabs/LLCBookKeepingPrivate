# UX Redesign Implementation Migration Plan

**Status: proposed only.** This document sequences a later redesign after product review. No source, navigation, accounting, schema, dependency, or security behavior was changed for this design review. Each phase should be implemented on an approved feature branch with small checkpoints and both-platform verification.

## Preconditions

1. Approve the canonical screenshots, design tokens, five-tab navigation, and open decisions in `../proposed/design-decisions.md`.
2. Replace all screenshot/sample amounts with a single reconciled synthetic fixture. Resolve the $40 balance-sheet mismatch and reversed-expense sign examples.
3. Freeze functional behavior during the presentation migration. Record an inventory of existing `BookkeepingApp` branches and screen callbacks; preserve the SQLCipher store, backup/recovery tools, source record IDs, accounting policies, and exports.
4. Confirm any capability represented as “available” against its current component, service, persistence record, and tests. If it is not implemented, mark it proposed or remove the control.
5. Decide cross-platform accessibility and dark-mode acceptance requirements before visual QA.

## Phase 0 — Baseline and shared visual primitives

**Scope:** tokens, typography, spacing, button, field, panel/card, badge/status, row, money display, headings, safe-area and navigation primitives in `apps/mobile/bookkeeping/ui.tsx`, `layout.ts`, and the shell. Preserve existing public component props and actions.

**Work:**

- Implement approved tokens and platform-aware spacing with accessible contrast, touch sizes and dynamic type.
- Standardize inline errors, helper text, loading/no-data states, focus/pressed/disabled states, and semantic amount formatting.
- Keep the current eight-tab shell during this phase; do not combine a visual-system rollout with navigation migration.
- Add visual baselines only after using sanitized synthetic records. Do not store real financial records in snapshots or logs.

**Gate:** existing form actions still call the same domain/storage functions; typecheck and tests pass; no unexplained visual overflow on narrow iOS/Android screens.

## Phase 1 — Dashboard and transaction presentation

**Components:** `DashboardScreen.tsx`, `TransactionsScreen.tsx`, `RecurringTransactionsSection.tsx`, `TransactionCsvImportPanel.tsx`, `bookkeeping-search.ts`.

**Work:**

- Recompose the dashboard into cash, cash-basis income/expenses, accounts, reminders and recent activity with correct labels.
- Improve transaction search/filter visibility, selected-filter summary, clear filters, grouped history and no-results state.
- Add a read-only transaction-detail presentation and linked reversal/replacement history only if it calls existing data and does not create a second source of truth.
- Keep transactions, category splits, transfers, manual recurring posting, CSV import validation, and explicit CSV share behavior unchanged.
- Remove member allocation, direct edit/delete, tax claims, automatic posting or hidden sync affordances from concepts.

**Gate:** original/income/expense/transfer/correction history and exported CSV reconcile before and after the UI refactor.

## Phase 2 — Members, capital, payments, and loans presentation

**Components:** `MembersScreen.tsx`, `LoansScreen.tsx`, member search rows, report links.

**Work:**

- Separate member list, member detail, capital ledger, guaranteed-payment obligation/payment history and loan activity views while reusing current stores/services.
- Show dated ownership history separately from contributions/distributions. No automatic profit/loss or income allocation.
- Show cash/property contribution and distribution records in capital. Keep loan liability/principal/interest and guaranteed-payment cash events outside capital balance.
- Separate obligations from actual payment rows and show the cash effect only for posted cash events.
- Show loan commitment ceiling, actual advances, principal outstanding, principal repayments, paid interest, as-of date and stored day-count convention.
- Preserve one-member owner-equity policy and CPA review notes.

**Gate:** per-member activity summaries reconcile to journal records and each dedicated subledger; correction/reversal links remain available; single-member restrictions remain enforced.

## Phase 3 — Five-tab shell and secondary navigation

**Components:** `BookkeepingApp.tsx`, shell/header/navigation, Dashboard, Transactions, Members, Reports, More destinations.

**Work:**

- Implement Dashboard / Transactions / Members / Reports / More only after approving Search entry and transition details.
- Put Accounts and manual Reconciliation under More → Accounts; deep-link to account list from dashboard balances.
- Put member payments and loans in member context, while keeping third-party lenders discoverable in a Loans/report summary if necessary.
- Put Settings, local reminders, period close/reopen and explicit storage/recovery entry under More.
- Add global search through a labeled shared header action if approved; retain transaction-specific filters.
- Preserve Android back and iOS safe-area behavior; route state must not silently discard drafts.

**Gate:** all old destinations/actions remain discoverable, no route is stranded, and all core tasks take no more than three transitions from an appropriate top-level screen.

## Phase 4 — Accounts, reconciliation and reports presentation

**Components:** `AccountsScreen.tsx`, `ReportsScreen.tsx`, `report-exports.ts`, `report-pdf.ts`.

**Work:**

- Split the current long Accounts/Reconciliation page into account summary and focused manual reconciliation states, without adding a bank connection.
- Present report selection, date/as-of range, basis, detail and export consistently. Keep current report calculations and export serializer paths.
- Label P&L cash basis; Balance Sheet/Trial Balance/General Ledger book basis; statement-vs-book reconciliation difference; member capital book activity; payment and loan workpapers.
- Replace tax-ready and scheduled/email report controls with supported report/explicit share actions.
- Show “review needed” only where source records or CPA-review annotations support the flag; do not create tax conclusions.

**Gate:** each displayed report subtotal and export reconciles with the same persisted journal/subledger data for identical date ranges.

## Phase 5 — Onboarding, More, privacy, recovery presentation

**Components:** `BusinessSetupScreen.tsx`, `SettingsScreen.tsx`, `WorkspacesSection.tsx`, `RemindersSection.tsx`, `BookkeepingApp.tsx` native proof route.

**Work:**

- Convert the one-page business setup into the approved step flow. Preserve data until explicit confirmation; use an explicit 40/20/20/20 confirmation for four members; allow optional account setup only if the user can later find the action easily.
- Remove tax classification and invented entity facts. Do not add EIN/address or contact data without a separate scope and privacy review.
- Group existing workspace, reminder, period and privacy controls in More.
- Clearly distinguish bookkeeping screens from native security/recovery proof. Keep backup and restore explicit and file-based; do not add cloud controls.
- Avoid app lock, Face ID, multi-user authorization, analytics or automatic backup controls until separately implemented and release-approved.

**Gate:** setup values and ownership totals persist; cancellation cannot partially create a workspace; restore/security entry points remain reachable; copy matches verified product state.

## Phase 6 — Cross-platform validation and rollout

**Scope:** iOS simulator/device and Android emulator/device presentation, accessibility and end-to-end regression.

**Work:**

- Exercise setup, account/opening balance, income, expense, transfer, corrections, search/filter, member edit/history, contribution/distribution, guaranteed payment obligation/payment/reversal, loan advance/repayment, reconciliation, each report/export, close/reopen and backup/recovery entry.
- Verify persistence after terminate/relaunch using synthetic data only. Compare screen values, report values, persisted journal/subledgers and exported CSV/PDF.
- Verify screen reader labels/order, larger text, keyboard, low-width Android, iPhone safe areas, dark mode if approved, and OS share sheet.
- Capture actual native screenshots for review; label any simulator/emulator-only evidence and any physical-device gap accurately.

**Gate:** platform acceptance criteria in `acceptance-criteria.md` pass. A visual approval does not substitute for accounting, persistence, security, or physical-device gates.

## Explicitly out of scope for the redesign migration

- Schema, migration, journal posting policy, domain arithmetic, backup format, key storage, security architecture, and dependency changes.
- New financial features (tax calculations, allocations, permissions, bank feeds, cloud sync, automatic report delivery, biometric lock) unless separately approved and specified.
- App-store submission or production-security signoff.

## Rollback strategy

Keep each phase isolated and reversible. If presentation regression affects task completion, restore the prior component layout while retaining domain/service code untouched. Do not revert or rewrite user data to recover a visual change. Preserve branch checkpoints and re-run relevant accounting/persistence regressions after every rollback.
