# Continue LLCBookKeepingPrivate on M4

## Start from this checkpoint

- Repository: <https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git>
- Branch: `chore/m4-migration-handoff-20261101-fd1ecd4`
- Source checkpoint: `fd1ecd43a534d0c4322ef914b16a0fcc419320df`
- Handoff commit: verify the live branch with `git ls-remote`; see the final delivery for its exact SHA.
- Read [`CLAUDE.md`](../../CLAUDE.md), [`AGENTS.md`](../../AGENTS.md), and [`M4-MIGRATION-HANDOFF.md`](M4-MIGRATION-HANDOFF.md) first.
- Migration is not ready until the local asset archive is verified outside the M1; see [`M4-LOCAL-ASSET-MANIFEST.md`](M4-LOCAL-ASSET-MANIFEST.md).

## Current implementation status

Implemented in tracked source: persistent LLC profiles and multiple local workspaces; member ownership/history; bank/cash accounts and balanced opening entries; income, expenses, splits, transfers, search/filter, corrections, recurring templates, CSV import/export; member capital contributions/distributions; guaranteed-payment obligations and actual payments; member/third-party loans; manual reconciliation; local reminders and period close/reopen; journal-derived dashboard/reports with CSV/PDF exports; SQLCipher/platform key-storage and encrypted backup/restore foundations. Exact screen/service mapping is in [`feature-preservation-matrix.md`](../design/implementation/feature-preservation-matrix.md).

Approved UX source work includes the shared design system, onboarding flow, five-tab navigation, dashboard, transaction/history/section flows, member/capital/payment sections, report selection, More/Accounts/Settings, and UX-specific search/filter behavior. Not every advanced form, empty/error state, accessibility behavior, or small-screen behavior has native acceptance.

## Platform and release evidence

| Platform/status | Evidence |
|---|---|
| iOS simulator | PASS for core synthetic workflow and UX checkpoint: onboarding, ownership confirmation, opening balance, income/expense, reversal/replacement, persistence after relaunch, search/filter, and report reconciliation. Advanced-screen interaction and accessibility acceptance remain. |
| Android build | PASS in fresh-clone Gradle build at source SHA `fd1ecd43...`; debug APK built. |
| Android UX acceptance | NOT VERIFIED. No ADB device/emulator was available during the UX acceptance run; do not equate APK compilation with screen acceptance. |
| Physical iOS/Android devices | NOT VERIFIED as an M4 beta. Apple identity/provisioning recovery is pending; no signed beta was delivered here. |
| Automated regression | `npm test`: 157 passed; `npm run typecheck`: passed on source SHA `fd1ecd43...`. |
| Security/recovery | Native encryption and explicit backup foundations exist, but production security/recovery release gates remain. Synthetic data only until approved gates pass. |

## Next three development priorities

1. **Complete Android native UX acceptance.** On M4, create/use a dedicated API 37 arm64 AVD or authorized Android device. Build and install the app; exercise setup, 40/20/20/20 confirmation, account/opening balance, income/expense correction lineage, restart persistence, search/filter clearing, member edit persistence/percentage validation, report reconciliation, and CSV row/totals reconciliation. Save real Android evidence outside Git and update the feature-preservation/acceptance records.
2. **Finish cross-platform functional and visual acceptance.** Exercise each redesigned workflow and its empty, invalid, confirmation, export, keyboard, scrolling, safe-area, and small-screen states on iOS and Android. Check accessibility labels/contrast/touch targets. Verify capital, guaranteed-payment, loan, reconciliation, CSV import, recurring, reminders, and period-close workflows through the actual persisted mobile UI; fix only reproduced defects.
3. **Close device beta and security/recovery gates before real data.** Recover authorized signing, produce installable internal iOS/Android development builds, test background/foreground and offline operation, and execute the current-database backup/restore, wrong-password/tamper, interruption/recovery, key-loss, migration, and data-preservation matrix. Do not report production readiness until platform and security gates have evidence.

## Exact resume commands

```sh
git clone --branch chore/m4-migration-handoff-20261101-fd1ecd4 \
  https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git LLCBookKeepingPrivate
cd LLCBookKeepingPrivate
git fetch origin
git rev-parse HEAD
git ls-remote origin refs/heads/chore/m4-migration-handoff-20261101-fd1ecd4
```

Verify the local and live SHA match. Install Node `24.22.2` from `.node-version`, then:

```sh
npm ci
npm run typecheck
npm test
npm run config:public
EXPO_NO_TELEMETRY=1 npm run prebuild -- --no-install
(cd ios && pod install)
(cd android && ./gradlew :app:assembleDebug --no-daemon --console=plain)
```

Use a dedicated native target; do not install onto a device unless the debug/release signature matches and its local data-preservation implications are understood. Follow the Git workflow in `AGENTS.md`; do not merge to `main` without explicit authorization.
