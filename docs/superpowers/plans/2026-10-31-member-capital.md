# Member Capital Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Persist cash/property contributions and member distributions in balanced journals, expose member capital ledgers, and connect entry and summary views to the native UI.

**Architecture:** Add pure posting helpers, migrate the existing encrypted SQLite schema from version 1 to version 2 without losing M1 records, and atomically write journal entries with a member-linked capital activity subledger. Read member book-capital summaries from persisted subledger activity; keep all capital movements outside the M1 cash-basis income/expense totals.

**Tech Stack:** TypeScript, React Native, Expo SQLite lease, SQL transactions, Vitest with Node SQLite.

**Spec:** `docs/bookkeeping/phase2-member-capital-policy.md`

## Global Constraints

- Use synthetic data only; preserve the existing encrypted local database boundary.
- Cash contributions debit cash and credit member capital; property contributions debit a noncash asset and credit member capital; distributions debit member capital and credit cash.
- Member capital is book activity only and must not be described as tax basis, outside basis, or allocated by ownership percentages.
- Property contribution valuations must be marked for CPA review.
- Every journal entry is balanced and each journal/subledger write is atomic.
- Do not implement guaranteed payments, loans, cloud synchronization, or tax filing in this slice.

---

### Task 1: Domain posting rules

**Files:**
- Modify `packages/domain/src/bookkeeping.ts`
- Modify `packages/domain/test/bookkeeping.test.ts`

**Interfaces:**
- Produce `cashCapitalContributionLines(cashAccountId, memberCapitalAccountId, amountCents)`.
- Produce `propertyCapitalContributionLines(propertyAssetAccountId, memberCapitalAccountId, amountCents)`.
- Produce `memberDistributionLines(memberCapitalAccountId, cashAccountId, amountCents)`.
- Each helper rejects nonpositive amounts and returns exactly balanced debit/credit lines.

- [x] Add expected debit/credit tests for all three posting types and invalid amounts.
- [x] Run the focused domain test and verify the new helper imports fail before implementation.
- [x] Implement the three helpers using `assertBalancedEntry`.
- [x] Run focused domain tests and the existing domain regression suite.

### Task 2: Atomic schema migration and persistence

**Files:**
- Modify `packages/storage-native/src/bookkeeping-store.ts`
- Modify `packages/storage-native/src/bookkeeping-service.ts`
- Modify `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- Produce `MemberCapitalActivityInput` with `id`, `journalEntryId`, `businessId`, `memberId`, `date`, `kind`, positive `amountCents`, `description`, and either `cashAccountId` or `propertyDescription`.
- Produce `MemberCapitalActivityRecord` with the persisted date, kind, amount, description, member identity, account labels, and `requiresCpaReview`.
- Produce `recordMemberCapitalActivityInDatabase` and the app service `recordMemberCapitalActivity`.
- Schema version 2 adds `asset` accounts, capital journal types, and `member_capital_activity`; existing accounts and M1 journals must survive migration with valid foreign keys.

- [x] Add migration tests against a version-1 fixture with existing business, account, member, and journal rows, including a corrupted-reference rollback fixture.
- [x] Add store tests for cash contribution, property contribution, and distribution; assert balanced lines, account movements, no P&L effect, and member subledger totals.
- [x] Run the new tests and verify they fail before implementation.
- [x] Implement v1→v2 migration, typed asset/capital schema, active-member/date/account validation, and atomic posting.
- [x] Reopen the database in tests; verify M1 records remain and `PRAGMA foreign_key_check` is empty.

### Task 3: Persisted capital summaries and reports

**Files:**
- Modify `packages/storage-native/src/bookkeeping-store.ts`
- Modify `packages/storage-native/src/bookkeeping-service.ts`
- Modify `packages/storage-native/test/bookkeeping-store.test.mjs`

**Interfaces:**
- Extend `BookkeepingSnapshot` with ordered `capitalActivities` and `memberCapitalSummaries`.
- Each summary returns contribution cents, distribution cents, and book-capital activity cents per stable member ID.
- Summary and activity records derive from committed journal-linked subledger rows; existing cash-basis reports continue to include only income and expense accounts.

- [x] Add independent expected-result fixtures for member balances, total cash movement, and zero P&L impact.
- [x] Run storage tests red before implementation.
- [x] Read member activity and summaries from SQLite, preserving dates and CPA review markers.
- [x] Verify journal sums agree with member subledger balances after database reopen.

### Task 4: Native member capital workflow

**Files:**
- Modify `apps/mobile/bookkeeping/MembersScreen.tsx`
- Modify `apps/mobile/bookkeeping/ReportsScreen.tsx`

**Interfaces:**
- Members screen records cash contribution, property contribution, or distribution for an explicit member and date.
- Cash activity requires a bank/cash account. Property activity requires a description and positive user-entered book value and visibly says CPA review required.
- Member screen displays each member's persisted activity ledger and book-capital activity.
- Reports screen displays capital contributions, distributions, and net book-capital activity, with the CPA/tax-basis limitation visible.

- [ ] Add focused component tests for form validation, service invocation, and displayed summaries. The repository has no React Native component-test harness; the native screen was exercised on iOS instead.
- [x] Implement controls using existing accessible `Field`, `Choice`, `Button`, `FormError`, and `Money` components.
- [x] Verify after save the screen refreshes from SQLite; capital activity is excluded from cash-basis P&L.

### Task 5: End-to-end synthetic verification and checkpoint

**Files:**
- Modify focused domain/storage/UI tests and this plan's checkbox status.

- [x] Run `npm test`, `npm run typecheck`, and `git diff --check`.
- [x] Run the four-member synthetic flow with cash/property contributions and distributions; verify balanced journal lines, member ledgers, cash balances, P&L exclusion, and persistence after relaunch on the iOS simulator.
- [ ] Verify Android on the smaller clean API 36 AVD if host resources permit; preserve an explicit blocked status if ADB remains unavailable.
- [ ] Review exact changed/staged files, commit the capital slice, push it, and verify local HEAD equals the live feature branch SHA with a clean tree.
