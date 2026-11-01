# Standalone Android beta candidate

**Source checkpoint:** `c25649f` (`feature/member-capital-20261031-a91c`)
**Build:** Android Release variant, version `0.1.0` / code `1`, min SDK 24, target SDK 36
**Artifact (local, ignored by Git):** `android/app/build/outputs/apk/release/app-release.apk`
**SHA-256:** `404851f4367625e10ad0ebdc2e2c0551a0d1809b83e0279c58fa65858f769935`
**Size:** 134,658,861 bytes
**Signing:** APK Signature Scheme v2 verified. Signed with the local Android Debug certificate, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. This is for controlled synthetic-data beta testing only; it is not a production signing key.

## Emulator verification

- `./gradlew :app:assembleRelease` completed successfully; the Gradle task bundled the JavaScript into the APK.
- `apksigner verify --verbose --print-certs` succeeded.
- `adb install -r` updated the existing emulator app without clearing its synthetic local database.
- Stopped the LLCBookKeepingPrivate Metro process, disabled emulator Wi-Fi and mobile data, force-stopped and relaunched the Release app. It opened directly into the persisted Dashboard without Metro or a development-server picker.
- The offline Dashboard showed `$3,537.81` cash; the Members screen showed the persisted synthetic `Jordan QAx` edit and 40/20/20/20 interests.
- While Wi-Fi and mobile data remained disabled, opened Reports. Cash-basis P&L showed `$100.00` income, `$132.19` expenses, and `−$32.19` net; exporting the report opened the native share sheet for `llc-profit-and-loss-2026-10-31.csv`. No share target was selected.

Images show the offline dashboard, Members and Reports screens after relaunch, and the native CSV share sheet. Device: Android 16/API 36 arm64 emulator `emulator-5554`.

## Installation

The local APK is at the artifact path above. On an authorized Android device with USB debugging enabled, install/update with `adb install -r android/app/build/outputs/apk/release/app-release.apk`. The package id is `com.amanchilabs.llcbookkeepingprivate`.

Do not uninstall an existing installation to work around a signing mismatch: uninstalling removes its local database. The Samsung was not connected to ADB during this build, so physical-device install and acceptance remain unverified.

## Limits

This is a standalone, locally debug-signed beta candidate. No production credentials, real financial data, physical-device result, iOS device build, app lock/recovery release-gate acceptance, or public distribution is represented. The APK is an ignored local build artifact and is not backed up by the Git remote.
