// The stage's pixel kit: a buffer of palette-slot indices (not colours), a 3x5 font, hand-placed
// sprites, and a rasteriser that turns a skeleton into a chunky figure with a 1 px ink outline.
// The slot -> colour map is the --stage-* tokens (src/tokens/colors.css), applied by StageCanvas, so
// the drawing never names a colour and a test can read it without a DOM.
import { clamp, project } from './scene.js'

// One slot per --stage-* token that the drawing paints with, in the token file's order: the last
// five are the zone map's temperatures, tinted into the strike zone at rest.
export const TOKENS = [
  'sky', 'sky-haze', 'crowd-1', 'crowd-2', 'crowd-3', 'crowd-4', 'wall-deep', 'wall', 'wall-lit',
  'grass', 'grass-lit', 'grass-far', 'grass-foul', 'dirt', 'dirt-lit', 'chalk', 'outline', 'shadow', 'shadow-dirt',
  'kit-navy', 'kit-trim', 'kit-road', 'kit-road-shade', 'kit-red', 'skin', 'skin-shade', 'bat', 'landing', 'frame',
  'zone-cold', 'zone-cool', 'zone-lukewarm', 'zone-warm', 'zone-hot',
]
export const S = Object.fromEntries(TOKENS.map((n, i) => [n.replace(/-(\w)/g, (_, c) => c.toUpperCase()), i]))

export const newBuf = (w, h) => ({ w, h, px: new Uint8Array(w * h) })
export const put = (b, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.px[y * b.w + x] = c }
export function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c) }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
// An ordered dither: true for the share `f` of pixels, in a fixed pattern.
export const dith = (x, y, f) => f > BAYER[(y & 3) * 4 + (x & 3)]

// ---- 3 x 5 font: digits and the letters pitch types and calls use ------------------------------
const GLYPH = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  W: '101101111111101', X: '101101010101101', Y: '101101010010010',
}
export const textW = (s) => s.length * 4 - 1
export function text(b, s, x, y, c) {
  for (const ch of s) {
    const g = GLYPH[ch]
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') put(b, x + (i % 3), y + ((i / 3) | 0), c)
    x += 4
  }
}

// ---- Sprites: hand-placed art for the high field view -----------------------------------------
// H hat, F face, J jersey, T trim, P pants, S sock, K shoe, s skin; two run frames.
export const SPR = {
  stand: ['..HHH..', '.HHHHH.', '..FFF..', '.JJJJJ.', 'sJTJTJs', 's.JJJ.s', '..PPP..', '..P.P..', '..S.S..', '.KK.KK.'],
  run0: ['..HHH..', '.HHHHH.', '..FFF..', 'sJJJJJ.', '.JTJTJs', '..JJJ..', '..PPP..', '.PP..P.', '.S...S.', 'KK...KK'],
  run1: ['..HHH..', '.HHHHH.', '..FFF..', '.JJJJJs', 'sJTJTJ.', '..JJJ..', '..PPP..', '..PP...', '..SS...', '..KKK..'],
}
export const KIT = {
  home: { H: S.kitNavy, F: S.skin, J: S.chalk, T: S.kitRed, P: S.chalk, S: S.kitNavy, K: S.outline, s: S.skin },
  road: { H: S.kitNavy, F: S.skin, J: S.kitRoad, T: S.kitTrim, P: S.kitRoad, S: S.kitNavy, K: S.outline, s: S.skin },
  ump: { H: S.outline, F: S.skin, J: S.outline, T: S.kitNavy, P: S.kitRoadShade, S: S.outline, K: S.outline, s: S.skin },
}
// Feet at (x, y). The outline is every empty pixel next to the figure.
export function sprite(b, rows, x, y, kit, flip) {
  const h = rows.length, w = rows[0].length, x0 = Math.round(x - w / 2), y0 = Math.round(y - h)
  const at = (i, j) => (j < 0 || j >= h || i < 0 || i >= w ? '.' : rows[j][flip ? w - 1 - i : i])
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    const ch = at(i, j)
    if (ch !== '.') put(b, x0 + i, y0 + j, kit[ch])
    else if (at(i - 1, j) !== '.' || at(i + 1, j) !== '.' || at(i, j - 1) !== '.' || at(i, j + 1) !== '.') put(b, x0 + i, y0 + j, S.outline)
  }
}

