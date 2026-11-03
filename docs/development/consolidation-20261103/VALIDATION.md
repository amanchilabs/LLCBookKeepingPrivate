# Current candidate validation — 2026-11-03

Application candidate: `442fb01fcff7d12d6bce75851039f118c585e289`. Later commits so far change documentation only. Host regression commands ran against this exact source. Historical native results remain attributed to their recorded source, not promoted to current passes.

## Environment

Apple M5 Pro, arm64; macOS 26.5.1 (25F80); Xcode 26.6 (17F113); CocoaPods 1.17.0; Homebrew OpenJDK 17.0.21.0.3; Gradle 9.4.1. Disk: 695 GiB free before builds, 671 GiB after dependency/native setup. Initial shell Node 22.23.4/npm 10.9.9; pinned Node 24.22.2 obtained in npm's external cache without changing project dependencies or global defaults. Final host suite used pinned Node. iOS local generated environment selects pinned Node. Dedicated targets: LLC Consolidation QA 20261103, UUID DC112959-3443-4376-9D70-7CD4DB0CCCE5 (iOS 26.5); isolated API34 arm64 AVD at `/tmp/llc-consolidation-avds`, serial emulator-5562. Existing other-product devices/worktrees were not modified.

## Automated and static evidence

| Check | Result | Scope |
|---|---|---|
| `npm ci` | PASS | 556 packages installed from unchanged lockfile; npm audit findings below |
| Pinned `npm run typecheck` | PASS | TypeScript compilation |
| Pinned `npm test` | PASS: 163 | Preview 2; UI/helpers 46; security policy/storage 57; domain 43; backup 15 |
| Accounting/storage regressions | PASS within suite | Balanced journals and trial balance, capital, payments, loans, transfer, reconciliation, corrections/reversal lineage, rollback, reopen persistence, workspace isolation, period controls, CSV, atomic onboarding |
| UI/helper regressions | PASS within suite | Search/filter logic, CSV/PDF generation helpers, navigation model, new search-section mapping; no rendered UI guarantee |
| `git diff --check` | PASS | Integration diff whitespace |
| Dedicated lint command | BLOCKED | No lint script/configuration exists; TypeScript/static source review reported separately |
| `npm run doctor` | FAIL | Online Expo compatibility metadata recommends metro-runtime ~58.0.16, expo ~58.0.22, expo-sqlite ~58.0.15, expo-dev-client ~58.0.18 versus pinned 58.0.15/58.0.21/58.0.14/58.0.17. Dependency framework changes were not included in consolidation. Bundled modules metadata still lists the pinned patch minima. |
| `npm run config:public` | PASS | Configuration resolution |
| `expo prebuild --no-install` | PASS | Generated native inputs without tracked package changes |
| `pod install` | PASS | 114 dependencies / 113 installed pods |
| Generated security configuration | PASS static inspection | SQLCipher enabled in Android properties and iOS pod flags; Android allowBackup=false and all-domain cloud/device-transfer exclusions; iOS fail-closed backup-exclusion precondition generated |

Full host output retained in `host-regression.txt`; dependency summary in `dependency-audit.json`. No tests/assertions weakened. No direct accounting arithmetic changes made for validation.

## Dependency findings

`npm audit --json`: 13 affected entries (1 low, 10 moderate, 2 high), all inherited through the unchanged lockfile. Advisory roots: deepmerge prototype poisoning; glob cancellation bypass; minimatch amplification denial of service; Zod constrained-collection memory exhaustion. High propagated entry includes Expo CLI. Offered fixes include patch availability and some incompatible Expo 51 downgrade suggestions. No automatic audit fix, downgrade, suppression, or risk acceptance applied. This source consolidation does not close dependency/security gates.

## Native evidence

Both native Debug builds PASS at source `721cafd15f9f50c83e75c8314ab3857fdee03dc5` (application inputs identical to reviewed/tested `442fb01`). Android arm64 APK installed and launched on emulator-5562; four-member 40/20/20/20 onboarding with a $1,000 opening balance PASS. iOS simulator app installed and launched, but bookkeeping startup FAILS at the Keychain gate; workflows remain BLOCKED (details below). Required checks without completed evidence remain BLOCKED. The initial default Android build was deliberately interrupted after arm64 compilation to avoid building unused emulator ABIs; the resumed build restricts `reactNativeArchitectures=arm64-v8a` and max workers to 2. This is a build-destination/resource selection, not a source or assertion change.

Build commands:

```sh
# Session-local JDK17 and ANDROID_HOME selected.
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2 --no-daemon --console=plain
# From repository root:
xcodebuild -workspace ios/LLCBookKeepingPrivate.xcworkspace -scheme LLCBookKeepingPrivate \
  -configuration Debug -sdk iphonesimulator \
  -destination 'id=DC112959-3443-4376-9D70-7CD4DB0CCCE5' \
  -derivedDataPath /tmp/llc-consolidation-derived -jobs 2 CODE_SIGNING_ALLOWED=NO build
```

Android build: `BUILD SUCCESSFUL in 52s`, 390 actionable tasks. iOS: `BUILD SUCCEEDED`. Artifact metadata/hashes are in [artifacts.json](artifacts.json). These are local regenerable QA artifacts; no signed release candidate, physical-device binary, store artifact, production certificate, or submission is certified. APK is Android-debug-signed; iOS signing disabled. Temporary binaries/full build logs are excluded from Git and have no off-device recovery certification.

## Runtime results and remaining gates

