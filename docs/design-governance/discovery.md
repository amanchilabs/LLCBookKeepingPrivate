# Design discovery review: LLCBookKeepingPrivate (read-only)

I loaded the `frontend-design:frontend-design` skill and stopped before its build step, as you asked. I wrote no files, ran no builds or agents, and looked at no credentials or real records. Every example below is synthetic.

The branch `feature/visual-review-20261106` was clean at `ae6754b` when the session started. I didn't modify anything, but this session had no shell, so I couldn't re-check git state myself.

Nothing in this review is approved by the owner. Each screen below is an **as-is review proposal**: it describes what the source does today, and lists any deviation as its own item for you to decide.

---

## 1. What the current source does (it overrides older docs)

| Item | Current source | Older docs that are now wrong |
|---|---|---|
| Onboarding | 6 states: `welcome → business → members → account → review → complete` (`onboarding-flow.ts:1`). The account step can be skipped and goes straight to review. | `screen-inventory.md` rows 2, 5, 6 and `screen-specifications.md` rows 1–6 say there is no welcome screen, no review screen and no wizard. |
| Navigation | 5 tabs: Dashboard, Transactions, Members, Reports, More (`navigation-model.ts:4`). Accounts and Settings are under More. Loans opens from inside Members. Search opens from a header button and replaces the content area. | `screen-specifications.md` row 14 says Loans is a top-level tab. |
| Reports | One screen with a report picker. There are 9 report sections, including the new **Exchange** panel (`ReportsScreen.tsx:238-248`, `BookkeepingExchangePanel.tsx`). | The inventory says everything is in one scrolling page and doesn't mention Exchange. |
| Transaction detail | An inline detail panel inside Transactions history, with a "Reverse and replace" button (`TransactionsScreen.tsx:342-368`). There is no separate detail screen. | The specs say there's no detail view at all. |

**Recommendation:** add a dated note to `screen-inventory.md` and `screen-specifications.md` marking these rows as superseded. That needs a write-authorized task. I didn't make the change.

## 2. Shared tokens (as built, `design-system.ts` and `ui.tsx`)

- **Colors:**
  - Background `#F7F5F0`; cards `#FFFFFF`; subtle surface `#F1F3EF`
  - Text navy `#14243B`; secondary text `#526174`
  - Primary emerald `#087A55`; dark emerald `#07583F`; emerald tint `#E7F3EC`; sage `#DCE9DF`
  - Border `#D9E0DC`; error `#B42318`; warning `#8A5A00`; info `#285D8F`
- **Type:** system font throughout.

  | Use | Size / line height / weight |
  |---|---|
  | Page title | 30/37, 700 |
  | Section title | 20/26, 700 |
  | Row title | 16/22, 700 |
  | Body and detail text | 14–15/20–22 |
  | Field label | 15/20, 600 |
  | Badge / caption | 13 |
  | Money | 17/23 bold, tabular figures (large: 30/38) |

- **Spacing and shape:**
  - Page padding 18, top 20, bottom 32, gap 16; maximum content width 760, centered
  - Card padding 18, gap 14
  - Corner radius: cards 16, controls 12, pills fully rounded
- **Touch targets:** at least 44 pt on iOS and 48 dp on Android. Inputs, buttons and tabs all meet this.
- **Accessibility:**
  - Headings, buttons, tabs, radios and the checkbox all have roles.
  - Errors are announced with `alert` / assertive live region.
  - Notices use polite live regions.
  - Money has an accessibility label.
  - `design-system.test.ts` includes a contrast helper. I didn't run it.
- **Responsive behavior:** rows wrap using `flexWrap`. Summary tiles are at least 145 wide. Content is capped at 760 on tablets. Tab labels shrink to 82% before truncating.
- **Mockup deviations that apply to every screen.** I recommend keeping the source version of each:
  - The mockups use a solid green header with an avatar and a notification bell. Source uses a white header with the brand name, the LLC name and a **Search** button. Avatars and notifications aren't supported.
  - The mockups have an "FY 2025" picker on every tab. There's no such source behavior.
  - The mockups use icon tab bars. Source tabs are text only (open question Q4).
  - The mockups use gradient buttons and arrow (`→`) button labels. Source buttons are flat.

## 3. Screen inventory, in the order a user meets them

Status key: **Impl** = implemented in source. That means present in code, not accepted on a simulator or device. **Prop** = proposed only.

### Startup and recovery

