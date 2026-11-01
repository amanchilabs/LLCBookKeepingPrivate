# Android cash movement report evidence

**Source commit:** `128126b` (`feat(reports): add cash movement report`)
**Platform:** Android 16/API 36 arm64 emulator (`emulator-5554`)
**Runtime:** Installed native development client with JavaScript served locally by Metro on port 8090. This is emulator verification, not a standalone/offline or physical-device test.
**Data:** Synthetic `Northstar Demo LLC` records only.

## Observed results

The Reports screen calculated per-account cash movement through 2026-10-31 from persisted journal lines:

| Account | Beginning | Inflows | Outflows | Net | Ending |
| --- | ---: | ---: | ---: | ---: | ---: |
| Synthetic Checking | $1,250.00 | $2,285.00 | $677.19 | $1,607.81 | $2,857.81 |
| Synthetic savings | $0.00 | $255.00 | $125.00 | $130.00 | $130.00 |
| Recon%QA | $500.00 | $100.00 | $50.00 | $50.00 | $550.00 |
| **Total cash** | **$1,750.00** | **$2,640.00** | **$852.19** | **$1,787.81** | **$3,537.81** |

The total ending cash equals the Balance Sheet total assets of $3,537.81; each ending account balance matches its cumulative journal balance. Internal transfers appear on both account sides and cancel in aggregate. The selected-period cash-basis P&L is unchanged by this report.

Pressing **Export cash movement CSV** opened the Android share sheet for `llc-cash-movement-2026-10-31.csv`. No external share target was selected. The report is calculated from journal rows; the CSV includes account, date range, beginning balance, inflows, outflows, net movement, and ending balance.

## Images

- `01-cash-movement-report.png` — per-account movement values.
- `02-cash-movement-reconciliation.png` — total cash agrees with Balance Sheet total assets.
- `03-cash-movement-share-sheet.png` — native Android CSV share sheet.

## Scope and limitations

This demonstrates the screen and share flow on an Android emulator with synthetic data. It does not establish physical-device, iOS, standalone/offline, release-signing, production security, tax, or CPA acceptance. CSV formula-like text is prefixed as text; signed numeric amounts remain numeric.
