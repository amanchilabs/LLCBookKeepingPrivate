# Multiple local LLC workspaces

## Scope and storage policy

Keep all workspaces in the existing encrypted SQLCipher database. Add a versioned local preference that points to the active business. When the preference is missing or invalid, select the earliest existing business so older databases continue to open. Creating a workspace makes it active. Preserve current business rows and account IDs; seed colliding system account IDs for later businesses with business-specific IDs. Every snapshot, account, journal, and subledger read remains scoped to the selected business.

Add a Settings workspace list with an explicit switch action and a create-workspace action that reuses LLC setup. Switching and creating a workspace must survive app relaunch. Do not add cloud sync, business deletion, or automatic data movement. Keep the suggested four-member defaults at 40/20/20/20; allow member rows to be added or removed, and set the remaining sole member to 100% when a setup/edit flow removes all other members.

Single-member policy, approved by the user: record owner contributions and distributions as equity activity; disable new guaranteed-payment obligations and actual guaranteed-payment postings for a sole-member workspace; flag owner labor/tax classification for CPA review. Do not infer tax classification or allocate profits by ownership.

## Implementation and acceptance

1. Add failing repository tests for a second business, distinct seeded accounts, isolated opening and income entries, workspace enumeration, active selection, migration from schema v12, and selection persistence after database reopen.
2. Add the v12-to-v13 encrypted-database preference migration, business enumeration and selection APIs, multi-business creation, business-scoped seeded account IDs, and active-business snapshot selection. Enforce the approved sole-member guaranteed-payment policy in storage.
3. Connect workspace list, switch, and create actions to Settings and the existing setup route; support one-to-four-plus member rows without changing the default four interests; after selection or creation refresh the UI from the selected business snapshot.
4. Run focused tests, the full regression suite, TypeScript, and `git diff --check`.
5. On the Android emulator, create a synthetic second LLC, switch between both workspaces, force-stop/relaunch, and verify each workspace retains its own accounts, members, cash, transactions, and reports. Capture native screenshots and reconcile values.
6. Commit and push source and evidence separately, then verify clean tree and the live feature branch SHA.