| ID | Screen | Source | Status | Spec and states | Deviations / acceptance |
|---|---|---|---|---|---|
| **BOOT-01** | Loading | `BookkeepingApp.tsx:154`, `Loading` | Impl | Spinner plus "Loading encrypted books…" with a polite live region | Q7: "encrypted" is a security claim and needs approval. **Accept:** visible until the snapshot resolves; announced by the screen reader. |
| **BOOT-02** | Local books unavailable | `BookkeepingApp.tsx:156-167` | Impl | Title, the error message, an explanation, primary "Open storage recovery tools", secondary "Retry local storage" | **Accept:** no records are changed; retry calls `refresh`; the recovery button opens BOOT-03. |
| **BOOT-03** | Storage and recovery tools | `App.tsx:113` `NativeProofScreen`, reached via a prop from BookkeepingApp | Impl (development tools) | States: recovering, locked (retry key / restore encrypted backup), SQLCipher check, backup/KDF checks, results box. Header button "Return to books". | The visual style differs from the app (its own `native*` styles). It shows the database path, which is fine for synthetic data but must not ship in release. **Accept:** reachable from BOOT-02, OB-01 and SET-01; the footnote stays ("production readiness remains unverified"). |

### First-launch onboarding (`BusinessSetupScreen.tsx`)

The setup header shows the brand name, a "PRIVATE · ON DEVICE" pill and a "Storage and recovery tools" link.

| ID | Screen | Status | Spec | Mockup reference and deviations | Acceptance |
|---|---|---|---|---|---|
| **OB-01** | Welcome | Impl (`:206-218`) | Cream card `#FFFDF8`; "On device" status pill; title "Your LLC books, kept private."; privacy sentence; "Get started"; a "What you'll set up" card | Mockup: *Private LLC Bookkeeping Onboarding.png*. It shows things the source doesn't: **Skip** (would bypass required setup), a 5-dot carousel, the claims "**CPA-ready reports**" and "no data tracking", an app icon, and a serif headline. Keep the source copy. | No Skip; one CTA that goes to OB-02; no "CPA-ready" or tax claims. |
| **OB-02** | Your LLC | Impl (`:220-232`) | Progress "Setup · 1 of 4" with a 4-segment bar; name, state (2 letters, auto-uppercased), formation date, books start date | Mockup has a tax-classification picker. **Rejected**, and correctly absent from source. | Validation errors appear in FormError and typed values are kept. |
| **OB-03** | Members & ownership | Impl (`:234-267`) | Single/multi choice; button to apply the suggested 40/20/20/20 split; member cards; running total; **explicit** confirmation checkbox, which resets whenever anything is edited | Matches the corrected decision. Defaults to "multi" with the suggested split prefilled (Q2). | Can't continue unless the total is 100% and the box is checked. |
| **OB-04** | First account | Impl (`:269-286`) | "Set up now" / "Do this later"; bank or cash; name; optional opening balance (negative allowed for bank only); date field appears when a balance is entered | The subtitle states the Opening Balance Equity offset. ✔ | If skipped, no account is created. The opening balance date can't be before the books start date. |
| **OB-05** | Review | Impl (`:288-316`) | Three sections, each with an "Edit…" button; "Create LLC" shows a saving state | ✔ | Business and account are saved in one action (`createBusinessWithInitialAccount`). No contribution is inferred from the opening balance. |
| **OB-06** | Ready | Impl (`:318-326`) | "Your books are ready." with a summary and "Go to dashboard" | Mockup offers a tour. Not supported, and correctly absent. | Goes to the Dashboard with the new business loaded. |
| **OB-ADD** | Add an LLC workspace | Impl (`BookkeepingApp.tsx:179`) | Same flow, with a Cancel header | Opened from SET-01 Workspaces | Cancel returns without saving anything. |

### App shell and global search

| ID | Screen | Status | Spec / issues |
|---|---|---|---|
| **SH-01** | Header and tab bar | Impl | Header at least 72 tall. A selected tab gets the emerald tint and `accessibilityState.selected`. Changing tab resets sub-routes and transaction drafts. |
| **SR-01** | Search | Impl (`SearchScreen.tsx`) | Search field and clear button; empty, no-results and results-count states; each result row has a kind badge and opens the relevant section. **Issue:** the header shows "Close search" and the content also shows a "‹ Search" back button, so there are two ways to close it (see Q1). |

### Dashboard

**DB-01 Dashboard** (`DashboardScreen.tsx`). Impl. It shows, in order:

