# Standing user Git workflow

Apply before every development prompt in this repository. The pushed feature
branch is the normal stopping point. Do not implement directly on main.

## Preflight and branch selection

1. Confirm repository root, current branch, remote fetch/push URLs and intended
   repository. Fetch current remote references before editing project files.
2. Inspect tracked modifications, staged files, untracked files, worktrees,
   relevant stashes and unpushed commits. Preserve existing work. Never discard,
   overwrite or silently incorporate unrelated work; stop for clarification if
   ownership or purpose is unclear.
3. Report missing remote, authentication or push blockers before implementation.
   Do not create remote repositories or change remote destinations without
   authorization.
4. main is canonical. If the project uses master, report it and obtain direction
   before renaming or changing defaults. Never force-push main or rewrite it.
5. Each new development prompt gets a fresh feature/fix/chore branch from latest
   fetched remote main unless the user explicitly authorizes a dependent base
   or continuation on an existing branch. Explain unmerged dependencies and
   resolve the base before editing; never silently omit prior work or reuse an
   unrelated task branch. Use an isolated worktree when appropriate.
6. Use a unique short task branch name. Push it and establish its own upstream
   early. Preserve existing task work before starting another task.

## Commits and checkpoints

- Commit small coherent changes and push checkpoints during substantial tasks.
- Before each commit review the diff and exact staged file list, run appropriate
  available checks, and check for secrets and unintended files. Include intended
  source, tests, migrations, configuration, lockfiles and necessary docs.
- Do not blindly stage all files. Never commit credentials, tokens, private keys,
  signing credentials, real financial records, receipts, local databases or other
  sensitive user data. Do not hide unfinished source in ignored files or leave
  task work in a stash as its final resting place.
- If incomplete or tests fail, preserve safe work in a clearly labeled WIP commit
  on the feature branch, push it, and report the actual failures. Do not merge
  incomplete work into main.
- Before final status, planned pause, handoff or another normal stop after repo
  changes: save intended files; review final diff/staging; run relevant checks or
  explain why unavailable; commit all intended changes; push; then verify:
  - clean working tree, including no unexplained untracked files;
  - intended upstream;
  - local HEAD matches a live remote branch query, e.g. git ls-remote;
  - no task commits remain only locally.
- A local commit, cached remote-tracking ref, or successful push message alone is
  insufficient. Report only after the remote verification attempt.
- On failed push/verification preserve local work, identify branch/commit and
  blocker, and say REMOTE SYNC BLOCKED — DO NOT DELETE WORKSPACE. Never claim
  remote backup without verification. Do not commit sensitive files merely to
  make status clean; report the exception and withhold deletion safety claims.

## Merge controls

Leave the feature branch pushed by default. Implementation completion is not
merge authorization. Assess tests and repository review/CI requirements, report
readiness, and ask before merging unless the user explicitly authorized an
automatic merge policy. Complete the checkpoint before requesting merge approval.
When authorized, require applicable checks to pass, resolve conflicts without
losing work, push and verify resulting remote main. Do not delete remote feature
branches until the merge is verified and cleanup is authorized.

## Final report and limits

Include task status (complete/incomplete/blocked), feature branch, latest SHA,
checks and actual results/tested SHAs, remote comparison, tree status, merge
status and intentionally excluded assets. Use exactly one applicable statement:

“REMOTE SYNC VERIFIED — all intended development changes are committed and
present on the remote branch; the local working tree is clean. Local-only data
and ignored assets are not covered.”

or:

“REMOTE SYNC BLOCKED — DO NOT DELETE WORKSPACE.”

The guarantee covers delivered committed development work only, not ignored
files, secrets, databases, external untracked assets, unsaved edits or interrupted
work before a successful push. Crashes, power loss, forced termination, network
outages and credential failures can interrupt preservation. Reduce exposure with
frequent commits/pushes; never promise unsaved/unpushed work survives termination.
Follow required environment approvals for commits, pushes, config and external
actions, obtaining them early enough to checkpoint. These instructions authorize
routine task feature commits/pushes, not merges, remote changes or sensitive-data
publication. Surface instruction conflicts before implementation.

## Current product restrictions and handoff

Read docs/handoff/M1-RESUME.md before resuming. This is a synthetic-data native
storage/backup proof, not a completed bookkeeping MVP. No real financial records,
receipts or production use until the documented gates pass. No merge approval
has been given. Do not alter approved artwork materially without approval.

This file is repository-scoped. Old-Mac global instructions do not automatically
transfer to another Mac. On M1 verify the agent's supported global mechanism and
install the user-approved general workflow above at that scope, preserving
existing instructions and checking for overrides. Do not copy private global
configuration into this repository. Global installation and scope verification
steps are in the handoff document.
