# Android in-app reminder verification

**Source commit:** `fb8c8a6301f40231062aa05ec96321b082d7f5e6` (`feature/member-capital-20261031-a91c`)

**Device:** Android 16 / API 36 arm64 emulator `emulator-5554`; package `com.amanchilabs.llcbookkeepingprivate`. No physical Android device was connected.

**APK:** local ignored Release artifact `android/app/build/outputs/apk/release/app-release.apk`, version `0.1.0` / code `1`, min SDK 24, target SDK 36; 134,697,741 bytes; SHA-256 `a49b962db1ffb12f1d5a4be56dc0878d1e88d46aec780d9c4cdb121d4feb256b`. `apksigner verify --verbose --print-certs` passed. It uses the local Android Debug certificate and is a synthetic-data beta build, not a production artifact.

The APK was installed using `adb install -r` over the emulator installation to retain its synthetic local books. It launched without Metro and migrated the existing database from schema v11 to v12. Existing dashboard figures remained cash `$3,857.81`, income `$500.00`, and operating expenses `$212.19` after reminder operations.

## Workflow exercised

1. Opened Settings from the native dashboard and created `Check synthetic stmnt`, due 2026-10-31, with synthetic-only note text (`reminder-after-save.png`).
2. Confirmed the open reminder appeared on the dashboard (`dashboard-reminder.png`).
3. Edited the reminder title to `Check synthetic stmnt updatedy` (`reminder-updated.png`).
4. Marked it complete (`reminder-complete.png`).
5. Force-stopped and relaunched the app, opened Settings, and confirmed the edited title, due date, completed status, and note persisted (`reminder-relaunch.png`).
6. Returned to the dashboard after relaunch; it showed no open reminders and the same `$3,857.81` cash, `$500.00` income, and `$212.19` expenses (`dashboard-after-relaunch.png`).
7. Confirmed the empty Settings form when opening the new feature (`settings-empty.png`).

The storage test compares journal transactions, the bank balance, and cash-basis totals before and after reminder create/edit/complete/reopen/delete operations. They remain unchanged. The reminder UI is local-only, has no system notifications, and never posts financial activity.

Automated checks on the same source tree: `npm test` passed (129 tests), `npm run typecheck` passed, and `git diff --check` passed. Focused migration and reminder persistence tests include a database close/reopen.

This verifies Android emulator behavior only. Samsung physical-device acceptance remains unverified; the phone was not attached. The APK is ignored by Git and is not covered by remote synchronization.
