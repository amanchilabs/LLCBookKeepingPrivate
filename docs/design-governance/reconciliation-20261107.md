# Review package reconciliation — proposal v4

35 screens;57 rendered proposals. No application implementation or visual approval.

**Independent re-review is blocked by the assigned Claude Code five-hour usage limit (reset reported6:30am America/Los_Angeles).** The prior dashboard finding is corrected but not independently re-cleared. No provider/API fallback.

| Order | ID | Screen | New functionality requiring separate authorization | Outstanding decisions |
| --- | --- | --- | --- | --- |
| 1 | OB-01 | Welcome | None | None |
| 2 | OB-02 | Your LLC | None | None |
| 3 | OB-03 | Members and ownership setup | None | None |
| 4 | OB-04 | First account (optional) | None | None |
| 5 | OB-05 | Review setup | None | None |
| 6 | OB-06 | Ready | None | None |
| 7 | SH-01 | Navigation shell | None | Header workspace-switcher shortcut: proposed no, switching stays in More |
| 8 | DB-01 | Dashboard | Fiscal-year / period selector on the Dashboard (rendered dashed as PROPOSED; default 'All dates' equals current behavior); Period-scoped tile values: wiring the Dashboard tiles to cashBasisForPeriod(from, through) for the selected period, with tests that the tiles reconcile to the Cash-basis report for the same range; Fiscal-year definition/storage, if a fiscal year other than calendar dates is wanted | Authorize the FY/period selector and period-scoped tile values, or omit the selector and keep all-dates tiles only?; If authorized: calendar year or a stored fiscal-year start, and should the hero stay an as-of-today balance (proposed: yes)?; Accept moving the cash hero and summary tiles above 'Record an activity' (order-only change)?; Should Reconcile keep its current Accounts destination, or open a specific reconciliation screen later (separate authorization)? |
| 9 | SR-01 | Search and results | Per-kind counts in the category grid, chips and section headers; Grouped result sections with View all; Type chips filtering results; 'Categories' group (income/expense accounts); Filters screen (record type, date, amount, account, member, category, status) with Apply/Clear all; Recent searches stored on the device; Opening the specific record instead of its section; Restoring query, filters, chips and scroll on Back; Related links shown as date, description and amount instead of a raw ID; Live result count on Apply | Allow recent searches on the device? If so, encrypted and clearable?; Show the recurring and LLC-profile kinds (searched today, not in the owner's list) as groups?; Offer 'Reverse and replace' on a detail opened from search, or keep it read-only there?; Authorize a live result count on the Apply button?; Reconciliation finding: the saved note requests a Project filter, but the source has no Project dimension. It is excluded from this bounded proposal; a future Project capability needs an explicit scope decision and verification, not silent omission or fabricated support. |
| 10 | TX-01 | Transaction history | Period income/expense/net summary; Sort control | Date grouping by posting date: confirm; Confirm the single 'Loans' chip maps to the existing loan-advance and loan-repayment type filter values |
| 11 | TX-02 | Income, expense and transfer entry | Native date picker | Authorize a native date picker? |
| 12 | TX-03 | Transaction detail | Full balanced journal lines (shares work with RP-05 expansion); Timestamped audit events; Related links shown as date, description and amount | Authorize journal lines on this screen? |
| 13 | TX-04 | Reverse and replace | Confirmation preview step with computed net effect; Closed-period pre-check before posting | Authorize the two-step preview flow and closed-period pre-check?; Accept the text-derived layout (no reference image exists)? |
| 14 | TX-05 | Recurring transactions | Search over schedules; Status filter chips, counts and summary tiles | Authorize schedule search, status chips and tiles? |
| 15 | TX-06 | CSV import and review | Per-row include/exclude; Search/filter in the preview; Duplicate match compare; Default category | Which per-row preview controls, if any, to authorize |
| 16 | MB-01 | Members and ownership history | None | None |
| 17 | MB-02 | Member capital | Running capital balance per row; Per-member capital export | None |
| 18 | MB-03 | Obligations and actual payments | Outstanding (obligation minus paid) figure; Percent-paid metric | Authorize an outstanding computation, and how is it defined? |
| 19 | MB-04 | Member and third-party loans | Term/maturity fields; Amortization schedule (see RP-08) | None |
| 20 | RP-01 | Profit and loss | Per-category income/expense breakdown; Period presets | Authorize the per-category breakdown? |
| 21 | RP-02 | Cash movement | Single-account filter; Transaction counts per direction | Add a single-account filter? |
| 22 | RP-03 | Balance sheet | None | None |
| 23 | RP-04 | Trial balance | Account search and type filter; Drill-down from trial balance to the general ledger (no such link exists today); Account code column in CSV/PDF | Authorize trial-balance-to-ledger drill-down as new navigation?; Add account code to the CSV/PDF? |
| 24 | RP-05 | General ledger | From-date (period) filter and beginning balance; Dr/Cr side or normal-side balance presentation; All-accounts mode and Accounts tab; Entry search; Expanded full balanced journal with other lines and audit history; User-facing reference display; Export respecting a from-date or all accounts | What is the 'reference': a short journal-entry ID or a new user-facing number?; How is the beginning balance defined when a from-date is set?; Present balances as Dr/Cr sides (proposed) or as signed debits minus credits (current)? |
| 25 | RP-06 | Capital movement workpaper | Period beginning and ending capital, per member and in total; Per-member rollforward; Member filter and member-filtered export; Activity search and chips | Should opening-balance equity be part of beginning member capital? (proposed: no); Introduce an 'adjustment' activity type? (existing kinds are cash contribution, property contribution and distribution only) |
| 26 | RP-07 | Payment cash workpaper | Combined cash aggregation across GP, distributions and loan principal/interest; Combined total; Type and recipient filters; By-recipient grouping; Activity search and chips; Reconciliation reference per payment; Combined export | Define 'Other payments' (which records?) or drop it; What is a 'reconciliation reference': a bank reconciliation ID or a journal entry? |
| 27 | RP-08 | Loan cash workpaper | Period beginning principal, in total and per loan (rollforward); Adjustments line; Loan filter; Amortization in loan detail (requires a schedule model); Activity search and chips | Introduce an adjustment record type? If not, omit the line; Authorize amortization (requires a schedule model)? |
| 28 | RP-09 | Tax Data Exchange | Tax-year selector; Capital and missing-category readiness checks; Multi-dataset package selection (new exchange contract version); Encrypted export (crypto exists only in backup development tools); Explicit share target to LLCBookKeepingTaxReturn | Authorize an encrypted package and new exchange contract version?; Authorize the tax-year selector and additional readiness checks? |
| 29 | MO-01 | More | Direct More > LLC workspaces row (owner-requested navigation); Direct rows for Bookkeeping periods and Reminders | Approve direct More rows for periods and reminders? |
| 30 | AC-01 | Accounts and reconciliation | Not-reconciled count and last-reconciled badge (derived); Reconciliation report PDF | Use Categories as the third tab instead of the reference's 'Activity'? |
| 31 | SET-01 | Settings, workspaces and periods | None | Accept the text-derived layout (no Settings reference exists)? |
| 32 | OB-ADD | Add another LLC workspace | Direct More > LLC workspaces route (owner-requested); Tab bar visible during add-LLC (currently full-screen) | Keep tabs visible through the later setup steps (members, account, review)? |
| 33 | BOOT-03 | Storage and recovery tools | Certified user backup/restore of real books (production verification); Storage usage meter; 'Last backup' record | When is the 'development' label removed? (requires the security release gate) |
| 34 | BOOT-01 | Loading books | None | Should the import-preview concept from that image become its own future screen ID? (existing CSV import stays in TX-06) |
| 35 | BOOT-02 | Local books unavailable | Deep link straight to restore; Showing the selected LLC name from the catalog; Static troubleshooting help | Accept no tab bar in this state (the reference shows one)? |

Full signed feedback is preserved in review-notes-full-20261107.json and the immutable approvals directory. Current hashes/contract text/reference paths are in registry.json; structured differences are in reconciliation-20261107.json.

Reference corrections: Loan Cash is excluded for More/Accounts/Settings; the misnamed Settings PNG depicts More and supplies no Settings layout; Loading Books remains loading, not import. The additional Search composite supplies all five states.

The dashboard retains existing cash-basis income/expense/net tiles and Reconcile. Period/FY selection is new, not a prerequisite for existing tiles. Existing aggregate search counts/empty feedback/accessibility are preserved.

All new native iOS/Android, physical-device, assistive-technology and functional evidence remains unverified. Old captures show old source only. Unrendered nonpriority states remain listed per screen.
