// The big-play cutscene's art: a buffer of palette-slot indices (never a colour), one hand-placed
// batter in four poses, a 5 x 7 pixel font, and the club chip. The slot -> colour map is the
// --stage-* tokens (src/tokens/colors.css) plus the six KIT slots a club fills at runtime, both
// applied by CutsceneCanvas, so the drawing never names a colour and a test can read it without a DOM.

// Token slots, in the token file's order, then the club's slots. A club swap touches only the KIT six.
export const TOKENS = [
  'outline', 'chalk', 'night', 'crowd-1', 'crowd-2', 'crowd-3', 'crowd-4', 'wall-deep', 'wall', 'wall-lit', 'dirt', 'dirt-lit',
  'skin-light', 'skin', 'skin-shade', 'kit-road-light', 'kit-road', 'kit-road-shade', 'leather', 'bat', 'bat-shade',
]
export const KIT_SLOTS = ['helmet', 'helmet-shade', 'trim', 'jersey', 'jersey-shade', 'jersey-light']
export const C = Object.fromEntries([...TOKENS, ...KIT_SLOTS].map((n, i) => [n.replace(/-(\w)/g, (_, c) => c.toUpperCase()), i]))

export const W = 192
export const H = 144
export const BAND = 96
export const newBuf = () => ({ w: W, h: H, px: new Uint8Array(W * H) })
export const put = (b, x, y, c) => { if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.px[y * b.w + x] = c }
export function rect(b, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(b, x, y, c) }

// ---- 5 x 7 caps, one 5-bit row per line. Advance 6, space 4. ----------------------------------
const GLYPH = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '!': [4, 4, 4, 4, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0, 4], ',': [0, 0, 0, 0, 0, 4, 8],
}
const adv = (ch) => (ch === ' ' ? 4 : 6)
export const textW = (s, k = 1) => [...s].reduce((w, ch) => w + adv(ch) * k, 0) - k
// Draws `s` scaled k; `shadow` paints a one-step drop first. A character the font lacks takes its space.
export function text(b, s, x, y, k, c, shadow) {
  const dots = []
  for (const ch of s) {
    const g = GLYPH[ch]
    if (g) for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r] & (16 >> q)) for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) dots.push([x + q * k + i, y + r * k + j])
    x += adv(ch) * k
  }
  if (shadow != null) for (const [a, d] of dots) put(b, a + 1, d + 1, shadow)
  for (const [a, d] of dots) put(b, a, d, c)
}

