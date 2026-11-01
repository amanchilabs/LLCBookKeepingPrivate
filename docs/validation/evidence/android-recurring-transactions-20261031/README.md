# Android recurring transaction verification

Date: 2026-10-31
Platform: Android emulator `LLCBookKeepingPrivate-M1-API36`, API 36, arm64
Installed package: `com.amanchilabs.llcbookkeepingprivate`
Build: standalone Gradle `assembleRelease` APK, app version 0.1.0
APK SHA-256: `970e163c4a03eb36dee2586f6bc699d5079722e878660fd4c5a680fb62b649b5`
APK size: 134,626,645 bytes

The release APK was installed over the existing emulator app with `adb install
-r --no-streaming`, preserving the synthetic database. The app launched and
opened the existing books after the v9-to-v10 storage migration. Android was
tested through the native app with no Metro connection.

## Scenario and observed results

1. Created a monthly $3.00 operating-expense schedule for Insurance from
   Synthetic Checking, due 2026-10-31. Creating the schedule alone did not
   change the account balance or P&L (`01-schedule-saved.png`).
2. Selected **Post due occurrence** once. The schedule advanced to 2026-11-30,
   retained its original day-31 month-end anchor, and recorded the 2026-10-31
   posting date (`02-occurrence-posted.png`).
3. Force-stopped and relaunched the app. The dashboard showed total cash
   $3,492.81, Synthetic Checking $2,812.81, cash-basis income $100.00, and
   expenses $132.19. These include the prior synthetic ledger data and the new
   $3.00 recurring expense (`03-dashboard-after-relaunch.png`).
4. Searched transaction history for `RecurringQA`; the app showed one persisted
   record dated 2026-10-31, category Insurance, account Synthetic Checking,
   labeled Recurring, amount −$3.00 (`04-history-search.png`).
5. Edited the future schedule amount to $3.50. The posted transaction remained
   −$3.00 and the dashboard totals did not change (`05-future-schedule-edited.png`,
   `06-original-history-after-edit.png`).
6. Force-stopped and relaunched again. The updated $3.50 schedule and original
   −$3.00 transaction remained persisted (`07-history-after-relaunch.png`).
7. Paused the schedule in the native screen; the card showed `Schedule paused`
   and offered Resume (`08-schedule-paused.png`). The schedule was resumed
   after capture.
8. Reinstalled the final APK after the correction-label priority fix and
   confirmed the persisted recurring schedule and −$3.00 transaction still
   appear in native transaction history (`09-final-apk-smoke.png`).

Storage tests additionally verify balanced journal entries, due-date rejection,
rollback without schedule advancement when cash would become negative,
pause/resume posting rules, and retention of a monthly day-31 anchor when an
edited schedule still has a next date on the 29th.

This is emulator verification only. No physical Android device was connected
during this run. The APK is locally built and debug-signed for development; it
is not a production distribution artifact. Recurring schedules do not post in
the background: each occurrence requires a separate user action.
