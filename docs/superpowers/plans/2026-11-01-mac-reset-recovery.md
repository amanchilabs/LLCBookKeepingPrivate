# Mac Reset Recovery Implementation Plan

> **For agentic workers:** Use this plan as the recovery checklist; preserve all historical branches and do not merge to `main`.

**Goal:** Prove that the LLCBookKeepingPrivate source and development state can be reconstructed from Git plus separately backed-up local assets before a Mac reset.

**Architecture:** Select the UX modernization commit as the capability-complete base after verifying branch ancestry and source coverage. Perform a clean clone and dependency/test/native-generation checks in a temporary directory, while documenting local-only assets and external-backup limits in recovery guides.

**Tech Stack:** Git/GitHub, Node.js/npm, Expo SDK 58, React Native, Xcode, CocoaPods, Gradle, Markdown, SHA-256 manifests.

**Spec:** User prompt “LLCBookKeepingPrivate — Repository Consolidation, Disaster Recovery & Mac Reset Readiness”.

## Global Constraints

- Do not erase or reset the Mac, delete worktrees, delete remote branches, or force-push.
- Do not merge to `main` without explicit approval.
- Never put credentials, signing keys, or private financial data in Git or plaintext recovery docs.
- A Downloads staging folder is not an external backup destination.
- Label native and physical-device checks as unverified unless actually run.

---

### Task 1: Verify the canonical source baseline

**Files:** None.

- [ ] Query all live remote branch/tag refs and compare local refs.
- [ ] Check worktrees, stashes, tracked/untracked/ignored files, and local-only commits.
- [ ] Verify each historical capability branch is an ancestor of the UX baseline and inspect capability source presence.

### Task 2: Audit local-only state and regeneration inputs

**Files:** None during audit.

- [ ] Inventory generated native folders, environment files, debug signing material, simulator state, and Downloads galleries without printing secrets.
- [ ] Verify tracked Expo config and plugins reproduce security-relevant native configuration.
- [ ] Identify an available external drive or authorized encrypted remote destination; do not claim asset backup without one.

### Task 3: Rehearse clean-clone recovery

**Files:** Temporary clone outside the working tree.

- [ ] Clone the canonical branch at an exact commit into a new temporary directory.
- [ ] Run `npm ci`, `npm run typecheck`, and `npm test` without using the existing `node_modules`.
- [ ] Run Expo configuration and prebuild checks; inspect generated backup/SQLCipher settings.
- [ ] Record unavailable signing, simulator, emulator, or device checks as unverified.

### Task 4: Write recovery and continuation guides

**Files:**
- Create: `docs/development/MAC-RESET-RECOVERY.md`
- Create: `docs/development/CONTINUE-FROM-HERE.md`
- Create: `docs/development/ASSET-MANIFEST.md`
- Create: `docs/development/RESTORE-LOCAL-ASSETS.md`

- [ ] Record verified commands, tool versions, exact SHA, capability branch matrix, and outstanding acceptance gates.
- [ ] Record external assets, size/checksum, backup priority, and restore instructions without embedding signing keys.
- [ ] Separate verified recovery steps from untested commands and pending human actions.

### Task 5: Checkpoint documentation

**Files:** Only the recovery documentation and this plan.

- [ ] Review staged paths and diffs; run `git diff --check`.
- [ ] Commit and push to the recovery feature branch.
- [ ] Verify clean status and local HEAD equals the live remote branch SHA.
