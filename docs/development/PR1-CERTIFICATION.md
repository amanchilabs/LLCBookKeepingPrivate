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

GitHub's branch response confirms main `protected=false`, protection disabled and required-check contexts empty. Owner merge authorization still applies. PR remains draft while native certification and final independent review are incomplete.

## Current native status

iOS Keychain correction and final native acceptance are in progress. Required unexecuted checks remain BLOCKED. No encryption/key-access checks or accounting assertions are weakened. No production signing, deployment, store submission, or main merge is authorized.

`WORKSPACE_RESET_NOT_SAFE`: native binaries/logs, simulator/AVD state, caches, private signing material and global agent configuration are not covered by remote source synchronization.
