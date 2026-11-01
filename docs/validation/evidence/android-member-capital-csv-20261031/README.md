# Android member capital movement CSV verification

Date: 2026-10-31
Platform: Android emulator `LLCBookKeepingPrivate-M1-API36`, API 36, arm64
Installed package: `com.amanchilabs.llcbookkeepingprivate`
Build: standalone Gradle `assembleRelease` APK, app version 0.1.0
Capital CSV verification APK SHA-256: `2e3127902e7f7fb7dfa9a6bde933f918e647f9ad7323d5e314229426e048e24b`
Date-range guard rebuild SHA-256: `8d13e12de6c2652a52dfbbe095bbf80c35301b8d209ec678b6929d88f51f7a78`
Latest APK size: 134,628,745 bytes

The APK was installed over the existing app with `adb install -r
--no-streaming`, preserving the synthetic encrypted database. The Reports screen
read the persisted capital activity and exposed the new export action.

The selected reporting period was 2026-01-01 through 2026-10-31. The screen
showed cash contributions of $150.00, property contributions of $0.00,
distributions of −$30.00, and net book capital activity of $120.00. The
persisted history contains five activities: the earlier $100 Jordan contribution
and $25 Jordan distribution, two separate $25 Jordan contributions with the
same `CapitalCSVContribution` test description, and a $5 Casey distribution.
The member subledgers and Synthetic Checking General Ledger show both $25
contributions. The Accounts screen and the Synthetic Checking General Ledger
both show an ending balance of $2,857.81. The two contributions less the $5
distribution add $45 to the earlier $2,812.81 checkpoint; one extra $25 entry
accounts for $25 beyond the originally intended single-contribution scenario.
The persisted entries reconcile to the report; the duplicate synthetic entry
was preserved as a separate audited activity rather than removed.

Selecting **Export capital movement CSV** opened Android's share sheet with
`llc-member-capital-movement-2026-10-31.csv`. The share sheet was canceled without
selecting another app or sending the file elsewhere. Exact CSV columns, signed
movement totals, date filtering, quote escaping, and CPA-review flags are
covered by `report-exports.test.ts`.

After the independent review found invalid date ranges could still show an
export action, the date guard APK was installed over the same app with `adb
install -r`; the synthetic database remained present. Entering invalid date
`2026-99-99` displayed a validation message and removed the capital CSV action
from the native screen. Restoring the valid inclusive date range restored the
report and export action. Selecting it again opened the CSV share sheet from
the rebuilt APK; it was dismissed without choosing a destination. Screenshots
05–07 record the invalid-range state, restored valid report, and latest share
sheet.

Screenshots:

- `01-capital-movement-report.png` shows the native Reports panel and totals.
- `02-local-share-sheet.png` shows the generated CSV filename in the Android
  share sheet before it was dismissed.
- `03-member-capital-ledger.png` shows both $25 contributions and the $5
  distribution in the persisted member activity history.
- `04-account-balances.png` shows current account balances, including
  Synthetic Checking at $2,857.81.
- `05-invalid-date-gate.png` shows the native capital activity panel's response
  to an invalid start date; the export action is not rendered.
- `06-valid-range-after-guard.png` shows the capital report and export action
  after restoring the valid date range on the rebuilt APK.
- `07-share-sheet-after-guard.png` shows the current APK opening the CSV share
  sheet; it was dismissed without sending the file elsewhere.

This is emulator verification, not physical-device or production-signing
verification. The CSV is a book activity workpaper and does not calculate tax
basis or outside basis.
