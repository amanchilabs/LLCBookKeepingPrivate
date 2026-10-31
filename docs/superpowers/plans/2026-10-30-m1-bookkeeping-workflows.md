# Milestone 1 Bookkeeping Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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
- Test: `packages/storage-native/test/bookkeeping-store.test.ts`

**Interfaces:**
- Domain exports `BusinessSetup`, `MemberInterestInput`, `CashAccountInput`, `CashTransactionInput`, `assertValidBusinessSetup`, `assertOwnershipTotals`, `openingBalanceLines`, `cashIncomeLines`, `cashExpenseLines`, and `reverseLines`.
- Store exports `ensureBookkeepingSchema`, `createBusiness`, `getBookkeepingSnapshot`, `createCashAccount`, `recordCashTransaction`, and `replaceMembers`.
- Store operations use `withActiveDatabase`; every write and its journal lines are in one SQLite transaction.

- [ ] Write failing tests for business/date validation, explicit ownership confirmation, 40/20/20/20 total, positive and negative opening balance posting, income/expense posting, and balanced reversal lines.
- [ ] Verify the new tests fail because the domain and repository APIs do not exist.
- [ ] Implement the minimum domain rules and versioned tables for businesses, members, dated ownership interests, accounts, transactions, journal entries, and journal lines.
- [ ] Exercise the repository against in-memory SQLite and verify account/journal/P&L totals derive from persisted rows.
- [ ] Run focused tests and typecheck; commit the domain and repository slice.

### Task 2: Native business setup and member management

**Files:**
- Create: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Create: `apps/mobile/bookkeeping/BusinessSetupScreen.tsx`
- Create: `apps/mobile/bookkeeping/MembersScreen.tsx`
- Modify: `App.tsx`
- Test: `apps/mobile/bookkeeping/business-workflow.test.ts`

**Interfaces:**
- Native `App` renders the bookkeeping navigation; web keeps the synthetic preview.
- Setup collects LLC name, formation state/date, bookkeeping start date, member names, and proposed interests.
- Creating a profile requires an explicit confirmation of the displayed interests.
- Member interest changes are dated and append history; active percentages must total 100%.

- [ ] Add failing tests for setup persistence, required ownership confirmation, exact active ownership totals, and preserved interest history.
- [ ] Implement setup and Members screens connected to the repository snapshot and write APIs.
- [ ] Verify screen components use labels, accessible roles, and error/loading/locked states.
- [ ] Run focused tests and typecheck; commit the setup/member slice.

### Task 3: Accounts, opening balances, and cash transaction screens

**Files:**
- Create: `apps/mobile/bookkeeping/AccountsScreen.tsx`
- Create: `apps/mobile/bookkeeping/TransactionsScreen.tsx`
- Modify: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Test: `apps/mobile/bookkeeping/account-transaction-workflow.test.ts`

**Interfaces:**
- Account screens create bank/cash accounts and record opening balances through the repository.
- Transaction screens record income and operating expenses with date, classification, account, amount, and description.
- History supports text search and type/category/account filters.
- Corrections append a reversal and replacement linked to the original; the original rows remain immutable.
- CSV export includes date, category, amount, account, and description for every posted event, including reversals.

- [ ] Add failing workflow tests for opening balance, income, expense, close/reopen persistence, reversal/replacement, filters, and CSV output.
- [ ] Implement account and transaction UI connected to encrypted writes and repository snapshots.
- [ ] Verify journal lines balance and calculated account totals equal transaction cash movements.
- [ ] Run focused tests and typecheck; commit the accounts/transactions slice.

### Task 4: Persisted dashboard and cash-basis reports

**Files:**
- Create: `apps/mobile/bookkeeping/DashboardScreen.tsx`
- Create: `apps/mobile/bookkeeping/ReportsScreen.tsx`
- Modify: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Test: `apps/mobile/bookkeeping/reconciliation.test.ts`

**Interfaces:**
- Dashboard displays account balances and totals queried from journal lines.
- Reports show cash-basis income, expenses, and net income for a selected date range.
- The end-to-end synthetic workflow asserts dashboard, journal, report, and CSV reconciliation after a correction.

- [ ] Add failing reconciliation tests for opening balance plus income, expense, reversal, and replacement.
- [ ] Implement persisted dashboard and report queries and connect report navigation.
- [ ] Run the full host suite and typecheck; document whether a dedicated native device workflow was demonstrated.
- [ ] Commit and push the completed or clearly labeled WIP slice; leave the branch unmerged for review.

## Deferred from this implementation slice

- Milestone 2 guaranteed payments and member loans.
- Milestone 3 Balance Sheet, Trial Balance, General Ledger, member capital, and PDF reports.
- Native release/security gates required before real financial data or production use.
