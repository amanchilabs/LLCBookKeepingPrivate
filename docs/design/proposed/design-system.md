# Consolidated Design System Proposal

Status: design recommendation only. No app tokens or components were changed. This system follows the approved direction: warm, welcoming surfaces; navy financial typography; restrained emerald actions; and a distinct premium bookkeeping identity. Values are proposed starting tokens inferred from the mockups and direction, not measured from an existing production design system.

## Design principles

1. **Financial facts lead.** Put the balance, basis, date range, account/member context, and record state beside each other. Use decoration only when it does not compete with amounts or labels.
2. **One source of truth.** Summaries and reports must explain their source and period. Screens must not suggest that ownership determines income, capital, or loan balances.
3. **Local-first is visible and literal.** Describe on-device storage and explicit sharing accurately. Do not depict cloud sync, bank links, analytics, or member access as available.
4. **Correctable, never silently mutable.** Posted events show their audit lineage and offer a correction path using reversal/replacement where supported. No destructive delete affordance on posted financial events.
5. **Warm but restrained.** Cream/warm-neutral backgrounds and soft surfaces can add approachability; navy provides hierarchy; emerald is reserved for primary actions and positive states. Avoid full-screen gradients, stock landscapes, oversized logos, or decorative charts that reduce data density.
6. **Native in behavior.** Preserve platform conventions for date pickers, keyboard types, system sharing and back navigation, while using a shared component language.

## Foundations and tokens

| Token | Proposed value | Use |
|---|---|---|
| Canvas | `#F7F5F0` | Warm app background; keep forms and data panels distinct from it. |
| Surface | `#FFFFFF` | Primary cards, sheets, form groups. |
| Surface subtle | `#F1F3EF` | Secondary grouping and selected navigation. |
| Ink / navy | `#14243B` | Main headings, body text, financial values. |
| Muted ink | `#526174` | Secondary labels; maintain readable contrast. |
| Emerald | `#087A55` | Primary actions, selected tab, positive state. |
| Emerald dark | `#07583F` | Pressed/strong action treatment where contrast passes. |
| Emerald tint | `#E7F3EC` | Selection and success backgrounds. |
| Border | `#D9E0DC` | Card and input outlines; do not rely on border alone for grouping. |
| Expense/error | `#B42318` | Errors and expense direction when paired with labels/icons. |
| Warning | `#8A5A00` | Needs review/overdue/statement difference, with text label. |
| Info accent | `#285D8F` | Informational labels, only when semantically useful. |

These are initial proposals. Verify contrast against actual rendered colors and both light/dark platform settings before implementation. Avoid pale green text on white, red/green-only distinctions, and saturated green gradient backgrounds.

## Typography

- Use the platform system sans family for a coherent native feel and dynamic type: SF on iOS and Roboto on Android. Do not bundle a typeface until there is a measured need.
- Use a small type scale with explicit roles: page title 28–32sp/pt semibold; section heading 20–22; card title 16–18; body 16; field label 14–16; helper/caption 13–14. These are target minimums for readability, not pixel-perfect requirements.
- Use tabular numerals for currency and aligned financial columns when the platform supports them. Keep signs and currency symbols visible. Never distinguish values by color alone.
- Limit serif or display type to a possible welcome headline; do not mix it into bookkeeping forms, tables, or reports.
- Respect system text scaling without clipping labels, numbers, focus indicators, or bottom navigation. Allow long LLC/member/account names to wrap.

## Layout, spacing, and surfaces

- Use a 4-point base spacing scale: 4, 8, 12, 16, 24, 32. Default page gutter 16–20; group related fields; use 24–32 between major sections.
- Use 12–16 corner radii consistently for cards and controls. Prefer a subtle border and minimal shadow; avoid multiple nested cards and excessive pill styling.
- Keep forms in a single logical column on phones. Put short date/amount pairs side by side only when labels remain readable and the platform width allows it.
- Use inline section expansion or a focused secondary screen only when a workflow warrants it. The current app uses long scrolling panels; the proposed design should reduce mixed-task density without adding several levels of navigation.
- On wider screens, constrain reading width and use two columns for independent summary/form panels. Keep report rows legible; do not stretch body copy edge-to-edge.

## Buttons and controls

