#!/usr/bin/env python3
"""Technical exports only. Requires Python 3 and Pillow 11.3.0.
Run from any directory; originals are never modified. No AI or artwork edits.
"""
from pathlib import Path
import hashlib
import json
import re
from PIL import Image, ImageCms, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / 'assets/branding'
SOURCE = BRAND / 'source'
OUT = BRAND / 'exports'
PREVIEW = BRAND / 'previews'

# Fail before exporting if the approved intake no longer matches its manifest.
for line in (BRAND / 'README.md').read_text().splitlines():
    match = re.match(r'\| [A-F] \| `([^`]+)`.*`([0-9a-f]{64})` \|$', line)
    if match:
        filename, expected = match.groups()
        assert hashlib.sha256((SOURCE / filename).read_bytes()).hexdigest() == expected, filename

OUT.mkdir(exist_ok=True)
PREVIEW.mkdir(exist_ok=True)
profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
exports = [
    ('LLC_Apple_default_icon_1024_1024.png', 'app-icon.png', 1024, 'RGB'),
    ('LLC_Android_foreground_transparent_1024_1024.png', 'android-foreground.png', 1024, 'RGBA'),
    ('LLC_Android_smooth_blue_background_1024_1024.png', 'android-background.png', 1024, 'RGB'),
    ('LLC_Android_monochrome_foreground.png', 'android-monochrome.png', 1024, 'RGBA'),
    ('LLC Document Security Icon.png', 'google-play.png', 512, 'RGBA'),
]
manifest = {}
for original, filename, size, mode in exports:
    with Image.open(SOURCE / original) as source:
        # Untagged source RGB is interpreted as sRGB. Resize the entire canvas;
        # do not crop, reposition, pad, recolor, or repair the supplied artwork.
        image = source.convert(mode).resize((size, size), Image.Resampling.LANCZOS)
        image.save(OUT / filename, optimize=True, icc_profile=profile)
    with Image.open(OUT / filename) as result:
        assert result.size == (size, size) and result.mode == mode
        assert result.info.get('icc_profile') == profile
        if filename == 'google-play.png':
            assert result.getextrema()[3] == (255, 255)
            assert (OUT / filename).stat().st_size <= 1024 * 1024
    manifest[filename] = {
        'source': original, 'width': size, 'height': size, 'mode': mode,
        'bytes': (OUT / filename).stat().st_size,
        'sha256': hashlib.sha256((OUT / filename).read_bytes()).hexdigest(),
    }
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

# Illustrative masks only: launchers control actual scale, mask and tint.
size = 240
background = Image.open(OUT / 'android-background.png').convert('RGBA').resize((size, size))
foreground = Image.open(OUT / 'android-foreground.png').resize((size, size))
composite = Image.alpha_composite(background, foreground)
mono = Image.open(OUT / 'android-monochrome.png').resize((size, size))
themed = Image.new('RGBA', (size, size), '#D4E4FF')
tint = Image.new('RGBA', (size, size), '#16345E')
tint.putalpha(mono.getchannel('A'))
themed = Image.alpha_composite(themed, tint)
board = Image.new('RGB', (1080, 650), '#EEEEEE')
draw = ImageDraw.Draw(board)
draw.text((24, 15), 'MASK PREVIEWS ONLY - NOT INSTALLED DEVICE EVIDENCE', fill='black')
for column, (label, shape) in enumerate([('Circle', 'circle'), ('Rounded square', 'round'), ('Square', 'square'), ('Themed alpha', 'circle')]):
    x = 20 + column * 265
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    if shape == 'circle':
        md.ellipse((0, 0, size-1, size-1), fill=255)
    elif shape == 'round':
        md.rounded_rectangle((0, 0, size-1, size-1), radius=54, fill=255)
    else:
        md.rectangle((0, 0, size-1, size-1), fill=255)
    draw.text((x, 48), label, fill='black')
    board.paste(themed if column == 3 else composite, (x, 72), mask)
app = Image.open(OUT / 'app-icon.png').resize((size, size))
play = Image.open(OUT / 'google-play.png').convert('RGB').resize((size, size))
board.paste(app, (20, 370))
board.paste(play, (285, 370))
draw.text((20, 342), 'iOS full-square export', fill='black')
draw.text((285, 342), 'Play full-square export', fill='black')
draw.text((560, 380), 'No foreground correction applied.', fill='black')
draw.text((560, 405), 'Themed preview uses supplied alpha.', fill='black')
draw.text((560, 430), 'Cutouts and safe-area limits remain.', fill='black')
board.save(PREVIEW / 'mask-contact-sheet.png', icc_profile=profile, optimize=True)
print(json.dumps(manifest, indent=2))
