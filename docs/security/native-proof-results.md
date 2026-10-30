# Architecture, Security, and Backup Validation Report

Status: **incomplete; synthetic-data only.** This report records current branch work and explicitly distinguishes earlier prerequisite evidence. It is not a security review approval or production-readiness claim.

Updated: 2026-10-30. All records and attachments used in tests are synthetic.

## Dependency base and reproducibility

- The dependent branch is based on prerequisite `feature/native-security-backup-poc-20261030` at SHA `8379b710302c9231299363e5a745dc939068d357`; it is not based on main. The public remote is `https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git`.
- Current toolchain: Node `24.22.2`, npm `11.6.2`, Expo SDK `58.0.21`, TypeScript `6.0.3`, Vitest `5.0.5`; exact direct package versions are in the lockfile and [dependency inventory](dependency-inventory.md).
- A clean-clone reproduction from the pushed current branch, installation, native regeneration/build, and automated checks is recorded below after it is performed. No ignored files may be copied into that clone.

## Checks actually executed on this branch

- `npm ci`: passed earlier in the branch worktree from the committed lockfile; 555 packages installed, 556 audited. Current branch has package-lock unchanged from the prerequisite SHA.
- `npm test`: passed, 30 tests (preview 2, fail-closed/build policy 3, domain 8, backup format/coordinator 17).
- `npx tsc --noEmit`: passed.
- `npx expo install --check`: passed, dependencies up to date.
- Native build policy direct probe using Node 24: default enables SQLCipher; `LLCB_SECURITY_NEGATIVE_SQLITE=1` disables it; setting that flag with `EAS_BUILD_PROFILE=production` throws. `packages/storage-native/test/fail-closed-open.test.ts` proves the cipher probe occurs before persistent storage open and fails if absent. No native negative-build binary/runtime test was completed.
- `swiftc -frontend -parse ios/LLCBookKeepingPrivate/AppDelegate.swift` and isolated `swiftc -typecheck` of the generated backup-exclusion helper: passed after the plugin fix. Xcode Simulator build initially failed on two generated helper type errors (`URL` mutability and missing `try`). Both were corrected in `plugins/with-ios-backup-exclusion.cjs` and regenerated into ignored `ios/` source. A post-fix full build was deferred after available disk dropped to 1.9 GiB; therefore current-branch iOS app compile remains pending. `pod install` itself succeeded with 112 pods before the first compile.
- `git diff --check`: passed at the report update checkpoint (rerun before commit).
- npm audits were run at `2026-10-30T18:19:36Z` UTC using Node `24.22.2` / npm `11.6.2`; both full and production-omitted audit commands exited 1. Exact JSON is in `audits/`. Two underlying advisories remain open; details and exploit paths are in [the advisory assessment](audits/npm-audit-2026-10-30.md). No forced downgrade, override, or suppression was used.

## Native and platform evidence matrix

