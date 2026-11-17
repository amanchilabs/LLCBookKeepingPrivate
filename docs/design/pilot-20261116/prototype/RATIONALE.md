# Visual Design Pilot Rationale (2026-11-16)

## 1. Authority, Scope & Governance
- **Authority**: Bounded authorization under `CAP-BOOK-DESIGN-PILOT-20261116` approved on 2026-11-16. Final state remains `WAITING_APPROVAL`.
- **Scope**: Authoring standalone, browser-rendered visual design artifacts (`index.html`, `RATIONALE.md`, `COVERAGE.md`, `DECISIONS.md`). Native UI implementation, schema migrations, and storage modifications are strictly forbidden.
- **Dependencies**: Pure, self-contained HTML5, CSS3, and JavaScript. No external fonts, CDN assets, or network endpoints are utilized.
- **Privacy & Security**: Zero remote financial transmissions or data capture. Complies with the local-only, synthetic-only principles mandated in `CLAUDE.md`.

## 2. Geometric Anchors & Raster Reference Reconstruction
Reconstruction maps the canonical reference screenshots (`Private LLC Bookkeeping Onboarding.png`, `LLC Setup Onboarding Screen.png`, `LLC Members and Ownership Setup.png`), each sized 1024×1536 px.
- **Viewport Geometry**: The external photographic frame is cropped to the app screen area `(x: 140, y: 36, w: 744, h: 1464)`.
- **Scale Factor**: 2x DPR mapping to `372 × 732 CSS pixels` (`(x-140)/2, (y-36)/2`).

### Measured Coordinate Comparison Table
| Screen | Element | Reference (px) | CSS Target (px) | Prototype Implementation |
|---|---|---|---|---|
| **OB-01** | App Logo Squircle | (404, 172) 216×200 | (132, 68) 108×100 | `.ob01-logo-squircle` at (132, 68), centered, 98×98 px with 22px border radius |
| **OB-01** | Brand Name | y ≈ 392, font 40 | y ≈ 178, font 19.5 | `.ob01-brand` at y≈178, bold navy #07152f, letter-spacing -0.3px |
| **OB-01** | Accent Bar | y ≈ 410, w 76 | y ≈ 187, w 36 | `.ob01-green-bar`, 36×3.5 px rounded pill, #009c3f |
| **OB-01** | Hero Headline | y ≈ 520, font 62 serif | y ≈ 242, font 29.5 serif | `.ob01-hero`, font-family New York/Georgia serif, line-height 33.5px |
| **OB-01** | Intro Text | y ≈ 678, font 32 | y ≈ 321, font 15 | `.ob01-intro`, line-height 21px, #4a5568 |
| **OB-01** | Feature Card 1 | x 60, y 792, w 636, h 104 | x 30, y 378, w 318, h 52 | `.ob01-card`, 52px height, 14px radius, #e8f5ed icon tile |
| **OB-01** | Feature Card 2 | x 60, y 920, w 636, h 104 | x 30, y 442, w 318, h 52 | `.ob01-card`, offline symbol, #e8f5ed tile |
| **OB-01** | Feature Card 3 | x 60, y 1044, w 636, h 104 | x 30, y 504, w 318, h 52 | `.ob01-card`, members symbol, #e8f5ed tile |
| **OB-01** | Primary CTA | x 48, y 1274, w 648, h 96 | x 24, y 619, w 324, h 48 | `.ob01-cta`, emerald gradient #009c3f to #005f3b, 24px radius |
| **OB-01** | Pager Dots | y ≈ 1396 | y ≈ 680 | `.ob01-dots`, 5 dots, first active green |
| **OB-02** | Progress Bar | y ≈ 232 | y ≈ 98 | `.progress-track`, 5-step track with checkmark node 1, active node 2 |
| **OB-02** | Page Icon | (40, 286) 110×110 | (20, 125) 55×55 | `.page-icon-squircle`, 52×52 px, #e8f5ed background, building icon |
| **OB-02** | Page Title | (174, 302) font 56 | (87, 133) font 25 | `.page-title`, bold navy, letter-spacing -0.3px |
| **OB-02** | Form Card | x 28, y 438, w 692, h 584 | x 14, y 201, w 346, h 292 | `.form-card`, white card with 16px radius, border 1px #e2e8e5 |
| **OB-02** | Name Field | y 476 label / y 508 input | y 220 label / y 236 input | `.form-input`, height 40px, rounded 8px |
| **OB-02** | State Field | y 614 label / y 646 input | y 289 label / y 305 input | `.form-select-trigger`, opens full US state picker modal |
| **OB-02** | Paired Dates | y 750 labels / y 782 inputs | y 357 labels / y 373 inputs | 2-column grid, triggers interactive calendar modals |
| **OB-02** | Classification | y 890 label / y 926 input | y 427 label / y 445 input | Classification selector with honest unset/unknown option |
| **OB-02** | Info Banner | y ≈ 1050 | y ≈ 507 | `.info-banner`, #eef7f2 background, #23503b text |
| **OB-02** | Primary CTA | x 48, y 1290, w 648, h 96 | x 24, y 627, w 324, h 48 | `.screen-cta`, emerald gradient button |
| **OB-03** | Page Icon | (34, 266) 108×108 | (17, 115) 54×54 | `.page-icon-squircle`, members icon |
| **OB-03** | Page Title | (164, 276) font 46 | (82, 120) font 22 | `.page-title`, bold navy |
| **OB-03** | Mode Toggle | y ≈ 428, h ≈ 68 | y ≈ 196, h ≈ 34 | `.member-toggle`, segmented Multi/Single pill control |
| **OB-03** | Template Row | y ≈ 514, h ≈ 70 | y ≈ 239, h ≈ 35 | `.template-banner`, magic wand icon + 40/20/20/20 split |
| **OB-03** | Member List | x 34, y 606, w 676, h 320 | x 17, y 285, w 338, h 160 | `.members-card`, avatar initials, name, percent, overflow menu |
| **OB-03** | Total Check | y ≈ 950 | y ≈ 457 | `.total-ownership-row`, live validation + checkmark/warning |
| **OB-03** | Add Member | y ≈ 1004 | y ≈ 484 | `.add-member-btn`, pill button |
| **OB-03** | Info Banner | y ≈ 1104 | y ≈ 534 | `.info-banner`, ownership notice |
| **OB-03** | Primary CTA | y ≈ 1306, h ≈ 88 | y ≈ 635, h ≈ 44 | `.screen-cta`, Continue button disabled if total != 100% |

