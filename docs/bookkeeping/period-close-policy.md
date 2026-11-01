# Bookkeeping period close policy

Closing a period records an append-only event and locks journal postings dated on or before the selected date. A close cannot extend into a future date. The first close starts on the LLC's bookkeeping start date. Each later close starts the day after the most recently active close and must extend the locked-through date. Closing does not generate a journal entry or change balances.

Reopening records a reasoned audit event against the latest active close. It unlocks that interval while earlier closed intervals remain locked. To edit a closed transaction, the user must reopen the period, post a traceable correction, and close it again when review is complete.

The lock is enforced inside the same SQLite write transaction that inserts a journal entry. It therefore applies to opening balances, income and expenses, split transactions, transfers, recurring occurrences, capital activity, guaranteed-payment cash events, loan advances and repayments, reversals, and replacement entries. Corrections to a closed original fail atomically even if their replacement date is later. Ownership-history changes also cannot take effect on or before the active close date.

The close is an operational posting control, not an accounting or tax close. It does not assess whether bank reconciliations are complete, create income-closing entries, move earnings into member capital, calculate tax basis, or certify a report. Reconciliation status can be updated independently; it does not alter journal balances. The UI retains close and reopen reasons with their date ranges in the encrypted local database.
