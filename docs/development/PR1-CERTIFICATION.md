# PR #1 certification follow-up

Continues `integration/llc-consolidation-20261103` from `793ff2d55dbf2da0ecbdc668a56b7f508ea7ffce` by explicit owner authorization. Branch inventory and UX consolidation are not repeated. Main remains unchanged. Synthetic data only; this certifies development readiness, not production/device/store readiness.

## Dependency disposition

The SDK 58 matrix recommended four patches: Expo 58.0.21→58.0.22, metro-runtime 58.0.15→58.0.16, expo-sqlite 58.0.14→58.0.15, dev-client 58.0.17→58.0.18. React/React Native/Expo major versions remain unchanged. `npm ci`, TypeScript, all 163 existing regressions, online `expo install --check`, and `npm audit --audit-level=low` pass after remediation; audit reports zero vulnerabilities.

Initial 13 affected package entries represented four underlying advisories. Paths below start at this project. Wrapper severities were propagated findings, not 13 independent vulnerabilities.

| Initial entry / severity | Dependency path and actual exposure | Remediation and residual risk |
|---|---|---|
| zod 3.25.76 / high | expo → CLI → zod; tooling schema/DevTools parsing, no identified financial-runtime input path | CLI 58.1.18 removes Zod; absent from final tree |
| @expo/cli 58.1.17 / high | expo → CLI; development server/build tooling | 58.1.18 removes Zod; glob also remediated below |
| deepmerge 4.3.1 / low | expo → config → deepmerge; project/plugin configuration merging | config 58.0.10 removes dependency; absent from final tree |
| glob 13.0.6 / moderate | expo → CLI/config/config-plugins/fingerprint/metro-config → glob; tooling filesystem traversal and cancellation | Scoped `glob@13` override to patched 14.0.3; API/semantic compatibility tested below |
| minimatch 10.2.6 / moderate | expo → fingerprint → minimatch, also glob → minimatch; tooling file patterns, attacker-controlled amplification | Scoped `minimatch@10` override to patched 11.0.4; consumer APIs tested below |
| @expo/config 58.0.9 / moderate | expo → config; project configuration | 58.0.10 plus glob remediation |
| @expo/config-plugins 58.0.11 / moderate | expo / expo-sharing → config-plugins → glob; generated native configuration | SDK-approved 58.0.11 retained; glob path remediated |
| @expo/fingerprint 0.21.7 / moderate | expo → fingerprint → glob/minimatch; build file enumeration/ignore matching | 0.21.8 plus scoped overrides; real fingerprint generation tested |
| @expo/inline-modules 0.2.8 / moderate | expo → CLI → inline-modules → config-plugins → glob; build configuration | SDK patch tree plus glob remediation |
| @expo/metro-config 58.0.19 / moderate | expo → metro-config → glob; Metro workspace discovery | 58.0.20 plus glob remediation; iOS/Android export tested |
| @expo/prebuild-config 58.0.17 / moderate | expo → CLI → prebuild-config → config-plugins → glob | 58.0.18 plus glob remediation; native prebuild tested |
| expo 58.0.21 / moderate | Direct; propagated tooling findings | 58.0.22 plus transitive remediation |
| expo-sharing 58.0.21 / moderate | Direct → config-plugins → glob; config plugin rather than identified mobile-sharing runtime vulnerability | SDK-approved sharing version retained; glob path remediated |

Advisory roots: [Zod memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).

No patched glob 13/minimatch 10 release was available. The overrides deliberately cross those transitive tool-package majors, without changing the app framework major. This is remediation, not audit suppression. Static consumer inspection found only retained public glob functions and Minimatch.match/pattern/negate, not removed walker/AST/makeRe APIs. `scripts/check-toolchain.mjs` exercises async/sync/stream/CommonJS glob, exclusions, abort behavior, Minimatch semantics and actual Expo fingerprint generation; native generation and both Metro native exports also pass. Residual maintenance risk is future upstream API use outside that surface; keep these scoped pins and compatibility checks until Expo adopts patched dependencies. Arbitrary untrusted plugins/repository content remain a development/CI trust boundary, not a financial input channel.

## Automated reproducibility

One minimal GitHub Actions job runs the pinned Node version, clean install, TypeScript, full regression suite, SDK matrix check, audit, toolchain smoke, native configuration generation, and both native JavaScript exports. Actions are pinned to their official release commit SHAs; token permissions are read-only and checkout does not persist credentials. Native simulator/emulator runtime results are separate from this Linux job.

GitHub's branch response confirms main `protected=false`, protection disabled and required-check contexts empty. Owner merge authorization still applies. PR was kept draft during remediation; readiness requires the completed native review and a passing live-head Validation check. Owner merge authorization remains separate.

## iOS Keychain root cause and correction

