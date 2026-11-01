# Android period close and reopen verification

## Environment

- Android emulator: `sdk_gphone64_arm64`, Android 16 / API 36, arm64-v8a.
- Installed application: LLCBookKeepingPrivate debug development build.
- APK SHA-256: `470e1cacfd1f5dbc27c2539fee9dd42698dbe50a0a325f7eb1d01978a8816522`.
- The development client loaded this worktree's JavaScript through a local Metro server on port 8090. This is emulator evidence; it is not an offline launch or physical-device result.
- Synthetic workspace: Northstar Demo LLC. No real financial records were used.

## Workflow

1. Installed the changed debug APK over the existing synthetic app database. The launch exercised the version 10 to 11 bookkeeping migration. Dashboard cash remained `$3,537.81`; Synthetic Checking remained `$2,857.81`.
2. In Settings, closed the books through `2026-10-31` with reason `Synthetic close testing`.
3. Force-stopped and relaunched the app. Settings still showed the close cutoff and its audit reason.
4. Reopened the latest interval with reason `Synthetic period reopened testing`. The close and reopen events both remained in audit history.
5. Force-stopped and relaunched again. Settings showed no active close and retained both audit events; dashboard cash remained unchanged.
6. Tried to close through future date `2026-11-01`. The UI displayed the validation error and kept the books open.

## Evidence

- `01-period-closed.png`: active cutoff after closing.
- `02-period-audit.png`: close event and reason.
- `03-period-reopened.png`: close and reopen audit events.
- `04-period-reopened-after-relaunch.png`: state persisted after restart.
- `05-dashboard-after-relaunch.png`: persisted dashboard cash after migration and restart.
- `06-future-close-rejected.png`: future-date validation with no active close.

This does not establish physical-device, iOS, signed-release, offline/no-Metro, or production-security acceptance.
