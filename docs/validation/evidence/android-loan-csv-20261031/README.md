# Android loan cash CSV verification

Date: 2026-10-31
Platform: Android emulator `LLCBookKeepingPrivate-M1-API36`, API 36, arm64
Installed package: `com.amanchilabs.llcbookkeepingprivate`
Build: standalone Gradle `assembleRelease` APK, app version 0.1.0
APK SHA-256: `46d5bfede4ccf093daf160c626152168b409de2de666645b133cae4709463f56`
APK size: 134,633,693 bytes

The APK was installed over the existing app with `adb install -r
--no-streaming`, preserving the synthetic encrypted database. Reports showed
loan advances of $2,000.00, principal repayments of $300.00, and actual
interest paid of $56.85 for 2026-01-01 through 2026-10-31. The workpaper's
period totals reconcile as $1,643.15 cash movement = $1,700.00 net principal
movement − $56.85 paid interest. The screen also showed $1,700.00 member loan
principal outstanding and $0.00 third-party loan principal outstanding.

Selecting **Export loan cash workpaper CSV** opened Android's share sheet with
`llc-loan-cash-activity-2026-10-31.csv`. The sheet was dismissed without
choosing a destination. Independent fixtures in
`apps/mobile/bookkeeping/report-exports.test.ts` cover member and third-party
agreements, a funded advance, a repayment split between principal and interest,
date filtering, CSV escaping, and the cash/principal/interest reconciliation.
The live file's rows were not opened outside the share sheet.

Entering invalid date `2026-99-99` hid loan period totals and the export action
and displayed a range validation message. Restoring the valid range restored
the report. Loan commitments remain excluded from cash activity; proceeds are
not income, principal repayments are not expenses, and the report does not
select interest rates or determine deductibility.

Screenshots:

- `01-loan-cash-workpaper.png` shows the native loan activity report and CSV
  export action.
- `02-loan-csv-share-sheet.png` shows the generated CSV filename before the
  sheet was dismissed.
- `03-invalid-range-gate.png` shows that invalid dates suppress the period
  totals and export action.

This is emulator verification, not physical-device or production-signing
verification. The CSV is a bookkeeping workpaper, not a tax form.