1. Record income / expense / transfer
2. A cash card with a large money figure and the date
3. Three cash-basis tiles
4. Accounts
5. Recent activity (5 items)
6. Members (ownership and capital shown separately)
7. Reminders
8. A link to Reports

Empty states exist for accounts, activity and reminders.

**Findings:**
- **D-a:** The cash-basis tiles have **no period label**. They're all-time figures (`cashBasisForPeriod(database, id)` with no dates, `bookkeeping-store.ts:3851`). This conflicts with the CLAUDE.md rule that reports must state their period and basis.
- **D-b:** "View accounts" and "Reconcile" both go to the same place.
- **D-c:** Recent activity shows the raw `kind` value (for example "loan-advance"), not `transactionRoleLabel`.
- **D-d:** The Members rows aren't tappable, even though `MemberSummaryCard` supports it.

**Mockup reference:** *LLC Financial Dashboard Overview.png*.
- Its **reversal is −$75** while the Transactions mockup shows the same reversal as **+$75**, so the mockups contradict each other.
- "Opening Balance → **Owner Contribution**" is wrong.
- The "Ownership **Allocation**" donut is the wrong concept.
- The income-vs-expense chart, FY picker, kebab menus and avatar have no source support.

**Accept:** every figure comes from the snapshot; zero accounts shows the empty state with "Create an account"; any period-dependent tile is labeled with its period once D-a is decided.

### Transactions (`TransactionsScreen.tsx`)

The screen has three sections chosen with a segmented control: History, Recurring and Import. The "＋ Income / Expense / Transfer" buttons are always visible.

| ID | Screen | Spec | Issues / mockup |
|---|---|---|---|
| **TX-01** | History | Search field; Type filter (6 options), Account and Category filters; "Clear filters" appears only when a filter is active; CSV export (disabled when there are no records); "N of M persisted records shown"; each row has a role badge (warning tone for reversals) plus Details and Correct buttons | Mockup *LLC Transactions Dashboard (1).png* is internally inconsistent: "All (5)" but only 4 rows, "Transfer (1)" but no transfer row, a Filters badge showing 1 while "All" is selected, and the opening balance labeled "Owner Contribution". The date grouping, sort button and chips are proposals only. **Issue:** the "No transactions match these filters" message also appears when there are no transactions at all, so empty and filtered-out aren't distinguished (spec requirement). |
| **TX-02** | Entry form | Type; account; category, or "Split across categories" with a running total; date; amount; description; Post / Cancel | Mockup *Add Transaction*: remove the member-assignment panel. That's already absent in source. ✔ |
| **TX-03** | Transaction detail (inline) | Description; role badge; amount; date, category and account; split lines; links to related reversal/replacement entries; "Reverse and replace" only for eligible entries | Mockup *Transaction Details and Member Allocation.png*: **reject** member allocation, Edit, Duplicate, Delete, "by John Doe" and the timeline actors (it also has the typo "Activit**v**"). **Source issue T-a:** the link shows a raw UUID ("Linked original transaction: {id}"); it should show date, description and amount. **T-b:** the panel only appears inside History; when a search result opens Transactions, the matching record isn't selected. |
| **TX-04** | Reverse and replace | Same form as TX-02 with a heading and an explanation that the original entry stays; "Post reversal and replacement"; notice afterwards | **Gap:** there is no preview or confirmation step showing original vs reversal vs replacement before posting. The spec requires one (Q5). |
| **TX-05** | Recurring | `RecurringTransactionsSection.tsx` | I inventoried this but didn't review its content. |
| **TX-06** | CSV import | `TransactionCsvImportPanel.tsx` | I inventoried this but didn't review its content. |

**Accept:** postings are always balanced; splits must add up exactly; a failed post keeps the draft; after a correction, the original, the reversal and the replacement are all visible in History.

### Members (`MembersScreen.tsx`)

The screen has three sections: Members, Capital and Payments.

