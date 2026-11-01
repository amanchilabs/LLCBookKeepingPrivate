# Member and third-party loans

## Goal and scope

Add local bookkeeping for loan agreements, actual advances, principal and interest repayments, dated interest calculations, payment history, and member/third-party summaries. This slice extends the existing encrypted bookkeeping store, journal engine, mobile navigation, and reports. It does not add tax advice, automatic rates, loan amortization schedules, external storage, or a loan-specific correction flow.

## Accounting policy

The governing decisions are recorded in `docs/bookkeeping/member-loans-policy.md`. Commitments and agreements are memorandum records. Actual advances create a liability and cash movement. Actual principal repayments reduce the liability. Actual interest paid is recorded separately as expense. Fixed contractual rates use the agreement's selected `ACT/365F` or `ACT/ACT ISDA` day-count convention and the existing simple-interest calculator. Other ACT/ACT variants are unsupported. Same-day repayment precedes a same-day advance; repayment dates are excluded from interest accrual. No compounding occurs.

## Data model and migration

Advance the local bookkeeping schema from version 4 to 5 transactionally. Rebuild the account, journal-entry, and transaction tables with foreign-key checks so the ledger can represent liability accounts and `loan-advance` / `loan-repayment` activity while preserving existing M1, capital, and guaranteed-payment rows. Create:

- `loan_agreements`: business, lender type, optional member reference, retained lender name, agreement date, commitment cents, rate in basis points, selected day-count convention, description, and per-agreement liability account.
- `loan_advances`: agreement, transaction and journal identifiers, actual date, cash account, amount, and description.
- `loan_repayments`: agreement, transaction and journal identifiers, actual date, cash account, principal cents, interest cents, and description.

All three activity tables are append-only and foreign-keyed. No commitment or unused amount is included in cash or principal balances.

## Domain and posting behavior

The store creates an agreement without a journal entry. A funded advance verifies the agreement, date, active cash account, unused commitment, and positive amount, then posts debit cash / credit that agreement's loan payable. A repayment reads the agreement's dated advances and previous repayments, calculates interest due through the repayment date from actual principal events, validates the two requested amounts independently, and atomically posts principal reduction plus interest expense against cash. A loan-specific snapshot contains agreement terms, lender identity, advances, repayments, outstanding principal, accrued interest, paid interest, and remaining accrued interest. Generic transaction correction excludes both loan activity kinds.

## Mobile experience and reports

Add a Loans tab with forms for member or third-party agreements, dated advances, and principal/interest repayments. Show commitment remaining, funded principal, outstanding principal, contractual rate, day-count convention, accrued/paid interest, and dated history. Reports summarize member and third-party principal and interest activity for the selected reporting period and show balances through the period end. Reports are bookkeeping workpapers and remain separate from tax conclusions.

## Acceptance and verification

Use synthetic data and independent fixtures: create member and third-party agreements; verify unused commitments do not move cash or P&L; post multiple differently dated advances; calculate interest from each actual outstanding-principal interval using known expected answers; post principal-only, interest-only, and mixed repayments; verify commitment, principal, interest, member/third-party summaries, expense classification, balanced journals, account balances, and persistence after reopen. Verify over-commitment, principal overpayment, interest overpayment, and late cash-validation failures leave no partial rows. Verify schema-v4 to v5 migration preserves existing transactions and foreign-key integrity. Run the actual iOS Simulator workflow plus repository tests and TypeScript checks. Android physical acceptance remains separate until a device is authorized and connected.
