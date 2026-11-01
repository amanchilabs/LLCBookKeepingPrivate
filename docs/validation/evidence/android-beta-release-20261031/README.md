# Standalone Android beta candidate

## Current artifact

- **Source commit:** `fb8c8a6301f40231062aa05ec96321b082d7f5e6` (`feature/member-capital-20261031-a91c`)
- **Build:** Android Release, version `0.1.0` / code `1`, min SDK 24, target SDK 36
- **Artifact (local, ignored by Git):** `android/app/build/outputs/apk/release/app-release.apk`
- **SHA-256:** `a49b962db1ffb12f1d5a4be56dc0878d1e88d46aec780d9c4cdb121d4feb256b`
- **Size:** 134,697,741 bytes
- **Signing:** APK Signature Scheme v2 verified. Signed with the local Android Debug certificate, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. This is for controlled synthetic-data beta testing only; it is not a production signing key.

## Current checkpoint: reminder migration and workflow

- `./gradlew :app:assembleRelease` completed successfully from the source tree committed as `fb8c8a6`, bundling the JavaScript into the APK. APK signature verification succeeded.
- Installed over the existing emulator app with `adb install -r`; the synthetic local database remained present through the v11-to-v12 schema migration.
- Created, edited, completed, and persisted an in-app reminder across force-stop and relaunch. Confirmed the open reminder appeared on the dashboard. Reminders do not create system notifications or journal activity.
- Account balances and P&L stayed unchanged during reminder operations. Evidence and exact artifact metadata are in [Android reminder verification](../android-reminders-20261031/README.md).
- Only `emulator-5554` was connected; the Samsung physical device was not attached.

## Prior checkpoint: CSV import verification (`ee2cdd1`)

The following records the earlier artifact and is not the current APK hash above.

- `./gradlew :app:assembleRelease` completed successfully from source commit `ee2cdd1` and bundled the JavaScript into the APK. `apksigner verify --verbose --print-certs` succeeded.
- Installed the APK with `adb install -r` over the existing emulator app. The update preserved its synthetic local database.
- Android 16 / API 36 arm64 emulator `emulator-5554` was the only connected device. The Samsung physical device was not attached.
- With emulator Wi-Fi and mobile data disabled, launched the Release app directly without Metro. Imported a synthetic expense from a local CSV using the amount `-$5.00`, force-stopped and relaunched offline, then verified it remained in transaction history and updated the dashboard and P&L.
- After that import, dashboard cash was `$3,857.81`, including Synthetic Checking `$3,177.81`, synthetic savings `$130.00`, and Recon%QA `$550.00`. Cash-basis P&L was `$500.00` income, `$212.19` operating expenses, `$287.81` net income.
- Re-selected the earlier two-row synthetic CSV in the current APK. Preview marked both existing rows as possible duplicates and showed `0 ready · 0 invalid · 2 possible duplicates`; the default action was to skip both. No duplicate rows were posted.
- Transaction search on the current APK returned the imported `$400.00` receipt and `−$75.00` rent expense individually, each as 1 of 20 persisted records.

See [Android CSV import workflow evidence](../android-csv-import-20261031/README.md) for screenshots and the two-row import reconciliation. The earlier two-row posting itself was exercised on the immediately preceding local release build; the `ee2cdd1` APK was then tested for duplicate detection and a further `-$5.00` import, offline persistence, search, dashboard, and P&L. That earlier artifact's SHA-256 was `b70e589c64e11966344b679af8a5e5c0b1f98cd9d7d91e40c5d3b30e1feb830e`.

## Earlier beta candidate screenshots

`01-dashboard-offline-after-relaunch.png`, `02-members-offline-after-relaunch.png`, `03-reports-offline.png`, and `04-csv-share-sheet-offline.png` document the superseded `c25649f` candidate. Its dashboard/P&L values predate the CSV import scenario and do not describe the current artifact's current database state. The native share sheet was opened for a P&L CSV; no external share target was selected.

## Installation

Install or update on an authorized Android device with USB debugging enabled:

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Package id: `com.amanchilabs.llcbookkeepingprivate`.

Do not uninstall an existing installation to work around a signing mismatch; uninstalling removes its local database. The APK is an ignored local build artifact and is not backed up by the Git remote. The Samsung physical-device install remains unverified.

## Limits

This is a standalone, locally debug-signed beta candidate. It is not production-ready. No production signing credentials, real financial data, physical-device result, iOS device build, app lock/recovery release-gate acceptance, or public distribution is represented. Real financial data remains blocked pending the documented security and recovery gates.
