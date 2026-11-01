# Design and Product Decisions

Status key: **Approved constraint** comes from the product direction supplied for this review. **Recommendation** is the proposed design resolution. **Open** requires product review before implementation.

## Decisions applied to the consolidated proposal

| Topic | Decision | Basis |
|---|---|---|
| Visual identity | Warm-neutral canvas, navy information hierarchy, restrained emerald actions, premium financial tone. | Approved hybrid aesthetic in the assignment; exact token values remain provisional in `design-system.md`. |
| Mobile navigation | Recommend five bottom tabs: Dashboard, Transactions, Members, Reports, More. Place Accounts/Reconciliation under More; guaranteed payments and loans in member context; Settings and explicit recovery under More. | Consolidates the proposed five-tab shell and keeps accounting relationships visible. |
| Search | Keep global record search available without a permanent sixth tab; expose a labeled search action in the shared header on every primary tab. Transactions also has focused filters. | Preserves the current all-record search capability and five-tab proposal. Needs usability confirmation. |
| Onboarding tax classification | Remove the proposed tax-classification selector and “Partnership default.” Use business facts only; show neutral CPA-review guidance if needed. | Current profile does not store tax classification; an app default can imply tax advice or an election. |
| Ownership and allocation | Ownership percentage is an ownership interest only. Do not auto-allocate income, profit, loss, contributions, or distributions according to ownership. | Accounting/data integrity; current member allocation mockups are misleading. Separate interests require explicit future policy and records. |
| Opening balance | Label the offset as Opening Balance Equity; never call the bank opening balance an owner contribution unless a separately confirmed capital transaction is recorded. | Current account service and journal policy. |
| Capital | Only dated contribution/distribution activity appears in member capital ledger. Do not include loan balances or guaranteed-payment obligations/actual payments in capital. Book capital does not establish tax basis/outside basis. | Existing domain separation and CPA review boundary. |
| Guaranteed payments | Present obligation/installments separately from actual cash payments. Unpaid obligation has no cash/bank effect and is not a cash-basis expense. Actual payment is journaled and may be reversed with audit history. | Current source posting model and approved bookkeeping policy. |
| Loans | Separate commitment, funded advances, outstanding principal, principal repayment, and paid interest. Loan proceeds are not income; principal repayments are not expense; debt is not capital. Display the explicit stored day-count policy. | Current loan engine and financial correctness gates. Do not auto-select rates or state deductibility. |
| Posted transactions | Remove direct delete and direct edit. Use a traceable reversal and replacement flow, keeping the original, reversal, and replacement visible. | Audit-history requirement and current correction service. |
| Tax/CPA labels | Use “bookkeeping report,” “cash-basis,” “book basis,” or “CPA workpaper” as applicable. Never “Tax Ready,” tax return, filing, or guaranteed compatibility. | Product boundary; reports are not tax computations or filing outputs. |
| Privacy | No cloud sync, automatic cloud backup, bank connections, analytics, advertising, external financial-data processing, or multi-user member permissions. Exports and backup are explicit user-initiated local file/share operations. | Approved privacy boundary. Remove conflicting iCloud/analytics/member-access UI. |
| Security language | Show only claims supported by current release evidence. SQLCipher/key-storage and encrypted-backup foundations do not mean app lock/biometrics are implemented or production security gates are complete. | Existing security/recovery release gates. |
| Single-member behavior | Use owner equity contributions/distributions; hide/disable partnership guaranteed-payment and profit/loss allocation flows. Owner labor and classification require CPA review. | Prior product decision; no automatic tax classification. |
| Destructive settings | Do not design reset/archive/delete as a casual More-menu action. Any data destruction needs explicit scope, strong confirmation, backup/recovery policy, and separate approval. | Data-integrity and recovery boundary. |

## Canonical screenshot selections

