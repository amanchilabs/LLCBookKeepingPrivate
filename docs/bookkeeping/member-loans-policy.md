# Member and third-party loan bookkeeping policy

Loan agreements and cash events have separate meanings in the books.

- An agreement records the lender, commitment ceiling, fixed annual contractual rate, day-count convention, and agreement date. An agreement or unused commitment does not create cash, principal, income, expense, or a journal entry.
- Only funded advances create loan principal. The total funded advances under this initial non-revolving facility cannot exceed its commitment ceiling. Repayment does not restore unused commitment.
- Advances debit the selected bank/cash account and credit a loan-payable liability account for that agreement. Loan proceeds are not income.
- Repayment records principal and interest as separate amounts. Principal debits loan payable and credits cash; interest paid debits a loan-interest expense account and credits cash. Principal repayment is not an expense.
- Interest is simple and non-compounding. It uses the agreement's fixed rate and the actual principal balance after dated advances and principal repayments. Interest begins on each advance date. A repayment date is excluded from the accrued-through calculation; a same-day repayment is ordered before a new advance because the ledger stores calendar dates without intraday times. The amount is rounded once, half-up, to whole cents at the calculation boundary.
- Contract rates are stored to basis-point precision (0.01%), from 0.00% through 1000.00%. The user enters the rate from the signed agreement; the application does not infer or recommend it.
- Each agreement chooses `ACT/365F` or `ACT/ACT`, both implemented by the existing simple-interest utility. The selected convention is stored with the agreement and shown in the loan screen. The user must verify it matches the signed agreement. The application does not select statutory rates, determine enforceability, or conclude interest deductibility.
- A repayment may include principal, interest, or both. Neither component may exceed its balance on the repayment date. Interest paid cannot exceed simple interest accrued through the repayment date less prior interest payments.
- Member lender names and third-party lender names are retained on the agreement. Member loans require a member active on the agreement date; later ownership changes do not rewrite the lender record.
- Agreements and events are append-only in this slice. No transaction is overwritten or deleted. The generic income/expense correction flow cannot alter loan events; a loan-specific correction workflow is deferred to the audit-history phase.
- Loan agreements, advances, repayments, subledgers, and journal records remain in the encrypted local database. Workpapers describe book activity only and do not calculate a tax rate or assert tax treatment.