| ID | Screen | Spec | Issues |
|---|---|---|---|
| **MB-01** | Members and ownership history | Member records (ownership %, book capital, a "Loans · {name}" button); edit form with an "×" remove control; effective date; "Confirm and save member changes"; ownership history | Mockups: reject roles, "Managing Member" and the ownership donut. Ownership and capital are already shown separately. ✔ |
| **MB-02** | Capital | Contribution/distribution form (property requires a description and is flagged for CPA review); per-member ledgers; dated activity list | **M-a:** the field label "Member **receiving** capital activity" reads wrong for contributions. Suggested label: "Member". The *Member Capital Ledger* mockup's inclusion of loans and guaranteed payments is rejected. |
| **MB-03** | Payments | Obligation form (memo only, no posting); totals for outstanding, due and overdue; installment list; actual-payment form with allocation lines (multi-member only); payment history with reversal fields | A single-member LLC gets disabled-state text. ✔ The *Modern Guaranteed Payments* mockup's split between obligations and paid amounts matches the source. **Gap:** reversal date, account and reason are entered once and shared by every "Reverse returned payment" button, and there's no confirmation step (Q5). |
| **MB-04** | Loans | `LoansScreen.tsx`, opened from MB-01 with the member preselected, plus a "‹ Members" back button. Agreement (memo only), funded advance, repayment (principal and interest), balances as of today, dated history | **L-a:** the loan picker shows `id.slice(0,6)`; the member and lender branches of that code are identical. **L-b:** third-party loans can only be reached through a member's Loans button, so they're hard to find (Q3). The *Member Loan* mockup is missing the commitment-vs-funded split and has a tax implication. Keep the source version. |

### Reports (`ReportsScreen.tsx`)

Report picker with 9 sections, then a period panel (From/Through, inline validation, "Update report"), then the selected report, then an "Available from persisted books" footer. CSV and PDF exports go through the system share sheet, and the notices never claim the file was delivered.

| ID | Section | Notes |
|---|---|---|
| RP-01 | Profit & Loss, cash basis | Totals only (income, operating expenses, net). The *P&L* mockup's category breakdown isn't supported, and the margin figure and "Send" button are rejected. |
| RP-02 | Cash movement | Per account: beginning, inflows, outflows, net, ending, plus a reconciliation line |
| RP-03 | Balance Sheet, book basis | Assets, liabilities and equity, current earnings, and the A−L−E difference. The mockup's **$40 mismatch** and "Final" badge are rejected. |
| RP-04 | Trial Balance | Debit and credit columns, each 88 wide (Q6: may be too narrow for large amounts at large text sizes) |
| RP-05 | General Ledger | Account picker plus its own "Update ledger" |
| RP-06 | Member capital | Period activity plus all-time per-member capital; "not tax basis" note |
| RP-07 | Guaranteed-payment cash | Actual payments only |
| RP-08 | Loans | Period flows and balances as of the through date |
| **RP-09** | **Exchange** | Source, period, "Cash basis · USD", and "Unreviewed · review needed" in warning tone. Totals appear only when the report is ready; otherwise a blocking reason is announced as an alert. "Prepare bookkeeping JSON" button; exclusions and limitations listed. |

**Mockup reference:** *Northstar Ventures Financial Reports.png*.
- Reject: Schedule Reports, the "business insights" wording, the FY picker, and "Transaction History" as a report (the transactions CSV lives in TX-01).
- The mockup has no cash movement, General Ledger, capital, payments, loans or Exchange sections.
- A separate list-then-detail layout is a proposal only (Q8).

**Exchange (RP-09) findings:**
- **E-a:** the description says "for your CPA **or tax** workpapers". The limitations list correctly says "Not a tax return…", but "tax workpapers" should be cleared by the owner.
- **E-b:** after the report is recalculated, an old share notice can remain on screen. The notice is cleared on refresh (`:110-111`), so this is low risk.

**Accept:**
- Exchange is blocked unless the business, the dates and the calculated report all match.
- The JSON contains only income and operating-expense totals.
- Cancelling the share sheet produces the honest "nothing left this device" message.
- An invalid date range blocks Update and every export.

### More

| ID | Screen | Spec | Issues |
|---|---|---|---|
| **MO-01** | More | Three cards: Accounts and reconciliation (primary button), Settings and privacy, and a data-control statement | The mockups' roles, notifications, reset/delete and iCloud items are rejected and correctly absent. |
| **AC-01** | Accounts and reconciliation | Create account (opening balance offsets to Opening Balance Equity); balances; income/expense category accounts; manual reconciliation (start, mark cleared, complete only when the difference is zero, reopen the latest); statement history; audit line | Matches the *Accounts & Reconciliation* mockup's structure without bank-feed tabs. **A-a:** "Mark cleared" changes saved data with no undo hint (it can be toggled back). **A-b:** the audit trail is joined into one line with middle dots, which reads poorly with a screen reader. |
| **SET-01** | Settings | Business profile (read-only); single-member policy; Workspaces; Reminders; Bookkeeping periods (close/reopen require a reason, audit list); Privacy; Development storage and recovery tools | The *Secure & Private* mockups' app-lock, biometrics, iCloud, analytics and delete-data controls are rejected and correctly absent. **S-a:** "Close books through date" runs immediately with no confirmation (Q5). WorkspacesSection and RemindersSection were inventoried but not reviewed in detail. |

