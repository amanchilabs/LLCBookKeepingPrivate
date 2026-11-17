# Visual Design Pilot Decision Recommendations (2026-11-16 — Revision R2d)

> **Notice**: All items represent builder decision recommendations and prototype proposals submitted for Owner review. None of these items constitute approved Owner decisions, legal determinations, tax elections, or accessibility certifications.

## 1. CPA Workpapers and Privacy/Security Claims (PENDING Owner C Decision)
- **Status**: Proposal only — PENDING Owner C Decision. Legal adequacy is **UNVERIFIED**.
- **Proposal**: Qualify reference claims ("CPA-ready", device-only storage) with qualified prototype wording ("clear bookkeeping workpapers for a CPA").
- **Governance Rationale**: In accordance with `CLAUDE.md`, the app is an offline bookkeeping tool for business owners, not a CPA firm or guarantor of tax outcomes. Final claim copy requires explicit Owner C decision.

## 2. Retention and Scope of the Tax Classification Selector (PENDING Owner C Decision)
- **Status**: Proposal only — PENDING Owner C Decision. Not settled.
- **Context**: The actual native `BusinessSetupScreen.tsx` includes welcome plus 4 numbered steps and has **NO field for tax classification**.
- **Proposal**: Retain the visual selector on `OB-02` per explicit instruction, offering an honest unset choice: "Unknown / not yet determined".
- **Architecture**: Self-reported metadata proposal only. No native database schema migration, tax determination, or entity election is implemented or inferred.

## 3. Separation of Ownership Equity from Tax Allocations & Confirmation (PENDING Owner C Decision)
- **Status**: UI placement proposal — PENDING Owner C Decision. Not settled.
- **Proposal**: Ownership percentages represent equity/governance interests only, not IRS tax or profit/loss allocation rules. Explicit confirmation checkbox is positioned at y594 with associated allocation disclaimers.
- **Governance Rationale**: Partnership tax rules permit special allocations differing from equity interests. Placement and exact disclaimer copy remain pending Owner approval.

## 4. Bookkeeping Start Date & Formation Date Ordering (Native Domain Rule)
- **Status**: Direct reflection of existing native domain behavior (`assertValidBusinessSetup`), NOT a new prototype rule.
- **Specification**: Validates valid calendar dates (`YYYY-MM-DD`) without requiring bookkeeping start to follow formation date, allowing pre-formation startup expenses.

## 5. Progress Indicator Discrepancy & Skip Semantics (PENDING Owner C Decision)
- **Status**: Unresolved discrepancy — PENDING Owner C Decision.
- **Discrepancy**: Authoritative reference mockups show 5-stage progress nodes and 6 dots on Welcome, whereas native onboarding implements 4 steps (`setupStepLabels`).
- **Skip Semantics**: Skip does not authorize silently creating invalid records. In the prototype, Skip on `OB-02`/`OB-03` validates required fields and blocks incomplete setup without creating a workspace, preserving entered values.

## 6. Viewport 372×732 Target & Responsive Viewport Fit (320px–430px)
- **Status**: Architectural presentation disclosure.
- **Specification**: Prototype capture specimen is strictly 372×732 CSS pixels matching the reference frame. Normal review mode responsively scales outer wrapper and phone presentation to fit viewports from true 320px through 430px without horizontal clipping or scrolling, keeping 372px logical design. No mobile, device, or accessibility certification is claimed.
