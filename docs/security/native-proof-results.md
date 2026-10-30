# Native Storage and Backup Validation Report

Status: **incomplete; synthetic data only.** This report records the bounded
continuation results and the remaining validation gates. It is not security,
financial-data, or release approval.

Updated: 2026-10-30. All fixtures are synthetic.

## Tested source and current checkpoint

- Validation branch: `feature/native-validation-20261030-939a045`.
- Native builds and the full automated suite below tested source SHA
  `78cf3096e17e7b3a531b1ccd3c4032cb948f97ad`.
- The branch starts at verified prerequisite
  `feature/restore-security-validation-20261030`, SHA
  `939a045f6d738c0c7c9158056946882e3c3fd215`.
- Documentation-only changes after the native build do not receive those
  build claims. Their new commit SHA is only a checkpoint for this report.
- Toolchain: Node 24.22.2, npm 11.6.2, Expo 58.0.21, React Native 0.88.1,
  Xcode 26.6, CocoaPods 1.17.0, Android SDK platform/build-tools 37, NDK
  27.1.12297006, Gradle 9.4.1, and the installed Java 25 runtime.

## Current-commit builds

| Platform | Result and exact configuration | Artifact/evidence |
| --- | --- | --- |
| Android | **Build passed.** `:app:assembleDebug`, default Expo configuration (SQLCipher on; no negative-build flag; not a production/release build), API 37 compile SDK / API 36 target, all four configured ABIs. Build completed in 14m24s. | Debug APK SHA-256 `e6ff3637e0d19520607ac8e9f88edbb6a9f8c2cc0682d1f50d121a9daf7ae43d`; temporary artifact `/tmp/LLCBookKeepingPrivate-android-debug-78cf309.apk`. |
| iOS | **Build passed.** Xcode Debug, `iphonesimulator26.5`, destination LLCBookKeepingPrivate iPhone 17 Simulator (`D48E279D-DFAC-440C-A125-CA614E8A1D29`), `CODE_SIGNING_ALLOWED=NO`, default Expo configuration (SQLCipher on). CocoaPods installed 112 pods. | App executable SHA-256 `dbde9b942354aa5ef025692fd8f8e2a6cae88b6f1ba9be21f3c12493b9bf5a82`; temporary app `/tmp/LLCBookKeepingPrivate-ios-debug-78cf309.app`. |

These are full native debug builds at the tested SHA. They do not establish a
signed release build, store packaging, or the SQLCipher-disabled behavior.

## Automated checks at the tested SHA

- `npm test`: passed, 38 tests (preview 2; security/config/storage 13; domain
  8; backup 15).
- `npm run typecheck`: passed.
- `git diff --check`: passed before the source checkpoint.
- Storage unit tests cover serialized generic operations, draining before a
  transition, stale database-lease rejection, wait-for-started-statements,
  locking after key-access errors, and retry after a valid active generation.
  Error-classification tests cover temporary lock, cancelled authentication,
  unavailable/corrupt key, and generic key-store failure. These are unit tests,
  not native concurrent save/read/export/attachment tests.

## Native runtime and recovery evidence

- Android debug APK installed on the available API 36 emulator and Metro
  generated a current-branch bundle. That emulator was concurrently running a
  separate DermaPrivate development session and returned to that app. I did
  not terminate or clear the shared emulator. No Android storage-proof screen
  or restore result is claimed.
- iOS app installed on the dedicated simulator and Metro bundled the current
  source. The simulator ran out of host disk during the launch attempt; Metro
  reported `ENOSPC` writing Expo's device metadata. No successful in-app
  recovery, storage proof, or restore result is claimed.
- Exception-injection tests remain distinct from process-kill tests. The
  earlier report described ten iOS Simulator exception boundaries, but it did
  not preserve the exact source SHA used. That historical result is not
  credited to this tested SHA. The full automated suite passed at this SHA;
  native exception recovery was not rerun here.
- No controlled external process-termination harness has been added. Durable
  activation/journal/key-persistence transitions, interrupted recovery retry,
  and record/attachment-hash checks across a new process remain pending.
  Nothing here is power-loss durability evidence.

## Storage coordination and inaccessible-key handling

The source now routes ordinary active-database callbacks through a shared
coordinator and lease. Restore/recovery closes admission, drains admitted work,
closes registered connections, validates a single active generation before
resuming, and rejects stale leases. A failed key-access classification can
lock new access until explicit retry.

When a database file exists but its SecureStore key is missing or malformed,
the code refuses to create a replacement key. The app has a locked/recovery
state, explains that no server or escrow exists, and requires explicit
confirmation before authenticated portable-backup replacement. On the
unusable-catalog path it archives local files before preparing a replacement
catalog. Without a usable old key or a valid independent backup and passphrase,
the existing encrypted data cannot be recovered.

