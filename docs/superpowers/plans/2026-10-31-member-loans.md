# Member and Third-Party Loans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record LLC member and third-party loan agreements, actual advances, principal and interest repayments, histories, and reconciled summaries in encrypted local books.

**Architecture:** Migrate SQLite v4 through v6, adding liability accounts, loan subledgers, and an explicit ACT/ACT ISDA label. Use the existing `calculateSimpleInterestCents` utility and per-agreement day-count conventions. Connect balanced posting services to a dedicated Loans screen and period summaries to Reports.

**Tech Stack:** TypeScript, Expo React Native, Expo SQLite/SQLCipher, Vitest, existing `decimal.js` simple-interest utility.

**Spec:** `docs/superpowers/specs/2026-10-31-member-loans-design.md`

## Global Constraints

- Financial data stays on device in the existing encrypted SQLite database.
- Unused loan commitments do not post to cash, principal, income, or expenses.
- Actual advances credit a liability; principal repayments reduce the liability; actual interest paid is a separate expense.
- Use the agreement's stored `ACT/365F` or `ACT/ACT ISDA` convention and the existing simple-interest utility; reject other ACT/ACT variants. Do not select statutory interest rates or claim deductibility.
- Every journal entry balances; loan activity is immutable and cannot use generic income/expense corrections.
- Use only synthetic data in tests and simulator verification.

---

### Task 1: Loan terms and interest ledger calculations

**Files:**
- Modify: `packages/storage-native/src/bookkeeping-store.ts`
- Test: `packages/storage-native/test/bookkeeping-store.test.mjs`
- Create: `docs/bookkeeping/member-loans-policy.md`

**Interfaces:**
- Input: `CreateLoanAgreementInput { id, businessId, lenderType, memberId?, lenderName?, agreementDate, commitmentCents, annualRateBasisPoints, dayCount, description }`.
- Derived summary: for each agreement, include `commitmentCents`, `totalAdvancesCents`, `principalRepaidCents`, `principalOutstandingCents`, `interestAccruedCents`, `interestPaidCents`, and `interestOutstandingCents` through a requested date.
- Convert integer basis points to an exact decimal string for `calculateSimpleInterestCents`; never convert money or rate through binary floating point.

- [x] **Step 1: Write failing tests** proving a member and third-party agreement is persisted without journal entries, cash changes, or P&L; commitment and rate fields round-trip exactly.
- [x] **Step 2: Run the focused test** with `npm exec vitest -- run packages/storage-native/test/bookkeeping-store.test.mjs`; confirm the expected missing agreement API fails.
- [x] **Step 3: Add transactional migrations**. v4→v5 rebuilds `accounts`, `journal_entries`, and `transactions` for liability and loan entries, then creates checked loan subledgers. v5→v6 names ACT/ACT ISDA explicitly and preserves agreement, advance, repayment, and journal history. Both verify foreign keys and roll back on failure.
- [x] **Step 4: Add agreement creation** validating lender identity, member activity on the agreement date, positive commitment, rate basis points in `0..100000`, supported day-count convention, and nonempty description. Agreement creation writes no journal entry.
- [x] **Step 5: Run focused tests and typecheck** with `npm exec vitest -- run packages/storage-native/test/bookkeeping-store.test.mjs && npm run typecheck`.
- [ ] **Step 6: Commit** the tested policy, migration, and agreement slice with `feat: add local loan agreements`.

### Task 2: Actual advances and liability posting

**Files:**
- Modify: `packages/domain/src/journal.ts`
- Modify: `packages/storage-native/src/bookkeeping-store.ts`
- Modify: `packages/storage-native/src/bookkeeping-service.ts`
- Modify: `apps/mobile/bookkeeping/TransactionsScreen.tsx`
- Test: `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- `RecordLoanAdvanceInput { id, transactionId, journalEntryId, loanId, date, cashAccountId, amountCents, description }`.
- Posting lines: debit selected bank/cash account by `amountCents`; credit that agreement's liability account by the same amount.
- Commitment remaining equals commitment less all recorded advances; repayments never restore it.

- [x] **Step 1: Add failing tests** for two dated advances, unchanged P&L, cash increase, liability increase, no advance beyond commitment, and rollback after a late duplicate-transaction failure.
- [x] **Step 2: Run the loan store tests** and confirm missing API/posting assertions fail.
- [x] **Step 3: Implement the per-agreement liability account** with `kind = 'liability'` and an ID tied to the agreement; validate the account belongs to the LLC and has the expected kind on reuse.
- [x] **Step 4: Implement atomic advance posting**. Validate date is not before agreement/business start, amount is positive, cumulative advances remain within commitment, lender record exists, and cash account is active. Insert balanced journal, transaction, and advance row in one SQLite transaction.
- [x] **Step 5: Verify** account balances, dated loan activity, journal balance, unchanged cash-basis P&L, reopen persistence, and foreign-key integrity.
- [ ] **Step 6: Commit** with `feat: post funded loan advances`.

### Task 3: Principal and interest repayments

**Files:**
- Modify: `packages/storage-native/src/bookkeeping-store.ts`
- Modify: `packages/storage-native/src/bookkeeping-service.ts`
- Test: `packages/domain/test/loan-interest.test.ts`
- Test: `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- `RecordLoanRepaymentInput { id, transactionId, journalEntryId, loanId, date, cashAccountId, principalCents, interestCents, description }`.
- Repayment journal lines debit liability for principal, debit loan interest expense for interest, and credit cash for their sum.
- Interest due uses advances and principal repayments through `[earliestAdvanceDate, repaymentDate)` and subtracts prior interest paid through that repayment date.

