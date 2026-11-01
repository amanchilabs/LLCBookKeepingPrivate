# Android search, filter, and member edit evidence

**Source:** `afa369a` (`feature/member-capital-20261031-a91c`)
**Platform:** Android 16/API 36 arm64 emulator (`emulator-5554`)
**Runtime:** Installed development client with the current JavaScript bundle served locally by Metro on port 8090.
**Data:** Synthetic `Northstar Demo LLC` records only.

## Search and filter results

- Searching transaction category text `insurance` returned 3 of 17 persisted records: `RecurringQA`, `SplitQA`, and `InsuranceQA`.
- With search cleared, selecting the Income type filter returned 1 of 17 persisted records.
- Clearing search and restoring All activity returned 17 of 17 records.

## Member edit persistence

Changed synthetic member `Jordan QA` to `Jordan QAx`, saved through **Confirm and save member changes**, and retained the ownership split 40/20/20/20. Force-stopped the app process, reopened the development client, selected its saved `http://127.0.0.1:8090` server, and returned to Members. The UI showed `Jordan QAx` and all four ownership percentages after reload.

## Images

- `01-category-search-results.png` — three persisted records matching the category search.
- `02-cleared-filters.png` — all 17 persisted records after clearing search and resetting type.
- `03-member-edit-after-relaunch.png` — saved member name and ownership interests after process restart and app reload.

## Limits

This is actual Android emulator UI evidence, not physical-device, standalone/offline, or release-build acceptance. The development client required Metro after force-stop. No real data was used.
