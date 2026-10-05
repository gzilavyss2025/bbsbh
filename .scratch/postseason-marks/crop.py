# Crops the 2026 postseason marks (MLB, via monterosa CDN) to the mark alone:
# drops the sponsor and broadcaster rows, trims to the alpha bounds, and
# exports every mark at the same 192px height (3x a 64px display height).
# Run: python crop.py  (needs Pillow). Output: public/postseason-marks/2026/.
from PIL import Image
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'public', 'postseason-marks', '2026')
HEIGHT = 192
# Last row (inclusive) of the mark itself, before the sponsor line.
KEEP_THROUGH = {'al-wild-card': 308, 'nl-wild-card': 305, 'alds': 192,
                'nlds': 205, 'alcs': 224, 'nlcs': 246}

def trim(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    return im.crop(box)

def world_series(im):
    # Capital One sits between the script and the 2026 plate, under the
    # shield's tail. Erase it (x >= 120 below row 219), then lift the plate.
    top = im.crop((0, 0, im.width, 225)).copy()
    px = top.load()
    for y in range(219, 225):
        for x in range(120, top.width):
            px[x, y] = (0, 0, 0, 0)
    plate = im.crop((0, 275, im.width, 307))
    out = Image.new('RGBA', (im.width, 225 + 10 + plate.height), (0, 0, 0, 0))
    out.alpha_composite(top, (0, 0))
    out.alpha_composite(plate, (0, 225 + 10))
    return out

for name in ['al-wild-card', 'alds', 'alcs', 'world-series', 'nlcs', 'nlds', 'nl-wild-card']:
    im = Image.open(os.path.join(HERE, 'source', name + '.png')).convert('RGBA')
    im = world_series(im) if name == 'world-series' else im.crop((0, 0, im.width, KEEP_THROUGH[name] + 1))
    im = trim(im)
    w = round(im.width * HEIGHT / im.height)
    im = im.resize((w, HEIGHT), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, im.size)
