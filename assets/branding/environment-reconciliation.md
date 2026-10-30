# Native icon environment reconciliation — 2026-10-30

Status: blocked pending user choice of a compatible build host or approval of
Android tooling downloads. No application/configuration/artwork changes.

## Branch and commit reconciliation

The live remote icon prerequisite was verified as exactly
`b703fd79af107385bd9700ee02820d2e08a94bfe`. The authorized dependent branch is
`feature/icon-native-env-20261030-b703fd7`, created from that fetched commit
and pushed with its own upstream. Icon and security-validation branches remain
intact. No history rewrite or merge occurred.

`git diff --name-status b12491413522341b3acbe93d089ce5db855aed62 b703fd79af107385bd9700ee02820d2e08a94bfe`
shows only the addition of `assets/branding/verification.md` (112 lines).
There were no application, configuration, dependency, or asset changes between
those commits. The host suite at b124914 remains evidence for that source;
it is not the native security matrix. This continuation adds documentation only.

## Current environment and historical comparison

| Item | Current observation | Earlier report at 78cf309 |
|---|---|---|
| macOS / architecture | 13.7.8, build 22H730; x86_64 | Not recorded |
| Hardware model | MacBookPro14,3 | Not recorded |
| Active Xcode | `/Applications/Xcode.app/Contents/Developer`, Xcode 15.2 (15C500b); DEVELOPER_DIR unset | Xcode 26.6; installation path not recorded |
| Other Xcodes | Only Xcode.app located in system/user Applications and Spotlight Xcode bundle search | Not recorded |
| iOS runtime | iOS Simulator 17.2 | iphonesimulator26.5 |
| CocoaPods | `pod` absent from PATH; system Ruby 2.6.10 gem inventory contains no CocoaPods; no user Ruby installations found in inspected conventional locations | CocoaPods 1.17.0; 112 pods installed |
| Pod dependencies | Current generated ios/Podfile.lock and ios/Pods/Manifest.lock absent | Successful native build reported |
| Java | Homebrew OpenJDK 17.0.15 and 24.0.1 run directly | Java 25 runtime |
| JAVA_HOME | Set to a nonexistent historical Corretto 17 directory; `/usr/bin/java` is a launcher, and java_home finds no registered JDK | Not recorded |
| Android env | ANDROID_HOME, ANDROID_SDK_ROOT, ANDROID_AVD_HOME unset | Not recorded |
| Android tools | adb, sdkmanager, emulator absent from PATH; SDK not located in inspected conventional locations | platform/build-tools 37, NDK 27.1.12297006, Gradle 9.4.1 |
| Existing AVD data | An API 35 x86_64 AVD descriptor exists; its image.sysdir is relative, and does not establish an installed SDK or executable emulator | API 36 emulator reported |
| Disk at preflight | 74,738,960 KiB / 71.28 GiB available | Prior report ended near 188 MiB free |
| Node / npm | 24.3.0 / 11.4.2 in icon continuation | 24.22.2 / 11.6.2 |

Current workspace, Xcode path/version, runtime, and shell configuration match
the immediately preceding icon-integration turn. No stable physical-host ID,
macOS, or architecture was recorded for the earlier successful validation
builds. Consequently, the execution toolchain is demonstrably different from
that report, but whether the physical machine is the same cannot be established.
No cause such as migration, deletion, or environment reset is inferred.

Search scope: system/user Applications, Spotlight Xcode bundles, standard
system/user JVM directories, Homebrew opt/Cellar/Caskroom, standard user and
/usr/local/opt Android SDK locations, and referenced shell paths. This is not
an assertion that no SDK or CocoaPods executable exists anywhere on disk.
Private keys, full environment dumps, serial numbers, and user data are not
included in this report.

## Corrections to previous diagnosis

The previous icon report's statement that no Java runtime is installed was
incorrect: it checked default discovery, not the Homebrew JDK installations.
Both installed JVMs returned version output successfully when invoked directly.
A single-command, session-local JAVA_HOME/PATH correction successfully selected
OpenJDK 17.0.15. No shell startup file or project setting was changed.

The React Native helper's Xcode 16.1 check is only a lower-level minimum, not
the full application's supported toolchain. Expo SDK 58 documents Xcode 26.4+.
Do not treat installing Xcode 16.1 as a sufficient repair.

## Smallest compatible repair proposal — not performed

Installed dependency evidence: Expo 58.0.21, React Native 0.88.1;
`@react-native/gradle-plugin/gradle/libs.versions.toml` selects AGP 9.2.1.
The generated Gradle wrapper selects 9.4.1. Expo's installed root-project plugin
defaults select build-tools 37.0.0, compile SDK 37, target SDK 36, and NDK
27.1.12297006. The generated iOS deployment target is 16.4.

### iOS: compatible host required