## 3. Design Tokens & Visual Hierarchy
- **Canvas & Surfaces**: Primary canvas uses clean, welcoming neutral `#f7f9f8`; cards and sheets use pure white `#ffffff` with subtle borders (`#e2e8e5`) and 14–16px radii.
- **Typography**: Information hierarchy anchored by deep navy (`#07152f`), with secondary labels in muted slate (`#5e6d7a`). The Welcome hero headline retains the classic serif style (`"New York", Georgia, serif`) to establish trust, while functional forms use the native sans-serif system stack.
- **Action Color**: Primary actions feature the approved emerald gradient (`#009c3f` to `#005f3b`), reserved exclusively for primary progress controls (`Get Started`, `Continue`).
- **Accent & Decorative Elements**: Organic mint wave graphics (`#eaf5ee`) subtly accent corners without compromising financial data readability.

## 4. Interaction Architecture & Deterministic Testing
- **`window.pilot` Global API**: Exposes `goto(screenId, state)` and `getState()`, enabling full programmatic navigation and inspection.
- **Capture Mode (`?capture=1`)**: Automatically positions the 372×732 phone viewport at `(0, 0)` and hides demo/review toolbars, allowing clean, pixel-exact DPR2 rendering (744×1464).
- **Accessible Pickers**:
  - State selector features all 50 US states, DC, and grouped territories (AS, GU, MP, PR, VI), with real-time text search filtering.
  - Formation and bookkeeping date pickers feature interactive calendar modals supporting month-to-month traversal.
  - Tax classification selector provides honest self-reported choices without inferring automatic elections.
- **Multi-Member Editing**: Full dynamic list supporting addition, deletion, name updates, percentage changes, and a one-click 40/20/20/20 template.

## 5. Workspace Isolation & Preservation
- **Non-Destructive Navigation**: Entered form inputs are preserved in-memory across back-navigation and error states.
- **Multi-Workspace Isolation**: The summary view supports creating independent secondary LLC drafts, ensuring draft 2 changes do not mutate workspace 1.