- One filled emerald primary action per visible task area; secondary actions use outlined or low-emphasis surface styles. Destructive actions use a clear warning/red treatment only for nonfinancial settings with explicit confirmation. No delete button for posted journal activity.
- Buttons need a 44pt iOS / 48dp Android target where practical, visible focus/pressed/disabled states, and text labels for critical actions. Icons may accompany labels but should not replace them.
- Use platform date pickers or validated ISO-date entry with a visible format hint. Use decimal numeric keyboards for money and percentages; retain validation text adjacent to the field.
- Selection chips need selected state conveyed by text, shape, and accessibility state, not color alone. Filter state must be visible and provide a one-action Clear filters control.
- Confirmation dialogs are reserved for actions with material effect: create/post, reverse/replace, close/reopen a period, restore, or other destructive/security operation. State what persists and what will change.

## Financial data, lists, and status

- Every financial figure has context: label, currency, range/as-of date, cash/book basis, and whether it is a balance, movement, obligation, or actual payment.
- Use a stable row hierarchy: description/member/account; date and category; kind/status; amount. On narrow screens, use stacked rows rather than a clipped spreadsheet.
- State colors are semantic and paired with text: Posted, Reversed, Replacement, Open, Completed, Difference, Overdue, Needs review. A reversal/replacement relationship is navigable in both directions.
- Totals must be visibly separated from detail rows. Opening balances must not be styled as income or owner contributions. Transfers affect account cash movements but net to zero across accounts and do not enter P&L.
- Show ownership, contributed capital, book capital, guaranteed-payment obligation/paid amounts, loan commitment, funded principal, principal repayment, and paid interest as separate measures.
- Tables should label each numeric column and provide readable ordering at narrow widths. Do not use donut charts to suggest allocation; charts are optional and supplementary.

## Forms and validation states

- Labels remain visible above inputs; placeholder text is an example, never the only label. Preserve typed values after validation errors.
- Put field-level validation near the input and a concise form-level summary near the primary action. Announce errors and success messages to assistive technology.
- Provide explicit loading, saved, retry, and no-results states. Empty states explain the next valid action; they do not imply that data is missing due to a sync issue.
- For percentage totals, show current total and the exact 100% rule before save. Do not silently normalize values or auto-allocate by ownership.
- For posted transactions, the correction form identifies the original and previews the reversal/replacement relationship before posting.

## Navigation and iconography

- The proposed phone shell uses five stable bottom destinations: Dashboard, Transactions, Members, Reports, More. Keep labels visible; selected state uses emerald tint plus text weight and accessibility selection.
- Use a consistent outline icon set with the same stroke weight and optical size. Pair icons with text for primary actions. Avoid the mockup’s chartmark branding as a substitute for a recognized action icon.
- Native back behavior should return to the last parent without losing an unsubmitted draft silently. When leaving a dirty form, ask whether to discard.
- More is a clearly labeled utility destination, not a miscellaneous dump: Accounts, Settings, and local backup/recovery are grouped there. Avoid hidden gestures for critical workflows.

## Accessibility and responsive behavior

- Meet WCAG 2.2 AA contrast targets for text and non-text controls; verify with rendered color pairs. Essential small text should not depend on thin weight.
- Support VoiceOver and TalkBack names, roles, values, focus order, selected/expanded/error state, live validation announcements, and logical headings.
- Respect reduce motion, system font scaling, display zoom, light/dark appearance, and platform contrast settings. No information may depend on animation.
- Keep touch targets at least 44×44pt iOS and 48×48dp Android where feasible; provide adequate spacing around adjacent destructive/primary controls.
- Avoid fixed-height cards and horizontally clipped financial tables. On tablets/web, use responsive columns while preserving the same labels, policy notes, and audit relationships.
- Keyboard traversal and screen-reader reading order must match the visual sequence. Test date, money, and percentage input with platform accessibility services.

## Platform adaptation

| Surface | iOS | Android | Shared rule |
|---|---|---|---|
| Bottom navigation | Native safe-area inset and tab-bar convention | Navigation bar inset and touch sizing | Keep five destinations and persistent labels; no overlap with home indicator/gesture bar. |
| Back/cancel | Navigation back / sheet dismissal convention | System back handling | Preserve draft or offer an explicit discard choice; do not silently post. |
| Date and share | Native date picker and Share Sheet | Native date picker and Android Sharesheet | User explicitly chooses exports or backup destinations; never sync automatically. |
| Forms | SF metrics and keyboard behavior | Roboto metrics and IME behavior | Shared content order and validation, platform-native sizing. |
| Wide layout | iPad split-friendly panels | Tablet/resizable width | Constrain content width and keep report totals near detail. |

## Reuse and boundaries

The same token and content model can support responsive web presentation later, but mobile remains local-first and independent of authentication/backend. A web renderer must not imply that mobile records upload or sync. Reuse domain/accounting policies only after a separate technical review; no web storage decision is made here.