The M5 Pro iOS 26.5 Simulator failure was a build-context problem, not defective key creation/read logic. The old build-only command used `CODE_SIGNING_ALLOWED=NO`, leaving the executable without the Simulator app identity needed by Keychain. System securityd reported -34018. Ordinary `codesign --entitlements` inspection was misleading: Xcode places simulated entitlements in `*-Simulated.xcent` and links an `__TEXT,__entitlements` section into the executable. Signature-only manual re-signing did not reproduce that pipeline and its variants were rejected at launch.

A normal Xcode Simulator build with signing enabled, ad-hoc local execution and the existing app development-team context generates the expected team-prefixed application identity. An explicit access-group experiment was tested, then removed: the unchanged default app-owned Keychain group works and reads the same key. `app.config.ts`, all key aliases, WHEN_UNLOCKED_THIS_DEVICE_ONLY accessibility, SQLCipher requirements, authentication behavior, and financial/storage/backup code remain unchanged from the initial candidate.

`scripts/build-ios-simulator.sh` encodes this build path, requires the pinned Node version and an explicit app development team, and checks Xcode's simulated application identity. It changes only the ignored machine-local Node setting. It does not export a signing key, use production signing, disable Keychain checks, or install a device provisioning profile. Example after prebuild/pod installation, with the appropriate existing team selected locally:

```sh
LLCB_IOS_DEVELOPMENT_TEAM=<app-team> LLCB_IOS_DERIVED_DATA=/tmp/llc-consolidation-derived \
  scripts/build-ios-simulator.sh <dedicated-simulator-uuid>
```

Actual final-config runtime reaches onboarding and passes native SQLCipher/key-store read-write/reopen, record/attachment persistence, wrong-key rejection, in-memory backup wrong-passphrase/tamper/truncation, and all ten injected restore boundaries on iOS and Android. These synthetic proof operations ran before any bookkeeping data was created on the fresh targets. They are exception-boundary tests, not process-kill/power-loss or physical-device certification.

## Final acceptance evidence

M5 Pro / macOS 26.5.1, Xcode 26.6 / iOS 26.5 Simulator, JDK 17 / Gradle 9.4.1 / Android API 34 arm64 emulator, Node 24.22.2. Dedicated iOS target DC112959-3443-4376-9D70-7CD4DB0CCCE5; fresh Android certification target emulator-5564. Other-product targets were not modified. Native apps remain version 0.1.0/build 1, bundle/package com.amanchilabs.llcbookkeepingprivate. Both artifacts are QA Debug builds; iOS uses ad-hoc Simulator execution, Android the unchanged public debug certificate. No production signing or store action occurred.

| Gate | iOS Simulator | Android emulator |
|---|---|---|
| Native build / install / launch | PASS using the guarded Xcode build script | PASS, arm64 Debug |
| Four-member setup / 40-20-20-20 confirmation / opening balance | PASS | PASS |
| Income / expense / linked reversal+replacement | PASS | PASS |
| Member cash contribution and journal-derived balances | PASS | PASS |
| Global search → Capital section | PASS | PASS |
| Description search / expense filter / clear / five tabs / Accounts and Settings | PASS | PASS |
| Trial Balance native CSV and PDF export | PASS; share sheet opened, no destination selected | PASS; same |
| Independent captured-export reconciliation | PASS | PASS |
| Actual termination/force-stop and relaunch | PASS: same LLC, member, contribution and $1,275 bank | PASS; also preserved earlier baseline data during upgrade |
| SQLCipher / secure key read-write / reopen / wrong-key rejection | PASS | PASS |
| In-memory backup wrong-passphrase/tamper/truncation and ten restore exceptions | PASS, before books were created | PASS, before books were created |
| Database plaintext-header / selected synthetic-string scan | PASS: five database/generation files | PASS: five files |
| SQLCipher-disabled negative binary | BLOCKED / not rerun on iOS; host guard tests and positive native coverage reported separately | PASS: refuses persistent storage; all five database file hashes unchanged; restored positive build retains books |

Exact financial results were preserved independently on both platforms: opening equity$1,000, income$250, corrected expense$75 (original$50 and its reversal retained), member capital$100, bank$1,275, trial balance debit=credit=$1,350. The cash transaction list has five persisted records: one income, original expense, separate reversal-kind entry, replacement expense and opening balance. Description search returns 1 of 5; Expense filter returns original+replacement 2 of 5. Capital is separately tracked. All163 host regressions also cover the existing accounting, capital, loans/payments/transfers, periods, recurring/import and reconciliation services.

The iOS label/input and pinned-footer automation issues were diagnosed from actual touch coordinates, not treated as application defects. The member input was at the footer's touch point despite its label being visible. The adapter now scrolls and taps the same constrained input/control above the footer, uses bounded swipes inside Page, and fails if it enters recovery tools. Early harness attempts did not create a business or post financial writes. After the correction, four-member onboarding, the complete accounting flow, filtering/navigation, exports and actual relaunch all passed. No financial expectation or product assertion was weakened, and no app UI code changed.