| Required behavior | Android API34 arm64 | iOS 26.5 simulator |
|---|---|---|
| Install / launch | PASS | PASS for original unsigned build; later manual-entitlement variants rejected at launch |
| Four-member onboarding, 40/20/20/20 confirmation, first account/opening balance | PASS, $1,000 opening | BLOCKED by Keychain |
| Income / expense / reversal and replacement | PASS, $250 income; $50 expense replaced with $75 | BLOCKED |
| Member capital | PASS, $100 cash contribution; bank $1,275; capital $100 | BLOCKED |
| Description search for correction | PASS | BLOCKED |
| Global search to Capital subsection | PASS; independently reviewed regression reproduced on native UI | BLOCKED |
| Reports / CSV / PDF export | PASS, native trial balance CSV/PDF; debit = credit = $1,350 | BLOCKED |
| SQLite persistence across force-stop/relaunch | PASS, same LLC, $1,275 bank, member and contribution retained | BLOCKED |
| Five-tab navigation / visual regression | Targeted core navigation exercised; screenshots retained; full visual/accessibility matrix BLOCKED | BLOCKED |
| Every advanced UI flow: loans, recurring, imports, reconciliation, reminders, periods, payment reversals | BLOCKED for complete current native acceptance; host regressions PASS and historical evidence retained | BLOCKED |

Native accounting evidence: [synthetic CSV](evidence/android-synthetic-trial-balance.csv), [synthetic PDF](evidence/android-synthetic-trial-balance.pdf), trial balance and share-sheet screenshots. `pdftotext` verified PDF identity and expected cash/totals. [validate-native-export.py](validate-native-export.py) independently sums exported decimal debits/credits and checks each expected account. The tracked CSV fixture uses LF line endings for repository whitespace checks; the untouched native export uses CRLF, and both original/fixture hashes are recorded in artifacts.json. These files contain only synthetic test records generated on the isolated target; they are not a canonical financial dataset.

Automation did **not** produce one uninterrupted all-green native suite. Initial overlays interfered with onboarding/search; disabling the Expo development Tools button fixed the obstruction. An accounting flow expected a comma in `$1,175.00` while the existing UI renders `$1175.00`; a continuation asserted the same exact numeric value with an optional grouping separator. A More-screen selector initially tapped the duplicate Settings heading instead of its button; an indexed button selector was used for the continuation. A screenshot command used an unsupported absolute path; a subsequent PDF flow used the supported relative path. Accounting writes were not replayed to force success. Executed actions, continuation assertions, exported data, and relaunch checks substantiate the targeted passes above. Raw relevant results are retained in `native-runtime-results.txt`, including harness failures. No product tests/assertions were weakened.

### iOS Keychain blocker

The generated app contains no application-identifier or keychain-access-groups entitlement. `securityd` records `-34018`: “Client has neither application-identifier nor keychain-access-groups entitlements”. App displays “Local books are unavailable” and preserves files; see [screenshot](evidence/ios-keychain-blocked.png). This is consistent with [Apple's entitlement error documentation](https://developer.apple.com/documentation/security/errsecmissingentitlement).

Permitted diagnostics/corrections attempted: unsigned simulator build; Xcode ad-hoc signing; Xcode ad-hoc signing with the team identified from an installed development certificate. All builds succeeded, but Xcode still emitted empty app entitlements. Separate local simulator-only entitlement experiments (unprefixed and actual-team-prefixed app identities) produced valid-on-disk signatures but Simulator rejected launch (`FBSOpenApplicationServiceErrorDomain=1`, underlying launchd POSIX 163). These experimental fixtures are **not integrated**. No signing key was exported, no production identity used for signing, no security check disabled, and no data/key files cleared. Original unsigned QA archive was restored and launches; its Keychain blocker remains. Further simulator signing/entitlement correction and verified native execution are required; compile success is not an iOS workflow pass.

## Security and privacy limits

No new telemetry, cloud sync, external financial storage, production signing, or real financial data introduced. Native security-negative binary, locked/missing keys, current-format cross-device backup/restore, interruption/kill recovery, plaintext DB/WAL scans, physical-device Keychain/Keystore and OS backup/transfer behavior remain BLOCKED pending dedicated evidence, as documented in the retained threat model and handoffs. Host backup tests and generated SQLCipher flags do not prove those behaviors. Synthetic validation only.

## GitHub gates

Draft PR: https://github.com/amanchilabs/LLCBookKeepingPrivate/pull/1, target main. No checks reported; workflow API returns 0; rulesets API returns []. Branch-protection API returns 404. Current account has push/triage but not admin/maintain permissions, so absence of additional owner-visible requirements cannot be certified. GitHub merge-state CLEAN is not evidence of tests or approval. Separate owner merge authorization is required.

## Status

INCOMPLETE validation / draft PR; main unchanged. Not ready to certify the Foundry pilot baseline after approval alone. Outstanding iOS Keychain/signing, dependency compatibility, complete native acceptance, and owner-visible gate confirmation must be resolved or explicitly scoped by the owner. `WORKSPACE_RESET_NOT_SAFE`.

## Global instructions and preservation

Existing global policy is installed at `/Users/veerrajuamanchi/.codex/AGENTS.md`, Codex user-level scope; no global override was present. Fresh ephemeral read-only Codex session from `/tmp` returned `AMANCHI-GIT-WORKFLOW-20261103-7f2c8e91` and the user-level scope. Installation was already current, so no global file was overwritten. [Official instruction discovery documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md) was checked. Private global configuration is excluded from repository recovery.

Native source at build SHA `721cafd` matches reviewed/tested application SHA `442fb01` byte-for-byte across App.tsx, apps, packages, plugins, app.config.ts and dependency manifests. Later task commits update documentation/evidence only. Use the live PR HEAD for the exact delivered documentation SHA.
