"""Make the fibre mask that breaks the print ink: white RGBA, alpha 0 on the
felt's finest dark fibres. Usage: python3 -I fibre_mask.py felt.png out.png [p0] [p1]
p0/p1 are percentiles of the fibre high-pass: ink is fully out below p0 and
fully in above p1. The board uses 0.6 / 2.5 (about 1% of fibres)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
p0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
p1 = float(sys.argv[4]) if len(sys.argv) > 4 else 2.5
a = np.asarray(Image.open(src).convert('L'), dtype=np.float32) / 255
n = a.shape[0]
# Wrap-aware blur (blur a 3x3 tiling, keep the centre) so the mask stays seamless.
big = Image.fromarray((np.tile(a, (3, 3)) * 255).astype(np.uint8))
low = np.asarray(big.filter(ImageFilter.GaussianBlur(5)), dtype=np.float32)[n:2 * n, n:2 * n] / 255
hp = a - low  # fine fibre detail only; the broad mottling would knock out whole chunks
t0, t1 = np.percentile(hp, p0), np.percentile(hp, p1)
alpha = np.clip((hp - t0) / (t1 - t0), 0, 1)
rgba = np.zeros((n, n, 4), np.uint8)
rgba[..., :3] = 255
rgba[..., 3] = (alpha * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(out)