[Expo SDK 58 requirements](https://docs.expo.dev/versions/v58.0.0/) specify
Xcode 26.4+. [Apple Xcode requirements](https://developer.apple.com/xcode/system-requirements)
list Xcode 26.4.1 on macOS Tahoe 26.2+, and the historically used Xcode 26.6
on Tahoe 26.2+. [Apple's model list](https://support.apple.com/en-us/108052)
identifies MacBookPro14,3 as the 15-inch 2017 model with Ventura as its newest
compatible OS. This host cannot reach the required toolchain through a
supported macOS upgrade. Do not patch version checks, downgrade dependencies,
or use an unsupported OS installation.

Preferred smallest action: the user selects/provides access to the previously
working compatible Mac, if still available, and verifies its actual installed
versions. Reuse Xcode 26.6 and CocoaPods 1.17.0 if present and compatible as
recorded; install this project's pods and build on that host only after any
required download/host-change approval. An alternative is an authorized
compatible Mac running Tahoe 26.2+ with pinned Xcode 26.4.1 and a compatible
simulator runtime. CocoaPods/Ruby versions must be checked there and pinned
before installation; no Gemfile or Pods lock exists here to establish an exact
required CocoaPods version. The historical 1.17.0 is prior evidence, not a new
minimum claim. CocoaPods recommends a separate Ruby and supports user-scoped
installation: [installation guide](https://guides.cocoapods.org/using/getting-started.html).
No remote build service is selected or authorized.

### Android: reuse local Java; SDK download approval required

Use the existing OpenJDK 17.0.15 with per-command JAVA_HOME and PATH; do not
install another JDK or persist an absolute path. [AGP 9.2 compatibility](https://developer.android.com/build/releases/agp-9-2-0-release-notes)
requires Gradle 9.4.1 and JDK 17; it supports API 37. Preserve the existing
wrapper and dependency selections.

If Android validation is requested on this Mac, approve a user-local Android
SDK install: command-line tools with a reviewed pinned package revision,
platform-tools, platforms;android-37, build-tools;37.0.0,
ndk;27.1.12297006, and the Gradle 9.4.1 distribution/dependency downloads.
For an emulator, also approve emulator binaries plus an API 36 Google APIs
x86_64 system image and a new isolated AVD. Inspect remote package metadata and
host compatibility before choosing the exact command-line-tools/emulator
revision and any required CMake package. These are substantial downloads;
none has started. Alternatively use an existing user-authorized Android device
or a compatible host with the SDK already installed to avoid the emulator
image download. SDK licenses and device access must be handled explicitly.
No existing AVD is deleted or reset.

## Asset limitations and smallest proposed corrections

- Foreground: `source/LLC_Android_foreground_transparent_1024_1024.png`, exported
  as `exports/android-foreground.png`. Remeasured alpha >=250 bounds are
  (257,248) to (1063,1064), with exclusive upper coordinates on the 1254 canvas.
  The requested central 626/1024 square spans approximately 243.70–1010.30.
  Right/bottom opaque pixels exceed that requested square by about 52–53 source
  pixels (about 43 output pixels). This is measured failure of the requested
  safe-square criterion, not proof of clipping under every Android mask.
  Launcher clipping, parallax and small-size legibility remain untested.
  The smallest correction for that square is to uniformly reduce the opaque
  bounding-box extent to <=766.61 pixels (about 93.95% of its 816-pixel height)
  and recenter the foreground bounds. Antialiasing/shadows need separate
  margin review. This changes composition/placement, though not design shapes;
  it requires approval. A universal safe-zone claim also requires reviewing
  Android's mask-specific guidance and installed behavior. No correction made.
- Monochrome: `source/LLC_Android_monochrome_foreground.png`, exported as
  `exports/android-monochrome.png`. Remeasurement finds 34 distinct RGB values
  among fully opaque pixels, so it is not a single-color source. Android themed
  rendering uses alpha: multiple RGB values alone do not establish themed-icon
  failure. Speckled internal cutouts are a visual concern in the supplied alpha;
  actual themed launcher rendering remains untested. Flattening RGB to one color
  while preserving alpha is a minimal technical normalization, but would not
  repair cutouts. Selectively filling accidental alpha holes would change the
  approved silhouette and needs explicit approval or a replacement approved
  source. No RGB normalization, hole filling, or redraw performed.

## Verification and stop

Diagnostics and read-only source/asset/config comparisons ran with repository
HEAD `b703fd79af107385bd9700ee02820d2e08a94bfe` on this new branch. Baseline
config evaluation again confirmed only icon/adaptiveIcon differ from intake;
identifiers, display name, splash, security, backup and release settings are
unchanged. No app/source/assets changed in this continuation, so the 38-test
host suite was not rerun. Its actual tested source remains b124914; the full
historical native security/build evidence remains 78cf309.

No new native build/install was attempted: the known failures require approved
prerequisite actions, not another identical build. No installed-app screenshots
exist for the icon commit. Existing contact sheet remains a host preview only.
All prior security/backup/recovery, physical-device, advisory, clean-clone,
negative-build and release gates remain open as previously recorded.

Stop pending user selection of a compatible iOS host; separately obtain approval
before Android SDK/Gradle/emulator downloads if using this Mac. This report and
its index corrections are the only repository changes. Generated native
projects, dependencies, temporary tools/logs and local AVD data stay outside Git.
No toolchain installation, system-wide upgrade, selected-Xcode change, deletion,
artwork change, additional feature, or merge occurred.
