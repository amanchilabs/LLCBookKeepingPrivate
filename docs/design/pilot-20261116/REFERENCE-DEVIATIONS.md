# Bookkeeping pilot — measured reference comparison and remaining deviations

Review candidate R2f; exact owner approval remains pending. Browser artifact only; native UI unchanged.

## Method

All three actual supplied owner images were loaded and inspected. Originals are 1024x1536. The same documented crop x140,y36,w744,h1464 maps to 372x732 CSS pixels at DPR2. This consistently excludes most external photographic bezel; residual rounded-edge/device rendering differs. Each comparison/r2f/ directory contains equal-scale sideBySide, 50% overlay and difference PNGs, geometry.json and palette-and-dimensions.json. No universal similarity score or pixel-perfect equivalence is claimed. Reference anchors are approximate manual observations, not authoritative design-vector measurements.

## Geometry — CSS pixels

| Screen / element | Approximate reference x,y,w,h | Actual browser x,y,w,h | Delta x,y,w,h |
|---|---|---|---|
| OB-01 / logo | [132, 68, 108, 100] | [131, 68, 110, 100] | [-1, 0, 2, 0] |
| OB-01 / hero | [0, 242, 372, 68] | [0, 242, 372, 68] | [0, 0, 0, 0] |
| OB-01 / feature1 | [30, 378, 318, 52] | [30, 378, 318, 52] | [0, 0, 0, 0] |
| OB-01 / feature2 | [30, 442, 318, 52] | [30, 442, 318, 52] | [0, 0, 0, 0] |
| OB-01 / feature3 | [30, 504, 318, 62] | [30, 504, 318, 62] | [0, 0, 0, 0] |
| OB-01 / CTA | [24, 619, 324, 48] | [24, 619, 324, 48] | [0, 0, 0, 0] |
| OB-02 / form | [14, 201, 346, 292] | [14, 201, 346, 292] | [0, 0, 0, 0] |
| OB-02 / formation date | [29, 373, 153, 40] | [29, 373, 153, 40] | [0, 0, 0, 0] |
| OB-02 / books date | [191, 373, 153, 40] | [192, 373, 153, 40] | [1, 0, 0, 0] |
| OB-02 / info | [14, 507, 344, 50] | [14, 507, 346, 50] | [0, 0, 2, 0] |
| OB-02 / CTA | [24, 627, 324, 48] | [24, 627, 324, 48] | [0, 0, 0, 0] |
| OB-03 / member list | [17, 285, 338, 160] | [17, 285, 338, 160] | [0, 0, 0, 0] |
| OB-03 / total | [0, 457, 372, 20] | [17, 457, 338, 18] | [17, 0, -34, -2] |
| OB-03 / add member | [73, 484, 230, 36] | [73, 484, 230, 36] | [0, 0, 0, 0] |
| OB-03 / info | [14, 534, 344, 50] | [17, 534, 338, 50] | [3, 0, -6, 0] |
| OB-03 / CTA | [24, 635, 324, 44] | [24, 635, 324, 44] | [0, 0, 0, 0] |

The form frame, four-row selected member-list frame, Add Member action, welcome cards and CTA anchors are directly measured. Date controls retain a small approximately 2px vertical offset from the manual target. Text-baseline bounds and total-row width are not direct pixel-equivalence measures. Error layouts intentionally reflow to keep messages, confirmation and controls separate; their safety/accessibility adaptation requires owner review.

## Primary colors and visual regions

Declared prototype colors: navy #07152f; emerald CTA gradient #009c3f to #005f3b; white surfaces; sage wave #cef0d2 fading toward white. Declared welcome serif stack includes New York/Georgia; this does not identify the exact typeface used in a raster reference. Quantized color bins use 16-channel buckets with sparse samples and skip near-white pixels. They are descriptive checks, not a quality or similarity score.

- OB-01: reference leading bins 232,248,232, 8,8,8, 216,248,216, 8,120,56; proposal 232,248,232, 216,248,216, 8,24,40, 8,104,56.

- OB-02: reference leading bins 232,248,232, 8,8,8, 8,120,56, 8,72,40; proposal 216,248,216, 232,248,232, 216,248,232, 8,120,56.

- OB-03: reference leading bins 232,248,232, 8,8,8, 8,104,56, 8,88,56; proposal 232,248,232, 216,248,216, 104,184,136, 104,168,136.

Welcome retains logo, navy brand/accent, serif headline, three icon/text cards, green CTA, Skip and pager. The middle wave now fades rather than painting the card region flat mint. Setup retains the white upper region and a separate sage bottom wave. OB-02 includes all five owner-required fields and live picker surfaces. OB-03 retains modes, explicit template Apply, four complete editable rows, percentages, menus, total, Add Member and policy banner. No owner-required field was silently omitted.

## Remaining visible and functional differences

- A: exact photographic shadows, icon strokes, card gradients, font metrics and faint rectangular logo-crop boundary differ. These are disclosed refinements for owner judgment, not certified pixel parity or presumed unavoidable constraints.
- C: the reference welcome has six dots; the proposal has five. Native already has Welcome plus four numbered steps. Numbering/pager treatment remains explicitly unresolved.
- C: CPA/privacy/security claim wording is proposed and unverified; qualified copy preserves placement. The app must not imply professional certification or guaranteed tax readiness.
- C: formation/start date pickers preserve valid-calendar validation without a new ordering rule. Classification has an explicit unset/unknown option and is not derived from member count.
- B/C: native has no classification persistence field. Future enum/effective history, schema/API changes, migrations and recovery-format compatibility require separate development authorization. The design requirement itself is already authorized.
- C: ownership confirmation is preserved from existing behavior although absent in the reference. Its proposed location and resulting disabled/unconfirmed CTA appearance need exact review. Ownership is not automatic tax/profit allocation.
- C: Skip validates required setup rather than silently saving incomplete records; exact intended Skip behavior remains a decision.
- B/C: summary/workspace switching is a browser-memory demonstration of first and second LLC setup, not native persistence or completion of the subsequent account/review steps.
- C: the reference specimen remains 372x732 CSS pixels. Normal review presentation now fits true desktop browser widths320/372/375/430 with no horizontal document overflow and fully visible phone bounds; before/after evidence is preserved. This does not certify native responsiveness, 200% text, widgets, device or screen-reader acceptance.

## Evidence boundaries

The 33 browser checks include actual state/date/classification controls, retained inputs/back, strict percentages, explicit confirmation, two complete LLCs and switching, exact single-member preservation, safe text rendering, modal keyboard controls and error geometry. The before-fix regression and rejected revisions remain preserved. AI review is not human approval. No native financial/recovery/storage behavior or records were changed.
