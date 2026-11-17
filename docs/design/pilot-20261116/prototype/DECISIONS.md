# Visual Design Pilot Decisions (2026-11-16)

## 1. CPA Workpapers and Representation Claims
- **Decision**: Replace unqualified reference claims like "CPA-ready" with precise, legally defensible wording: "clear bookkeeping workpapers for a CPA" or "CPA workpapers".
- **Governance Rationale**: In accordance with `CLAUDE.md`, the application is an offline bookkeeping tool for business owners, not a CPA firm, tax return preparer, or guarantor of tax outcomes. Promising that records are automatically tax-ready or filing-compliant creates regulatory exposure.
- **Implementation**: Feature card 3 on `OB-01` and informational disclaimers in `OB-02`/`OB-03` clearly state that reports represent bookkeeping records intended for CPA review.

## 2. Retention and Scope of the Tax Classification Selector
- **Decision**: Retain the visual tax-classification selector on screen `OB-02` per the Owner's explicit 2026-11-16 instruction, but replace the mockup's misleading "Partnership (default)" with an honest unset choice: "Unknown / not yet determined".
- **Governance Rationale**: Single-member and multi-member LLCs have distinct default classifications under IRS rules (disregarded entity vs. partnership), but owners may elect corporate taxation (Form 8832 / 2553). Inferring a tax classification or election without CPA consultation violates the product boundary.
- **Data Architecture**: Tax classification is treated strictly as self-reported metadata for reports, not an active database election. No native database schema migration is implemented in this design-only pilot.

## 3. Strict Separation of Ownership from Tax and Economic Allocations
- **Decision**: Ownership percentages are displayed and recorded strictly as governance/equity ownership interests. They do NOT dictate automatic income, expense, profit, loss, or cash distribution allocations.
- **Governance Rationale**: Partnership tax rules (IRC Subchapter K) permit special allocations that often differ from nominal ownership percentages. Assuming ownership equals allocation produces incorrect capital ledgers and misleading CPA workpapers.
- **Implementation**: `OB-03` requires explicit owner confirmation of ownership interests and provides prominent disclaimer banners explaining that ownership is not a profit/tax allocation rule.

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