| Validation | Current dependent branch result | Device type / exact path |
| --- | --- | --- |
| SQLCipher enabled, SecureStore key, persistence, wrong-key rejection, host SQLite cannot read database | Earlier prerequisite native build passed on both platforms. On this branch, iOS Simulator hot-reloaded the new restore/catalog code and reran SQLCipher/catalog checks; Android was not rebuilt. | iOS 26.5 iPhone 17 Simulator; Android API 36 Pixel 8 AVD evidence is prerequisite-only. No physical devices. |
| SQLCipher disabled, no plaintext fallback | Automated ordering test and build-policy tests pass. Native negative build and on-device storage-path scan pending. | Unit tests only. |
| Current branch restore activation and recovery | Passed 10/10 named failure injection boundaries using actual SQLCipher generation/catalog databases and synthetic attachment BLOBs. Each injected exception was followed by recovery in the same simulator process. | iOS 26.5 iPhone 17 Simulator. Not a hard kill or device power-loss test. |
| Native backup KDF latency | PBKDF2-HMAC-SHA-256, 600,000 iterations, 5 samples; median 45.3 ms, p95 53.1 ms. Measures KDF only; no peak-memory measurement. | iPhone 17 Simulator. Android and physical low-end targets pending. |
| Portable v2 artifact, both platform directions | Not tested. Previous prerequisite branch tested an older v1 iOS-created artifact on Android and attempted Android-to-iOS through a picker; v1 is no longer accepted and does not satisfy current v2 compatibility. | Current v2 crypto and file restore need actual artifact transfer and independent compatibility check on both platform builds. |
| Fresh-install restore on both platforms | Current v2: pending. Previous Android fresh reinstall used v1 only. | Simulator/emulator route pending. |
| Interrupted restore and full process restart | Native exception recovery above passed; actual forced process termination after each durable transition pending. | Simulator-only injected exceptions. |
| SQLCipher build and restore on Android current branch | Pending. Two build attempts failed `No space left on device`; later Expo Android launch reported ADB boot/property query timeout. | Pixel 8 API 36 emulator present; no usable current-branch app result. |
| iOS backup exclusion | Expo prebuild generated AppDelegate code with a launch-time directory exclusion and fail-closed precondition. First Xcode compile caught two Swift type errors in the helper; the config plugin was corrected and generated Swift regenerated. A post-fix full build was not run because available disk fell to 1.9 GiB, below the 1.4 GiB Pods install plus Xcode build outputs. No device inspection. | Generated-source fix; full compile/runtime pending. |
| Android OS backup/device-transfer exclusions | Generated manifest/XML were inspected: `allowBackup=false`, full backup excludes root/file/database/sharedpref/external, Android 12+ cloud and device transfer excludes same domains. No current branch Android build or OEM transfer test. | Generated configuration only. Android docs note device-transfer behavior can vary by implementation. |
| No-Metro offline operation / release network configuration | App config sets updates disabled, no OTA package/backend, and no app fetch/WebSocket/upload call was found. Development manifest still contains INTERNET. Standalone/release-like build and external-network-isolated run pending. | Source/config review only. |
| Plaintext temporary files, logs, exports, sharing | Code path review: import requests no picker cache copy and bounds before decrypt; decrypted payload is in memory and best-effort zero-filled; export stages encrypted bytes only and deletes app cache file after share returns. Full filesystem/log/crash/export/share-destination audit pending. | Code inspection only; no forensic scan. |
| Biometric/key failure and recovery | No biometric/PIN gate exists. Existing DB with missing key fails closed. User-initiated restore from an independently selected backup is intended to create a new generation key, but recovery UX when current catalog key itself is unavailable is not implemented. | Architecture/code review. |

## Restore state machine and failure injection

The candidate is a distinct SQLCipher database generation with a distinct random local key. Input authentication and structural limits are checked before staging. Candidate rows, attachment BLOBs, schema version, row count, and canonical hash are validated before closing; catalog activation pointer and `{previous,candidate}` journal are committed together. Candidate is reopened and revalidated before journal clear. Only then is the old generation deleted. Startup recovery finalizes a valid candidate or rolls back to the preserved original if the candidate is invalid. See [restore-state-machine.md](restore-state-machine.md) for connection, WAL, journal, and cleanup behavior.

On the iOS Simulator, injected exceptions at all ten boundaries produced either the entire original or entire candidate record+attachment. This simulated exceptions and called recovery without terminating the process; hard process termination/power loss was not tested. Orphan inactive generations can remain if interruption occurs before activation or during cleanup; the active generation remains whole. The shell has no production writer barrier, so arbitrary concurrent write lifecycle is an architecture blocker.

## Cross-platform restore matrix

| Artifact / path | Format | Result |
| --- | --- | --- |
| iOS-generated v1 proof -> Android Downloads picker -> fresh Android install | Previous prerequisite branch format v1 | Passed then; does not establish v2 compatibility and the old format is unsupported by current parser. |
| Android-generated v1 proof -> iOS Files picker | Previous prerequisite branch format v1 | Import did not complete because simulator Files provider showed unavailable Recents; picker UX failure does not answer crypto compatibility. |
| Android-generated v2 file -> iOS native restore | Current format v2 | Pending. |
| iOS-generated v2 file -> Android native restore | Current format v2 | Pending. |
| iOS fresh-install v2 restore | Current format v2 | Pending. |
| Android fresh-install v2 restore | Current format v2 | Pending. |

No current v2 cross-platform compatibility claim is made. Required test should separately run byte-level crypto vectors over the same artifact on each native crypto implementation, then file-based picker/import on each platform. Picker/provider behavior must be reported separately from authentication/format compatibility.

## Privacy and encryption compliance inventory

