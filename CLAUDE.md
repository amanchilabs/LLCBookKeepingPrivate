> Current PR #1 certification: [`docs/development/PR1-CERTIFICATION.md`](docs/development/PR1-CERTIFICATION.md). Main changes require separate owner merge authorization. The M4 continuation guidance below is historical.

# LLCBookKeepingPrivate — Claude Code Project Guide

## Product vision

Build a dependable, privacy-first bookkeeping application for U.S. single-member and multi-member LLC owners on iOS and Android. Keep bookkeeping local and usable offline. The goal is for an owner to maintain business records and prepare clear workpapers for a CPA; the app is not a tax preparer, tax return, or guarantee of tax treatment.

The current repository is a developing product, not a production-ready accounting service. Use synthetic data only until the security, recovery, privacy, accessibility, and device release gates in the handoff and security documents have passed and the owner approves real-data use.

## Source of truth and architecture

- Read [`AGENTS.md`](AGENTS.md) before any Git or implementation work. Its branch, preservation, push, remote-verification, and no-merge rules apply.
- The M4 continuation baseline is the pushed `chore/m4-migration-handoff-20261101-fd1ecd4` branch. Its application source starts from UX checkpoint `fd1ecd43a534d0c4322ef914b16a0fcc419320df`; verify the live branch SHA before work.
- Approved visual and navigation authority: [`docs/design/proposed/README.md`](docs/design/proposed/README.md), [`design-system.md`](docs/design/proposed/design-system.md), [`navigation-map.md`](docs/design/proposed/navigation-map.md), [`screen-specifications.md`](docs/design/proposed/screen-specifications.md), [`design-decisions.md`](docs/design/proposed/design-decisions.md), and [`docs/design/implementation/`](docs/design/implementation/). Canonical images are in [`docs/design/proposed/screenshots/`](docs/design/proposed/screenshots/). Images are visual references; domain and privacy rules below take precedence.
- Mobile UI: Expo + React Native + TypeScript, primarily in `apps/mobile/bookkeeping/` and `App.tsx`.
- Business rules: `packages/domain/` (fixed precision, journals, bookkeeping, loans, recurring items, CSV).
- Local encrypted persistence and services: `packages/storage-native/` (SQLCipher and platform-protected key access).
- Explicit encrypted backup/restore foundation: `packages/backup/`.
- Native projects are generated and ignored. Durable native configuration belongs in `app.config.ts`, `apps/mobile/native-build-policy.cjs`, and tracked config plugins under `plugins/`. Do not hand-edit generated `ios/` or `android/` files as the durable fix; encode needed changes in tracked configuration and verify prebuild output.
- No remote database, mobile account requirement, automatic synchronization, bank connection, analytics, or advertising SDK is authorized.

## Accounting and data-integrity rules

- Every posted financial journal entry must balance. Use the existing money parser/fixed-precision utilities; do not use floating-point arithmetic for money.
- Source all account balances and reports from persisted journal lines. If a screen cannot get a value from the accounting engine, show it as unavailable rather than inventing a number.
- A posted transaction is immutable. Correct it with linked reversal and replacement entries; preserve the original and the full audit trail. Never add direct deletion or silent overwrite.
- An account opening balance offsets to Opening Balance Equity. It is not automatically an owner contribution.
- Ownership percentage is not a profit, loss, tax, or capital allocation rule. Do not allocate activity based on ownership without explicit approved policy and records. Preserve dated ownership history and total validation.
- Contributions increase member book capital and cash/property as applicable; they are not income. Distributions reduce member book capital and cash; they are not operating expenses. Book capital does not establish tax basis or outside basis.
- Keep guaranteed-payment obligations distinct from actual payments. An unpaid obligation does not reduce cash or create a cash-basis expense. Actual payments are separately posted, allocated, and reversible. Do not add guaranteed payments to capital.
- Keep debt commitments distinct from funded advances. Loan proceeds are not income or capital; principal repayment is not an expense. Only actual outstanding principal accrues the agreement's stored simple-interest rate/day-count policy. Do not choose tax rates or assert deductibility.
- Transfers move cash between accounts and net to zero across accounts; they are neither income nor expense. Split transaction lines must reconcile exactly to the transaction amount.
- Reports must identify period and basis and reconcile to the journal. CPA workpapers are not tax returns or claims of direct tax-software compatibility.
- For a single-member LLC, support a 100% owner interest and owner-equity contributions/distributions. Do not infer federal tax classification. Disable partnership allocation/guaranteed-payment workflows as applicable and flag owner labor/classification for CPA review.
- Do not silently place unexplained balances into member equity. Failed writes/imports must not partially commit. Keep historical corrections and period close/reopen events traceable.

