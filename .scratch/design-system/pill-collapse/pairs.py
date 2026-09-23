# Stitch before/after crops side by side, one row per target, as JPEG pages
# small enough to read. Usage: python pairs.py [suffix] [names,...]
#   SLICE=2 python pairs.py ...   reads and writes s2/ instead of this folder
#   suffix ''      the tag in its row  (<name>.png)
#   suffix '--tag' the tight 2x tag   (<name>--tag.png)
import os
import sys

from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
if os.environ.get('SLICE', '1') != '1':
    here = os.path.join(here, 's' + os.environ['SLICE'])
suffix = sys.argv[1] if len(sys.argv) > 1 else ''
only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
names = sorted({f[: -len(f'{suffix}.png')] for f in os.listdir(os.path.join(here, 'before'))
                if f.endswith(f'{suffix}.png') and (suffix or '--' not in f)})
if only:
    names = [n for n in names if n in only]
rows = []
for n in names:
    ims = []
    for ph in ('before', 'after'):
        p = os.path.join(here, ph, f'{n}{suffix}.png')
        ims.append(Image.open(p).convert('RGB') if os.path.exists(p) else Image.new('RGB', (40, 20), 'white'))
    rows.append((n, ims))
W = max(sum(i.width for i in ims) + 180 for _, ims in rows)
H = sum(max(i.height for i in ims) + 12 for _, ims in rows)
sheet = Image.new('RGB', (W, H), (246, 239, 220))
d = ImageDraw.Draw(sheet)
y = 0
for n, ims in rows:
    d.text((4, y + 4), n, fill=(0, 0, 0))
    x = 150
    for im in ims:
        sheet.paste(im, (x, y))
        x += im.width + 30
    y += max(i.height for i in ims) + 12
out = os.path.join(here, f'pairs{suffix or "-row"}.jpg')
if sheet.width > 1600:
    sheet = sheet.resize((1600, int(sheet.height * 1600 / sheet.width)))
sheet.save(out, quality=82)
print(out, sheet.size)
