"""Make a seamless felt texture tile: mid-gray (128 = no change) for soft-light blending."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 384
rng = np.random.default_rng(7)


def periodic_noise(scale):
    # Band-limited noise via FFT: periodic by construction, so the tile is seamless.
    white = rng.standard_normal((N, N))
    f = np.fft.fft2(white)
    ky = np.fft.fftfreq(N)[:, None]
    kx = np.fft.fftfreq(N)[None, :]
    k = np.sqrt(kx * kx + ky * ky)
    filt = np.exp(-((k * N / scale) ** 2))
    out = np.real(np.fft.ifft2(f * filt))
    return out / (out.std() + 1e-9)


# Mottled density (felt is pressed, not woven): broad + medium + fine fuzz.
base = 0.55 * periodic_noise(6) + 0.35 * periodic_noise(24) + 0.25 * periodic_noise(110)

# Fibres: short wavy strokes in random directions, drawn on a 3x3 tiled canvas
# and cropped from the centre so strokes wrap across the tile edges.
big = Image.new("L", (N * 3, N * 3), 128)
d = ImageDraw.Draw(big)
for _ in range(16000):
    x, y = rng.uniform(N, 2 * N, 2)
    ang = rng.uniform(0, np.pi)
    length = rng.uniform(3, 10)
    bend = rng.uniform(-0.25, 0.25)
    pts = []
    for t in np.linspace(0, 1, 5):
        a = ang + bend * t
        pts.append((x + np.cos(a) * length * t, y + np.sin(a) * length * t))
    shade = int(128 + rng.choice([-1, 1]) * rng.uniform(10, 30))
    d.line(pts, fill=shade, width=1)
tile = big.crop((N, N, 2 * N, 2 * N))
# Copy the wrap: strokes that started in neighbour cells were not drawn, so
# redraw by folding the 3x3 canvas (sum of offsets from 128) into one tile.
arr_big = np.asarray(big, dtype=np.float32) - 128
fold = sum(arr_big[i * N:(i + 1) * N, j * N:(j + 1) * N] for i in range(3) for j in range(3))
fibres = Image.fromarray(np.clip(fold + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))

fib = np.asarray(fibres, dtype=np.float32) - 128
img = 128 + base * 16 + fib * 0.9
img = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(img, "L").save(sys.argv[1], optimize=True)
print("mean", img.mean().round(1), "std", img.std().round(1))
