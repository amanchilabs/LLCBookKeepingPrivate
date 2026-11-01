# Android local LLC workspaces and sole-member policy

**Source commit:** `8bfd88924ac1adde11b1fc056058db2043e70080` on `feature/member-capital-20261031-a91c`.

**Device:** Android 16 / API 36 arm64 emulator `emulator-5554`, package `com.amanchilabs.llcbookkeepingprivate`. No physical Android device was connected, so this is emulator evidence only.

**APK:** local ignored Release artifact `android/app/build/outputs/apk/release/app-release.apk`, version `0.1.0` / code `1`, min SDK 24, target SDK 36; 134,710,913 bytes; SHA-256 `908dce7336ac1ac680ae22bc6cdd682c2ab9bf3b73199c487a294bb3cf52df3f`. APK Signature Scheme v2 verification passed. It uses the local Android Debug certificate and is for synthetic-data testing, not production distribution.

## Workflow exercised

1. Updated the existing app with `adb install -r`, preserving its synthetic Northstar books. The dashboard continued to show cash `$3,857.81`, income `$500.00`, and expenses `$212.19` (`dashboard-northstar-final-build.png`).
2. In Settings, opened the existing workspace list and added a second LLC through the app UI.
3. Created `Cedar Design LLC`, formed in WA on 2026-01-01, with one member, Morgan Owner, at 100% (`setup-single-member-100pct.png`).
4. Confirmed the Cedar dashboard started with `$0.00` cash, income, and expenses (`cedar-final-build-after-relaunch.png`).
5. Edited the owner name to Morgan Lee, saved, force-stopped, and relaunched the app. The member remained at 100% (`members-single-owner.png`).
6. Confirmed Settings displayed the sole-member equity policy, CPA-review notice, and Cedar as the active workspace (`settings-single-member-workspace.png`).
7. On the Members screen, confirmed new guaranteed-payment obligation and actual-payment entry controls are absent for the sole member; policy text and empty payment history remain visible (`single-member-payment-policy.png`).
8. Switched to Northstar. Its cash and P&L remained `$3,857.81`, `$500.00` income, and `$212.19` expenses. Force-stopped and relaunched; Northstar remained active with the same totals (`northstar-after-relaunch-final-build.png`).

Automated repository checks at this source checkpoint: `npm test` passed (136 tests), `npm run typecheck` passed, and `git diff --check` passed. The storage regression test also covers a partnership becoming single-member, rejection of new obligations/payments, a later return-cash reversal, balanced journals, persisted cash, and a P&L that nets to zero.

This run verified emulator UI behavior and local persistence. It did not verify a physical phone, production signing, security/recovery release gates, or real financial data. The APK is ignored by Git and is not covered by remote synchronization.
