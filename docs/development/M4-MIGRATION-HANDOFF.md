# M1 to M4 Development Migration Handoff

**Prepared:** 2026-11-01
**Canonical M4 branch:** `chore/m4-migration-handoff-20261101-fd1ecd4`
**Verified application source checkpoint:** `fd1ecd43a534d0c4322ef914b16a0fcc419320df` (`feature/ux-modernization-20261101-2b4ad87`)
**Repository:** <https://github.com/veerrajuamanchi/LLCBookKeepingPrivate>

This handoff branch is a documentation-only child of the UX modernization baseline. Its final commit SHA is reported in the task delivery and must be checked from the live remote; it is intentionally not embedded as a self-referential SHA in this file. `main` is not changed or merged.

## Canonical branch and Git audit

The UX checkpoint is the recommended product baseline. The canonical M4 checkout is this task branch, which was created from the UX checkpoint so that handoff guidance is part of the branch Claude Code will use. `main` remains the integration branch and is six commits behind the UX checkpoint at the audit snapshot.

| Remote branch at audit | Live SHA at audit | Capability/work represented | Relation to UX baseline |
|---|---|---|---|
| `main` | `e33e8609a7ff11c9c52e4b61463fd13ae42951c7` | Member capital, bookkeeping engine, reports/PDF export | Ancestor; 6 commits behind |
| `feature/member-capital-20261031-a91c` | `e33e8609a7ff11c9c52e4b61463fd13ae42951c7` | Capital, member loans, guaranteed payments, reports | Ancestor |
| `feature/m1-bookkeeping-capabilities-20261031-5c1` | `c6fa2deb2b0fb5bc87f34ca80e1b56ba0f669ba3` | M1 persisted bookkeeping and Android safe-area fix | Ancestor |
| `feature/m1-bookkeeping-vertical-slice-20261030-481e028` | `99a80178ace4905105dc2e6ea6350124fd11c6b9` | Native bookkeeping vertical slice | Ancestor |
| `feature/m1-ios-simulator-validation-20261030-b6662a5` | `481e028d5ec93c38b6dd97cb45cbba377e71f04f` | iOS workflow evidence | Ancestor |
| `feature/native-security-backup-poc-20261030` | `8379b710302c9231299363e5a745dc939068d357` | SQLCipher/key-storage and backup proof | Ancestor |
| `feature/restore-security-validation-20261030` | `939a045f6d738c0c7c9158056946882e3c3fd215` | Restore validation | Ancestor |
| `feature/native-validation-20261030-939a045` | `19a9e6b23df2e0425db7be70c0e493817ea0e697` | Native build validation | Ancestor |
| `feature/app-icons-20261030-19a9e6b` | `b703fd79af107385bd9700ee02820d2e08a94bfe` | App icon assets/configuration and validation notes | Ancestor |
| `feature/icon-native-env-20261030-b703fd7` | `7a34f6a80149c1c0ad414f40c2e75c0317c2052e` | Native environment/icon integration | Ancestor |
| `feature/m1-android-icon-runtime-20261030-8d0bd89` | `b6662a5f9b66e2cc7d314c3b7b623da1cc66e492` | Android physical icon validation record | Ancestor |
| `feature/m1-android-icon-validation-20261030-7c441ab` | `8d0bd8929309028cbe7fb90f2502580a9c7fd731` | Android icon validation record | Ancestor |
| `docs/design-consolidation-20261101-e33e860` | `2b4ad87b72d2fa9c6e577f5eafc6cfeb395ec5c4` | Approved design specs, navigation, decisions, and images | Ancestor |
| `feature/ux-modernization-20261101-2b4ad87` | `fd1ecd43a534d0c4322ef914b16a0fcc419320df` | Current mobile UX implementation and source acceptance evidence | Canonical source checkpoint |
| `chore/m4-migration-handoff-20261101-fd1ecd4` | `fd1ecd43a534d0c4322ef914b16a0fcc419320df` when created from UX | This M4 migration documentation checkpoint | Starts at UX; final handoff SHA is in delivery/live remote |
| `chore/m1-handoff-20261030-7a34f6a` | `7c441ab2e3af42c46949413b13d55f235feaf141` | Earlier M1 environment/security handoff | Ancestor |
| `chore/mac-reset-recovery-20261101-fd1ecd4` | `d147d1bbf99c55684e6beaaa9795af895a428827` | One additional recovery-plan document | Diverges only by `docs/superpowers/plans/2026-11-01-mac-reset-recovery.md`; retained remotely, not product code |

At the start of this handoff, the UX and all capability/security/design branch tips were ancestors of the selected source checkpoint. No implementation or approved design capability was found only on a divergent feature branch. The recovery-plan branch is the one exception in ancestry and contributes no application capability. All local branches corresponded to fetched remote branches at preflight; all branches remain preserved.

