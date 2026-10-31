# Guaranteed payment bookkeeping policy

This feature keeps contractual payment obligations separate from actual cash activity.

- An obligation and its dated installments are memorandum records. Creating an obligation, reaching a due date, or showing an overdue amount does not post a journal entry, change cash, or change the cash-basis Profit & Loss.
- Each obligation explicitly identifies one member and one classification: services or use of capital. The application does not infer the classification from ownership, capital balances, or payment history.
- An actual cash payment is dated when funds leave the selected bank/cash account. It is posted as an expense under a distinct book category for services or use of capital. Payments and returned funds affect the cash-basis report on their cash dates. The app does not determine tax deductibility, tax-year reporting, or whether a cost should be capitalized; both classifications are marked for CPA review.
- Guaranteed payments are not member distributions, loan principal, or ownership allocations.
- A payment may be allocated across one or more outstanding installments for the same member and classification. Each allocation is positive, partial allocations are allowed, and allocations must total exactly the payment amount without exceeding an installment's unpaid amount.
- A payment reversal records funds returned to a selected cash account on the return date. It reverses the original expense journal, preserves the original payment and allocations, and reopens the allocated installment balances. A correction without an actual cash return is not represented as a payment reversal.
- One-time schedules have one installment. Monthly and quarterly schedules have a finite count from 2 through 120. If an anchor date falls after the last day of a later month, that installment is due on that month's last day; later installments return to the original anchor day when possible.
- All amounts use exact USD cents. Obligations, installments, payment allocations, payments, and reversal records are retained in the local encrypted database. No user-edit or cancellation flow is included in this initial slice; contract amendments must be entered as new obligations until an audited amendment workflow is added.

The services/use-of-capital distinction mirrors the separate labels in the IRS partnership materials, but this app produces bookkeeping workpapers only. It does not produce Form 1065, Schedule K, Schedule K-1, or a tax conclusion. See [Instructions for Form 1065](https://www.irs.gov/instructions/i1065) and [Publication 541](https://www.irs.gov/publications/p541); tax and capitalization treatment remains for the LLC's CPA.
