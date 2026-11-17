# Visual Design Pilot Rationale (2026-11-16 — Revision R2d)

## 1. Authority, Scope & Governance
- **Authority**: Bounded authorization under `CAP-BOOK-DESIGN-PILOT-20261116`. Authoring design artifacts only; final state remains `WAITING_APPROVAL`.
- **Authoritative References vs Proposals**: Reconstructs authoritative owner raster references (`Private LLC Bookkeeping Onboarding.png`, `LLC Setup Onboarding Screen.png`, `LLC Members and Ownership Setup.png`). Proposal designs are NOT approved; no human owner or native certification is claimed.
- **Pure Design Artifacts**: Pure HTML5/CSS3/JavaScript. No native code, database migrations, remote network endpoints, or external dependencies.
- **Legal Adequacy & Representation Claims**: Legal adequacy of copy is **UNVERIFIED**. Device-only privacy claims, CPA workpapers representations, and tax classification options represent builder prototype proposals **PENDING Owner C Decision**.

## 2. Geometric Anchors & Raster Reconstruction
- **Viewport**: Fixed `372 × 732 CSS pixels` (DPR2 `744 × 1464`), mapping the (140, 36, 744, 1464) reference app screen crop.
- **Narrow Viewport (320px) Limitation**: Target viewport is fixed 372px. In review mode on viewports narrower than 372px (e.g. 320px mobile or 347px test frames), horizontal scrolling occurs unless scaled. 320px zero-scroll is an explicit limitation, NOT certified.
- **Key Measured Anchors**:
  - `OB-01`: Logo squircle at (132, 68), brand title y≈178, emerald accent bar width 52px (corrected from outdated 36px), serif hero headline y≈242 (font 31/line 34), feature cards x30/y378/442/504 (h52/52/62), primary CTA x24/y619 (w324, h48), 5 pager dots at y680. Mid-wave features a vertical gradient fading to near-white behind cards.
  - `OB-02`: Nav at top (h54); progress track at y98; icon at (20,125); title at (87,133); form card at (14,201,w346,h292); name label y220/input y236; state label y289/input y305; paired dates labels y357/inputs y373; classification label y427/input y445 (h40, ends at 485 within card bottom 493); info banner at y507; CTA at (24,627,w324,h48).
  - `OB-03`: Header icon (17,115); title (82,120); mode toggle y196; template banner y239; member list card (17,285,w338,h160); total row y457 with circular check badge; add member y484; info banner y534; confirmation checkbox y594; CTA y635 (h44). Error states reflow orderly to prevent banner collisions.

## 3. Disclosed Minor Visual Variations
- **Vector Icons & Fallbacks**: Rendered with lightweight inline SVG rather than full-screen raster embeds.
- **Calendar Leading Icon**: Calendar triggers feature leading calendar SVGs and right chevrons matching references.
- **Circular Total Check Badge**: Validation indicator features a circular emerald badge `✓` on valid 100% total, and a warning badge on imbalance.
- **Feature Text Wrapping & Logo Boundary**: Disclosed slight differences in system typography wrap and logo container squircle compared to native photographic frame.

## 4. Interaction Architecture & Accessibility
- **Accessible Dialogs**: State, calendar, and classification pickers implement `role="dialog"`, `aria-modal="true"`, descriptive `aria-labelledby` headers, and Escape/Tab focus containment without inerting the parent phone container.
- **Validation**: Per-field validation tracks individual field errors (`name`, `state`, `formationDate`, `booksDate`) with `aria-invalid` and `aria-describedby`, preventing false highlights.
- **Data Preservation**: Legitimate single-member and multi-member data are strictly preserved across navigation. Normal navigation to `COMPLETE` summary does NOT overwrite saved workspaces with demo templates.
