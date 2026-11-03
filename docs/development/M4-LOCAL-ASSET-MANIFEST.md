# M4 Migration Local-Asset Manifest

**Inventory date:** 2026-11-01
**Status:** Package prepared and verified locally; **not backed up outside the M1**.
**Git branch:** `chore/m4-migration-handoff-20261101-fd1ecd4`

## Tracked and remotely recoverable

All application source, lockfiles, business/domain tests, configuration, design specifications, and canonical mockups are tracked in Git. The design package contains its README/specifications, decisions, design system, navigation map, screen inventory/specifications, implementation migration plan, feature-preservation matrix, acceptance criteria, and all 31 proposed PNGs. Twenty canonical screen selections are identified and resolve to tracked files. These assets are restored by cloning the handoff branch; they do not need to be placed in the local-asset archive.

## Checksum-verified UX evidence package

| Item | M1 path | Contents | Status |
|---|---|---|---|
| UX discovery gallery | `~/Downloads/LLCBookKeepingPrivate/UX-Discovery/` | 112 files, 22,137,573 bytes: screenshots, HTML index, inventory, navigation diagram, design references and assessments | Local-only source; copied into archive |
| UX implementation evidence | `~/Downloads/LLCBookKeepingPrivate/UX-Implementation-20261101/` | 376 files, 398,316,333 bytes: 99 PNG screenshots, 106 JSON evidence/metadata files, 170 logs, 1 temporary file | Archive includes all 99 PNG and 106 JSON; logs/temp omitted |
| Migration archive | `~/Downloads/LLCBookKeepingPrivate/M4-Migration-20261101/llcbookkeeping-m1-to-m4-local-assets-20261101.tar.gz` | 317 selected source files plus README and internal checksum list; excludes credentials, logs, temp files, caches, dependencies, and generated builds | Archive SHA-256 verified; extracted payload checksums verified (318 entries) |
| Archive checksum sidecar | `~/Downloads/LLCBookKeepingPrivate/M4-Migration-20261101/llcbookkeeping-m1-to-m4-local-assets-20261101.tar.gz.sha256` | Detached SHA-256 line for archive | SHA-256: `9a46ae30f397b2fabd437b5d9107909de05f333cec8b9241db89f3ff12f4aa0e` |

Archive size: 45,552,175 bytes. It was created with unique paths and re-extracted into a temporary directory; all 318 internal SHA-256 entries matched. The detached archive digest also matched. The previous source asset list at `~/Downloads/LLCBookKeepingPrivate/Recovery/SHA256SUMS.txt` contains 489 entries; all 489 verified at inventory time. That list is a local checksum record, not an off-device backup.

The archive currently remains in the M1 user's Downloads. `/Volumes` contained only the internal Macintosh volume at inventory time. **Migration is not ready.** Copy the archive and its `.sha256` sidecar to an external drive or authorized encrypted storage. On the destination, run:

```sh
cd /path/to/copied/M4-Migration-20261101
shasum -a 256 -c llcbookkeeping-m1-to-m4-local-assets-20261101.tar.gz.sha256
mkdir extracted
tar -xzf llcbookkeeping-m1-to-m4-local-assets-20261101.tar.gz -C extracted
cd extracted/llcbookkeeping-m1-to-m4-local-assets
shasum -a 256 -c SHA256SUMS.txt
```

Expected: archive checksum passes and 318 payload entries pass. Keep the archive untouched until destination verification succeeds.

## Signing and machine-local files

| Asset | Location/state | Migration action |
|---|---|---|
| Android debug key | Ignored `android/app/debug.keystore`, 2,257 bytes. The M1 clean-clone Expo template regenerated a byte-identical default debug key. | Not included in the archive and no backup is required to regenerate the same debug identity at this pinned dependency version. On M4, compare the generated key before updating an existing device install. This is not a production signing key. |
| Apple development identities | M1 login keychain `~/Library/Keychains/login.keychain-db`; two valid code-signing identities, no provisioning profiles found, and no `.p12` export found in repo/Downloads. Identity names and contents are intentionally omitted. | For physical iOS signing, export the needed identity plus private key from Keychain Access as a password-protected `.p12`; transfer separately using encrypted storage; import on M4 and reissue provisioning if needed. Do not copy the whole login keychain into Git or the archive. Simulator builds do not require signing identities. |
| `ios/.xcode.env.local` and `ios/.xcode.env` | Ignored generated, machine-local Node environment files; `.xcode.env.local` is 63 bytes. Values were not copied into this document. | Regenerate on M4. Do not transfer an absolute M1 Node path. |
| Simulator/AVD/app state | Local synthetic state only; no real financial records identified in this audit. Android device state remains on the device. | Not required to rebuild source. Recreate acceptance fixtures; do not copy device databases into Git. |

## Regenerable or disposable state

The following ignored/generated folders are not included in the migration archive:

- `node_modules/` (about 3.9 GiB), `.expo/` (about 6.5 MiB): recreate with `npm ci` and Expo.
- `ios/` (about 1.4 GiB, including CocoaPods/derived output), `android/` (about 75 MiB): generated from tracked Expo app config, native build policy, plugins, assets and lockfile; no manual nonregenerable native source change was found.
- Xcode DerivedData, Gradle caches/builds, AVD and simulator images/state: regenerate or reinstall with tools on the M4.
- The UX implementation logs (170 files) and one `.tmp`: excluded from the package because they are voluminous diagnostic output, not build inputs. The original Downloads copy remains on the M1 until separately backed up or intentionally discarded.

Tracked inputs controlling native generation include `app.config.ts`, `apps/mobile/native-build-policy.cjs`, `plugins/with-ios-backup-exclusion.cjs`, `plugins/with-android-backup-exclusions.cjs`, `package.json`, `package-lock.json`, `.node-version`, and referenced assets. A fresh clone at source SHA `fd1ecd43...` passed Expo prebuild, iOS Pods installation, unsigned iOS Simulator build, and Android debug APK build. Generated SQLCipher, backup-exclusion, and app-identifier settings matched tracked inputs. No generated native directory is tracked by Git.

## Human actions before reset

1. Copy the archive and checksum sidecar off the M1; verify them on the destination.
2. If future physical iOS development is required, export a password-protected Apple `.p12` separately and verify/restore it on M4 without exposing its password or key.
3. On M4, clone the canonical branch and verify the live Git SHA; then install dependencies, run tests/typecheck, prebuild, and verify native configuration before device use.

Do not describe the current M1 state as migrated or reset-ready until the external copy is verified and required signing material is available or intentionally reissued.
