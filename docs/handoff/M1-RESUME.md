# M1 resume handoff — LLCBookKeepingPrivate

Prepared 2026-10-30 on the older Intel Mac, confirmed by the user. The separate
M1 is currently serving DermaPrivate Android deployment. Do not stop, reset,
uninstall, repurpose, or otherwise disturb that deployment or shared targets.
No new implementation, toolchain installation, SDK download, native rebuild or
artwork correction was performed for this handoff. No merge is authorized.

## A. Repository and exact resume state

- Remote: https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git
- Resume branch: `chore/m1-handoff-20261030-7a34f6a`.
- Verified complete development baseline/prerequisite:
  `7a34f6a80149c1c0ad414f40c2e75c0317c2052e`, environment reconciliation branch.
- Latest application/configuration/assets implementation:
  `b12491413522341b3acbe93d089ce5db855aed62` (icon exports/configuration).
- Handoff commits add only this document and repository agent instructions.
  Resolve the exact delivered handoff SHA using the branch's live remote ref;
  the final delivery message records it. A document cannot embed the SHA of
  its own containing commit without changing that commit.

At handoff preflight the branches below were fetched and independently queried
with `git ls-remote`. Local branch means an actual `refs/heads` entry; fetched
tracking refs are listed separately so their absence is not mistaken for loss.

| Remote branch | Live remote and fetched tracking SHA | Local branch SHA at inventory |
|---|---|---|
| feature/native-security-backup-poc-20261030 | 8379b710302c9231299363e5a745dc939068d357 | No local branch; remote tip fetched |
| feature/restore-security-validation-20261030 | 939a045f6d738c0c7c9158056946882e3c3fd215 | No local branch; remote tip fetched |
| feature/native-validation-20261030-939a045 | 19a9e6b23df2e0425db7be70c0e493817ea0e697 | No local branch; remote tip fetched |
| feature/app-icons-20261030-19a9e6b | b703fd79af107385bd9700ee02820d2e08a94bfe | b703fd79af107385bd9700ee02820d2e08a94bfe |
| feature/icon-native-env-20261030-b703fd7 | 7a34f6a80149c1c0ad414f40c2e75c0317c2052e | 7a34f6a80149c1c0ad414f40c2e75c0317c2052e |

Canonical remote main is `ff900cf3a19612f1c85b06e5f53a510e3a3d2a6d`.
`git merge-base --is-ancestor` verified each listed tip and main is contained in
the complete baseline. The tips form the ordered development chain shown in the
table; no divergence was found. No later continuation branch existed at inventory.
The handoff branch is a direct descendant of that baseline, not main. Do not
merge/cherry-pick historical branches to reconstruct work; their changes are
already ancestors. Re-fetch/recheck before future development.

### M1 checkout and initial verification (no installation required)

Choose a new directory separate from DermaPrivate and existing work. Do not
clone over or delete an existing workspace. Authenticate to the existing remote.

```sh
git clone --branch chore/m1-handoff-20261030-7a34f6a \
  https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git LLCBookKeepingPrivate-M1
cd LLCBookKeepingPrivate-M1
git fetch origin
git status --short --branch
git rev-parse HEAD
git ls-remote origin refs/heads/chore/m1-handoff-20261030-7a34f6a
git merge-base --is-ancestor 7a34f6a80149c1c0ad414f40c2e75c0317c2052e HEAD
git ls-files
```

Compare local HEAD with the live remote SHA and final delivery SHA. Confirm the
inventory in section E is present before considering the old workspace removable.
The user will decide removal after M1 confirmation; do not delete it yourself.

## B. Product and bounded next task

Delivered source: synthetic browser preview; pure decimal/domain examples and
tests; native SQLCipher/SecureStore storage proof; encrypted generation/catalog
restore coordinator and lease; inaccessible-key recovery UI; bounded portable
backup envelope v2 and synthetic payload schema v1; backup-exclusion plugins;
icon exports/configuration and illustrative masks. These are proof components,
not a full multi-member LLC bookkeeping product. No production schema, receipt
workflow, tax correctness, biometric/PIN gate or release approval is established.

Last completed task: reconcile Intel toolchain evidence and checkpoint the
handoff. Icon technical integration is delivered; installed-icon validation is
not complete. This handoff does not resolve native security/backup gates.

Next bounded task on M1: inspect existing tools and DermaPrivate target usage,
propose the smallest compatible session-local setup, obtain approval for needed
downloads/tool changes, then build/install the unchanged current icon source on
isolated iOS and Android targets and capture launcher evidence. No framework
change or new feature work. Preserve identifiers, display name, splash, security,
backup and release settings. Foreground/monochrome correction needs separate
approval; see [asset and environment details](../../assets/branding/environment-reconciliation.md).

