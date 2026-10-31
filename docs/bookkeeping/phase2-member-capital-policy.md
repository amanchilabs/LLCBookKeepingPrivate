# Phase 2 member capital policy

Member capital activity is separate from ownership percentages, income, operating expenses, guaranteed payments, and loans. Every activity identifies a member explicitly; ownership percentages never allocate or derive capital.

- Cash contributions debit a selected bank/cash account and credit that member's capital account.
- Property contributions debit a noncash asset account and credit that member's capital account. The entered amount is book value only. Each property record is marked for CPA review of its description and valuation; the app does not infer tax basis or outside basis.
- Distributions debit that member's capital account and credit a selected bank/cash account. Distributions do not post to operating expenses.
- Every entry is dated, uses exact USD cents, is balanced, and commits its journal lines and member activity record atomically. Corrections are not in this slice; posted records remain append-only.
- A member's book capital activity is contributions less distributions. It is a bookkeeping ledger balance, not tax-basis capital, outside basis, a profit/loss allocation, or a tax conclusion. Negative balances are shown and not silently reclassified.
- Ownership changes and historical membership do not rewrite prior capital activity. Special allocations, noncash valuation, and ownership changes remain CPA review matters.