### Provenance and reproducibility

- Application, domain, storage, backup, key aliases and app configuration are byte-identical to initial 793ff2d; only SDK dependency patches, tooling overrides, CI and validation helpers/documentation changed.
- The first positive Android APK ran the complete fresh workflow. Canonical regeneration removed only the unused experimental `/ios/entitlements` entry from packaged app.config and refreshed app.fingerprint. A ZIP comparison proves all 30 DEX/native-code entries byte-identical. The final canonical APK was installed without data clearing and independently revalidated for exports and force-stop/relaunch. This distinguishes reuse of unchanged runtime-code evidence from final-artifact checks.
- iOS's final normal build uses the untouched default app Keychain group. Both the generated simulated-entitlement plist and the actual executable's embedded __TEXT entitlement were independently inspected; only the expected app-owned application identity exists.
- The positive Android project was regenerated after the negative check; expo.sqlite.useSQLCipher=true is restored. Negative environment flags were command-local and are not committed as defaults.
- `scripts/native/README.md` records the existing fixtures, platform adapter and exact preconditions. `validate-native-export.py CSV PDF` checks actual captured files; historical no-argument fixture validation remains intact.
- GitHub Validation runs 41620241865 (dependency commit3c525702),41621829156 (build-script commitf7131b03), and41625492958 (native-helper commitd2da5618) all PASS. Each includes clean install, TypeScript, all 163 regressions, SDK check, audit0, fingerprint/API smoke, native generation and both native JavaScript exports. Final live-head checks are verified before PR readiness; native device execution is not inferred from Linux CI.

| Local QA/evidence identity | SHA-256 |
|---|---|
| Final canonical Android APK | 23407ac8778a8dc3aa8811c2edf24e55d77d29ee59c2511873330f2ab586cf72 |
| SQLCipher-negative Android APK | 10d3d0bfc3a3eab738f4753f9c0eb54fcb162da073cb0733e7726627f5a76b89 |
| iOS Simulator executable | 67041fa89b32eeabf20054d29cf9585a5b80e8d706f4ab89b144e62b5e68822e |
| iOS Simulator debug dylib | 4675ef1eee06b6a823d356c5ad891664f69aa3774ddfa58900c5350d625bf312 |
| iOS native CSV / PDF | 543625a4a0d7d1539cdb72cfb6cdb86a77c6f0da61419afdb27aac2f03e3c641 / d92b1f19fe8b81d882a5f46b8b345f806cbed13bf378ac3f1f2ac249e6fbfc4d |
| Final Android native CSV / PDF | a8926cdc1f935feee1ef7dc52e987f8dc61eb3618981771bb2fc7dcb1c615f3c / a31045e7a5045e8331a7fa5a9e729028db6935b63ff18b28c9461319c14aca82 |

Full native logs/captures and QA binaries remain local under /tmp/llc-cert-* and the task DerivedData; they are not represented as remotely backed-up release artifacts. No unnecessary binary/evidence package was added to Git.

## Scope, review and readiness

This certification targets the synthetic development baseline for the Foundry pilot. Physical-device Keychain/Keystore, full advanced-screen/accessibility matrix, cross-platform real-file/provider restore, process-kill/power-loss during restore, OS backup/transfer and signed production/store acceptance remain BLOCKED release/real-data gates. The iOS negative binary was not rerun; Android's binary negative, both positive native proofs and host fail-closed regressions cover the affected development gate. No claim of full product/release acceptance or real-data authorization is made.

Independent final review of exact candidate ea0ea4383b2a6d7630750d0cccb3d6612c361cde found no critical/important findings. The reviewer verified Keychain handling and the executable's embedded identity, scoped dependency updates, unchanged accounting/storage/backup source, native result logs, both export validators, all eight artifact/capture hashes and the 30 byte-identical Android runtime-code entries. The targeted negative check was repeated with retained before/after maps; the reviewer independently compared all five filenames and hashes. Both maps have SHA-256 de79e933db6b4f16bf500556803db848d8a80c4af4d288790a8bf85f8db44a4f. The restored final positive build again passed persistence. Exact-head CI41627989213 also passed.

All requested synthetic development acceptance gates are complete with no waived security findings or financial assertions. The final delivery/PR records the live-head CI result after this review-record-only update. PR#1 is eligible for owner review and merge authorization after that confirmation. Main remains unchanged; no merge authorization has been given. Real-data/release gates above remain open.

`WORKSPACE_RESET_NOT_SAFE`: native binaries/logs, simulator/AVD state, caches, private signing material and global agent configuration are not covered by remote source synchronization.
