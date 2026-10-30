# Icon integration verification — 2026-10-30

## Source and scope

Tested icon source commit: `b12491413522341b3acbe93d089ce5db855aed62` on
`feature/app-icons-20261030-19a9e6b`. Subsequent documentation-only checkpoint
commits do not acquire native build claims. Intake checkpoint was
`f8d79cb8bb0e1f6b661281cdf830b2cbe6bf665e`; validation base remains
`19a9e6b23df2e0425db7be70c0e493817ea0e697`. Neither validation branch nor main
was changed.

Integration and technical exports are delivered. The overall task is
**incomplete: native build/install verification is blocked by host prerequisites**.
The existing safe-area overshoot and monochrome cutouts remain as authorized.
No existing security/backup/release blocker is resolved by this work.

## Environment

**Reconciliation:** [current environment audit](environment-reconciliation.md)
corrects the Java diagnosis below: Homebrew JDKs 17.0.15 and 24.0.1 exist but
default discovery fails. Expo SDK 58 requires Xcode 26.4+, beyond the lower-level
React Native helper minimum. Original build outcomes below are unchanged.

Initial disk check: 77,547,756 KiB available (73.96 GiB), exceeding the prior
5 GiB minimum estimate. No cleanup or user-data deletion was performed.
Node 24.3.0; npm 11.4.2; Python 3.11 with Pillow 11.3.0 in an isolated temporary
virtual environment. Xcode 15.2 / iOS Simulator 17.2. No booted simulator or
connected Android target was available during preflight. CocoaPods is absent.
The expected user Android SDK directory and adb are absent; no Java runtime
is installed. JAVA_HOME points to a nonexistent Corretto installation.
React Native's installed `scripts/cocoapods/helpers.rb` specifies minimum
Xcode 16.1; this host's Xcode is below that prerequisite.

## Checks at the tested icon commit

| Check | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Passed; 590 packages installed from unchanged lockfile before committing. This is not an advisory audit. |
| `npm run typecheck` | Passed at tested commit. |
| `npm test` | Passed at tested commit: preview 2, security config/storage 13, domain 8, backup 15; 38 tests total across 9 files. Host tests, not native security validation. |
| `npm run doctor` | Passed at tested commit; dependencies up to date. |
| `EXPO_NO_TELEMETRY=1 npx expo config --json` | Passed at tested commit; public config resolution also passed before commit with identical configuration. |
| Baseline config comparison | Loaded intake and current TypeScript configs; after removing only new `icon` and `android.adaptiveIcon`, objects are identical. Every new path exists and is repository-relative. |
| Source integrity | All six intake SHA-256 values verified before export; Git diff confirms originals unchanged. |
| Export validation | All five manifest hashes verified; decoded pixels exactly equal full-canvas Lanczos downsampling of corresponding sources, with matching dimensions/modes. Embedded sRGB ICC profiles checked during generation. |
| Play asset | PNG IHDR verified 512 × 512, bit depth 8, color type 6 (32-bit RGBA); opaque alpha; sRGB ICC; 262,317 bytes, below 1024 KB. |
| `EXPO_NO_TELEMETRY=1 CI=1 npx expo prebuild --no-install` | Passed at tested commit for both platforms. package.json and lockfile unchanged. |
| Generated iOS icon | Universal 1024 × 1024 catalog entry; decoded RGB pixels exactly match committed app-icon.png. |
| Generated Android icons | Foreground/background/monochrome plus legacy/round WebP icons present at all five density buckets. Both adaptive XML files reference all three layers. |
| `git diff --check` | Passed. |

## Native build attempts at tested icon commit

### iOS — failed, no install

Command:

```sh
xcodebuild -project ios/LLCBookKeepingPrivate.xcodeproj \
  -scheme LLCBookKeepingPrivate -sdk iphonesimulator -configuration Debug \
  -derivedDataPath /tmp/llcb-icons-derived CODE_SIGNING_ALLOWED=NO build
```

Failed in `[CP] Check Pods Manifest.lock`:

```text
error: The sandbox is not in sync with the Podfile.lock. Run 'pod install' or update your CocoaPods installation.
** BUILD FAILED **
```

CocoaPods dependencies were not installed because CocoaPods is unavailable;
Xcode must also be upgraded to satisfy the installed dependency minimum.
No successful executable or current-icon installed screenshot was produced.

### Android — failed, no install

Command: `cd android && ./gradlew :app:assembleDebug`.

```text
ERROR: JAVA_HOME is set to an invalid directory
```

The configured Java location does not exist. A compatible JDK and Android
SDK/build tools/NDK plus an emulator or authorized physical target are required
before retrying. No APK was produced or installed.

## Visual evidence

`previews/mask-contact-sheet.png` was generated and visually inspected. It shows
circle, rounded-square, square, and themed-alpha illustrations and both opaque
full-square exports. These are host-rendered previews, not Android launcher
or iOS installed-device verification. No actual launcher mask/parallax,
themed-icon selection, physical-device installation, or store upload was tested.
The source composition is preserved; platform mask quality remains subject to
the documented foreground safe-area and monochrome limitations.

## Security and remaining work

The prior full native security/build evidence in
the prior native proof report belongs to source
`78cf3096e17e7b3a531b1ccd3c4032cb948f97ad`, not this icon commit. See [prior native proof results](../../docs/security/native-proof-results.md).
Only the automated host suite listed above was rerun here. Native backup
portability, process termination/recovery, physical-device key/KDF checks,
negative encryption builds, clean-clone builds, dependency advisory review,
and signed release/store gates remain as documented there.

To finish: provision compatible native toolchains, install CocoaPods dependencies,
build both regenerated native projects at a recorded commit, install on isolated
available targets, capture launcher screenshots and themed-mask behavior, and
record outcomes without reusing older security evidence. Do not change security,
backup, identifiers, splash, or release settings to bypass these prerequisites.

Generated `ios/`, `android/`, node_modules, temporary build logs/DerivedData and
the temporary Python virtual environment are intentionally outside Git and
reproducible from committed inputs plus external toolchains. All intended
exports, source assets, generation script, preview, and reports are committed.
No merge is authorized; keep this branch pushed for review.