// ---- Figures: a skeleton from the swing and windup keyframes, drawn as capsules ---------------
// parts: { kind: 'cap', at: [jointA, jointB], r (ft), c, shade } | { kind: 'quad', at: [4 joints], c, shade }
// | { kind: 'head', at: [joint], r, c, hat }. Far parts paint first. `ghost` draws a 50% checker
// (the catcher, see-through so the zone stays clear).
export function figure(b, cam, joints, parts, { minR = 0.6, ghost = false } = {}) {
  const P = {}
  for (const k in joints) { P[k] = project(cam, joints[k], b.w, b.h); if (!P[k]) return }
  const xs = Object.values(P).map((p) => p.x), ys = Object.values(P).map((p) => p.y), pad = Math.ceil(1.6 * (P.pelvis?.s ?? 1)) + 3
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), x1 = Math.min(b.w - 1, Math.ceil(Math.max(...xs) + pad))
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)), y1 = Math.min(b.h - 1, Math.ceil(Math.max(...ys) + pad))
  if (x1 < x0 || y1 < y0) return
  const bw = x1 - x0 + 1, mask = new Uint8Array(bw * (y1 - y0 + 1))
  const set = (x, y, c) => { if (x >= x0 && x <= x1 && y >= y0 && y <= y1) mask[(y - y0) * bw + (x - x0)] = c + 1 }
  const cap = (a, c, rFt, col, shade) => {
    const r = Math.max(minR, rFt * (a.s + c.s) / 2), dx = c.x - a.x, dy = c.y - a.y, L2 = dx * dx + dy * dy || 1
    for (let y = Math.floor(Math.min(a.y, c.y) - r); y <= Math.ceil(Math.max(a.y, c.y) + r); y++) {
      for (let x = Math.floor(Math.min(a.x, c.x) - r); x <= Math.ceil(Math.max(a.x, c.x) + r); x++) {
        const u = clamp(((x + 0.5 - a.x) * dx + (y + 0.5 - a.y) * dy) / L2, 0, 1), ex = x + 0.5 - a.x - dx * u, ey = y + 0.5 - a.y - dy * u
        if (ex * ex + ey * ey <= r * r) set(x, y, shade != null && (ex * 0.8 + ey * 0.6) / r > 0.35 && (x + y) & 1 ? shade : col)
      }
    }
  }
  const quad = (q, col, shade) => {
    for (let y = Math.floor(Math.min(...q.map((p) => p.y))); y <= Math.ceil(Math.max(...q.map((p) => p.y))); y++) {
      for (let x = Math.floor(Math.min(...q.map((p) => p.x))); x <= Math.ceil(Math.max(...q.map((p) => p.x))); x++) {
        let sgn = 0, inside = true
        for (let i = 0; i < 4 && inside; i++) {
          const p = q[i], n = q[(i + 1) % 4], s = Math.sign((n.x - p.x) * (y + 0.5 - p.y) - (n.y - p.y) * (x + 0.5 - p.x))
          if (s) { if (!sgn) sgn = s; else if (s !== sgn) inside = false }
        }
        if (inside) set(x, y, shade != null && (x + y) & 1 && x > (q[0].x + q[1].x) / 2 ? shade : col)
      }
    }
  }
  const depth = (p) => p.at.reduce((s, k) => s + P[k].d, 0) / p.at.length
  for (const p of [...parts].sort((a, c) => depth(c) - depth(a))) {
    if (p.kind === 'cap') cap(P[p.at[0]], P[p.at[1]], p.r, p.c, p.shade)
    else if (p.kind === 'quad') quad(p.at.map((k) => P[k]), p.c, p.shade)
    else {
      const a = P[p.at[0]], r = Math.max(1.2, p.r * a.s)
      for (let y = Math.floor(a.y - r - 1); y <= Math.ceil(a.y + r); y++) {
        for (let x = Math.floor(a.x - r - 1); x <= Math.ceil(a.x + r + 1); x++) {
          if ((x + 0.5 - a.x) ** 2 + (y + 0.5 - a.y) ** 2 <= r * r) set(x, y, y + 0.5 - a.y < -r * 0.05 ? p.hat : p.c)
        }
      }
    }
  }
  const m = (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? mask[(y - y0) * bw + (x - x0)] : 0)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (ghost && (x + y) & 1) continue
      const c = m(x, y)
      if (c) b.px[y * b.w + x] = c - 1
      else if (m(x - 1, y) || m(x + 1, y) || m(x, y - 1) || m(x, y + 1)) b.px[y * b.w + x] = S.outline
    }
  }
}