Do not use real financial records, receipts or databases until all applicable
security/data gates pass and the user approves. Synthetic-only work must also
respect the native-runtime gates before starting the bookkeeping MVP.

## C. Verification matrix and evidence boundaries

| Evidence | Exact source attribution | Result and limits |
|---|---|---|
| Earlier native PoC | Report preserved in branch snapshot 8379b710302c9231299363e5a745dc939068d357; report does not identify exact binary source SHA | iOS Simulator/Android emulator SQLCipher, SecureStore, restart and synthetic backup proof reported passing. Not current-source or physical-device proof. |
| Superseded v1 file portability | Same earlier snapshot; binary source SHA not recorded | iOS-created v1 backup restored after Android reinstall; reverse iOS picker attempt incomplete. Current parser rejects v1. Does not prove v2. |
| Earlier restore exceptions | Report at 939a045f6d738c0c7c9158056946882e3c3fd215; exact exception-test source SHA not recorded | Ten iOS Simulator exception boundaries reported passing within one process. Not process-kill, power-loss or current-source evidence. |
| Historical clean clone | 17259e23a90b6c36a587c74f11b6fcf0ee38f38e | npm install, native regeneration, 30 host tests/typecheck/doctor reported passing. Native clone builds were not run. |
| Latest security-validation host suite | 78cf3096e17e7b3a531b1ccd3c4032cb948f97ad | 38 tests and typecheck passed. Unit tests do not establish native concurrency/key-loss behavior. |
| Latest security native builds | 78cf3096e17e7b3a531b1ccd3c4032cb948f97ad | Android Debug and iOS Simulator Debug built. Android installed but shared emulator returned to DermaPrivate; iOS installed but launch hit ENOSPC. No reliable app-level proof claimed. |
| Icon host checks | b12491413522341b3acbe93d089ce5db855aed62 | 38 tests, typecheck, doctor, config resolution, both prebuilds, export/hash/pixel checks passed. Generated iOS icon and Android density resources checked. |
| Icon builds | b12491413522341b3acbe93d089ce5db855aed62 | iOS failed at absent Pods manifest; Android failed at stale JAVA_HOME. No installed icon screenshots. |
| Icon report checkpoint | b703fd79af107385bd9700ee02820d2e08a94bfe | Only verification.md added after b124914; app/config/assets unchanged. No additional test/build claim. |
| Environment diagnostics | b703fd79af107385bd9700ee02820d2e08a94bfe | Direct JVM checks, asset measurements and config comparison; no native build retry. Report checkpoint 7a34f6a is documentation only. |
| This handoff | Baseline 7a34f6a80149c1c0ad414f40c2e75c0317c2052e plus docs/AGENTS only | Worktree/ref/stash/ignored inventory, ancestry, required tracked-file and branding hash checks, document links, diff checks, live remote comparison. No application tests, tool installs or native builds rerun. |

Current v2 envelope file matrix remains **not run natively**: both cross-platform
directions, both fresh-install restores, native file wrong-passphrase/tamper/
truncation/version rejection, missing-key/rejected-restore preservation and
picker/provider UX. Envelope v2 and synthetic payload/schema v1 are distinct
version fields; do not confuse them with superseded envelope v1.

Remaining gates: current native concurrent read/save/export/attachment behavior;
locked/inaccessible key and actual-file preservation; controlled external kill
and recovery retries with complete record/attachment hashes; SQLCipher-disabled
negative binary and plaintext DB/WAL/SHM/journal scan; current clean-clone builds;
backup-exclusion/transfer and offline/no-Metro behavior; physical-device
Keychain/Keystore, KDF latency/memory, key loss and transfer; production schema/
migrations and attachment design; logs/plaintext/export review; signed release,
privacy/accessibility/export-control/store review. No physical-device result or
power-loss durability result is claimed.

Dependency snapshot (not a fresh advisory query): committed 2026-10-30 audits
against prerequisite lockfile 8379b71 report two upstream advisories propagated
to eight npm entries in the production-omitted report (5 low, 3 high): deepmerge
4.3.1 prototype poisoning through Expo config, and Zod 3.25.76 memory exhaustion
through Expo CLI DevTools parsing. Findings remain open; no risk acceptance,
override, suppression or offered Expo 51 downgrade was applied. Do not assert
that no fix exists today based solely on that snapshot. Reassess compatibility
and upstream advisory status before real-data/release work.

