# Guaranteed Payments Implementation Plan

**Goal:** Track member payment obligations and finite due schedules without posting unpaid amounts, post allocated actual cash payments, and preserve payment reversals and period reporting.

**Architecture:** Extend the encrypted local SQLite schema from version 2 to 4 with immutable obligations/installments, actual payment allocations, and reversal links. Version 4 records the cash account that received each returned payment and backfills older reversals to the original payment account. Paid amounts use existing balanced cash-expense journal posting and transaction history. Payment reversals post a cash-date reversal entry and leave original records intact. The Members screen owns obligation entry, allocation, history, and outstanding summaries; Reports shows payment workpapers by cash date.

**Policy:** `docs/bookkeeping/guaranteed-payments-policy.md`.

## Tasks

### 1. Installment schedule rules

- [x] Add monthly, quarterly, and one-time due-date generator with anchored month-end behavior and a fixed 2–120 count for recurring schedules.
- [x] Add expected-answer fixtures for month ends, leap year, count bounds, and invalid dates.

### 2. Persistence and journal integration

- [x] Add v2→v3 migration tables for obligations, installments, payments, allocations, and reversals, then v3→v4 return-account migration.
- [x] Add obligation create, payment allocation, and dated payment reversal APIs with atomic balanced journals.
- [x] Enforce member/classification/business alignment, due balance, exact allocation totals, cash nonnegative, recorded return account, and no double reversal.
- [x] Prevent generic transaction correction from leaving a guaranteed-payment subledger stale.
- [x] Verify migration, reopening, cross-year payment dates, journal balance, outstanding balances, reversal audit history, and late-operation rollback on failure.

### 3. Native workflow and reports

- [x] Connect finite obligation schedules, partial/multi-installment allocations, payment history, reversal entry, return-account selection, and due/overdue summaries to Members.
- [x] Connect cash-date services/use-of-capital workpapers and actual payment reversals to Reports; unpaid obligations remain outside P&L.
- [x] Exercise create → overdue → partial pay → cross-year report → reverse → reopened balance → relaunch on iOS Simulator.

### 4. Checkpoint

- [x] Run `npm test`, `npm run typecheck`, `node --check packages/storage-native/test/bookkeeping-store.test.mjs`, and `git diff --check`.
- [ ] Review and push a coherent feature-branch commit; query the live remote SHA and verify the working tree is clean.
- [ ] Keep Android acceptance explicitly blocked unless a compatible Android target runs the actual current app.
