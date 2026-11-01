# Android split transaction verification

Run on 2026-10-31 with the standalone Android release APK on the arm64 AVD
`LLCBookKeepingPrivate-M1-API36` (`emulator-5554`). The app opened without
Metro. After update, it migrated the existing synthetic encrypted books to
schema version 9 and retained prior balances and activity.

## Scenario and result

- Posted one synthetic $12.34 expense from Synthetic Checking, allocated as
  $7.34 Insurance and $5.00 Office Supplies, description `SplitQA`.
- Transaction history showed one persisted record with both categories and
  `−$12.34`; search by description returned 1 of 14 records.
- Force-stopped and relaunched the app. The Dashboard showed $3,495.81 total
  cash, $2,815.81 Synthetic Checking, $100.00 cash-basis income, and $129.19
  cash-basis expenses. The account screen showed the same $2,815.81 checking
  balance.
- These totals include the existing synthetic test ledger on this emulator;
  they are not an isolated accounting fixture.

## Build and evidence

- Command: `ANDROID_HOME=/Users/veerrajuamanchi/Library/Android/sdk ./gradlew :app:assembleRelease`
- Package/version: `com.amanchilabs.llcbookkeepingprivate`, `0.1.0` (versionCode 1)
- Local APK: `android/app/build/outputs/apk/release/app-release.apk`
- APK SHA-256: `b320eb4f68c6d962be9b4628e501658f6affe7719a051ff9ed0c3bcfef136c05`
- The APK is debug-signed for development; it is not a production release.
- `01-split-transaction-search.png`: posted transaction and category detail.
- `02-dashboard-after-relaunch.png`: persisted dashboard and P&L totals.
- `03-split-persisted-after-relaunch.png`: description search after relaunch.
- `04-account-balance.png`: checking balance from the Accounts screen.
- `05-split-entry-form.png`: latest build's split allocation form and currency total.

The first `adb install -r` command stalled while the emulator was CPU-bound.
Retrying with `adb install -r --no-streaming` returned `Success`; the updated
standalone app launched with the synthetic database intact. The physical
Samsung was disconnected, so this is emulator verification only.

Host checks for this change: all 93 repository tests passed, TypeScript
typecheck passed, and `git diff --check` passed. The focused storage suite also
verified balanced split journals, exact allocation totals, correction history,
persisted cash/P&L values, CSV reconciliation, and migration from schema 8.