- No account, server, analytics, ads, crash reporting, remote config, bank connection, payment processing, or AI dependency/service is configured. Expo updates are disabled. `expo-updates-interface` is present through development client support; `expo-updates` is absent. Developer-run package/native builds use network to fetch dependencies and SDK artifacts.
- Expo FileSystem has network-capable APIs, but only local file methods are called. DocumentPicker and Sharing are explicit user actions; provider/recipient behavior is not controlled by the app.
- Android development manifest contains INTERNET. Release manifest/entitlement review is pending. No-Metro offline test is pending.
- iOS backup exclusion is configured but not compiled/runtime verified. Android generated exclusions are not device/OEM verified. OS transfer settings are not a substitute for the encrypted user backup.
- Apple documents `isExcludedFromBackup` as a resource attribute that file operations can reset and as guidance rather than an absolute backup guarantee; directory exclusion and behavior after SQLite writes need device verification. Android Auto Backup rules distinguish cloud and device-to-device transfer and are OS/target dependent. See [Apple exclusion behavior](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup) and [Android Auto Backup rules](https://developer.android.com/identity/data/autobackup).
- Live SQLCipher data protection does not cover all memory, logs, screenshots, user exports, share destinations, app/provider caches, compromised devices, or inaccessible key recovery. No absolute privacy claim is made.
- App Store privacy disclosures and applicable encryption export requirements need review against the actual release artifact. No store declaration, exemption, registration, or compliance conclusion is asserted.
- Biometric/PIN access, key reset/loss flow, crash-log review, temporary-file forensics, database file-protection class, and external sharing disclosures remain open.

## Clean-clone reproduction

From `/tmp/llcb-clean-clone`, cloned from the pushed remote branch at `17259e23a90b6c36a587c74f11b6fcf0ee38f38e` without copying any ignored files:

- `npm ci` with Node `24.22.2` and npm `11.6.2`: passed; 555 packages installed, 556 audited. npm reported the same 8 advisory entries (5 low, 3 high) described above.
- `expo prebuild --clean --no-install`: passed and regenerated both `ios/` and `android/` using committed Expo config and config plugins. Generated iOS AppDelegate contains the fixed backup-exclusion helper. Android manifest and backup-rule resources were regenerated with `allowBackup=false` and cloud/device-transfer exclusions.
- Android manifest/full-backup/data-extraction XML parsed successfully. `swiftc -frontend -parse` passed on generated AppDelegate. These are generation/syntax checks, not native app builds.
- `npm test`: passed, 30 tests (2 preview, 5 security-config/storage, 8 domain, 15 backup). `npm run typecheck`: passed. `npm run doctor`: passed.
- `git status` remained clean after generation; `ios/`, `android/`, and `node_modules/` are ignored. No required native manual edits were found outside config/plugins.
- Native build: not run from the clone because only 1.4 GiB remained after installation/regeneration. In the implementation worktree, current-branch Android Gradle attempts failed with `No space left on device`; the current-branch iOS build installed Pods but its first compile found two plugin-generated Swift errors. Those source errors were corrected and regenerated, and the isolated helper typechecked, but a post-fix full native build could not fit. No current-branch Android app build or post-fix iOS app build is claimed.

External prerequisites: macOS, Node 24.22.2/npm 11.6.2, Xcode 26.6 and an installed iOS simulator runtime, CocoaPods 1.17.0, Android SDK/NDK and compatible Java/Gradle, sufficient disk for native dependencies/build outputs, and Apple signing identity only for physical-device installation. No secrets are committed.

## Blockers

### A. Architecture blockers

- No application-wide storage/write gate serializes writes and closes all handles across restore.
- No hard process-kill/power-loss transition test or native SQLCipher-disabled build.
- Actual current-v2 cross-platform and fresh-install artifact restores are untested.
- Current catalog-key-loss recovery path is not available in an already damaged installation.
- iOS directory exclusion has not compiled/runtime verified; no full temporary-file/log/share audit.
- Android current-branch build, KDF measurements, and release-like offline validation are pending.

### B. Blockers to using real financial data

- Restore transaction coordinator and failure-preservation behavior are still proof-only; arbitrary writers and real schemas/migrations/attachments are unsupported.
- No verified recovery if local catalog key is inaccessible, no biometric/PIN experience, and no full attachment storage design.
- Dependency advisories remain open in Expo config/CLI build paths.
- No physical-device validation of key storage, backup exclusions, KDF latency, or device transfer.
- No forensic audit of plaintext temporary files, OS/provider copies, logs, and exports.

### C. Store-release blockers

- Physical iOS and Android release-like build/install/offline testing and platform privacy behavior.
- Store privacy disclosures and encryption export review against actual binaries.
- Dependency advisory remediation or reviewed mitigation with release evidence.
- Device security, crash/log redaction, app lock, backup/restore interruption, migration, and accessibility/release QA.

## Recommendation

**Do not begin the full bookkeeping MVP yet.** Continue this validation slice: the current iOS Simulator recovery proof is useful, but current-branch Android build, SQLCipher-disabled native behavior, cross-platform v2 file restore, clean-clone reproduction, and writer/key-loss architecture are still unresolved. Synthetic-data preview work may continue only if it does not add real data intake or imply native security validation.

When devices become available, use the [physical-device validation script](physical-device-test-script.md). No physical-device results are claimed here.
