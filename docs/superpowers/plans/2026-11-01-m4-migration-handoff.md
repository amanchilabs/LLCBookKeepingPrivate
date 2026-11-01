# M1 to M4 Migration Handoff Plan

> **For agentic workers:** Use this plan as a documentation and recovery checklist. Do not change application behavior, merge to `main`, force-push, delete refs/worktrees, or put credentials in Git.

**Goal:** Make the verified LLCBookKeepingPrivate source and required non-Git development assets recoverable on the M4 Mac.

**Architecture:** Use the UX modernization lineage as the complete product baseline, checkpoint this handoff on a fresh branch, inventory non-Git assets, and package the useful UX evidence separately from the repository. Keep sensitive signing identities out of Git and mark migration readiness blocked until required assets are verified off the M1.

**Tech Stack:** Git/GitHub, Expo SDK 58, React Native, Node/npm, Xcode/CocoaPods, Android SDK/Gradle, Markdown, tar.gz, SHA-256.

**Spec:** User prompt “LLCBookKeepingPrivate — M1 to M4 Development Migration Preparation”.

## Global Constraints

- Canonical Git integration branch remains `main`; do not merge to it.
- Preserve historical branches and worktrees; do not force-push or delete refs.
- Do not modify bookkeeping behavior, schema, security architecture, dependencies, or approved design assets.
- Never put private keys, certificates, tokens, or real financial data in Git or the migration archive.
- A package under M1 `~/Downloads` is staging, not an external backup.
- Report Android UI, physical-device, signing, and release gates only at the level actually verified.

---

### Task 1: Preserve prior task and select the source lineage

- [x] Commit and live-remote verify the only in-progress prior task file on its existing branch.
- [x] Fetch `origin`; verify live refs, ancestry, worktrees, stashes, tags, and task work.
- [x] Select a fresh handoff branch based on the user-requested UX baseline; leave `main` unchanged.

### Task 2: Audit capability, configuration, and local-only assets

- [x] Compare branch tips and design/capability source coverage against the UX checkpoint.
- [x] Inventory generated native directories and compare generated security-critical settings to tracked Expo configuration/plugins.
- [x] Inventory Downloads UX assets, signing identity state, machine-local environment files, ignored build/dependency data, and external storage availability without displaying secret contents.

### Task 3: Prepare the non-Git migration package

- [x] Package the UX discovery gallery and PNG/JSON implementation evidence only.
- [x] Exclude logs, temporary files, generated projects/builds, dependencies, caches, and signing credentials.
- [x] Generate internal per-file SHA-256 checksums and detached archive checksum; extract in a temporary directory and verify every listed file.
- [ ] Copy the package to an authorized destination outside the M1 and verify it there; this requires the user to provide/mount that destination.
- [ ] Export any Apple signing identity needed on M4 as a password-protected `.p12`; do not place it in the repository or unencrypted archive.

### Task 4: Write and verify the M4 handoff

**Files:**
- Create: `CLAUDE.md`
- Create: `docs/development/M4-MIGRATION-HANDOFF.md`
- Create: `docs/development/CONTINUE-FROM-HERE.md`
- Create: `docs/development/M4-LOCAL-ASSET-MANIFEST.md`

- [x] Record exact source checkpoint, branch preservation, tests, native build evidence, platform gaps, setup commands, and human actions.
- [x] Run final documentation diff checks, commit, push, and query the live remote branch SHA. Both pushed checkpoints matched live remote refs when verified.