Evidence at this SHA is source review and unit tests only. Native concurrent
save/read/export/attachment behavior, authentication/keychain failures,
preservation of actual local files, confirmed recovery, and no-key/no-backup
UI outcomes were not exercised because the native app could not be run
reliably. Do not treat those code paths as validated behavior.

## Current backup-format matrix

The current envelope header is version 2; the synthetic proof payload schema
still identifies itself as payload/schema version 1. They are separate
version fields. Existing unit tests cover envelope parsing, fixed header
parameters, bounds, bad magic, truncation, and unsupported versions. They do
not exercise the native AES/PBKDF implementation against files on both
platforms.

| Test | Current result |
| --- | --- |
| iOS-created v2 file restored on Android | Not run |
| Android-created v2 file restored on iOS | Not run |
| Fresh-install restore on iOS | Not run |
| Fresh-install restore on Android | Not run |
| Wrong passphrase, tampering, truncation, unsupported version as native file tests | Not run; only envelope-level automated cases are current |
| Missing old local key and existing-data preservation after rejected restore | Not run natively |
| Picker/provider UX on both platforms | Not run; must remain distinct from file-format/crypto evidence |

The earlier v1 artifact result is not counted toward v2 portability.

## Negative encryption and clean-clone builds

- Automated policy tests verify SQLCipher is on by default, a separate
  `LLCB_SECURITY_NEGATIVE_SQLITE=1` build disables it, and that flag is rejected
  for the production profile. The SQLCipher-disabled native app was not built,
  installed, or scanned for plaintext DB/WAL/SHM/journal files.
- A current-SHA clean-clone build was not run. Earlier clone evidence at
  `17259e23a90b6c36a587c74f11b6fcf0ee38f38e` is not evidence for this SHA.
  Re-run clean-clone iOS and Android builds without copying ignored files.
- External prerequisites include macOS, Node 24/npm 11, Xcode 26.6 and an iOS
  26.5 simulator runtime, CocoaPods, Android SDK/build tools/NDK, compatible
  Java/Gradle, and sufficient disk. Physical installation additionally needs
  Apple signing credentials; none are required for the simulator compile
  reported above.

## Dependency advisory disposition

The package lockfile did not change in this continuation. The committed audit
snapshot uses Node 24.22.2/npm 11.6.2 and reports two unique upstream
advisories through Expo's build/development graph:

- `deepmerge@4.3.1`, `GHSA-gcqx-w48m-w2h4`, reached through `expo@58.0.21` and
  `@expo/config@58.0.9`. The advisory lists no patched release. This is
  configuration/build-time exposure; app financial requests do not call it.
- `zod@3.25.76`, `GHSA-mrhx-c7xc-m3w5`, reached through Expo CLI 58.1.17.
  The fix is Zod 4.6.6, outside the CLI's declared Zod 3 range. The described
  input is development-server DevTools plugin output, not a shipped financial
  record path.

Full package paths, inputs, mitigation limits, and original advisory links are
in [the audit assessment](audits/npm-audit-2026-10-30.md). Findings remain
open. No downgrade, override, suppression, or residual risk acceptance was
made. The audit was not rerun in this continuation; reassess before release.

## Deferred hardware and release checks

Physical-device KDF latency, Keychain/Keystore behavior, key loss and restore,
backup/transfer and OEM behavior, signed release install, privacy disclosures,
and store review remain pending. A simulator KDF benchmark is not backup
password-security validation and is not repeated or relied on in this report.

### Gates

**A. Before synthetic-data bookkeeping implementation:** run current-SHA native
runtime proof on isolated iOS and Android targets; complete native concurrent
access, missing-key, v2 file interoperability/fresh-install, SQLCipher-negative,
and clean-clone builds; and run the controlled process-kill/recovery matrix.

**B. Before using real financial data:** additionally complete physical-device
key and transfer checks, production schema/migration and attachment design,
plaintext/log/export review, and compatible remediation or separately reviewed
mitigation for open advisories. No real-data use is approved by this report.

**C. Before store release:** additionally build and install signed release
artifacts, verify offline behavior and backup policy on supported OS/OEM paths,
complete accessibility/privacy/export-control/store disclosures, and close the
security and dependency review. No release readiness is implied.

## Environment blocker

After both native builds and simulator launch attempts, the workspace volume
had 185 MiB free. The current iOS launch hit `ENOSPC`; continuing process-kill,
negative-build, or clean-clone work safely requires at least 5 GiB available on
that volume. The next environment action is to approve targeted cleanup of
reproducible user-level build caches or provide a volume with at least 5 GiB
free. No unrelated workspace, broad user cache, backup, or simulator contents
were deleted. Current generated native projects, CocoaPods, and node_modules
are ignored build inputs. The APK and iOS app bundle listed above are temporary
files outside Git; they are not required application assets.