## 4. Decisions and open questions for the owner

1. **Q1:** Should the search close control be the header button or the back button? Recommendation: keep the header toggle and drop the back button.
2. **Q2:** Should onboarding default to multi-member with the 40/20/20/20 split prefilled, or to a neutral starting state?
3. **Q3:** Where should third-party loans be reachable from (Members, More or Reports)?
4. **Q4:** Should tabs get icons? This is optional polish, not a fix.
5. **Q5:** Should these actions get a confirmation or preview step: TX-04 reverse and replace, MB-03 reverse payment, SET-01 close period?
6. **Q6:** Date entry is free-text YYYY-MM-DD everywhere. Keep it, or approve a native date picker?
7. **Q7:** Approve the wording "encrypted" (BOOT-01) and "tax workpapers" (E-a).
8. **Q8:** Should Reports become a list with separate detail screens, as in the mockup, or stay a single picker? Recommendation: keep it as is.
9. **Q9:** How should the dashboard tile period be handled (D-a)? Options: label the tiles "All time", or follow the Reports period.
10. **Minor source fixes, each needing separate approval:** D-b, D-c, D-d, T-a, T-b, M-a, L-a, A-b, and the "No transactions" empty state in TX-01.
11. **Evidence gap:** there are **no native captures** of any screen yet. All 31 PNGs are mockups. Device acceptance hasn't been done.

**Optional notes from the skill's style guidance, not mandatory:** "PRIVATE · ON DEVICE" is an all-caps label joined with a middle dot, and many detail lines are built as `A · B · C` strings. Both are generic patterns the skill warns about. They're readable as they are; I'm only flagging them.

**Exact acceptance for this package:** the owner approves or rejects each screen ID above and answers Q1–Q9. Nothing gets implemented until there's authenticated owner approval of a hashed copy of the written artifact. This review exists only in this chat, so if you need a hashed artifact it has to be written in a write-authorized task.

---

## 5. Workflow review: `autonomous-foundry/docs/design-discovery-workflow.md`

**WORKFLOW_REVIEW: PASS** with non-blocking findings. This reviews the workflow only. It is not approval of any screen.

I reviewed the file's content. I couldn't confirm the `040bb48` commit SHA because this session has no shell.

**Strengths:**
- It is clearly a fallback that requires proof the primary skill is absent.
- It is read-only, forbids inventing approvals, and returns BLOCKED instead of pretending to have run.
- It requires a clear split between implemented, proposed and out-of-scope screens.
- It covers each screen's full spec plus empty, error and loading states.
- It keeps native captures separate from mockups, uses synthetic data only, and requires owner approval of exact hashes before any code is written.

**Findings, ranked:**
- **F1 (do before invoking):** it doesn't say which source wins when inputs conflict. Add: "Current application source at the recorded SHA overrides prior design documents; domain, accounting and privacy rules override mockups." This repo already has stale docs (see section 1), so without the rule a fallback run could repeat their wrong claims. Putting it in the invocation prompt also works.
- **F2:** the evidence it records should include the product repository, branch and source SHA, not just "input manifest hash". It should also name the hash algorithm and define what goes into the manifest.
- **F3:** "work read-only" sits alongside "produce a catalog" without saying where the output goes. It should name an output location outside the product repo, or say the result is response-only.
- **F4:** it doesn't define what counts as an "independent review" or how the approval is recorded (who reviewed, the file hash, the date).
- **F5:** it doesn't explicitly ban builds, launching other agents, or sending screenshots or data to external services. "Read-only" implies this but doesn't state it.

---

## Final status

| Item | Status |
|---|---|
| Task status | Complete. Read-only discovery and the workflow review were delivered in this chat. |
| Repository / branch | LLCBookKeepingPrivate, `feature/visual-review-20261106`, HEAD `ae6754b` at session start (not re-checked) |
| Files changed | None. No commits or pushes. |
| Tests | None run (outside a read-only review) |
| Merge | Not applicable |
| Local-only assets | None created |

**Sync statement:** I made no repository changes, so there was nothing to sync. I also didn't verify the remote branch SHA myself. For that reason I'm not giving either sync statement: "REMOTE SYNC VERIFIED" would claim a check I didn't run. Workspace reset readiness wasn't assessed (`WORKSPACE_RESET_NOT_SAFE` until it's audited).
