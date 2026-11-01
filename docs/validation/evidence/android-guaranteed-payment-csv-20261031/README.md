# Android guaranteed-payment cash CSV verification

Date: 2026-10-31
Platform: Android emulator `LLCBookKeepingPrivate-M1-API36`, API 36, arm64
Installed package: `com.amanchilabs.llcbookkeepingprivate`
Build: standalone Gradle `assembleRelease` APK, app version 0.1.0
APK SHA-256: `dbd109ad19007a40616a363bf9129c61f2e15f601cbf64a17578b70e4d82af79`
APK size: 134,631,369 bytes

The APK was installed over the existing app with `adb install -r
--no-streaming`, preserving the synthetic encrypted database. In the native
Members screen I created a one-time $10 services obligation for Jordan QA due
2026-10-31. Saving it created no journal or cash activity. I then posted an
actual $10 payment from Synthetic Checking and reversed it in full to the same
account, dated 2026-10-31.

The member payment history retained the $10 payment and the −$10 reversal,
showed the original as reversed, and restored the installment's $10 outstanding
amount. The Reports screen showed services paid $10, services returned $10, and
net services cash expense $0. Use-of-capital activity remained $0. The payment
and reversal therefore net to zero cash and expense while preserving both
source events.

Selecting **Export payment cash workpaper CSV** opened Android's share sheet
with `llc-guaranteed-payment-cash-2026-10-31.csv`. The sheet was dismissed
without choosing a destination. The export rows and period totals are covered
by `report-exports.test.ts`; the event model stores payments and reversals with
separate transaction IDs and a shared payment ID. The CSV's workpaper amount
uses +paid/−returned, while the separate cash movement uses −paid/+returned.
The report is a cash activity workpaper, not a tax form; unpaid obligations are
not included.

Entering invalid date `2026-99-99` hid the guaranteed-payment period totals and
CSV action and displayed a range validation message. Restoring the valid range
restored the workpaper.

Screenshots:

- `01-payment-history.png` shows the payment and full reversal in member
  history, with the original retained.
- `02-guaranteed-payment-workpaper.png` shows the $10 paid, $10 returned, and
  $0 net report plus the export action.
- `03-csv-share-sheet.png` shows the generated CSV filename in Android's share
  sheet before dismissal.
- `04-invalid-range-gate.png` shows the date validation response with
  guaranteed-payment period totals and export hidden.

This is emulator evidence, not physical-device or production-signing
verification. The CSV is a bookkeeping workpaper, not a filed tax form.
