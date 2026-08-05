// What colour a Logbook game stamp is pressed in — ADR-0036's addendum, "the
// ink is the winner's".
//
// PURE, React-free, and it reads only two things about a game: WHO WON and the
// clubs' ids. A stamp is a keepsake of a game whose score its owner has already
// revealed (ADR-0035), so the ink saying which club won reveals nothing the
// stamp is not already printing in numerals two lines below it.
//
// ===========================================================================
// THE RULE THIS MODULE MUST NOT BREAK
// ===========================================================================
// This is the ONE place in src/lib/ that colours something from game state,
// and it is a deliberate, contained exception to the invariant at the bottom
// of src/lib/CLAUDE.md ("theming's only inputs are teamId and treatment").
// That rule is about surfaces the user has NOT revealed — a page tinted by
// who's leading is a spoiler. It is safe here for exactly the reason the rest
// of GameStamp.jsx is safe, and NOWHERE ELSE: the only caller is the stamp
// art, and the stamp art may only render on the surfaces
// scripts/check-stamp-surfaces.mjs allows. Do not import this module anywhere
// that draws a game the user has not stamped.
//
// ===========================================================================
// Why the DARKEST colour, and not the club's primary
// ===========================================================================
// A stamp is ink on paper. Its whole design is one colour, with contrast
// coming from stroke weight and mass alone (GameStamp.jsx), so the colour has
// to work at hairline widths and in small mono type — which a club's brand
// primary often does not (the Brewers' yellow, the Pirates' gold, the Rays'
// sky blue are all brand colours, and none of them is ink). Every club owns
// something dark, and the darkest thing it owns is both unmistakably its own
// and legible pressed onto cream paper. So: the winner's darkest, with a floor
// underneath it for the handful of clubs whose darkest still isn't dark
// enough.
//
// A game with no winner — a tie, a suspended game, facts that never resolved —
// gets `null`, and the caller leaves the stamp in the book's default navy ink.
// That is the honest answer, not a failure: there is no winner to be the ink.

import { MILB_COLORS, MLB_TEAM_COLORS, milbBrandPair } from './brandColors.js'
import { contrastRatio, relativeLuminance } from './contrast.js'

// The paper a stamp is pressed onto: --surface-card (--paper-2), the raised
// sheet both the passport page and the Logbook grid cell are drawn on. Mirrored
// here as a literal for the same reason teams.js mirrors its two text tokens —
// contrast math needs a value, not a CSS custom property. Keep it in step with
// tokens/colors.css if that stock ever changes.
export const STAMP_PAPER = '#FBF6E9'

// The floor the ink has to clear against that paper. WCAG AA for body text,
// because the smallest thing a stamp draws (the ring's venue/date type) is
// body-sized, and it is the whole artifact rather than decoration on one.
// Today exactly one club in either league is caught by this (Rocket City's
// #3378c2 at 4.22); the rest clear it several times over. It exists for the
// affiliate whose researched pair is a pastel, not for the 30.
export const MIN_INK_CONTRAST = 4.5

const HEX = /^#[0-9a-f]{6}$/i

const isHex = (value) => typeof value === 'string' && HEX.test(value)

function toRgb(hex) {
  const h = hex.slice(1)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

function toHex([r, g, b]) {
  const channel = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

// Every colour a club actually owns, in no particular order — this function's
// job is coverage, `darkestInk` picks. MLB reads the club's own triad plus its
// documented extras (mlb-team-colors.json, ADR-0029); MiLB goes through
// brandColors.js's affiliate -> parent-org chain, plus the affiliate's own
// researched third where it has one.
//
// Deliberately steps 1-2 of that chain only (`milbBrandPair`, not
// `milbColorPair`): a club nothing is known about must come back EMPTY so the
// stamp keeps the book's own ink, rather than being pressed in the neutral
// graphite placeholder, which would read as a design choice about that game.
export function inkCandidates(teamId) {
  const mlb = MLB_TEAM_COLORS[teamId]
  const raw = mlb
    ? [mlb.primary, mlb.secondary, mlb.accent, ...(mlb.extras ?? []).map((e) => e?.hex)]
    : [...(milbBrandPair(teamId) ?? []), MILB_COLORS[teamId]?.third]

  const seen = new Set()
  const out = []
  for (const hex of raw) {
    if (!isHex(hex)) continue
    const key = hex.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hex)
  }
  return out
}

// The darkest of a set of hexes, by relative luminance rather than by anything
// that can be read off the digits. Ties break on the earlier candidate, which
// puts a club's primary ahead of an extra that happens to match it.
export function darkestInk(hexes) {
  let best = null
  let bestLuminance = Infinity
  for (const hex of hexes ?? []) {
    if (!isHex(hex)) continue
    const luminance = relativeLuminance(hex)
    if (luminance < bestLuminance) {
      best = hex
      bestLuminance = luminance
    }
  }
  return best
}

// Walk a colour toward black until it reads on the paper. Scaling all three
// channels by the same factor keeps the hue and the relative mix — the club's
// blue stays its blue, just further down — where clamping channels or mixing
// in grey would drift it toward something the club does not own.
//
// Converges: each pass takes 12% off, so 40 of them reach black from anywhere,
// and black clears every threshold this paper can pose.
export function deepenToContrast(hex, paper = STAMP_PAPER, minRatio = MIN_INK_CONTRAST) {
  if (!isHex(hex) || !isHex(paper)) return null
  let rgb = toRgb(hex)
  let out = hex
  for (let pass = 0; pass < 40; pass += 1) {
    if (contrastRatio(out, paper) >= minRatio) return out
    rgb = rgb.map((c) => c * 0.88)
    out = toHex(rgb)
  }
  return '#000000'
}

// Which club won, from the stamp facts. `winnerId` is what both producers of
// this shape already carry (src/api/linescore.js from a live feed,
// src/api/logbook.js from the schedule), so the runs are only a fallback for a
// hand-built or older record — and a tie, or a side whose runs never resolved,
// is `null` in both readings.
export function stampWinnerId(game) {
  if (!game) return null
  if (game.winnerId != null) return game.winnerId
  const away = game.away?.runs
  const home = game.home?.runs
  if (typeof away !== 'number' || typeof home !== 'number' || away === home) return null
  return (away > home ? game.away?.id : game.home?.id) ?? null
}

// The whole answer: the hex a stamp for `game` is drawn in, or null for "use
// the book's own ink" — no winner, or a club with no colour on file.
export function stampInkFor(game, { paper = STAMP_PAPER } = {}) {
  const winnerId = stampWinnerId(game)
  if (winnerId == null) return null
  const darkest = darkestInk(inkCandidates(winnerId))
  if (!darkest) return null
  return deepenToContrast(darkest, paper)
}
