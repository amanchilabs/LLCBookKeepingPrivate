# Android CSV import evidence

**Source commit:** `ee2cdd1b88f48dab230e543422d667ebc78ab435` (`feature/member-capital-20261031-a91c`)

**APK:** local ignored Release artifact `android/app/build/outputs/apk/release/app-release.apk`; SHA-256 `b70e589c64e11966344b679af8a5e5c0b1f98cd9d7d91e40c5d3b30e1feb830e`; version `0.1.0` / code `1`; v2 signature verified with the local Android Debug certificate.

This hash identifies the APK used for the CSV acceptance at that checkpoint. The local APK path has since been rebuilt for reminders; its current artifact hash is recorded in [the latest Android beta evidence](../android-beta-release-20261031/README.md).

**Device:** Android 16 / API 36 arm64 emulator `emulator-5554`. No physical Android device was attached. All records and CSV input were synthetic.

## Workflow and reconciliation

The emulator began with synthetic cash of `$3,537.81`, cash-basis income of `$100.00`, and operating expenses of `$132.19`. A two-row CSV was selected through Android's local document picker, mapped to the checking account and existing categories, reviewed, and posted: `$400.00` income to Sales and Services and `−$75.00` Rent. The updated values were `$3,862.81` total cash, `$500.00` income, `$207.19` expenses, and `$292.81` net income. The checking balance rose from `$2,857.81` to `$3,182.81`; savings and the other synthetic cash account were unchanged. That initial two-row posting was exercised on the immediately preceding local APK build, before the final currency parsing fix was committed; its binary did not have a recorded source SHA.

The APK built from the exact commit above was then installed with `adb install -r`, preserving that local database. On this exact build:

- The same two-row file previewed as `0 ready · 0 invalid · 2 possible duplicates`. The default action skipped both and no duplicate import was submitted.
- Searching separately for `Synthetic imported client receipt` and `Synthetic imported rent` returned the persisted `$400.00` and `−$75.00` records, each as 1 of 20 records.
- A local CSV row with amount `-$5.00` previewed as a valid Rent expense, then imported successfully while emulator Wi-Fi and mobile data were disabled.
- After force-stop and relaunch, still offline, the row remained in transaction history. Final totals were `$3,857.81` cash, `$500.00` income, `$212.19` expenses, and `$287.81` net income. Checking was `$3,177.81`, savings `$130.00`, and Recon%QA `$550.00`.

Cash reconciles: `$3,537.81 + $400.00 − $75.00 − $5.00 = $3,857.81`. The P&L reconciles: `$500.00 − $212.19 = $287.81`. App storage tests separately verify balanced journal entries, transaction CSV cash reconciliation, duplicate skip/override behavior, and rollback of an entire batch when a cash balance rule fails.

After the source change, `npm test` passed all 126 tests, `npm run typecheck` passed, and `git diff --check` passed.

## Screenshots

- `currency-negative-preview.png` — exact-checkpoint APK accepts the `-$5.00` input as one valid expense row.
- `dashboard-after-offline-relaunch.png` — exact-checkpoint APK after the two-row import, restarted offline.
- `dashboard-after-currency-import-relaunch.png` — exact-checkpoint APK after all three imported rows and offline relaunch, with updated balances and recent activity.
- `pnl-after-import.png` — exact-checkpoint APK showing final cash-basis totals.
- `transaction-search-income.png` and `transaction-search-expense.png` — exact-checkpoint APK search results for the two-row import; each shows 1 of 20 persisted records.
- `duplicate-preview.png` — exact-checkpoint APK showing both rows flagged, default skip selected, and `Import 0 new rows · skip 2 duplicates`.
- `import-preview.png` — initial two-row preview from the preceding local build; see the source-attribution limitation above.

## Install and limitations

Install or update an authorized Android device with:

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

The file importer is local-only and supports one signed amount, date, description, and a category matching an existing income or expense account. Transfers, split rows, refunds, and tax adjustments are not supported. This is a debug-signed synthetic-data beta candidate, not a production release. Physical-device acceptance, iOS device testing, app-lock/recovery release gates, real financial data, and public distribution remain unverified or blocked.
