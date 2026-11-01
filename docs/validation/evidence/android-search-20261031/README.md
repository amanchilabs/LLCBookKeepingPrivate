# Android cross-record search

**Source commit:** `e14ec35325c30c9efa110a05329a2d333da5afbf` on `feature/member-capital-20261031-a91c`.

**Device:** Android 16 / API 36 arm64 emulator `emulator-5554`, package `com.amanchilabs.llcbookkeepingprivate`. The Samsung phone was not connected; this is emulator evidence only.

**APK:** local ignored Release artifact `android/app/build/outputs/apk/release/app-release.apk`, version `0.1.0` / code `1`, min SDK 24, target SDK 36; 134,720,005 bytes; SHA-256 `068cf9f334b19ea3ba29be2dc801f9d91cdf222fea612878559425d7010a9846`. APK Signature Scheme v2 verification passed. Signed with the local Android Debug certificate for synthetic-data testing.

## Workflow exercised

1. Installed the Release APK with `adb install -r` over the existing synthetic books and launched the bundled app directly, without Metro.
2. From Northstar Demo LLC, searched `Rent`. The results included the Rent account and two expense transactions; selecting each opened Accounts or Transactions (`search-rent-results.png`, `search-account-result-destination.png`, `search-transaction-result-destination.png`).
3. Switched to Cedar Design LLC and searched `Northstar`. The active-workspace search returned no matches (`search-active-workspace-isolation.png`).
4. Restored Northstar as the emulator's active workspace. Dashboard cash and P&L remained `$3,857.81`, `$500.00` income, `$212.19` expenses.

Search uses only the currently loaded local LLC snapshot. It covers business and member history, accounts, transactions and split categories, capital activity, guaranteed-payment obligations and cash events, loan agreements and activity, recurring entries, reconciliations and their audit events, period history, and reminders. It adds no database schema or network access.

Automated checks at this source checkpoint: `npm test` passed (141 tests), `npm run typecheck` passed, `git diff --check` passed, and the Android Release build completed successfully.

This verifies Android emulator behavior only. No physical-device, production-signing, security-release-gate, or real-financial-data acceptance is claimed. The APK is ignored by Git and is not covered by remote synchronization.