Authoritative detail: [native proof results](../security/native-proof-results.md),
[audit assessment](../security/audits/npm-audit-2026-10-30.md),
[restore state machine](../security/restore-state-machine.md),
[icon results](../../assets/branding/verification.md).
Host [mask contact sheet](../../assets/branding/previews/mask-contact-sheet.png)
is a preview, never installed-app evidence. Foreground overshoots the requested
safe square by about 52–53 source pixels on right/bottom. Monochrome has 34
opaque RGB colors and speckled alpha concerns; actual themed appearance is
untested. No artwork correction is included in this handoff.

## D. M1 toolchain preflight and future commands

Do not execute installation or build commands until resuming the authorized
validation task. Read current configuration and installed package metadata;
verify supported documentation before selecting or upgrading tools.

- Node **24.22.2** is pinned in `.node-version`; npm 11.6.2 was used historically.
  Intel icon checks used Node 24.3.0/npm 11.4.2. Use committed lockfile, not an
  opportunistic dependency/framework upgrade.
- Expo **58.0.21**, React Native **0.88.1**, React **19.3.0** are pinned.
- Expo SDK 58 documents **Xcode 26.4+**; React Native helper minimum 16.1 alone
  is insufficient. Historically Xcode 26.6/iOS 26.5 runtime worked for compilation.
  Xcode 26.4.1/26.6 require compatible macOS (Apple lists Tahoe 26.2+). Check
  M1 model and OS first. Do not upgrade/change selected Xcode without approval.
- CocoaPods version is not pinned by a committed Gemfile/Pods lock. Historical
  evidence used 1.17.0. Inspect M1 Ruby/CocoaPods versions and pin a reviewed
  compatible choice before installation. Prefer existing compatible user tools.
- Installed RN Gradle plugin selects **AGP 9.2.1**; generated wrapper **9.4.1**.
  AGP 9.2 documents JDK **17**. Expo defaults: compile SDK **37**, target SDK
  **36**, build-tools **37.0.0**, NDK **27.1.12297006**. Confirm these after
  lockfile install/regeneration. Historical Java 25 worked; do not upgrade Java
  solely to copy that observation.
- M1 uses arm64 tooling and emulator system images, not Intel x86_64 images.
  Inspect available AVDs/runtimes; use a dedicated target and coordinate with
  DermaPrivate. Do not reuse/clear its deployment target.
- At least 5 GiB free was the old minimum estimate, not a sufficiency guarantee
  for two clean builds plus tool downloads. Inspect actual disk headroom first.

Read-only checks before any install/tool change:

```sh
sw_vers
uname -m
xcode-select -p
xcodebuild -version
xcrun simctl list devices available
/usr/libexec/java_home -V
command -v pod
command -v adb
command -v sdkmanager
node --version
npm --version
df -h .
```

Inspect only relevant environment variables: DEVELOPER_DIR, JAVA_HOME,
ANDROID_HOME, ANDROID_SDK_ROOT, ANDROID_AVD_HOME and required PATH entries; avoid
full environment dumps. Check available Xcodes, Ruby/Pods status, existing JDKs,
SDK platforms/build-tools/NDKs, `adb devices -l` and emulator list. A tool missing
from PATH may still be installed. On Intel, Homebrew JDK 17/24 existed despite
stale JAVA_HOME. Use session-local corrections, not committed absolute paths.

Future reproduction after preflight and required approvals, in the new clone:

```sh
npm ci
npm run typecheck
npm test
npm run doctor
npm run config:public
EXPO_NO_TELEMETRY=1 npx expo prebuild --no-install
(cd ios && pod install)
```

Inspect generated config/backup exclusions/icons. Do not patch generated files
to bypass checks. No `--clean` regeneration is needed in a fresh clone. Then,
using explicitly selected isolated targets:

```sh
EXPO_NO_TELEMETRY=1 npx expo run:ios --device <dedicated-simulator-UUID>
EXPO_NO_TELEMETRY=1 npx expo run:android --device <dedicated-emulator-serial>
```

Replace angle-bracket placeholders; do not execute them literally. These Expo
commands build/install and may require a separate local Metro session via
`npm run start`. For build-only evidence after dependencies are installed:

```sh
xcodebuild -workspace ios/LLCBookKeepingPrivate.xcworkspace \
  -scheme LLCBookKeepingPrivate -configuration Debug -sdk iphonesimulator \
  -destination 'id=<dedicated-simulator-UUID>' CODE_SIGNING_ALLOWED=NO build
(cd android && ./gradlew :app:assembleDebug)
```

