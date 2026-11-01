# Android chart account verification

Date: 2026-10-31. Test data is synthetic and stored in the emulator's local
encrypted database. The app was installed as a standalone Android release
variant and launched without Metro.

Target: AVD `emulator-5554`, `sdk_gphone64_arm64`. This is emulator evidence;
the authorized Samsung device disconnected and was not verified in this run.

Build: package version `0.1.0` (version code `1`), release variant, installed
with `adb install -r` and launched without Metro. The APK is local and ignored
at `android/app/build/outputs/apk/release/app-release.apk`; SHA-256:
`68513f89c3e205a10df09f38094f1e1649e005220943db8801b36b6dc4f6e91a`. It uses
the Android debug certificate, so it is an emulator/development artifact and
not a production-signed beta.

Workflow exercised:

1. Add the custom expense account `Insurance` from Accounts. The app assigns
   code `6001` and displays it in the persisted chart.
2. Record a `$10.00` operating expense classified to `Insurance` and paid from
   `Synthetic Checking`.
3. Force-stop and relaunch the app. Confirm the account and transaction remain,
   and the calculated totals reconcile.

After relaunch, Dashboard showed `$3,508.15` cash, `$100.00` income, and
`$116.85` expenses. The cash accounts showed `$2,828.15` checking, `$130.00`
savings, and `$550.00` Recon%QA, summing to `$3,508.15`. Transactions search
showed `1 of 13` records: `InsuranceQA`, categorized as Insurance, in Synthetic
Checking for `−$10.00`.

Screenshots are direct ADB captures from the installed Android app:

- `01-dashboard-after-relaunch.png`
- `02-chart-account-after-relaunch.png`
- `03-transaction-after-relaunch.png`