- [x] **Step 1: Add independent expected-answer fixtures** for multiple dated advances, principal reduction, leap-year and cross-year ACT/ACT ISDA, and cent rounding using manually calculated expected values.
- [x] **Step 2: Add failing repository tests** for principal-only, interest-only, mixed repayment, P&L including interest only, outstanding interest, and overpayment rejection with no partial writes.
- [x] **Step 3: Run focused tests** and confirm the uncovered loan-store behaviors fail before implementation.
- [x] **Step 4: Implement interest-due calculation** by loading persisted dated events and calling `calculateSimpleInterestCents`; pass annual rate as an exact decimal string derived from basis points.
- [x] **Step 5: Implement atomic repayment posting** validating nonnegative components, positive total, outstanding principal, accrued unpaid interest, active cash account, and date. Preserve separate principal/interest subledger amounts and transaction history.
- [x] **Step 6: Verify** cross-year amounts, member/third-party balance fixtures, journal balance, P&L, persistence, rollback, and unsupported generic correction rejection.
- [ ] **Step 7: Commit** with `feat: record loan principal and interest repayments`.

### Task 4: Loan screen and reports

**Files:**
- Create: `apps/mobile/bookkeeping/LoansScreen.tsx`
- Modify: `apps/mobile/bookkeeping/BookkeepingApp.tsx`
- Modify: `apps/mobile/bookkeeping/ReportsScreen.tsx`
- Modify: `packages/storage-native/src/bookkeeping-store.ts`
- Modify: `packages/storage-native/src/bookkeeping-service.ts`
- Test: `apps/mobile/bookkeeping/`

**Interfaces:**
- Snapshot includes loan agreements and dated activities needed to display lender, commitment, advances, principal, interest, account, date, and description.
- Loans screen provides agreement creation, advance entry, repayment entry, current balances, and immutable history.
- Reports shows member versus third-party summaries and selected-period advances, principal repayments, and interest payments; balances are labeled with their as-of date.

- [x] **Step 1: Exercise actual Android UI controls** for loan navigation, agreement/advance/repayment entry, explicit day-count label, and CPA/tax limitation copy.
- [x] **Step 2: Implement the Loans tab** using the existing `Choice`, `Field`, `Button`, `FormError`, and `Money` components, with no network access.
- [x] **Step 3: Connect persisted snapshot data** to agreement balances and chronological histories; refresh after every successful write.
- [x] **Step 4: Add period reporting** separating loan proceeds, principal repayments, accrued interest, and paid interest; only actual paid interest appears in expense totals.
- [ ] **Step 5: Complete cross-platform acceptance**. Android emulator exercise passed: create a member agreement → two dated advances → mixed principal/interest repayment → force-stop/relaunch → reconcile cash, liability, loan summary, and cash-basis P&L. iOS Simulator loan acceptance remains unverified.
- [ ] **Step 6: Commit** with `feat: add loan management screen and summaries`.

### Task 5: Regression and checkpoint

**Files:** all Phase 4 files above.

- [x] Run `npm test`, `npm run typecheck`, `node --check packages/storage-native/test/bookkeeping-store.test.mjs`, and `git diff --check`.
- [x] Review the intended file list and diff; no secrets or user financial data are included.
- [ ] Review the accounting policy against the persisted journal and independent fixtures.
- [ ] Commit any remaining intended changes, push the feature branch, query its live remote SHA, and verify clean tree/upstream equality.
- [ ] Keep physical-device and iOS Simulator verification separate from the Android emulator pass; do not infer either from unit tests.
