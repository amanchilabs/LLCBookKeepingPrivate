# UX Redesign Acceptance Criteria

These criteria apply to a future approved implementation. They are not claimed as passed by this screenshot review. Use synthetic records only until security/recovery release gates permit otherwise.

## Visual system and accessibility

- [ ] Approved colors/type/spacing/actions are implemented in shared components and used consistently across all canonical screens.
- [ ] Text and controls meet WCAG 2.2 AA contrast targets; color is never the sole signal for income/expense, status, error, or selection.
- [ ] iOS VoiceOver and Android TalkBack announce labels, roles, values, selected states, errors, and success messages in visual order.
- [ ] Text scaling/display zoom do not clip LLC names, member names, dates, currency values, buttons, or navigation.
- [ ] Touch targets meet 44pt iOS / 48dp Android goals for primary/critical actions; focus, pressed, disabled, and error states are visible.
- [ ] Layout works at narrow phone widths and tablet/resizable widths without clipped financial columns or fixed-height text. Safe areas and Android system bars do not overlap content.
- [ ] Dark mode is either implemented and verified or explicitly declared out of scope in the approved release spec; it must not render unreadable system-colored controls.

## Setup and members

- [ ] First launch clearly separates welcome from required business setup and does not create records until explicit confirmation.
- [ ] Business name, state, formation date, books start date, member names, and interests survive close/relaunch.
- [ ] Four-member suggestion is presented as a suggestion; user explicitly confirms 40/20/20/20 before save. Invalid totals block save, retain values, and show current/required total.
- [ ] Ownership changes use effective dates and preserve prior history; no existing historical percentage is silently overwritten.
- [ ] Ownership is never shown as automatic profit, income, loss, contribution, or distribution allocation.
- [ ] Single-member experience uses owner contributions/distributions as equity and does not present partnership guaranteed-payment/allocation flows; owner labor/classification has CPA-review wording.
- [ ] Setup review values exactly match the values saved. Skipping account setup creates no hidden account/opening entry.

## Accounts, transactions, and corrections

- [ ] Bank/cash account balances match persisted journal lines; opening balance posts a balanced entry against Opening Balance Equity.
- [ ] Income and operating expenses use fixed-precision money validation and create balanced journal entries; invalid/zero/negative values are rejected according to existing policy.
- [ ] Category splits sum exactly to transaction amount and are not member allocations.
- [ ] Transfers update source/destination cash, net to zero across cash accounts, and do not affect P&L.
- [ ] Search by description/category/account/date returns matching persisted rows; each filter works alone and in combination; Clear filters restores full history.
- [ ] A no-results state is distinct from an empty transaction history and gives a clear reset action.
- [ ] A posted transaction cannot be directly edited or deleted. Correction posts reversal and replacement, preserves original record, and presents all three with traceable links.
- [ ] Transaction details, dashboard activity, account balances, journal output, reports, and CSV reflect the same persisted entries and sign conventions.
- [ ] CSV export contains transaction date, category, amount, account, description, and any transfer/correction semantics needed for reconciliation; total/effects reconcile to the app. Export is user-initiated through system sharing.
- [ ] Import preview/validation, duplicate handling, and atomic import remain available; recurring templates never auto-post without the user’s explicit posting action.

## Member capital, payments, and loans

- [ ] Cash/property contributions and distributions persist with member, date, amount, and applicable account/description; their balanced journals move cash/equity as designed and do not inflate income/operating expenses.
- [ ] Member capital ledger and capital report equal journal-derived member capital activity. Property valuation is marked for CPA review; book capital is not described as tax/outside basis.
- [ ] Guaranteed-payment obligation creates dated obligation/installment state only; it has no bank balance, journal, or cash-basis P&L effect before actual payment.
- [ ] Actual guaranteed-payment event is allocated to obligation installments, posts a balanced cash/journal effect, appears in member history and cash-basis workpapers, and can be reversed with retained audit history.
- [ ] A loan commitment alone creates no principal/cash/income; each dated advance creates debt/cash; principal repayment reduces debt and is not expense; paid interest is separated and handled by existing policy.
- [ ] Loan summaries use actual outstanding principal, documented day-count conventions and as-of dates; no automatic tax rate, deductibility, or tax outcome is stated.
- [ ] Contributions, distributions, guaranteed payments, member loans, third-party loans, and ordinary expenses remain distinct in navigation and ledger/report outputs.

## Reconciliation, reports, and settings

- [ ] Manual reconciliation shows statement balance, book balance, cleared and uncleared items, and difference; completion/reopen does not change journal balances or create unexplained adjustments.
- [ ] P&L is visibly labeled cash basis and date range. Balance Sheet/Trial Balance/General Ledger are visibly labeled book basis/as-of date where appropriate.
- [ ] P&L, Balance Sheet, Trial Balance, General Ledger, Cash Movement, Member Capital, guaranteed-payment workpapers, loan workpapers, and exports reconcile to persisted journal/subledger records.
- [ ] Report period and as-of semantics are explicit; no “final” status appears without a defined persisted close state.
- [ ] CSV/PDF totals and displayed report totals match; external sharing requires explicit OS destination selection. No automatic email/scheduled/cloud export exists.
- [ ] Settings preserve local workspaces, reminders, period close/reopen audit and privacy/recovery access. Reminder state does not post a journal entry.
- [ ] Privacy copy makes no claim of multi-user access, cloud backup, automatic sync, bank connection, analytics, or app lock unless those capabilities are separately approved and verified.
- [ ] Existing encrypted database, key-storage, backup, restore, wrong-password/tamper, migration and recovery controls remain reachable and unchanged by visual work.

## Navigation and platform end-to-end

- [ ] Five proposed primary destinations are Dashboard, Transactions, Members, Reports, More, with a discoverable global Search action and local transaction filters.
- [ ] Accounts/reconciliation are reachable from More and Dashboard account summaries; guaranteed payments and loans are reachable from the member context; reports and explicit export are reachable from Reports.
- [ ] Common expense entry, capital contribution, member payment, and report export complete in no more than three transitions from the relevant primary surface.
- [ ] iOS and Android provide equivalent business labels, validation, data, and action outcomes while respecting native back, safe area, keyboard, date picker, and share sheet behavior.
- [ ] Full synthetic workflow persists after force-close/relaunch on both platforms; test records are not real user data.
- [ ] Actual iOS and Android execution evidence is labeled as simulator/emulator or physical-device evidence. A web preview or unit test does not satisfy mobile acceptance.

## Review and release evidence

- [ ] `npm test`, `npm run typecheck`, and `git diff --check` pass for implementation changes, along with focused domain/store tests required by changed behavior.
- [ ] There is no change to financial arithmetic/storage policy in a presentation-only PR; if a policy or schema change is necessary, stop and obtain a separate approved scope.
- [ ] Reviewers inspect a native screenshot gallery with default, empty, form, validation, confirmation, report, export, scrolling and error states.
- [ ] Feature-preservation matrix is updated with each phase and remaining gaps are named honestly.
- [ ] UX approval, security release approval, physical-device beta acceptance, and production release readiness are reported as separate statuses.
