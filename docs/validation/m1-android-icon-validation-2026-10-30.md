# M1 Android icon validation checkpoint — 2026-10-30

Status: **incomplete; native build and install deferred for resource contention.** Synthetic data only. No bookkeeping MVP, merge, iOS build, or real financial data was used.

## Source and branch

- Feature branch: `feature/m1-android-icon-validation-20261030-7c441ab`.
- Exact source SHA for all application/configuration checks: `7c441ab2e3af42c46949413b13d55f235feaf141`.
- This checkpoint adds documentation only. It does not change application code, dependencies, lockfile, or artwork.

## Isolated setup

- M1 host: MacBook Pro, Apple M1/arm64, macOS 26.2.
- Node 24.22.2 arm64 archive was downloaded from the official Node.js distribution and matched its published SHA-256: `aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a`. It is installed under a user-local versioned directory; default Node and shell profiles were not changed. Actual bundled npm: 11.19.1.
- `npm ci` installed 555 packages from the committed lockfile. `package.json` and `package-lock.json` remained unchanged.
- Xcode 26.6 and iOS 26.5 runtime are available; CocoaPods 1.17.0 is installed. No iOS build was started.
- Android requirements resolved from the installed project plugins/config: AGP 9.2.1, Gradle 9.4.1, compile SDK 37, target SDK 36, build-tools 37.0.0, and NDK 27.1.12297006. JDK 17.0.20.1 is available through the existing Gradle-managed installation; session-local selection is required because default Java is 25.0.1 and `JAVA_HOME` is unset.
- Required SDK components are present, including Android API 37.0/API 36 and the Google APIs API 36 arm64 system image. No SDK or emulator image download was made.
- Android prebuild generated the ignored `android/` project from committed configuration. It produced all five density buckets for foreground, background, and monochrome launcher layers, with adaptive XML references to all three. Generated checks confirmed the application ID/namespace, display name, `allowBackup=false`, and both backup exclusion rules. Public config retained SQLCipher enabled, updates disabled, and the committed icon paths. Package and lock files were unchanged.
- A dedicated AVD config named `LLCBookKeepingPrivate-M1-API36` was written using the existing API 36 arm64 image and Pixel 7 profile. Homebrew `avdmanager` returned an error while reading device metadata (`devices.xml` is absent from the installed image directory); it wrote the AVD config before returning. The AVD was not booted, so this target is not yet verified usable. The existing AVD and attached device were not used.

## Checks at the exact source SHA

| Check | Result |
| --- | --- |
| `npm test` | Passed: 38 tests across 9 files. |
| `npm run typecheck` | Passed. |
| `npm run doctor` | Passed: dependencies up to date. |
| `npm run config:public` | Passed; SQLCipher on, updates disabled, identifiers and icon configuration resolved. |
| Export/source asset validation | Passed: all 5 export hashes, dimensions, modes, and all 6 approved source hashes matched their manifests. No artwork was modified. |
| `EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install` | Passed; Android native project generated. |
| Lockfile check | Passed; `package.json` and `package-lock.json` unchanged. |
| `npm audit --json` | Exit 1: 8 entries (5 low, 3 high) from 2 unique advisories. |

Current audit findings:

- `deepmerge`: [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), prototype poisoning in returned objects; low severity.
- `zod`: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), memory exhaustion while validating oversized constrained collections; high severity.

No dependency fix or override was applied.

## Native work deferred

The resource recheck after setup showed 21.3 GiB free disk, an 8 GiB host with 42% system-wide memory free, and 2.59 GiB of 3 GiB swap already used. Two long-lived npm processes referenced DermaPrivate (0% CPU and about 8 MiB RSS each), an ADB device was attached with ownership unconfirmed, and Gradle daemons were present without an active build task. No process or ADB server was stopped or restarted; no emulator was launched, and the attached device was only enumerated, never targeted.

Given the attached target, DermaPrivate-referencing processes, and nearly full swap, no LLC native build, emulator boot, install, app launch, or screenshot was attempted. The installed-icon result is therefore **not established**. The existing artwork reports remain the only evidence: foreground opaque bounds exceed the documented safe square by about 52–53 source pixels on the right/bottom; the monochrome source has internal alpha concerns. These are not emulator observations, and no correction was made.

The existing UI exposes “Run SQLCipher + key-storage proof,” but it was not run because no native app was built or launched. No native SQLCipher result is claimed. Restore, key-loss, process-kill, physical-device, and release gates remain open.

## Local-only items

Node 24.22.2, its downloaded archive/checksum file, `node_modules/`, generated ignored `android/`, Gradle/npm caches, and the unbooted AVD configuration are local-only. They are not committed. The AVD config is not boot-validation evidence.