Git inventory at preflight: one registered worktree; no stashes; no local or remote tags; no local-only commits. The only untracked file was the previous task's recovery plan, `docs/superpowers/plans/2026-11-01-mac-reset-recovery.md`; it was committed and pushed as `d147d1bbf99c55684e6beaaa9795af895a428827` on its existing recovery branch before switching tasks. No unrelated untracked source was found. Generated native projects, dependencies, `.expo`, and build state are ignored. A final delivery must compare local HEAD to `git ls-remote origin refs/heads/chore/m4-migration-handoff-20261101-fd1ecd4`.

## Capability preservation

The UX tree includes the source, services, persistence paths, and tests for:

- LLC setup, multiple local workspaces, one- or multi-member ownership and dated member history.
- Bank/cash accounts, opening balance equity, journal-derived balances, income/expenses, categories/splits, transfers, search/filter, correction lineage, recurring templates, and validated CSV import.
- Member cash/property contributions and distributions; guaranteed-payment obligations and actual payment histories; member/third-party loan agreements, advances, repayments, and interest policies.
- Manual reconciliation, report periods, period close/reopen, local reminders, dashboard summaries, cash-basis P&L, cash movement, book-basis Balance Sheet/Trial Balance, General Ledger, member capital/payment/loan reports, CSV and PDF exports.
- SQLCipher storage, platform key access, and explicit encrypted backup/restore foundations.

The checked-in [`feature-preservation-matrix.md`](../design/implementation/feature-preservation-matrix.md) maps each capability to current screen/service/persistence behavior and calls out unsupported or incomplete states. Source presence does not mean every workflow is accepted on both native platforms.

## Design references

All six design specification documents, the implementation migration plan, feature-preservation matrix, acceptance criteria, and all **31 proposed PNG images** are tracked in Git. `design-decisions.md` selects **20 canonical screen images**, each present in Git. The full design review starts at [`docs/design/proposed/README.md`](../design/proposed/README.md). The M1 native screenshot galleries remain outside Git and are described in [`M4-LOCAL-ASSET-MANIFEST.md`](M4-LOCAL-ASSET-MANIFEST.md).

## Verified tests and native rebuild evidence

On this handoff source checkpoint (`fd1ecd43...`), during this task:

| Check | Result |
|---|---|
| `npm test` | PASS — 157 tests across preview, bookkeeping UI, storage/security configuration, domain, and backup suites |
| `npm run typecheck` | PASS — `tsc --noEmit` |

The M1 pinned `.node-version` is `24.22.2`; this test invocation used installed Node `25.1.0`/npm `11.6.2`. A prior fresh-clone rehearsal on this same application SHA also ran `npm ci` with Node `24.22.2`/npm `11.19.1`, then passed the same 157 tests and typecheck.

Fresh-clone native regeneration/build evidence on source SHA `fd1ecd43a534d0c4322ef914b16a0fcc419320df`:

- `npm run prebuild -- --no-install`: PASS; generated iOS and Android projects reflected tracked Expo configuration/plugins.
- `cd ios && pod install --clean-install`: PASS; 113 pods installed.
- iOS Simulator Debug build: PASS through XcodeBuildMCP; unsigned simulator build. This did not test physical-device signing.
- Android `:app:assembleDebug`: PASS using Gradle 9.4.1/JDK 25; debug APK created. No emulator or physical-device install/launch was performed in that rehearsal.
- `npm run config:public`: PASS; SQLCipher enabled, backup disabled for app data, identifiers and configured native plugins resolved.
- `npm run doctor`: reported four Expo SDK package patch-level mismatches (`@expo/metro-runtime`, `expo`, `expo-sqlite`, `expo-dev-client`). No dependency changes were made. Recheck on M4; do not run package upgrades without review.

The clone had no repository `node_modules`; dependency installation used a fresh npm cache and the iOS build used fresh DerivedData. CocoaPods/React Native artifact caches already present on the M1 were reused, so this is not a fully cache-isolated rebuild. The Android Gradle build used a separate Gradle user home. Toolchains and SDK downloads were already present on the M1.

Separate UX acceptance recorded in the feature matrix: iOS simulator workflow, search/filter, member editing/persistence, and synthetic report reconciliation passed. Android redesigned UI remains **NOT VERIFIED** because no ADB device was attached. This distinction matters: an Android APK build passed in a separate clean-clone rehearsal, but Android screen acceptance did not. Physical-device beta on either platform remains unverified.

## M4 environment setup

### Verified versions and requirements

