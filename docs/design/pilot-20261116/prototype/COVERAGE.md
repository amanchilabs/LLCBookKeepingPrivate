# Visual Design Pilot Coverage Matrix (2026-11-16 — Revision R2d)

## Scope & Classification
- **A (Visual Parity)**: Faithfully reconstructs authoritative owner raster references within the 372×732 CSS viewport.
- **B (Prototype UI Function)**: Browser design interaction capability (e.g. interactive calendar, workspace isolation).
- **C (Governance / Decision)**: Proposal PENDING Owner C Decision (legal adequacy UNVERIFIED; not settled).

## Field, Control & Native Gap Matrix

| Ref / Screen | Element / Control | Prototype Behavior | Native Implementation (`BusinessSetupScreen.tsx`) | Class | Persistence & Architecture Gap | Verification State |
|---|---|---|---|:---:|---|---|
| **OB-01 (132,68)** | App Logo Squircle | `assets/welcome-mark.png` with vector SVG fallback | Welcome step with 'Get started' action | A | Static asset | `OB-01 default` |
| **OB-01 (186,178)** | Brand Title | Bold navy label `LLCBookKeepingPrivate` | None | A | None | Measured y≈178 |
| **OB-01 (186,187)** | Brand Accent Bar | 52×3.5px emerald pill bar `#009c3f` | None | A | None | Render check |
| **OB-01 (186,242)** | Hero Headline | Serif title `Private bookkeeping for your LLC` | None | A | None | Serif check |
| **OB-01 (186,321)** | Intro Subtitle | Local-first bookkeeping explanation | None | A | None | Copy check |
| **OB-01 (30,378)** | Feature Card 1 | `Your books stay on your device` | Informational text | C | Device-only privacy claims PENDING Owner C Decision | Visual parity |
| **OB-01 (30,442)** | Feature Card 2 | `Works offline` | Informational text | A | None | Visual parity |
| **OB-01 (30,504)** | Feature Card 3 | `Built for real LLCs` (CPA workpapers) | Informational text | C | CPA workpapers claim copy PENDING Owner C Decision | Visual parity |
| **OB-01 (24,619)** | Get Started CTA | Emerald gradient button; advances to `OB-02` | `moveTo('business')` | A | In-memory navigation | `goto('OB-02')` |
| **OB-01 (330,52)** | Skip Action | Green top-right link; advances to `OB-02` without records | None | C | Skip semantics PENDING Owner C Decision | Navigates empty |
| **OB-01 (186,680)** | Pager Indicator | 5 dots with active first dot | None | A | Visual parity | Dot 0 active |
| **OB-02 (20,52)** | Back Chevron | Navigates back to `OB-01` | `back()` | A | Preserves draft values | Back click |
| **OB-02 (186,52)** | Step Indicator | Text `2 of 5` | Step 1 of 4 in native wizard (`setupStepLabels`) | C | 5-stage reference vs 4-step native PENDING Owner C Decision | Text check |
| **OB-02 (186,98)** | Step Progress Bar | 5 nodes (Node 1 check, Node 2 active) | `SetupProgress` component | A | Presentation only | Width 25% |
| **OB-02 (20,125)** | Header Icon | 52×52px squircle with building icon | None | A | Visual parity | Render check |
| **OB-02 (87,133)** | Header Title | `Your LLC` and subtitle | `Heading` component | A | Visual parity | Render check |
| **OB-02 (14,201)** | Legal Name Input | Text input; per-field validation with `aria-invalid` | `Field` name input | A | Stored in `BusinessSetupInput.name` | `updateDraft('name')` |
| **OB-02 (14,289)** | Formation State Trigger | Button opening accessible modal; normalizes 2-letter | Native text field typed 2 letters | B | Stored in `formationState` (2-letter code) | `openModal('state')` |
| **OB-02 (Modal)** | State Picker Dialog | Searchable 50 states + DC + territories (`role="dialog"`) | None | B | Focus contained; Tab/Shift+Tab trap | State selection |
| **OB-02 (14,357)** | Formation Date Trigger | Leading calendar icon; triggers interactive calendar | Text input `YYYY-MM-DD` | B | Stored as ISO `YYYY-MM-DD` | `openModal('formation-date')` |
| **OB-02 (Modal)** | Formation Calendar | Interactive month calendar with trapped focus | None | B | `assertValidCalendarDate` | Day cell click |
| **OB-02 (186,357)** | Books Date Trigger | Leading calendar icon; triggers interactive calendar | Text input `YYYY-MM-DD` | B | Stored as ISO `YYYY-MM-DD` | `openModal('books-date')` |
| **OB-02 (Modal)** | Books Date Calendar | Interactive month calendar with trapped focus | None | B | Books start may precede formation date | Day cell click |
| **OB-02 (14,427)** | Classification Trigger | Dropdown showing `Not selected` / `Unknown` | Omitted in native `BusinessSetupScreen.tsx` | C | Native model has NO classification field; future B/C | `openModal('tax-classification')` |
| **OB-02 (Modal)** | Classification Dialog | 5 self-reported options (`role="dialog"`) | None | C | Self-reported metadata proposal only | Selection updates draft |
| **OB-02 (14,507)** | Settings Info Banner | Notes classification can be updated in Settings | None | A | Visual parity | Render check |
| **OB-02 (14,575)** | Inline Validation Banner | Per-field error alert; highlights only invalid inputs | `FormError` | A | Non-destructive validation | `OB-02 validation-error` |
| **OB-02 (24,627)** | Continue CTA | Validates OB-02 fields; advances to `OB-03` | `continueFromCurrentStep()` | A | In-memory progression | Advances to OB-03 |
| **OB-03 (20,52)** | Back Chevron | Navigates back to `OB-02` without data loss | `back()` | A | Preserves draft values | Back click |
| **OB-03 (186,52)** | Step Indicator | Text `3 of 5` | Step 2 of 4 in native wizard | C | Step count discrepancy PENDING Owner C Decision | Text check |
| **OB-03 (186,98)** | Step Progress Bar | Node 1 check, Node 2 check, Node 3 active | `SetupProgress` | A | Presentation only | Width 50% |
| **OB-03 (17,115)** | Header Icon | 52×52px squircle with members icon | None | A | Visual parity | Render check |
| **OB-03 (82,120)** | Header Title | `Members & Ownership` | `Heading` component | A | Visual parity | Render check |
| **OB-03 (17,196)** | Mode Segmented Toggle | Multi-member vs Single-member pill toggle | `Choice` component | A | In-memory draft mode | Mode switch |
| **OB-03 (17,239)** | Template Banner | `Use 4-member template (40/20/20/20)` | `createSuggestedMembers` | A | Explicit apply only | Injects 4 members |
| **OB-03 (17,285)** | Member List Card | Dynamic rows (avatar initials, name, %, menu) | Dynamic member panels | A | Stored in `MemberInterestInput[]` | Row edits |
| **OB-03 (17,457)** | Total Ownership Row | Single-line total + circular emerald check badge | `formatPercent(ownershipTotal)` | A | Validated via `assertOwnershipTotals` | Live validation |
| **OB-03 (73,484)** | Add Member Action | Pill button adding an empty member row | `addMember()` | A | Appends member draft | Adds new row |
| **OB-03 (17,594)** | Confirmation Checkbox | Explicit checkbox; does not infer tax allocation | `ownershipConfirmed` checkbox | C | Ownership ≠ tax allocation disclaimer PENDING Owner C Decision | Checked before submit |
| **OB-03 (17,534)** | Member Policy Banner | Notes ownership must total 100% | `uiStyles.rowDetail` | A | Visual parity | Render check |
| **OB-03 (17,566)** | Error Banner | Reflows cleanly without overlapping controls | `FormError` | A | Alert role; orderly reflow | `OB-03 blocked` |
| **OB-03 (24,635)** | Continue CTA | Disabled unless total==100% and confirmed | `continueFromCurrentStep()` | A | Non-mutating save; preserves single/multi | Advances to COMPLETE |
| **COMPLETE** | Workspace Summary | Displays actual saved LLC facts without mutation | Native Review step | B | In-memory summary | Single-member preserved |
| **COMPLETE** | Add Another LLC | Clears draft, creates independent secondary LLC | Workspaces list in Settings | B | Proves draft 2 does not mutate workspace 1 | Isolation check |
