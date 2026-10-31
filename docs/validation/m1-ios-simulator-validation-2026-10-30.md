# M1 iOS Simulator validation

Status: **complete for the bounded iOS Simulator build, install, icon, and
documented SQLCipher smoke checks**. Synthetic data only; this is not production
or release approval.

## Source and preserved Android result

- iOS tested source SHA: `b6662a5f9b66e2cc7d314c3b7b623da1cc66e492`.
- This branch starts from the live remote tip of
  `feature/m1-android-icon-runtime-20261030-8d0bd89`, verified at that exact SHA
  before work began.
- Comparing Android-tested source `8d0bd8929309028cbe7fb90f2502580a9c7fd731`
  to the iOS tested source shows documentation and Android evidence only. No
  application source, configuration, dependency, lockfile, or icon changed.
- Only this report and reviewed screenshots are committed after the tested
  source SHA; the reporting commit does not change the tested build source.
- The Android evidence remains attributed to SHA `8d0bd8929309028cbe7fb90f2502580a9c7fd731`:
  Samsung circular-mask appearance and development-client cold launch were
  demonstrated; themed/monochrome rendering and standalone no-Metro/offline
  operation remain pending.

## Environment and checks

- Mac: arm64; macOS 26.2 (25C56).
- Xcode 26.6 (17F113); installed iOS Simulator runtime 26.5 (23F77).
- Target: a new LLC-labeled iPhone 17 Simulator, redacted ID `4FB2…9782`.
- Node 24.22.2 and npm 11.19.1 were selected through the project-local session
  PATH. CocoaPods 1.17.0 installed 112 Pods from the generated iOS project.
- Build: Xcode Debug, iOS Simulator arm64, SQLCipher enabled,
  `CODE_SIGNING_ALLOWED=NO`, `ONLY_ACTIVE_ARCH=YES`. Build succeeded with zero
  errors and 619 dependency/toolchain warnings. The main executable SHA-256 is
  `dbde9b942354aa5ef025692fd8f8e2a6cae88b6f1ba9be21f3c12493b9bf5a82`.
- A second diagnostic Debug build used Simulator-only ad-hoc signing
  (`CODE_SIGNING_ALLOWED=YES`, `CODE_SIGN_IDENTITY=-`) in the same DerivedData
  folder. It succeeded with zero errors and 35 warnings. Its executable was
  ad-hoc signed with no Team ID and no entitlements, then installed over the
  LLC app on the same fresh Simulator without clearing app data. No signing
  credentials were accessed. Its executable SHA-256 is
  `7fe0d6cbe865d8d3f4f697a2ca948b82f9bd8417bb0dea5ae30a74204d18fa02`.
- `npm test`: passed, 38 tests across 9 files.
- `npm run typecheck`: passed.
- `npm run doctor`: passed; Expo reported dependencies up to date.
- `npm run config:public`: passed. It resolved bundle ID
  `com.amanchilabs.llcbookkeepingprivate`, display name `LLCBookKeepingPrivate`,
  SQLCipher enabled, and updates disabled.
- Generated project inspection confirmed the iOS 16.4 deployment target, the
  configured bundle ID/display name, the SQLCipher Pod property, the committed
  iOS backup-exclusion plugin in AppDelegate, and the generated splash
  storyboard. No app config or dependency lockfile changed.
- The general host test suite is not a rerun of the security matrix. The
  committed npm advisory snapshot was not refreshed; its two recorded upstream
  advisories (deepmerge and Zod, affecting eight npm entries in the snapshot)
  remain open.

## Install, launch, and icon

- Fresh install succeeded on the dedicated iPhone 17 Simulator. The final
  ad-hoc signed app launched and rendered the current JavaScript proof screen
  from Metro on `localhost:8082`. An earlier unsigned launch displayed a
  SecureStore error; after installing the ad-hoc build, startup reached the
  ready storage state. The exact cause of the first error is not confirmed.
- The installed home-screen icon matches the committed artwork. The LLC mark,
  ledger, bars, shield, and lock are visible and legible. I observed no outer
  border, clipped foreground, or transparent default background. The iOS home
  screen applies its normal rounded-square mask. The long configured label is
  truncated by the launcher; the configured display name was not changed.
- Privacy-reviewed, tightly cropped Simulator screenshot:
  [installed iOS home-screen icon](evidence/m1-ios-simulator-2026-10-30/launcher-icon.png)
  (SHA-256 `ec5273b0075368c6baef78914d6c14da7ea7717a01787d2ac3adb5506cfd8f45`).
- This is Simulator evidence only, not physical-iPhone evidence. It does not
  demonstrate a standalone/no-Metro build.

## SQLCipher smoke checks and initial SecureStore diagnostic

The first unsigned build displayed “Secure key storage could not be read. Existing
encrypted files were preserved.” One explicit retry showed the same state. The
signed ad-hoc build then reached ready state without clearing or replacing app
data. The initial failure is preserved in the
[startup diagnostic screenshot](evidence/m1-ios-simulator-2026-10-30/storage-keychain-blocked.png).

On the ad-hoc Simulator build, the existing proof screen reported SQLCipher
`4.17.0 community`; secure key stored, database reopened, synthetic record and
attachment persisted across database connections, and wrong key rejected all
passed. I stopped and relaunched only the LLC app on this Simulator. Startup
returned to the ready state, the encrypted `llc-local.db` SHA-256 remained
`3e7b136fc39834a6af70f46130e7eb02523cb957669569013fcb74f7575d762a`, and the
proof screen passed again. The existing proof routine upserts its deterministic
fixture before reading it, so the process-relaunch evidence is the unchanged
database hash plus successful startup integrity validation; the UI does not
provide a separate read-only row/BLOB query after relaunch.

Ordinary Python SQLite, opened read-only with immutable mode against the app’s
synthetic encrypted database, returned `file is not a database`. No database key
or plaintext was read or copied. The privacy-reviewed
[SQLCipher proof screenshot](evidence/m1-ios-simulator-2026-10-30/sqlcipher-proof.png)
shows the passing checks without exposing the Simulator or app-container ID.
(SHA-256 `df9ee9c2dae65a8d5bfba775b165ab95e97a8e3c81f7f944b5f88e863476b703`.)

The earlier startup diagnostic remains a failed initial attempt, not an
unresolved current runtime failure. No SQLCipher result is inferred from host
tests or configuration checks.

## Resources and remaining gates

The iOS build and fresh Simulator consumed substantial disk space; available
space fluctuated between 1.1 and 2.3 GiB afterward and was 1.1 GiB at the final
check. The task-specific temporary DerivedData folder remains because its
removal was rejected by command safety review. No shared cache, SDK, other
Simulator, Samsung app, or DermaPrivate process was removed or modified. The
LLC Simulator and installed app remain intact.

Still open: broader security-matrix checks; cross-platform/current-format
restore; key-loss handling; interrupted-restore/process-kill recovery; the
SQLCipher-disabled negative build and plaintext-file scan; standalone offline
operation; physical-iPhone behavior; dependency advisory reassessment; and
signing, privacy, and release gates. No store console or credentials were used.
No merge was performed.