- **Node:** use `.node-version` exactly: `24.22.2`. The clean-clone dependency install was tested with npm `11.19.1`; `npm ci` uses the committed lockfile.
- **Expo/React Native:** Expo SDK `58.0.21`, React Native `0.88.1`, React `19.3.0` are pinned in `package.json`/lockfile.
- **Xcode:** Expo SDK 58 documentation requires Xcode 26.4 or later. M1 used Xcode 26.6 and CocoaPods 1.17.0.
- **Android:** project compiles against Android API 37, targets API 36, Build Tools 37.0.0, NDK `27.1.12297006`; generated Gradle wrapper is 9.4.1 and AGP is 9.2.1. AGP 9.2 requires JDK 17 or later. The clean build passed with JDK 25.0.1.
- Install Xcode and Android SDK components using Apple/Google developer channels. If setting up an emulator, use an arm64-compatible image on M4. Emulator execution is still an outstanding acceptance task.

Before building on M4, confirm the toolchain and select the Android SDK/JDK for the shell:

```sh
xcodebuild -version
pod --version
java -version
node --version
npm --version
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
adb version
adb devices -l
```

Install the Android platform `android-37`, platform tools, build tools `37.0.0`, and NDK `27.1.12297006` via SDK Manager. The M1 used JDK `25.0.1`; the documented AGP floor is JDK 17. Xcode 26.4+ and CocoaPods 1.17.0 were the verified iOS environment. These are environment setup instructions; M4 installation itself has not been performed.

Official references: [Expo SDK 58 requirements](https://docs.expo.dev/versions/v58.0.0/), [Expo Prebuild/CNG](https://docs.expo.dev/workflow/continuous-native-generation/), [Expo CLI](https://docs.expo.dev/more/expo-cli/), and [Android AGP 9.2 release notes](https://developer.android.com/build/releases/agp-9-2-0-release-notes).

### Clone and install

```sh
git clone --branch chore/m4-migration-handoff-20261101-fd1ecd4 \
  https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git LLCBookKeepingPrivate
cd LLCBookKeepingPrivate
git fetch origin
git status --short --branch
git rev-parse HEAD
git ls-remote origin refs/heads/chore/m4-migration-handoff-20261101-fd1ecd4
```

Confirm `HEAD` equals the live remote SHA. Install/select Node 24.22.2 with the M4's approved version manager, then:

```sh
node --version
npm --version
npm ci
npm run config:public
npm run typecheck
npm test
npm run doctor
```

`npm run doctor` is a diagnostic and had the patch mismatches above. Do not use `npm install` to silently rewrite the lockfile.

### Generate and build native projects

```sh
EXPO_NO_TELEMETRY=1 npm run prebuild -- --no-install
(cd ios && pod install)
(cd ios && xcodebuild -workspace LLCBookKeepingPrivate.xcworkspace \
  -scheme LLCBookKeepingPrivate -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build)
(cd android && ./gradlew :app:assembleDebug --no-daemon --console=plain)
```

The prebuild, Pods install, simulator build, and Gradle build were independently verified in the M1 fresh-clone rehearsal at the source SHA. The exact raw `xcodebuild` shell line above is a reproducible invocation but was not the interface used for the recorded XcodeBuildMCP build. No device installation or UI acceptance is claimed from these build commands.

### Signing and device recovery

- No release signing secret is in Git. The local Android debug keystore was generated by Expo prebuild and matched the pinned template's fresh-clone key byte-for-byte. It is not a production key. On M4, verify the generated key before attempting to update an existing device installation; a signature mismatch requires a deliberate app/data migration decision.
- Two Apple code-signing identities were present in the M1 login keychain; no provisioning profiles or exported `.p12` were found. Simulator builds do not need them. Before physical iOS signing, use Keychain Access on M1 to export the relevant Apple Development identity and private key as a password-protected `.p12`, then transfer it separately over encrypted storage and import it into the M4 login keychain. Never commit or put the `.p12` in the UX archive. Provisioning may need to be regenerated from the authorized Apple developer account.
- No Android device was attached during this handoff. The Samsung remains a possible synthetic-data acceptance target, but confirm the app signature matches before installing an update.

## Migration readiness and human actions

The checksum-verified archive is at `~/Downloads/LLCBookKeepingPrivate/M4-Migration-20261101/llcbookkeeping-m1-to-m4-local-assets-20261101.tar.gz`. Its SHA-256 is recorded in [`M4-LOCAL-ASSET-MANIFEST.md`](M4-LOCAL-ASSET-MANIFEST.md) and in the adjacent `.sha256` sidecar. It contains only UX discovery files plus PNG/JSON implementation evidence; signing secrets are excluded.

No external volume was mounted at audit time. The archive is still on the M1 in Downloads, so the project is **NOT MIGRATION READY**. Copy it to an external drive or authorized encrypted storage and verify its `.sha256` there. Also export and back up an Apple signing identity if physical iOS device testing is needed on M4. Do not reset/erase the M1 until these human steps are completed or the owner explicitly accepts losing the external UX evidence and/or reissuing signing credentials.

Next product tasks are listed in [`CONTINUE-FROM-HERE.md`](CONTINUE-FROM-HERE.md). No feature development was performed on the M1 as part of this handoff.
