# Visual Design Pilot Coverage Matrix (2026-11-16)

## Summary of Scope
This matrix documents every visual element, form field, interactive control, and state transition authored in the 2026-11-16 design pilot across screens `OB-01`, `OB-02`, and `OB-03`.

### Classification Legend
- **A (Visual Parity)**: Faithfully reconstructs approved owner raster references within the 372×732 CSS viewport.
- **B (New UI Function)**: Interactive browser prototype capability (e.g. interactive calendar picker, multi-workspace isolation).
- **C (Governance / Product Decision)**: PENDING Owner C Decision (prototype proposal only; not settled or legally defensible).

---

## Detailed Element & Control Mapping

| Ref Location | Element / Control | Prototype Behavior | Native Implementation | Class | Future Persistence Gap | Test / State Verification |
|---|---|---|---|:---:|---|---|
| **OB-01 (132,68)** | App Logo Squircle | Displays `assets/welcome-mark.png` with fallback vector SVG squircle | No welcome screen route in current app (`BusinessSetupScreen` starts at step 1) | A | None (static visual asset) | `window.pilot.goto('OB-01', 'default')` |
| **OB-01 (186,178)** | Brand Title | Centered bold navy label `LLCBookKeepingPrivate` | None | A | None | Measured DOM anchor at y≈178px |
| **OB-01 (186,187)** | Brand Accent Bar | 36×3.5px emerald pill bar `#009c3f` | None | A | None | Render check |
| **OB-01 (186,242)** | Hero Headline | Serif title `Private bookkeeping for your LLC` | None | A | None | Checks serif font family and line wrap |
| **OB-01 (186,321)** | Intro Subtitle | Explains local-first single and multi-member LLC app | None | A | None | Copy verification |
| **OB-01 (30,378)** | Feature Card 1 | Lock icon + `Your books stay on your device` | Informational text in `BusinessSetupScreen` | A | None | Verification of local-only storage notice |
| **OB-01 (30,442)** | Feature Card 2 | Offline icon + `Works offline` | Informational text | A | None | Offline operation notice |
| **OB-01 (30,504)** | Feature Card 3 | Group icon + `Built for real LLCs` (CPA workpapers) | Informational text | C | None | Replaces unqualified 'CPA-ready' with workpapers |
| **OB-01 (24,619)** | Get Started CTA | Emerald gradient button; navigates to `OB-02` | `moveTo('business')` | A | In-memory navigation | `click` opens OB-02 |
| **OB-01 (330,14)** | Skip Action | Green top-right link; advances to `OB-02` without creating records | None | C | No silent record creation | Navigates to OB-02 with empty fields |
| **OB-01 (186,680)** | Pager Indicator | 5 dots with active first dot | None | A | Visual parity | Dot index 0 active |
| **OB-02 (20,14)** | Back Chevron | Navigates back to `OB-01` | `back()` | A | Preserves draft values | Back button click preserves state |
| **OB-02 (186,14)** | Step Indicator | Text `2 of 5` | `setupStepLabels` (1 of 4 in native) | C | Harmonizes reference 5-step with wizard | Text verification |
| **OB-02 (186,98)** | Step Progress Bar | 5 nodes (Node 1 checkmark, Node 2 active, Nodes 3-5 gray) | `SetupProgress` component | A | Presentation only | Progress width 25% |
| **OB-02 (20,125)** | Header Icon | 52×52px squircle with bank/building icon | None | A | Visual parity | Render check |
| **OB-02 (87,133)** | Header Title | `Your LLC` and subtitle | `Heading` component | A | Visual parity | Render check |
| **OB-02 (14,201)** | Legal Name Input | Text input for legal LLC name; updates draft in real-time | `Field` name input | A | Stored in `BusinessSetupInput.name` | `updateDraft('name', 'Acme LLC')` |
| **OB-02 (14,270)** | Formation State Trigger | Dropdown button displaying selected state; opens modal | Text input for 2-letter code | B | Stored in `formationState` (normalized 2-letter) | `openModal('state')` |
| **OB-02 (Modal)** | State Picker Modal | Searchable list of 50 states + DC + grouped territories | None (native typed 2 letters) | B | Normalizes state name to 2-letter code | `selectState('DE')` updates display and code |
| **OB-02 (14,338)** | Formation Date Trigger | Calendar picker trigger showing `Jan 15, 2024` | Text input `YYYY-MM-DD` | B | Stored as ISO `YYYY-MM-DD` | `openModal('formation-date')` |
| **OB-02 (Modal)** | Formation Calendar | Interactive month calendar with prev/next controls | None | B | Validated via `assertValidCalendarDate` | Day cell click sets date and closes modal |
| **OB-02 (186,338)** | Books Start Date Trigger | Calendar picker trigger showing `Jan 1, 2025` | Text input `YYYY-MM-DD` | B | Stored as ISO `YYYY-MM-DD` | `openModal('books-date')` |
| **OB-02 (Modal)** | Books Date Calendar | Interactive month calendar with prev/next controls | None | B | Books start may precede formation date | Selects valid ISO date |
| **OB-02 (14,408)** | Classification Trigger | Dropdown showing `Unknown / not yet determined` | Omitted in native `BusinessSetupScreen` | C | Unpersisted metadata; requires future schema | `openModal('tax-classification')` |
| **OB-02 (Modal)** | Classification Modal | 5 options: Not selected, Unknown, Disregarded, Partnership, Corp | None | C | Proposed self-reported metadata | Selection updates draft |
| **OB-02 (14,507)** | Settings Info Banner | Notes tax classification can be updated in Settings | None | A | Visual parity with reference | Render check |
| **OB-02 (24,627)** | Continue CTA | Validates business name; advances to `OB-03` | `continueFromCurrentStep()` | A | In-memory draft progression | Advances to OB-03 on valid input |
| **OB-02 (Error)** | Inline Validation Banner | Displays error when name is missing; keeps valid inputs | `FormError` | A | Non-destructive validation | `goto('OB-02', 'validation-error')` |
| **OB-03 (20,14)** | Back Chevron | Navigates back to `OB-02` without data loss | `back()` | A | Preserves draft values | Back button click preserves state |
| **OB-03 (186,14)** | Step Indicator | Text `3 of 5` | Step 2 of 4 in native | C | Harmonized 5-step model | Text verification |
| **OB-03 (186,98)** | Step Progress Bar | Node 1 check, Node 2 check, Node 3 active | `SetupProgress` | A | Progress width 50% | Render check |
| **OB-03 (17,115)** | Header Icon | 52×52px squircle with members icon | None | A | Visual parity | Render check |
| **OB-03 (82,120)** | Header Title | `Members & Ownership` | `Heading` component | A | Visual parity | Render check |
| **OB-03 (16,196)** | Mode Segmented Toggle | Multi-member vs Single-member pill toggle | `Choice` component | A | Stored in setup draft | Toggles between multi and single modes |
| **OB-03 (16,239)** | Template Banner | Magic wand + `Use 4-member template (40/20/20/20)` | `createSuggestedMembers` | A | Populates suggested member array | Click injects 4 members totaling 100% |
| **OB-03 (17,285)** | Member Rows | Initials avatar, name input, percent input, menu button | Dynamic member panels | A | Stored in `MemberInterestInput[]` | Real-time percent recalculation |
| **OB-03 (Row Menu)** | Member Row Menu | Overflow menu with `Remove Member` action | Remove button | A | Removes member; switches to single if 1 left | Member removed on click |
| **OB-03 (16,457)** | Total Ownership Row | Shows total with live checkmark or warning indicator | `formatPercent(ownershipTotal)` | A | Validated via `assertOwnershipTotals` | Warning displayed when total != 100% |
| **OB-03 (16,484)** | Add Member Action | Pill button adding an empty member row | `addMember()` | A | Appends member draft | Adds new row to member list |
| **OB-03 (16,514)** | Confirmation Checkbox | Explicit checkbox: `I confirm these ownership interests...` | `ownershipConfirmed` checkbox | C | Clears on any edit; required before save | Resets to unchecked on member change |
| **OB-03 (14,534)** | Member Policy Banner | Notes ownership must total 100% | `uiStyles.rowDetail` | A | Visual parity | Render check |
| **OB-03 (24,635)** | Continue CTA | Disabled unless total == 100% and confirmed; opens Summary | `continueFromCurrentStep()` | A | Validates 100% and confirmation | Disabled when invalid; proceeds to Summary |
| **Summary** | Workspace Summary Card | Shows legal name, jurisdiction, dates, classification, members | Review step in native | B | In-memory summary | Render check |
| **Summary** | Add Another LLC | Clears current draft, starts new empty LLC, preserves first | Workspaces list in Settings | B | Tests multi-workspace isolation | Proves LLC 1 not mutated by LLC 2 |