// ---- The batter: 45 x 49, letters are KIT jobs. Body, head and legs are the chosen reference
// sprite (an AI-generated gallery piece, edited and recoloured under its licence); the arms were
// redrawn for each pose. `up` and `pump` are the fist pump's two beats, `point` and `point2` the
// point to the dugout. Rows 27..28 are the belt, so rows 0..28 are the waist-up close-up.
export const SPR = {
  up: [
    '......................................KKKKKK.',
    '...............KKKKKK.................KSSSsK.',
    '...............KsSSSK.................KSSSsK.',
    '...............KsSSSK.................KSSSsK.',
    '...............KsSSSK.................KddddK.',
    '...............KddddK.................KKSSsK.',
    '...............KsSSKK....KKKKKK.......KKSSsK.',
    '...............KsSSKK...KHHHHHHK......KSSsKK.',
    '...............KKsSSK...KHHHHHTHK.....KSSsK..',
    '................KsSSK..KhhhHHHHhK....KKSSsK..',
    '................KsSSKK.KhhhHHhhTTTK..KSSsKK..',
    '................KKsSSK.KhKKKKTTTKKK.KKSSsK...',
    '.................KsSSKK.KKKKdKKKK..KKSSsKK...',
    '.................KKjjjK.KKSKSsddK.KKjjjKK....',
    '..................KjJJKK.KKsSSSSK.KJJjKK.....',
    '..................KKjJJKKddjdSsKKKKJJjK......',
    '...................KKjJJKSssKssKKKJJjKK......',
    '....................KjJJjdSdssjKmJJjKK.......',
    '....................KKjJJjSdsjKJJJjKK........',
    '.....................KjjjJjjjKJJmmmK.........',
    '.....................KjjjJJjjJJJmmmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '....................KjBBKBBBBBBBKK...........',
    '.....................KBKBBBBBBKKK............',
    '......................KKKKKKKKKjK............',
    '......................KjnHnKKppjnK...........',
    '.....................KnjnnppppHnppK..........',
    '.....................KnjPPPPPpHHpppK.........',
    '.....................KnjPpppppppppppKK.......',
    '.....................KnTPPPPppHppppPPnK......',
    '.....................KjPPPPppKpppppPPPpK.....',
    '.....................KjPPPPnKKppppppPPPpK....',
    '....................KPmPPPpK..KKKppppPPPpK...',
    '....................KTPPPPpK....KKKpppPPpK...',
    '....................KTPPPpK.......KKKHHPpK...',
    '...................HPmPPpnK.........KhpppK...',
    '..................KSmPPPpK.........KpppppK...',
    '.................KPmPPPpp..........KKpppK....',
    '................KKjPPPppK..........KKKKK.....',
    '................KThPpppK...........KjjjK.....',
    '...............KThhHppK............KKKKK.....',
    '..............KHThhKKK.............KhhK......',
    '..............KHhjKK...............KhhK......',
    '.............KhhhK................sKhhKK.....',
  ],
  pump: [
    '.............................................',
    '.............................................',
    '.............................................',
    '.....................................KKKKKK..',
    '................KKKKKK...............KSSSsK..',
    '................KsSSSK...............KSSSsK..',
    '................KsSSSK...KKKKKK......KSSSsK..',
    '................KsSSSK..KHHHHHHK.....KddddK..',
    '................KddddK..KHHHHHTHK....KKSSsK..',
    '................KsSSKK.KhhhHHHHhK.....KSSsK..',
    '................KsSSK..KhhhHHhhTTTK..KKSSsK..',
    '................KsSSKK.KhKKKKTTTKKK..KSSsKK..',
    '................KKsSSK..KKKKdKKKK....KSSsK...',
    '.................KjjjK..KKSKSsddK...KKSSsK...',
    '.................KjJJKK..KKsSSSSK..KKjjjKK...',
    '.................KKjJJKKKddjdSsKKKKKJJjKK....',
    '..................KKjJJKKSssKssKKKJJJjKK.....',
    '...................KKjJJjdSdssjKmJJjKKK......',
    '....................KKjJJjSdsjKJJJjKK........',
    '.....................KjjjJjjjKJJmmmK.........',
    '.....................KjjjJJjjJJJmmmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '.....................KjjJJJJJJJJJJmK.........',
    '....................KjBBKBBBBBBBKK...........',
    '.....................KBKBBBBBBKKK............',
    '......................KKKKKKKKKjK............',
    '......................KjnHnKKppjnK...........',
    '.....................KnjnnppppHnppK..........',
    '.....................KnjPPPPPpHHpppK.........',
    '.....................KnjPpppppppppppKK.......',
    '.....................KnTPPPPppHppppPPnK......',
    '.....................KjPPPPppKpppppPPPpK.....',
    '.....................KjPPPPnKKppppppPPPpK....',
    '....................KPmPPPpK..KKKppppPPPpK...',
    '....................KTPPPPpK....KKKpppPPpK...',
    '....................KTPPPpK.......KKKHHPpK...',
    '...................HPmPPpnK.........KhpppK...',
    '..................KSmPPPpK.........KpppppK...',
    '.................KPmPPPpp..........KKpppK....',
    '................KKjPPPppK..........KKKKK.....',
    '................KThPpppK...........KjjjK.....',
    '...............KThhHppK............KKKKK.....',
    '..............KHThhKKK.............KhhK......',
    '..............KHhjKK...............KhhK......',
    '.............KhhhK................sKhhKK.....',
  ],
  point: [
    '.............................................',
    '.............................................',
    '.............................................',
    '.............................................',
    '.............................................',
    '.............................................',
    '.........................KKKKKK..............',
    '........................KHHHHHHK.............',
    '........................KHHHHHTHK............',
    '.......................KhhhHHHHhK............',
    '.......................KhhhHHhhTTTK..........',
    '.......................KhKKKKTTTKKK..........',
    '........................KKKKdKKKK............',
    '........................KKSKSsddK............',
    '..KKKKKKKKKKK............KKsSSSSK............',
    '..KSSSSSSSSsKKKKK.....KKKddjdSsKK............',
    '..KKKKKSSSSSssssKKKKKKKKKSssKssKKKKK.........',
    '......KddddSSSSSssjjjjjjjdSdssjKmmmKK........',
    '......KddKKKSSSSSSjJJJJJjjSdsjKJmmmKKK.......',
    '......KKKK.KKKKKSSjJJJJJjJjjjKJJmmmKjK.......',
    '...............KKKKKKKjjjJJjjJJJmmmKjKK......',
    '.....................KjjJJJJJJJJJJmKJjKK.....',
    '.....................KjjJJJJJJJJJJmKJJjK.....',
    '.....................KjjJJJJJJJJJJmKjjjKK....',
    '.....................KjjJJJJJJJJJJmKKSSsK....',
    '.....................KjjJJJJJJJJJJmKKSSsK....',
    '.....................KjjJJJJJJJJJJmKKSSsK....',
    '....................KjBBKBBBBBBBKK..KSSsK....',
    '.....................KBKBBBBBBKKK...KSSsK....',
    '......................KKKKKKKKKjK...KSSsK....',
    '......................KjnHnKKppjnK.KKSSsK....',
    '.....................KnjnnppppHnppKKSSSsK....',
    '.....................KnjPPPPPpHHpppKSSSsK....',
    '.....................KnjPpppppppppppSSSsK....',
    '.....................KnTPPPPppHppppPddddK....',
    '.....................KjPPPPppKpppppPPPpKK....',
    '.....................KjPPPPnKKppppppPPPpK....',
    '....................KPmPPPpK..KKKppppPPPpK...',
    '....................KTPPPPpK....KKKpppPPpK...',
    '....................KTPPPpK.......KKKHHPpK...',
    '...................HPmPPpnK.........KhpppK...',
    '..................KSmPPPpK.........KpppppK...',
    '.................KPmPPPpp..........KKpppK....',
    '................KKjPPPppK..........KKKKK.....',
    '................KThPpppK...........KjjjK.....',
    '...............KThhHppK............KKKKK.....',
    '..............KHThhKKK.............KhhK......',
    '..............KHhjKK...............KhhK......',
    '.............KhhhK................sKhhKK.....',
  ],
  point2: [
    '.............................................',
    '.............................................',
    '.............................................',
    '.............................................',
    '.............................................',
    '.............................................',
    '.........................KKKKKK..............',
    '........................KHHHHHHK.............',
    '........................KHHHHHTHK............',
    '.......................KhhhHHHHhK............',
    '.......................KhhhHHhhTTTK..........',
    '.......................KhKKKKTTTKKK..........',
    '........................KKKKdKKKK............',
    '........................KKSKSsddK............',
    '.........................KKsSSSSK............',
    '..KKKKKKKKKKKKK.......KKKddjdSsKK............',
    '..KSSSSSSSSsssKKKKKKKKKKKSssKssKKKKK.........',
    '..KKKKKSSSSSSSssssjjjjjjjdSdssjKmmmKK........',
    '......KddddSSSSSSSjJJJJJjjSdsjKJmmmKKK.......',
    '......KddKKKKKSSSSjJJJJJjJjjjKJJmmmKjK.......',
    '......KKKK...KKKKKKKKKjjjJJjjJJJmmmKjKK......',
    '.....................KjjJJJJJJJJJJmKJjKK.....',
    '.....................KjjJJJJJJJJJJmKJJjK.....',
    '.....................KjjJJJJJJJJJJmKjjjKK....',
    '.....................KjjJJJJJJJJJJmKKSSsK....',
    '.....................KjjJJJJJJJJJJmKKSSsK....',
    '.....................KjjJJJJJJJJJJmKKSSsK....',
    '....................KjBBKBBBBBBBKK..KSSsK....',
    '.....................KBKBBBBBBKKK...KSSsK....',
    '......................KKKKKKKKKjK...KSSsK....',
    '......................KjnHnKKppjnK.KKSSsK....',
    '.....................KnjnnppppHnppKKSSSsK....',
    '.....................KnjPPPPPpHHpppKSSSsK....',
    '.....................KnjPpppppppppppSSSsK....',
    '.....................KnTPPPPppHppppPddddK....',
    '.....................KjPPPPppKpppppPPPpKK....',
    '.....................KjPPPPnKKppppppPPPpK....',
    '....................KPmPPPpK..KKKppppPPPpK...',
    '....................KTPPPPpK....KKKpppPPpK...',
    '....................KTPPPpK.......KKKHHPpK...',
    '...................HPmPPpnK.........KhpppK...',
    '..................KSmPPPpK.........KpppppK...',
    '.................KPmPPPpp..........KKpppK....',
    '................KKjPPPppK..........KKKKK.....',
    '................KThPpppK...........KjjjK.....',
    '...............KThhHppK............KKKKK.....',
    '..............KHThhKKK.............KhhK......',
    '..............KHhjKK...............KhhK......',
    '.............KhhhK................sKhhKK.....',
  ],
}
export const WAIST = 28
export const KIT = {
  K: C.outline, S: C.skinLight, s: C.skin, d: C.skinShade, H: C.helmet, h: C.helmetShade, T: C.trim, J: C.jersey, j: C.jerseyShade,
  m: C.jerseyLight, P: C.kitRoadLight, p: C.kitRoad, n: C.kitRoadShade, B: C.leather, W: C.bat, w: C.batShade,
}
// Rows r0..r1 of a pose at (x, y), each letter k x k pixels. The outline is drawn into the rows.
export function sprite(b, rows, x, y, k, r0 = 0, r1 = rows.length - 1) {
  for (let r = r0; r <= r1; r++) for (let q = 0; q < rows[r].length; q++) {
    const c = KIT[rows[r][q]]
    if (c != null) for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(b, x + q * k + i, y + (r - r0) * k + j, c)
  }
}

// A club chip seen edge-on to face-on (w = half width 1..6), the stand-in monogram when it faces us.
// The build draws the club's real logo here (teamLogoUrl), shrunk into the stage palette; never a
// hand-drawn logo.
export function chip(b, cx, cy, w, back, mono) {
  const R = 6, inside = (i, j) => (i / w) ** 2 + (j / R) ** 2 <= 1
  for (let j = -R - 1; j <= R + 1; j++) for (let i = -R - 1; i <= R + 1; i++) {
    if (inside(i, j)) put(b, cx + i, cy + j, back ? C.trim : (i / w) ** 2 + (j / R) ** 2 > 0.62 ? C.chalk : C.helmet)
    else if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) put(b, cx + i, cy + j, C.outline)
  }
  if (!back && w >= 5 && mono) text(b, mono[0], cx - 2, cy - 3, 1, C.trim)
}