Do not set negative-security flags for ordinary icon validation. Record build
profile, exact source SHA, tool versions, install/launch outcomes and installed
launcher screenshots separately. Check clipping, borders, alignment, legibility,
adaptive masks and themed alpha where supported. Do not infer security matrix
success from these builds. Signing is unnecessary for simulator/emulator debug
proof; obtain credentials separately and securely for authorized device/release
work. None are transferred by this handoff.

[Expo SDK requirements](https://docs.expo.dev/versions/v58.0.0/),
[Apple Xcode requirements](https://developer.apple.com/xcode/system-requirements),
[AGP compatibility](https://developer.android.com/build/releases/agp-9-2-0-release-notes).
These sources were consulted during reconciliation; recheck before tool changes.

## E. Local-only inventory and source completeness

Exactly one worktree was registered in this repository: the current Intel
checkout. No other associated worktree, staged/modified/untracked task files,
stash, unpushed commit or local-only branch was found at preflight. All preexisting
local branch tips match the live remote; the new handoff branch is checkpointed
separately. This inventory covers this Git repository and its registered
worktrees, not arbitrary standalone clones or files elsewhere on either Mac.

Ignored trees found: node_modules (25,237 files), ios (18), android (55), .expo
(26). Counts are inventory-time observations, not reproduction requirements.
No ignored files outside these trees were found. Native files include generated
Podfile/Xcode project/AppDelegate, Android manifests/Gradle files and icon/backup
resources. Their durable inputs are committed config, package lock and plugins;
no hand-edited native-only source requirement was identified. Generated Android
debug.keystore is intentionally excluded: do not upload or transfer it. New
debug builds can use generated development signing; no release key is needed.

Also excluded: local build logs/DerivedData and image-tool virtual environment
in temporary storage, Gradle/npm caches, simulator/AVD data and synthetic app
state. Historical temporary APK/app/backup artifacts are not required source
inputs and their continuing existence is not assumed. No essential local-only
item requiring secure transfer was identified. Any future discovery of an
independent real-data backup or signing credential requires separate secure
handling and renewed inventory; never add it to Git just to make a checkpoint.

Tracked inventory verified before delivery:

- App.tsx; apps/mobile policy/capability modules and tests.
- packages/domain, packages/storage-native, packages/backup source and tests.
- package.json, package-lock.json, .node-version, tsconfig.json, vitest config.
- app.config.ts and both native backup-exclusion plugins.
- All six approved original branding assets, all five exports and manifest,
  export script, preview and reports. Original Downloads copies are not needed.
- Architecture, threat model, restore state machine, physical-device script,
  dependency inventory/audit snapshots and validation plans/reports.
- Schema/proof SQL is embedded in tracked database-catalog.ts,
  native-storage-proof.ts and native-restore-store.ts. No separate migration
  directory exists; no production migration system is claimed.
- Root AGENTS.md and this handoff.

Do not copy Intel node_modules, generated native projects, simulator data or
machine-specific paths to M1. Reinstall/regenerate from committed inputs using
compatible external tools; their availability is required, their old files are not.

## F. Agent workflow on M1

[Root AGENTS.md](../../AGENTS.md) carries the approved Git workflow at repository
scope: preflight, preservation, fresh branch/explicit dependency, early upstream,
small reviewed commits, checkpoints, live remote comparison, clean tree, WIP
preservation, approval before merge, sensitive-data exclusions and required final
status. Read it before work. Leave this handoff branch intact; a new development
prompt needs a new branch from its verified baseline only with explicit dependent
base authorization. Do not silently start from main and lose this unmerged work.

The Intel user's global instructions do **not** automatically transfer to M1.
For Codex, verify its supported mechanism using official documentation and the
actual effective CODEX_HOME (default ~/.codex). At global scope Codex reads the
first nonempty AGENTS.override.md, otherwise AGENTS.md; project instructions
can override it and combined instructions have a size cap. See
[Codex AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

On M1 inspect existing files without printing private configuration. Preserve
existing instructions, reconcile conflicts, and install the user-approved general
Git workflow from root AGENTS.md at the active global scope. Do not overwrite
unrelated guidance or copy the Intel global configuration wholesale. Check for a
global override that would shadow the installation. Verify exact readback and
then confirm instruction discovery in a fresh Codex session; report location,
profile/machine scope and any precedence/size limits. If no global mechanism is
supported, state that limitation and retain repository instructions; never claim
repository-local scope is global. No private global config belongs in this repo.

Normal stopping points require committed/pushed task work, a clean tree, intended
upstream and local HEAD matching the live remote branch. Use the exact safety
statement from AGENTS.md; ignored/local-only data is excluded. Never merge,
force-push or delete branches without the required authorization. Keep the Intel
workspace until M1 checkout/source presence is confirmed and the user chooses
whether to remove it.
