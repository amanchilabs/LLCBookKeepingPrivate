# Current Commit Native Validation Implementation Plan

> **For agentic workers:** Execute inline in the current dependent feature branch. Keep commits small and preserve remote checkpoints.

**Goal:** Close the two documented native-storage recovery gaps and produce current-commit simulator/emulator evidence for builds, restore behavior, backup portability, and the SQLCipher-disabled fail-closed configuration.

**Architecture:** Add one application-wide storage access coordinator that drains in-flight operations, blocks new access during restore/recovery, scopes connection lifetimes, and only resumes after validating one active generation. Keep the existing encrypted generation catalog and portable-backup format; add only the minimum recovery state and test harness needed to prove the requested behavior.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, expo-sqlite/SQLCipher, expo-secure-store, expo-file-system, Vitest, Xcode Simulator, Android Emulator.

**Spec:** User continuation request in this session; existing state-machine contract in `docs/security/restore-state-machine.md`.

## Global Constraints

- Work only on `feature/native-validation-20261030-939a045`, based on remote `939a045f6d738c0c7c9158056946882e3c3fd215`.
- Do not start bookkeeping MVP work, merge to `main`, redesign the framework, or expand the UI beyond a clear locked/recovery state and controlled proof harness.
- Use synthetic records and attachments only; never log database keys, passphrases, backup plaintext, or secret diagnostics.
- Require full original or full restored records and attachment hashes after every interrupted transition.
- Distinguish injected exceptions from external process termination; do not label either as power-loss proof.
- Build both native targets from the current committed source and repeat native build verification from a clean clone without ignored files.
- Keep physical-device key access, KDF, backup/transfer, and release checks pending when hardware is unavailable.
- Preserve all unrelated work and user files; do not clear broad caches, simulator contents, backups, or workspaces.

---

### Task 1: Coordinated storage gate and generation-safe operations

**Files:** `packages/storage-native/src/database-catalog.ts`, `packages/storage-native/src/encrypted-database.ts`, new storage access coordinator and tests, `packages/backup/src/native-restore-store.ts`, `packages/backup/src/native-portable-backup.ts`, `App.tsx` only where it calls storage APIs.

- [ ] Write failing tests for overlapping saves, reads, attachment reads, exports, restore activation, and recovery. Assert operations already in progress settle before transition, new work waits, each result belongs to one generation, and no write can reach a retired generation.
- [ ] Route every financial database open through one coordinator. Expose callback-scoped reads/writes and an exclusive restore/recovery operation; do not return raw live handles to callers.
- [ ] Drain in-flight work before closing tracked handles, run candidate validation/activation/recovery while the gate is closed, reopen and verify the selected generation, then resume queued operations.
- [ ] Capture exports as one immutable generation snapshot, including attachment bytes, before encryption or file sharing.
- [ ] Run focused tests, full `npm test`, and `npm run typecheck`; commit the storage change.

### Task 2: Inaccessible-key recovery and explicit replacement consent

**Files:** secure-key access and catalog initialization modules, native restore entry point, minimum native recovery UI in `App.tsx`, focused tests, `docs/security/restore-state-machine.md` and threat model.

- [ ] Add tests distinguishing supported key-unavailable/device-locked/authentication states from malformed data, wrong SQLCipher key, catalog corruption, and unrelated I/O failures.
- [ ] Confirm inaccessible existing database/catalog files remain byte-for-byte present and are never initialized as an empty database.
- [ ] Add a locked/recovery state that explains backup restore can create a fresh local key; require explicit confirmation before replacement or discard.
- [ ] Document that with no usable key and no independent portable backup, existing encrypted data cannot be recovered; no server or escrow exists.
- [ ] Run focused tests and typecheck; commit the recovery path.

### Task 3: Current-format file portability and rejection matrix

**Files:** current v2 payload/format helpers and tests, native portable-backup harness, test artifact scripts/fixtures, native proof screen only for existing controls, security evidence report.

- [ ] Define one deterministic synthetic v2 fixture with record and attachment hashes and verify its authenticated envelope on both native crypto implementations.
- [ ] Exercise actual backup files iOS-to-Android, Android-to-iOS, and fresh-install restore on each platform. Verify reopened rows and attachment hashes.
- [ ] Verify wrong passphrase, tampering, truncation, unsupported version, missing old local key, and rejected-restore preservation of existing records.
- [ ] Keep parser/crypto/file restore results separate from native document picker/provider UX results. Do not reuse prerequisite v1 evidence.
- [ ] Commit reproducible test controls and evidence.

### Task 4: External process-termination harness

**Files:** native restore test hooks or launch arguments, minimal proof-screen controls, simulator/emulator harness scripts, restore-recovery tests, evidence report.

- [ ] Add named durable boundaries spanning candidate/key persistence, activation journal, pointer commit, candidate revalidation, journal clear, and retired-generation cleanup.
- [ ] At each selected boundary, pause the process with progress/artifact state; have an external host script terminate it, start a new process, and inspect recovery before storage operations are enabled.
- [ ] Make recovery interruption repeatable and verify each retry ends with the complete original or restored record set and matching attachment hashes.
- [ ] Keep current exception injection results in a separately labeled matrix. State explicitly that process termination is not power-loss durability proof.
- [ ] Run the harness on available iOS Simulator and Android Emulator; commit script and results.

### Task 5: SQLCipher-disabled native negative build

**Files:** existing `apps/mobile/native-build-policy.cjs`, Expo config/plugins only if generated native evidence identifies an error, native proof/harness controls, evidence report.

- [ ] Build and install a non-production SQLCipher-disabled native configuration on available simulators/emulators.
- [ ] Verify initialization is explicitly refused before persistent financial database creation and scan app-private database, WAL, SHM, and journal paths for plaintext financial storage.
- [ ] Verify configuration tests reject use of the negative build under the production profile.
- [ ] Record source SHA, profile, generated native settings, install/run result, and storage scan result.

### Task 6: Current-commit full builds and clean-clone reproduction

**Files:** Expo config/plugins only for reproduced native build errors; `docs/security/native-proof-results.md`, dependency/build documentation, reproducible build script if needed.

- [ ] Generate native projects from committed config, build the full iOS Simulator app and Android Emulator APK from this branch, and record exact source SHA/configuration.
- [ ] Resolve generated errors through committed config/plugins and repeat the full builds.
- [ ] Clone the pushed branch into a new directory without copying ignored files; install from the lockfile, regenerate native projects, and repeat both builds.
- [ ] Document external SDK, simulator image, Java/Gradle, CocoaPods, and signing requirements; signing remains unnecessary for simulator/emulator builds.
- [ ] Preserve test evidence and rerun checks; commit results.

### Task 7: Advisory verification and final gate report

**Files:** `docs/security/audits/npm-audit-2026-10-30.md`, `docs/security/dependency-inventory.md`, `docs/security/native-proof-results.md`.

- [ ] Verify each advisory against its original source and current installed dependency path/version.
- [ ] Separate shipped runtime, build-time, and development-server exposure; describe reachable inputs, compatible fixes, mitigations, and uncertainty without downgrades, suppressions, unreviewed overrides, or residual-risk acceptance.
- [ ] Publish separate exception, process-kill, portability, concurrent-operation, missing-key, native-build, negative-build, and clean-clone results.
- [ ] List remaining gates for synthetic-data bookkeeping implementation, real financial data, and store release. Keep physical-device gates explicitly pending if hardware is unavailable.
- [ ] Run the final requested checks, review the diff and sensitive-file set, commit/push, and verify the remote SHA and clean working tree.