## Privacy and security commitments

- Financial records stay on the device. No automatic cloud sync, remote financial storage, background upload, bank credentials/connections, external AI processing, analytics, tracking, or advertising.
- Exports and backups are explicit user actions. Do not describe an OS share sheet or a local backup file as cloud sync.
- Do not claim app lock, biometrics/PIN, attachment encryption, backup protection, recovery, or release security unless the specific behavior is implemented and verified on the target platform.
- Never commit signing keys, certificates, provisioning profiles, passwords, tokens, real financial records, receipts, local database files, or device dumps. Do not print secret values in logs or docs.
- Treat all test data and device screenshots as synthetic unless clearly established otherwise. Do not use production records in test output.
- Keep migrations fail-closed and preserve the existing database/backup controls. Do not weaken encryption or backup exclusions to make development easier.

## UI and accessibility direction

Use the approved hybrid aesthetic: warm whites, navy information hierarchy, emerald primary actions, soft sage accents, restrained rounded surfaces, accessible contrast, and generous touch targets. Use the approved five-tab model: Dashboard, Transactions, Members, Reports, and More. Keep Accounts/Reconciliation discoverable under More; put capital, guaranteed payments, and loans in member context. Preserve explicit navigation to Settings and recovery controls.

Use actual native iOS/Android execution for platform acceptance. Unit tests, web preview, generated source, or a screenshot from the wrong platform do not prove native behavior. Check keyboard, safe areas, scroll, small devices, accessibility labels/targets, and persisted state after relaunch.

## Development commands

Use the Node version pinned by `.node-version` (currently `24.22.2`) and the committed `package-lock.json`. Install with `npm ci`, not an unconstrained install.

```sh
git status --short --branch
git fetch origin
npm ci
npm run config:public
npm run typecheck
npm test
npm run doctor
```

`npm run doctor` may report pinned Expo package patch-version drift; inspect the output and discuss compatibility before changing dependencies or the lockfile.

Regenerate the ignored native directories only after dependency installation and review of tracked config:

```sh
EXPO_NO_TELEMETRY=1 npm run prebuild -- --no-install
(cd ios && pod install)
(cd android && ./gradlew :app:assembleDebug --no-daemon --console=plain)
```

For simulator/device runs, use the intended dedicated target and the existing scripts `npm run start:ios` or `npm run start:android`. Simulator/emulator compilation does not establish physical-device signing or acceptance. Current environment requirements and verified build evidence are recorded in [`docs/development/M4-MIGRATION-HANDOFF.md`](docs/development/M4-MIGRATION-HANDOFF.md).

## Autonomous execution expectations

Work in small, reviewable vertical slices: inspect existing behavior; preserve the current workflow; add or update focused tests; connect domain, persistence, and actual mobile UI; run regression and native verification; inspect the diff for financial/privacy regressions; commit and push the task branch; query the live remote SHA; and report evidence and gaps. Investigate and remediate ordinary blockers without abandoning independent work. Do not represent source presence or tests as simulator, physical-device, security-release, or production acceptance.

Do not merge to `main`, delete branches/worktrees, force-push, add cloud services, make tax-policy decisions, or introduce paid/signing resources without the necessary explicit approval. Keep the feature-preservation matrix current. Continue from [`docs/development/CONTINUE-FROM-HERE.md`](docs/development/CONTINUE-FROM-HERE.md).
