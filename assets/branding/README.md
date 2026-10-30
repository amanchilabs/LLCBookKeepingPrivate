# Approved branding asset intake

Originals were copied from `/Users/veerrajuamanchi/Downloads/LLC` without modification. The source directory remains read-only and is not a build dependency. SHA-256 values below identify the copied originals.

| Mapping | Source file | Bytes | Actual format / dimensions | Alpha and profile | SHA-256 |
|---|---|---:|---|---|---|
| A | `LLCBookKeepingPrivate-master.svg` | 2,677 | SVG, 1024 × 1024 viewBox | Editable vector elements; no embedded raster, external references, or scripts | `e0de5138d362ae2976a80eb50f459fb8c1970387a010d076f0f68d4eeb16cf63` |
| B | `LLC_Apple_default_icon_1024_1024.png` | 1,497,618 | PNG, 1254 × 1254, RGB | Opaque; no embedded profile reported | `a59f791b453766d55428dcf3ed9dfb5eef15f9c8f8acaafc822492c17376a74a` |
| C | `LLC_Android_foreground_transparent_1024_1024.png` | 721,113 | PNG, 1254 × 1254, RGBA | Transparency present; no embedded profile reported | `666f8c93bbe1f44c737f2a373fcf5ce8c2d84cbd5cba1ff6b88b69482f3a33a9` |
| D | `LLC_Android_smooth_blue_background_1024_1024.png` | 1,439,355 | PNG, 1254 × 1254, RGB | Opaque; no embedded profile reported | `bfb28658490cad14fae2890d31688c1b43b77cd52f72997104f4135e537f8992` |
| E | `LLC_Android_monochrome_foreground.png` | 438,294 | PNG, 1254 × 1254, RGBA | Transparency present; no embedded profile reported | `bd3573a421436e5df3bf912e5c525f61ad9a4545a8313f2090f22e2865984677` |
| F | `LLC Document Security Icon.png` | 1,626,254 | PNG, 1254 × 1254, RGB | Opaque; no embedded profile reported | `030285647f568aba1c0a0b15080d95ecd86688977565d45f4918b202aedcca75` |

## Validation findings

- A contains SVG paths, rectangles, groups, gradients, and a drop-shadow filter. Its XML has no `<image>` or `<script>` element and no external `href`, so it is an editable vector master rather than a raster wrapper.
- B is full-square and opaque, with no alpha channel. It still needs a 1024 × 1024 technical downsample for the requested application export.
- C has transparency. At alpha ≥ 250 its visible bounds are approximately `(257, 248)` through `(1062, 1063)` on the 1254 × 1254 canvas. The central 626/1024 safe region is approximately 767 × 767 pixels, from 244 to 1010 on this canvas; the foreground therefore extends about 52 pixels beyond the right and bottom safe edges. Its artwork has not been scaled or moved.
- D is an opaque, full-canvas blue background visually compatible with C.
- E has transparency, but its opaque pixels contain multiple RGB colors and the preview shows speckled internal cutouts. It has not been converted into a replacement silhouette.
- F is the designated opaque, square store-art source. It exceeds 1024 KB and is not 512 × 512; no export has been derived yet.
- All five PNGs are 8-bit, non-interlaced. The supplied files have been preserved byte-for-byte under `assets/branding/source/`.

## Pending work

No application configuration or derived export has been changed yet. Technical resizing, the 512 × 512 sRGB RGBA Play export, app configuration, configuration checks, visual previews, and native install/build verification remain pending. Foreground safe-area correction and a clean monochrome source require an approved correction or direction before any material artwork change.
