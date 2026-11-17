# Visual Design Pilot Decision Recommendations (2026-11-16)

> **Notice**: All items in this document represent builder decision recommendations and prototype proposals submitted for Owner review. None of these items constitute approved Owner decisions, legal advice, tax determinations, or accessibility certifications.

## 1. CPA Workpapers and Privacy/Security Representation Claims (PENDING Owner C Decision)
- **Status**: Proposal only — PENDING Owner C Decision. Not settled or legally defensible.
- **Proposal**: Qualify reference claims like "CPA-ready" and device-only privacy claims with prototype wording ("clear bookkeeping workpapers for a CPA").
- **Governance Rationale**: In accordance with `CLAUDE.md`, the application is an offline bookkeeping tool for business owners, not a CPA firm, tax return preparer, or guarantor of tax outcomes. Final claim copy requires explicit Owner C decision.
- **Implementation**: Feature card 3 on `OB-01` and informational disclaimers in `OB-02`/`OB-03` present prototype proposal text pending owner review.

## 2. Retention and Scope of the Tax Classification Selector (PENDING Owner C Decision)
- **Status**: Metadata proposal only — PENDING Owner C Decision. Not settled or legally determined.
- **Proposal**: Retain the visual tax-classification selector on screen `OB-02` per the Owner's explicit 2026-11-16 instruction, with an honest unset choice: "Unknown / not yet determined".
- **Governance Rationale**: Single-member and multi-member LLCs have distinct default classifications under IRS rules, but owners may elect corporate taxation. Classification options are strictly self-reported metadata proposals pending Owner C decision.
- **Data Architecture & Persistence**: Tax classification is self-reported metadata only; future persistence is classified B/C. No native database schema migration or automatic tax determination is implemented.

## 3. Strict Separation of Ownership from Tax and Confirmation Placement (PENDING Owner C Decision)
- **Status**: UI placement proposal only — PENDING Owner C Decision. Not settled.
- **Proposal**: Ownership percentages represent governance/equity interests only. Explicit owner confirmation checkbox is positioned in the visual gap near y594 without displacing the CTA.
- **Governance Rationale**: Partnership tax rules permit special allocations differing from equity percentages. Confirmation placement and exact policy remain pending Owner C approval.
- **Implementation**: `OB-03` positions the functional confirmation checkbox near y594 with disclaimer banners explaining ownership is not an allocation rule.

## 4. Bookkeeping Start Date and Formation Date (Existing Native Domain Rule)
- **Status**: Reflection of existing native domain behavior, NOT a new business rule or prototype decision.
- **Specification**: In existing native `assertValidBusinessSetup`, dates are validated as valid calendar dates without requiring bookkeeping start to follow formation date. The prototype reflects this existing domain validation without inventing new ordering constraints.

## 5. Progress Indicator and Skip Semantics (UNRESOLVED Discrepancy — PENDING Owner C Decision)
- **Status**: Discrepancy unresolved — PENDING Owner C Decision (NOT harmonized or approved).
- **Discrepancy**: Canonical reference mockups show 5-stage progress nodes and 6 dots on Welcome, whereas the native onboarding wizard implements 4 steps (`setupStepLabels`). This discrepancy is documented as unresolved pending Owner decision.
- **Skip Semantics**: Exact Skip semantics remain PENDING Owner C Decision. Reference Skip does not authorize silently creating invalid records. In the prototype, clicking Skip on `OB-02` or `OB-03` validates required fields and blocks incomplete setup without creating a workspace, preserving entered values and providing inline explanation.

## 6. Asset Packaging & DOM Vector Rendering
- **Decision**: Implement all cards, forms, waves, icons, and buttons as real CSS, SVG, and DOM elements rather than embedding full-screen reference screenshots.
- **Governance Rationale**: Full-screen raster embedding prevents accessibility validation, responsive scaling, and interaction testing. Real DOM construction allows direct measurement of anchor coordinates and verifiable state transitions.
- **Logo Asset**: Uses `<img src="assets/welcome-mark.png">` with an automatic vector SVG fallback to ensure flawless presentation regardless of environment.
