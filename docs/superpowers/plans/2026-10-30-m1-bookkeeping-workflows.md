# Milestone 1 Bookkeeping Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Implementation checkpoint — 2026-10-30

The first vertical slice is implemented. Domain and storage tests, typecheck, and the full host test suite passed. The synthetic setup, four-member confirmation, opening balance, income/expense posting, app close/reopen, correction, dashboard/account reconciliation, date-ranged P&L, and CSV share flow were exercised in the iOS simulator. Android UI acceptance and the production security/recovery gates remain open, so Milestone 1 is not accepted.

**Goal:** Replace the native proof as the primary experience with persisted on-device LLC setup, member interests, accounts, balanced cash transactions, and reports.

**Architecture:** Keep the existing SQLCipher database generation and lease as the only persistence boundary. Add versioned bookkeeping tables and a repository that posts every financial event and its journal lines atomically; keep money and posting rules in the domain package. Native navigation reads only repository snapshots, while the web preview remains synthetic.

**Tech Stack:** Expo SDK 58, React Native, Expo SQLite with the existing SQLCipher gate, SecureStore, TypeScript, Vitest, and the existing fixed-precision USD helpers.

**Spec:** User-supplied “LLCBookKeepingPrivate — Business Capability Delivery Directive” in the implementation prompt.

## Global Constraints

- Financial records remain on device in the existing encrypted active database.
- Do not introduce cloud sync, backend dependencies, analytics, advertising, or bank connections.
- Keep all test and demonstration data synthetic.
- Reuse SQLCipher/key storage, restore coordination, `parseUsd`, `formatUsd`, and balanced journal validation.
- Use USD cents as integer minor units; post income and expenses on cash receipt/payment dates.
- Opening balances post against Opening Balance Equity; member ownership is informational and requires explicit user confirmation.
- Do not begin member loans or guaranteed payments before Milestone 1 acceptance.

---

### Task 1: Domain rules and encrypted bookkeeping repository

**Files:**
- Create: `packages/domain/src/bookkeeping.ts`
- Test: `packages/domain/test/bookkeeping.test.ts`
- Create: `packages/storage-native/src/bookkeeping-store.ts`
- Test: `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- Domain exports `BusinessSetup`, `MemberInterestInput`, `CashAccountInput`, `CashTransactionInput`, `assertValidBusinessSetup`, `assertOwnershipTotals`, `openingBalanceLines`, `cashIncomeLines`, `cashExpenseLines`, and `reverseLines`.
- Store exports `ensureBookkeepingSchema`, `createBusiness`, `getBookkeepingSnapshot`, `createCashAccount`, `recordCashTransaction`, and `replaceMembers`.
- Store operations use `withActiveDatabase`; every write and its journal lines are in one SQLite transaction.

- [x] Write tests for business/date validation, explicit ownership confirmation, 40/20/20/20 total, positive and negative opening balance posting, income/expense posting, and balanced reversal lines.
- [x] Implement the minimum domain rules and versioned tables for businesses, members, dated ownership interests, accounts, transactions, journal entries, and journal lines.
- [x] Exercise the repository against a temporary SQLite database and verify account/journal/P&L totals derive from persisted rows.
- [x] Run focused tests and typecheck; commit the domain and repository slice.

### Task 2: Native business setup and member management

**Files:**
- Create: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Create: `apps/mobile/bookkeeping/BusinessSetupScreen.tsx`
- Create: `apps/mobile/bookkeeping/MembersScreen.tsx`
- Modify: `App.tsx`
- Tests: `packages/domain/test/bookkeeping.test.ts`, `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- Native `App` renders the bookkeeping navigation; web keeps the synthetic preview.
- Setup collects LLC name, formation state/date, bookkeeping start date, member names, and proposed interests.
- Creating a profile requires an explicit confirmation of the displayed interests.
- Member interest changes are dated and append history; active percentages must total 100%.

- [x] Add tests for setup validation, required ownership confirmation, exact active ownership totals, and preserved interest history.
- [x] Implement setup and Members screens connected to the repository snapshot and write APIs.
- [x] Verify screens expose labeled controls, accessible roles, and error/loading/storage-unavailable states.
- [x] Run focused tests and typecheck; commit the setup/member slice.

### Task 3: Accounts, opening balances, and cash transaction screens

**Files:**
- Create: `apps/mobile/bookkeeping/AccountsScreen.tsx`
- Create: `apps/mobile/bookkeeping/TransactionsScreen.tsx`
- Modify: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Test: `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- Account screens create bank/cash accounts and record opening balances through the repository.
- Transaction screens record income and operating expenses with date, classification, account, amount, and description.
- History supports text search and type/category/account filters.
- Corrections append a reversal and replacement linked to the original; the original rows remain immutable.
- CSV export includes date, category, amount, account, and description for every posted event, including reversals.

- [x] Add repository tests for opening balance, income, expense, persistence across close/reopen, reversal/replacement, and CSV output.
- [x] Implement account and transaction UI connected to encrypted writes and repository snapshots.
- [x] Verify journal lines balance and calculated account totals equal transaction cash movements.
- [x] Run focused tests and typecheck; commit the accounts/transactions slice.

### Task 4: Persisted dashboard and cash-basis reports

**Files:**
- Create: `apps/mobile/bookkeeping/DashboardScreen.tsx`
- Create: `apps/mobile/bookkeeping/ReportsScreen.tsx`
- Modify: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Tests: `packages/domain/test/bookkeeping.test.ts`, `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- Dashboard displays account balances and totals queried from journal lines.
- Reports show cash-basis income, expenses, and net income for a selected date range.
- The end-to-end synthetic workflow asserts dashboard, journal, report, and CSV reconciliation after a correction.

- [x] Add reconciliation tests for opening balance plus income, expense, reversal, and replacement.
- [x] Implement persisted dashboard and report queries and connect report navigation.
- [x] Run the full host suite and typecheck; document that iOS simulator workflow was demonstrated and Android UI acceptance remains open.
- [ ] Commit and push the remaining UI and documentation changes; leave the branch unmerged for review.

## Deferred from this implementation slice

- Milestone 2 guaranteed payments and member loans.
- Milestone 3 Balance Sheet, Trial Balance, General Ledger, member capital, and PDF reports.
- Native release/security gates required before real financial data or production use.