| Screen | Canonical image | Chosen because | Corrections required before use |
|---|---|---|---|
| Welcome | `Private LLC Bookkeeping Onboarding.png` | Clear first-launch privacy and start action. | Remove unsupported “CPA-ready”; make privacy wording precise. |
| LLC setup | `LLC Setup Onboarding Screen.png` | Direct business fact form. | Remove tax selector/default. |
| Member setup | `LLC Members and Ownership Setup.png` | Makes suggested four-member template and total visible. | Make confirmation explicit; separate ownership from allocation. |
| First account | `First Account Setup Onboarding Screen.png` | Account kind/name/opening balance is immediately understandable. | State Opening Balance Equity offset; optional skip must be explicit. |
| Setup review | `LLC Onboarding Review Screen.png` | Lets user verify persisted profile before create. | Account only appears if actually included; no silent assumptions. |
| Setup complete | `LLC Workspace Ready Screen.png` | Distinct completion and dashboard handoff. | Do not promise unavailable tour/reports. |
| Dashboard | `LLC Financial Dashboard Overview.png` | Populated state exposes cash, P&L and recent activity. | Correct opening balance label and reversal sign/context; remove avatar/notification if unsupported. |
| Transactions | `LLC Transactions Dashboard (1).png` | Search, visible filters, grouped records and totals. | Show correction links and filter clearing; no mock totals claim. |
| New transaction | `LLC Bookkeeping Add Transaction Screen.png` | Simpler form hierarchy than default ownership allocation variant. | Remove member allocation panel. |
| Transaction detail | `Transaction Details and Member Allocation.png` | Full metadata and audit history are easier to scan. | Remove member allocation, Edit and Delete; keep only correction flow and audit links. |
| Members | `LLC Members Ownership Dashboard.png` | Clear list of names, ownership and contribution amounts. | Keep ownership and contributed capital separate; no roles. |
| Member capital | `Member Capital Ledger Dashboard.png` | Best dated ledger structure. | Remove loans/guaranteed payment from capital and role/contact claims. |
| Guaranteed payments | `Modern Guaranteed Payments Dashboard.png` | Separates obligation balance and paid history most clearly. | Clarify unpaid/noncash vs paid; classify services/use-of-capital; no auto-posting. |
| Member loan | `Member Loan Overview Dashboard.png` | Shows principal, payments and history as a distinct feature. | Commitment vs funded amount, explicit date-count and principal/interest; no tax claims. |
| Accounts/reconciliation | `Accounts & Reconciliation Dashboard.png` | Groups account list and statement matching. | Remove any implication of bank connection; label book vs statement amounts. |
| Reports landing | `Northstar Ventures Financial Reports.png` | Standard report list is easy to discover. | Remove scheduled reports; show available report set and basis/date. |
| P&L | `Profit & Loss Statement Dashboard.png` | Clear detail hierarchy and category totals. | Label cash basis/date; replace send action with system share; avoid unapproved margin. |
| Balance sheet | `LLC Balance Sheet Report Detail.png` | Clear assets/liabilities/equity grouping. | Fix $40 arithmetic mismatch; remove “Final” and ownership-inferred capital. |
| More/settings | `LLCBookKeeping More Settings Screen.png` | Most useful grouping for company, categories, exports and preferences. | Remove permissions, destructive management, unsupported settings/notifications. |
| Privacy/security | `Secure & Private LLC Bookkeeping Settings.png` | Clear separation of access, protection and privacy. | Remove app-lock claims until implemented; remove iCloud and analytics; no casual delete. |

## Open decisions before visual implementation

1. **Search entry point:** The recommendation is a global header search action plus transaction-local filters. Confirm whether a dedicated Search page should remain reachable as a route for full cross-record results.
2. **Onboarding sequence:** Confirm whether first account is optional during onboarding (recommended: allow skip, then prominently offer account creation before posting) and whether the welcome intro can be skipped without losing required business setup.
3. **Member-detail hierarchy:** Confirm if guaranteed payments and loans should be tabs inside a member detail or clearly labeled sections within a single page. The visual model should not hide obligations or debt inside capital.
4. **Sample content:** Replace or validate every illustrative total before production mockups. The current screenshots use inconsistent totals/signs; synthetic records need a single reconciled fixture. Do not use the $40-mismatched balance-sheet sample.
5. **Security and backup presentation:** Decide final wording only after current release gates are complete. No app-lock toggle, cloud backup, or member authorization should be designed as available now.
6. **Dark mode:** Establish whether the first redesign must support dark mode. The current image set only shows a light visual treatment; no evidence establishes dark-mode assets or behavior.
7. **Web reuse:** Responsive token/layout reuse is recommended, but web identity, authentication, storage, and synchronization are separate decisions. This review does not authorize remote financial storage or mobile sync.

## Rejected concepts in current mockups

- Default member allocation or allocation amount computed from ownership.
- Guaranteed payments or loan balances rolled into capital.
- Opening cash balance classified as owner contribution without an explicit capital record.
- Direct editing/deleting of posted financial transactions.
- Tax classification defaults, tax-ready export labels, tax calculations, or deductibility statements.
- Member roles/permissions, “authorized members,” identity avatars, or shared access.
- iCloud/automatic backup, analytics/usage tracking, or automatic exports.
- “CPA-ready” or “tax-ready” claims that exceed the supported report/workpaper scope.
