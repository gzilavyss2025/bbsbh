# python3 sbs.py <canvas.png> <live.png> <out.png> <cy0> <cy1> <ly0> <ly1>   (CSS px; both 2x shots) -> side by side at 1x
import sys
from PIL import Image
c, l, out = sys.argv[1:4]
cy0, cy1, ly0, ly1 = map(int, sys.argv[4:8])
def crop(p, a, b):
    im = Image.open(p).convert('RGB')
    x = im.crop((0, a*2, im.width, b*2)); return x.resize((x.width//2, x.height//2))
A, B = crop(c, cy0, cy1), crop(l, ly0, ly1)
H = max(A.height, B.height)
o = Image.new('RGB', (A.width + B.width + 10, H), (255, 0, 255))
o.paste(A, (0, 0)); o.paste(B, (A.width + 10, 0))
o.save(out, optimize=True)
