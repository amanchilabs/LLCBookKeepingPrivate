# M1 Android physical-device validation — 2026-10-30

Status: **complete for the bounded Android build, install, launcher, and SQLCipher smoke task.** Synthetic test data only. This does not complete the bookkeeping MVP, security matrix, restore gates, or release review.

## Source and target

- Feature branch: `feature/m1-android-icon-runtime-20261030-8d0bd89`.
- Exact application source SHA built and exercised: `8d0bd8929309028cbe7fb90f2502580a9c7fd731`.
- The source files and dependencies are unchanged from `7c441ab2e3af42c46949413b13d55f235feaf141`; the intervening commit added the prior validation report only. This report and its screenshots are also documentation/evidence only.
- Target: Samsung SM-S911U, Android 17 / API 37. Redacted ADB identifier: `RFC…D4J`. Exactly one Samsung target was connected and the same target was checked before each device-specific operation.
- Application ID: `com.amanchilabs.llcbookkeepingprivate`; version `0.1.0`. The app was absent before installation, so installation was fresh. No app data was cleared or replaced.

## Environment and build

- Node 24.22.2, npm 11.19.1, Temurin JDK 17.0.20.1, Gradle 9.4.1, Android Gradle Plugin 9.2.1, compile SDK 37, target SDK 36, build-tools 37.0.0, NDK 27.1.12297006.
- Session-local `JAVA_HOME`, Node path, and Android SDK path were used. Project dependencies, lockfile, identifiers, app configuration, and artwork were not changed. `npm ci` was not rerun because `node_modules` was already installed; Expo reported dependencies up to date.
- One Debug build succeeded in 2m37s. Command:

  ```sh
  ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a \
    --max-workers=2 --no-parallel --console=plain
  ```

- Only `arm64-v8a` native libraries are packaged. APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 85,829,922 bytes, SHA-256 `e56cb108cab7e9364de6cb59b2d7c943f20a27888389a8dd4e575878ad405f31`. The APK and generated native project remain ignored local build artifacts; the APK is not committed.
- The final APK manifest has the configured package, display label, target SDK, `allowBackup=false`, and both backup exclusion rules. Expo updates are disabled; SQLCipher is enabled. The standard Debug overlay enables cleartext for the local Metro development connection. No release configuration or signing credentials were changed.
- Gradle was limited to two workers. The NDK Ninja sub-build spawned multiple compiler processes; memory availability briefly fell to 31% and disk availability to 17 GiB, with no DermaPrivate build/deployment activity detected. No DermaPrivate process, ADB server, or unrelated device was stopped or modified.

## Automated checks at the tested source SHA

| Check | Result |
| --- | --- |
| `npm test` | Passed: 38 tests across 9 files. |
| `npm run typecheck` | Passed. |
| `npm run doctor` | Passed: dependencies up to date. |
| `npm run config:public` | Passed: app ID, SQLCipher enabled, updates disabled, icon resources resolved. |
| Branding validation | Passed: five export hashes/dimensions and six source hashes matched committed manifests. |
| Project/lockfile check | Passed: `package.json`, `package-lock.json`, and `app.config.ts` unchanged. |

The general test suite is not a rerun of the security matrix. The prior npm audit snapshot was not rerun here; its previously recorded advisory findings remain open.

## Installation, launch, and installed icon

- Fresh `adb install` succeeded on the approved Samsung. The app launched through the installed development client and Metro served the JavaScript bundle. A force-stop of the LLC package followed by a cold relaunch also succeeded. Only the LLC app was force-stopped.
- The installed launcher icon is shown in [the cropped Samsung app-drawer screenshot](evidence/m1-android-physical-2026-10-30/launcher-icon.png). The launcher rendered a circular mask. The LLC mark, document, chart, shield, and lock remain visible and legible without essential foreground clipping. The launcher truncates the long app label to `LLCBookKeepi…`; the configured display name remains unchanged.
- Screenshot SHA-256: launcher icon `82d06b15c908d125b55e985e4459eadea6d208552499163ede4baafc63fbb6a4`.
- The APK’s adaptive icon XML includes the monochrome layer. The current Samsung drawer screenshot shows the colored icon; themed/monochrome rendering was not observed. I did not change launcher settings. This is unverified under the current launcher presentation, not a failed icon check. One Samsung launcher does not establish behavior under every Android mask.
- The screenshot was cropped to the LLC icon and label; the status bar and other app icons are excluded.

## SQLCipher smoke check

The existing **Run SQLCipher + key-storage proof** was run once with the app’s synthetic proof record and BLOB. The screen reported:

- SQLCipher `4.17.0 community`.
- Secure key stored: PASS.
- Database reopened: PASS.
- Synthetic record and attachment persisted across database connections: PASS.
- Wrong key rejected: PASS.

The [cropped installed-app screenshot](evidence/m1-android-physical-2026-10-30/sqlcipher-proof.png) shows these results. A temporary copy of the app-private encrypted database was tested with ordinary SQLite on the host; SQLite rejected it as an encrypted database. The app was then force-stopped and cold-launched; the encrypted file remained byte-for-byte unchanged, and ordinary SQLite still rejected it. The temporary host copy was deleted. No key or real financial data was copied or logged.

Screenshot SHA-256: SQLCipher proof `7fcd531f3176c57886c7e1b4cdf119e7351af4dfa343e6e12f34d899244ddd1e`.

This smoke check does not test backup restore, key loss, interrupted restore, a SQLCipher-disabled build, Android backup/transfer behavior, or release security. The device reported `ACCESS_LOCAL_NETWORK` granted for the debug app; I did not issue a permission-grant command or change device settings.

## AVD and remaining gates

- The earlier LLC-specific AVD remains incomplete because the installed legacy `avdmanager` encountered missing `devices.xml`. It was not repaired or used. No Android CLI, SDK component, or emulator image was downloaded for this follow-up; the approved physical device was used instead.
- iOS, other Android launcher masks, themed-icon rendering, current-format cross-platform restore, key-loss recovery, restore interruption/process-kill recovery, physical backup/transfer behavior, the negative SQLCipher build, and release/store checks remain open.
- No App Store Connect or Google Play Console session was accessed. Nothing was uploaded, submitted, signed for release, or published. No merge was performed.
