# Synthetic Android validation flows

These are local Maestro 2.12.0 test definitions, not production capabilities. Use a dedicated emulator with only synthetic records. Do not run these against real or existing customer books. Select the device explicitly with `maestro --udid <serial> test <file>`; no cloud upload is needed.

Build/install the unchanged app as documented in VALIDATION.md. Start its Metro server on port 8089 and reverse that port for the dedicated Android target. Open the development client URL and disable its floating Tools button in the development menu so it does not cover Search. No security or accounting behavior is disabled.

- `onboarding.yaml`: PASS from fresh synthetic setup after opening the development URL; handles introductory development-menu prompts. Creates four synthetic members, default 40/20/20/20 ownership, and $1,000 opening balance.
- `accounting.yaml`: **corrected combined flow, NOT rerun end-to-end**. Original execution posted $250 income, $50 expense, then reversal/replacement to $75; its old comma-only money selector failed. This saved version accepts the UI's existing ungrouped money format. Continues with $100 contribution, search and trial balance. Do not replay financial writes against the already-populated test workspace; use fresh setup for a future full run.
- `search-reports.yaml`: PASS continuation after the financial writes and $100 contribution already existed. Exercises global capital search, destination section, bank $1,275 and trial balance visibility. Tools overlay must be disabled.
- `pdf.yaml`: PASS after opening Trial Balance. Opens PDF system share sheet, captures screenshot inside Maestro output directory, and dismisses without sending.
- `persistence.yaml`: PASS after force-stopping and reopening the app via its development URL. Verifies same LLC, $1,275 cash, member and contribution.
- `settings.yaml`: PASS continuation from More. Uses indexed button selector because the heading shares its label. Opens Settings and returns to Dashboard. Accounts navigation was separately exercised before this continuation.

These stateful chunks plus retained execution logs/evidence are not one green end-to-end suite. The iOS Keychain blocker prevents cross-platform certification. CSV export was exercised before PDF; independent captured-export checks are in validate-native-export.py. Full build logs and transient device/runner artifacts remain local and excluded from remote source recovery.
