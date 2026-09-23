# Reads s2/centre/{before,after}/boxes.json + the crops centre.mjs wrote, and
# prints how far each figure tag's glyphs sit from the centre of its pill.
#
#   python centre.py                 before and after
#   python centre.py trial           any phase folder by name
#
# The inner box is the tag's DOM box minus its border, in device pixels. The
# glyph box is every whole device row inside the inner box (a row the capsule's
# anti-aliased edge crosses is left out), inside the middle 60% of its width, with
# a pixel that is at least half-way from the pill's FILL colour to its INK
# colour. "high" = (gap below - gap above) / 2, in CSS px: positive means the
# glyphs sit high, negative means low. Zero is centred.
import json
import math
import os
import re
import sys

from PIL import Image

here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 's' + os.environ.get('SLICE', '2'), 'centre')


def rgb(s):
    nums = [float(x) for x in re.findall(r'[\d.]+', s)]
    if s.startswith('color(srgb'):
        return tuple(round(v * 255) for v in nums[:3])
    return tuple(nums[:3])


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def measure(row, folder):
    im = Image.open(os.path.join(folder, row['file'])).convert('RGB')
    d = row['dpr']
    fill, ink = rgb(row['fill']), rgb(row['ink'])
    half = dist(fill, ink) / 2
    oy, ox = row['clip']['y'], row['clip']['x']
    top = (row['top'] + row['bt'] - oy) * d
    bottom = (row['bottom'] - row['bb'] - oy) * d
    left = (row['left'] - ox) * d
    right = (row['right'] - ox) * d
    w = right - left
    x0, x1 = int(left + w * 0.2), int(right - w * 0.2)
    ys = [y for y in range(math.ceil(top), math.floor(bottom))
          if 0 <= y < im.height and any(dist(im.getpixel((x, y)), fill) >= half for x in range(x0, x1))]
    if not ys:
        return None
    g_top, g_bottom = ys[0], ys[-1] + 1
    above, below = g_top - top, bottom - g_bottom
    return {'above': above / d, 'below': below / d, 'high': (below - above) / 2 / d, 'glyph': (g_bottom - g_top) / d}


phases = sys.argv[1:] or ['before', 'after']
for phase in phases:
    folder = os.path.join(here, phase)
    if not os.path.exists(os.path.join(folder, 'boxes.json')):
        continue
    rows = json.load(open(os.path.join(folder, 'boxes.json')))
    print()
    print(f'{phase}   (high, CSS px: mean [min, max] over the copies sampled; + = glyphs sit high)')
    print(f"{'tag':16} {'pad T/B':9} {'n':>2}  " + '   '.join(f'{d}x' + ' ' * 18 for d in (1, 2, 3)))
    by = {}
    for r in rows:
        by.setdefault(r['name'], []).append(r)
    for name, rs in by.items():
        cells = []
        for d in (1, 2, 3):
            ms = [m for m in (measure(r, folder) for r in rs if r['dpr'] == d) if m]
            hs = [m['high'] for m in ms]
            cells.append(f"{sum(hs) / len(hs):+5.2f} [{min(hs):+5.2f}, {max(hs):+5.2f}]" if hs else '(no glyphs)'.ljust(21))
        pad = f"{rs[0]['pt']}/{rs[0]['pb']}".replace('px', '')
        n = len([r for r in rs if r['dpr'] == 1])
        print(f'{name:16} {pad:9} {n:>2}  ' + '   '.join(cells))
    sys.stdout.flush()
