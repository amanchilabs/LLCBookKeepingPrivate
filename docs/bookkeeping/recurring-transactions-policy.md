# Recurring transaction policy

Recurring transaction schedules are local reminders for expected income or
operating expenses. Creating or saving a schedule does not post a journal entry,
change an account balance, or affect a report. The user must review each due
occurrence and select **Post due occurrence**.

Each manual post writes one balanced income or expense journal entry, one
transaction-history record, and one occurrence-history record in a single
database transaction. Insufficient cash, invalid references, or another failed
write rolls back the journal, transaction, occurrence, and schedule advancement
together. An occurrence cannot be posted before its scheduled date or while its
schedule is paused.

Reports use the date the user posts the occurrence. The original scheduled date
is retained separately for audit and due-history display. A late schedule does
not auto-catch-up: each occurrence still requires a separate user action.

Monthly and quarterly schedules retain their day-of-month anchor through short
months (for example, an anchor on the 31st moves to February's last day and
returns to the 31st in March). Yearly leap-day schedules retain February 29 as
the anchor. Editing a schedule changes future occurrences only; posted
transactions and their journal entries keep the values and dates that were
posted. A schedule can be paused or resumed without changing its history.

This implementation does not run a background scheduler, send reminders, or
post transactions automatically. Android emulator verification does not
constitute physical-device verification.
