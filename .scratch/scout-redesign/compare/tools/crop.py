# python3 crop.py <src.png> <out> <y0> <y1> [scale]  (y in CSS px of a 2x full-page shot; scale 1 = 1x output)
import sys
from PIL import Image
src, out, y0, y1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1
im = Image.open(src).convert('RGB')
c = im.crop((0, y0*2, im.width, y1*2))
c = c.resize((int(c.width*scale/2*2*0+c.width*scale/1/2*1), int(c.height*scale/2)))
c.save(out, optimize=True) if out.endswith('.png') else c.save(out, quality=82)
