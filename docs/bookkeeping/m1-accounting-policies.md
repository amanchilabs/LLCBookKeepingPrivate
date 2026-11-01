# Milestone 1 bookkeeping policies

This first native workflow records synthetic test data in the existing encrypted local database. Do not enter real financial records until the security and recovery gates in `docs/handoff/M1-RESUME.md` pass and the user approves.

## Scope and currency

- One LLC profile is active per app installation. The stored schema is business-keyed so a future multi-business selector can be added without replacing the journal model.
- The first workflow uses USD only and stores exact integer cents. Amount entry accepts at most two decimal places.
- LLC formation state and formation date are descriptive profile data. The bookkeeping start date bounds opening balances and transaction dates.
- Member interests are ownership percentages only. The app does not infer profit allocations, guaranteed payments, capital balances, or tax treatment from them.
- The initial 40% / 20% / 20% / 20% split is a suggestion. The user confirms the names and percentages when creating the profile. Subsequent ownership changes require confirmation, an effective date, and a total of exactly 100%; prior effective-dated percentages remain in history.

## Posting rules

- Income is recorded when cash is received: debit the selected bank/cash account and credit an income category.
- Operating expense is recorded when cash is paid: debit an expense category and credit the selected bank/cash account.
- A transfer between two different active bank/cash accounts debits the destination and credits the source. It changes account balances but is excluded from income and expenses.
- The first categories are Sales and Services, Other Income, Office Supplies, Rent, Software and Hosting, Travel, Meals, and Other Operating Expense. These are bookkeeping categories, not tax advice or tax-return mappings.
- A non-zero opening balance posts on its entered date as a balanced entry against Opening Balance Equity. A positive balance debits the cash account; a negative bank opening balance credits it. A zero-balance account has no opening journal entry.
- A cash-on-hand account may not become negative on any recorded date. A bank account may show a negative balance to reflect an overdraft.
- Corrections keep the original entry, post a reversing entry dated on the original transaction date, and post a replacement using the corrected date and details. This preserves the journal trail and moves the cash/P&L effect to the corrected period.
- Cash account balances and cash-basis P&L are calculated from journal lines. CSV amounts are signed cash movements, including opening balances and reversals; a transfer exports both account legs so each account ledger reconciles and the transfer nets to zero.

## Not represented in this slice

- Receivables, payables, accrual accounting, payroll, and tax calculations are not supported. Member capital activity and distributions are maintained as book-capital activity and do not establish tax basis or outside basis.
- A bank account can display a negative balance for an overdraft. A future balance sheet must classify an overdraft as a liability where appropriate.
- No transaction or ownership interest is synchronized to a service. CSV and encrypted backup sharing require an explicit user action.