const kit = (jersey, shade, pants, trim, hat, sleeve) => [
  { kind: 'cap', at: ['lHip', 'lKnee'], r: 0.3, c: pants, shade }, { kind: 'cap', at: ['rHip', 'rKnee'], r: 0.3, c: pants, shade },
  { kind: 'cap', at: ['lKnee', 'lFoot'], r: 0.24, c: trim }, { kind: 'cap', at: ['rKnee', 'rFoot'], r: 0.24, c: trim },
  { kind: 'quad', at: ['lSho', 'rSho', 'rHip', 'lHip'], c: jersey, shade }, { kind: 'cap', at: ['neck', 'pelvis'], r: 0.48, c: jersey, shade },
  { kind: 'cap', at: ['lSho', 'lElb'], r: 0.22, c: sleeve }, { kind: 'cap', at: ['rSho', 'rElb'], r: 0.22, c: sleeve },
  { kind: 'head', at: ['head'], r: 0.48, c: S.skin, hat },
]
// The bat is drawn from the hands to the barrel, with a knob (the batter's bat rule is met).
export const BATTER = [
  ...kit(S.kitRoad, S.kitRoadShade, S.kitRoad, S.kitNavy, S.kitNavy, S.kitNavy),
  { kind: 'cap', at: ['lElb', 'hands'], r: 0.19, c: S.skin }, { kind: 'cap', at: ['rElb', 'hands'], r: 0.19, c: S.skin },
  { kind: 'cap', at: ['hands', 'batTip'], r: 0.11, c: S.bat }, { kind: 'cap', at: ['hands', 'hands'], r: 0.2, c: S.kitTrim },
]
export const PITCHER = [...kit(S.chalk, S.kitRoad, S.chalk, S.kitNavy, S.kitNavy, S.kitRed), { kind: 'cap', at: ['rElb', 'ball'], r: 0.19, c: S.skin }, { kind: 'cap', at: ['lElb', 'lElb'], r: 0.32, c: S.dirt }]
export const FIELDER = kit(S.chalk, S.kitRoad, S.chalk, S.kitNavy, S.kitNavy, S.kitRed)
export const CATCHER = {
  head: [0, 0.2, 3.5], neck: [0, 0.1, 3.05], lSho: [-0.62, 0.15, 2.9], rSho: [0.62, 0.15, 2.9], lElb: [-0.75, 0.75, 2.3], rElb: [0.7, 0.55, 2.2],
  pelvis: [0, -0.3, 1.8], lHip: [-0.5, -0.3, 1.8], rHip: [0.5, -0.3, 1.8], lKnee: [-0.95, 0.7, 1.5], rKnee: [0.95, 0.7, 1.5], lFoot: [-0.8, -0.2, 0], rFoot: [0.8, -0.2, 0], ball: [0, 0, 0],
}
export const CATCHER_PARTS = [...kit(S.kitNavy, S.outline, S.chalk, S.kitNavy, S.kitNavy, S.kitNavy), { kind: 'cap', at: ['lElb', 'lElb'], r: 0.42, c: S.dirt }]

// ---- A numbered pitch mark: a round dot with the pitch's number (or X for the pitch put in play) --
const R = [[-2, 2], [-3, 3], [-4, 4], [-4, 4], [-4, 4], [-4, 4], [-4, 4], [-3, 3], [-2, 2]]
export function mark(b, x, y, label, fill, ink) {
  x = Math.round(x); y = Math.round(y)
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) if (Math.hypot(i, j * 1.1) <= 5.3) put(b, x + i, y + j, S.outline)
  for (let j = 0; j < 9; j++) for (let i = R[j][0]; i <= R[j][1]; i++) put(b, x + i, y - 4 + j, fill)
  text(b, label, x - 1, y - 2, ink)
}
