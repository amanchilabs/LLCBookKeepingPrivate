# Visual Design Pilot Decisions (2026-11-16)

## 1. CPA Workpapers and Privacy/Security Representation Claims (PENDING Owner C Decision)
- **Status**: Proposal only — PENDING Owner C Decision. Not settled or legally defensible.
- **Proposal**: Qualify reference claims like "CPA-ready" and device-only privacy claims with prototype wording ("clear bookkeeping workpapers for a CPA").
- **Governance Rationale**: In accordance with `CLAUDE.md`, the application is an offline bookkeeping tool for business owners, not a CPA firm, tax return preparer, or guarantor of tax outcomes. Final claim copy requires explicit Owner C decision.
- **Implementation**: Feature card 3 on `OB-01` and informational disclaimers in `OB-02`/`OB-03` present prototype proposal text pending owner review.

## 2. Retention and Scope of the Tax Classification Selector (PENDING Owner C Decision)
- **Status**: Metadata proposal only — PENDING Owner C Decision. Not settled or legally determined.
- **Proposal**: Retain the visual tax-classification selector on screen `OB-02` per the Owner's explicit 2026-11-16 instruction, with an honest unset choice: "Unknown / not yet determined".
- **Governance Rationale**: Single-member and multi-member LLCs have distinct default classifications under IRS rules, but owners may elect corporate taxation. Classification options are strictly self-reported metadata proposals pending Owner C decision.
- **Data Architecture**: No database schema migration or automatic tax determination is implemented.

## 3. Strict Separation of Ownership from Tax and Confirmation Placement (PENDING Owner C Decision)
- **Status**: UI placement proposal only — PENDING Owner C Decision. Not settled.
- **Proposal**: Ownership percentages represent governance/equity interests only. Explicit owner confirmation checkbox is positioned in the visual gap near y594 without displacing the CTA.
- **Governance Rationale**: Partnership tax rules permit special allocations differing from equity percentages. Confirmation placement and exact policy remain pending Owner C approval.
- **Implementation**: `OB-03` positions the functional confirmation checkbox near y594 with disclaimer banners explaining ownership is not an allocation rule.

## 4. Historical Bookkeeping Start Date & Pre-Formation Expenses
- **Decision**: Allow the bookkeeping start date to precede the legal formation date.
- **Governance Rationale**: LLC founders frequently incur legitimate pre-formation startup expenses (e.g. state filing fees, legal fees, domain registrations) before the state officially stamps the certificate of formation. Forbidding an earlier books start date forces founders to misdate initial transactions.
- **Implementation**: The date pickers enforce valid ISO calendar dates (`YYYY-MM-DD`) but do not reject bookkeeping start dates prior to legal formation.

## 5. Progress Indicator Harmonization (5-Step Model)
- **Decision**: Present the 5-stage progress indicator matching the canonical screenshots (1: Welcome, 2: Your LLC, 3: Members & Ownership, 4: First Account, 5: Review), concluding the 3-screen pilot at `OB-03` and summarizing results in an interactive draft view.
- **Governance Rationale**: Reconciles the visual mockup's 5-stage progress nodes with the current 4-step native wizard. Screens 4 (First Account) and 5 (Review) remain future native onboarding steps.
- **Skip Navigation**: Clicking `Skip` on `OB-01` advances to `OB-02` with empty fields and does not create silent records.

## 6. Asset Packaging & DOM Vector Rendering
- **Decision**: Implement all cards, forms, waves, icons, and buttons as real CSS, SVG, and DOM elements rather than embedding full-screen reference screenshots.
- **Governance Rationale**: Full-screen raster embedding prevents accessibility validation, responsive scaling, and interaction testing. Real DOM construction allows direct measurement of anchor coordinates and verifiable state transitions.
- **Logo Asset**: Uses `<img src="assets/welcome-mark.png">` with an automatic vector SVG fallback to ensure flawless presentation regardless of environment.
