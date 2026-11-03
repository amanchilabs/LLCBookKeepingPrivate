# Branch reconciliation — 2026-11-03

Repository: `https://github.com/amanchilabs/LLCBookKeepingPrivate.git`.
Main baseline: `e33e8609a7ff11c9c52e4b61463fd13ae42951c7`. Default and canonical branch both `main`.

Original checkout: only local branch `main`, clean tree, no stashes or other registered worktrees, no local-only commits or ignored assets at preflight. Isolated task worktree and integration branch were then created. Fetch and live remote inventory succeeded. Historical handoffs reference the old `veerrajuamanchi` URL; no remote destination was changed.

## Matrix

Unique counts mean commits reachable from the branch and absent from the original main baseline. Counts overlap for dependent branches; they must not be added. All older branch tips are exact ancestors, not merely similar patches. Full SHAs, merge bases, commit subjects/SHAs, changed file lists, and local/remote ref identity are in [branch-inventory.json](branch-inventory.json). It records refs after initial integration branch creation; its task ref snapshot is historical.

| Branch (origin unless stated) | Unique commits | Functionality | Validation evidence | Integration status / recommended action |
|---|---:|---|---|---|
| `chore/m1-handoff-20261030-7a34f6a` | 0 | M1 handoff | Historical handoff | Already in main; retain |
| `chore/m4-migration-handoff-20261101-fd1ecd4` | 8 | M4 migration and continuation documentation | Historical migration report, no app changes | Merge with history; supersede continuation pointer |
| `chore/mac-reset-recovery-20261101-fd1ecd4` | 7 | Unexecuted Mac reset recovery checklist | Unchecked tasks; promised recovery guides absent | Exclude unique d147d1b; preserve branch; shared UX ancestry included |
| `docs/design-consolidation-20261101-e33e860` | 1 | Approved design reference and preservation matrix | Design documentation; not runtime proof | Included through UX ancestry; no separate replay |
| `feature/app-icons-20261030-19a9e6b` | 0 | Approved icon sources/exports | Branding verification.md; historical WIP native gaps | Already in main; retain |
| `feature/icon-native-env-20261030-b703fd7` | 0 | Native icon environment reconciliation | Historical environment report | Already in main; retain |
| `feature/m1-android-icon-runtime-20261030-8d0bd89` | 0 | Android physical icon/SQLCipher proof | docs/validation/m1-android-physical-followup-2026-10-30.md | Already in main; retain |
| `feature/m1-android-icon-validation-20261030-7c441ab` | 0 | Android icon validation deferral | Historical deferred validation document | Already in main; retain |
| `feature/m1-bookkeeping-capabilities-20261031-5c1` | 0 | Android safe-area correction | layout.test.ts; historical native evidence | Already in main; retain |
| `feature/m1-bookkeeping-vertical-slice-20261030-481e028` | 0 | Encrypted journal/repository and native workflows | bookkeeping-store/domain regressions; historical native reports | Already in main; retain |
| `feature/m1-ios-simulator-validation-20261030-b6662a5` | 0 | iOS simulator storage/icon validation | docs/validation/m1-ios-simulator-validation-2026-10-30.md | Already in main; retain |
| `feature/member-capital-20261031-a91c` | 0 | Capital, payments, loans, reconciliation, recurring, CSV import/export, periods, workspaces, search, PDF | Domain/storage/UI tests; docs/validation/evidence | Exact main tip; retain |
| `feature/native-security-backup-poc-20261030` | 0 | Initial SQLCipher/SecureStore/portable backup proof | docs/security/native-proof-results.md; backup tests | Already in main; earlier proof superseded by restore hardening; do not replay |
| `feature/native-validation-20261030-939a045` | 0 | Restore access coordination and inaccessible-data preservation | Storage access/fail-closed tests; historical native build report | Already in main; retain; unresolved device/security gates |
| `feature/restore-security-validation-20261030` | 0 | Recoverable restore coordinator and bounded backup format | Restore coordinator/format tests; historical clean clone evidence | Already in main; supersedes initial proof; retain |
| `feature/ux-modernization-20261101-2b4ad87` | 6 | Five tabs, onboarding, shared visual system, screen sections, atomic initial account | 157 historical/current host tests; historical iOS acceptance; Android UX previously unverified | Merge with history plus independently reviewed search-section fix |
| `main` | 0 | Current canonical integration source | Baseline e33e860 | Unchanged pending owner approval |

## Reconciliation decisions

- Merge UX tip `fd1ecd43a534d0c4322ef914b16a0fcc419320df` with `--no-ff`; design tip `2b4ad87` is its ancestor. No conflicts and no older bookkeeping code replayed.
- Merge migration tip `66adb218eb917e918d8eddc75219b952edc0344c` with `--no-ff`; this adds five documentation files only. Historical evidence is retained, with continuation pointers updated for this task.
- Exclude only the independent reset-checklist commit `d147d1bbf99c55684e6beaaa9795af895a428827`. Its shared UX ancestry is included; its unchecked recovery promises are not completed development or reset certification. Remote branch remains intact.
- No new security experiment is introduced. Security, backup, domain, native plugins, app configuration, and lockfile are unchanged from main. Already integrated experiments retain synthetic-only limitations; consolidation does not certify production security.
- Application changes versus main are the existing UX implementation, atomic business/initial-account insertion using existing SQL logic and schema, and the search-section regression correction. No accounting arithmetic or schema revision is introduced.
- No branches were deleted, no force-push, no main merge, no deployment, no production data.

## Independent source review

Read-only reviewer `independent_review` reviewed `f1834c038315f75631e0576c930edd6982b9738a` against main. Found one P2: search results for capital/payments/recurring templates lost subsection context. Fix `442fb01fcff7d12d6bce75851039f118c585e289` preserves the full result, initializes the destination subsection, and adds six mapping regressions. Reviewer re-reviewed that exact SHA: finding resolved; no remaining critical/important source findings. Domain/backup/config/native policy parity, unchanged schema, and atomic onboarding boundaries confirmed. Helper tests do not establish rendered/native navigation acceptance.

## Continuation and recovery

Task branch: `integration/llc-consolidation-20261103`. This document records an integration candidate, not authorization to merge. Main remains the baseline above until separate approval and successful merge verification. Use the live task branch SHA and current validation report when resuming. No new capabilities or artwork changes are authorized by this task.

`WORKSPACE_RESET_NOT_SAFE`. Ignored dependencies/native projects, caches, simulator/AVD synthetic data, temporary build logs/artifacts, debug signing keys and user-level agent configuration are excluded from Git recovery. No signing/off-device backup/restore certification performed.

## Final independent evidence audit

Reviewer independently audited exact candidate `97d0f386831bd5eb860e1b9534e86357b2c12286`: no remaining critical/important findings. Confirmed application-source parity with reviewed `442fb01` and build `721cafd`, all 20 inventory ref entries and their merge bases/unique counts, all eight evidence hashes, 163 host-test total, clean full integration diff check, and the native export validator PASS. Runtime harness failures/continuations and iOS/doctor/audit/security gaps are accurately disclosed. Final disposition remains draft/not ready for Foundry baseline certification. Native flow definitions are preserved under flows/; full native build logs remain local; committed evidence is not a standalone end-to-end automation reproduction package. This follow-up records that audit without changing application inputs.
