// Batter-side pitch-mix splits (mlb/aaa; scripts/gen-pitch-arsenal.mjs's own
// sweep) — how differently a pitcher's arsenal reads to a LEFT-handed batter
// vs a RIGHT-handed one, read from the shared SQLite layer (docs/adr/0021) and
// joined into gen-callouts.mjs's starterRecords as `sideSplit`
// (docs/callouts.md's sideSplit family). Split out of gen-callouts.mjs for the
// same two reasons century-club.mjs was: that file's line budget (ADR-0038),
// and so the shaping below is unit-testable without a live DB (see
// arsenalSideFromRows).
//
// The story this exists to tell: Bryce Elder threw 51.4% sinkers to righties
// and 14.7% to lefties this season. That is not a small edge — it is a
// different pitcher depending on who is in the box, and it is invisible on a
// season arsenal card that sums the two together.
import { openDb } from './db.js'

// Show floors. A split only surfaces once it is genuinely notable, so the
// feed is not peppered with "throws 2% more sliders to lefties" noise. The
// numbers come from sweeping the committed 2026 table (1997 pitchers): the
// MEDIAN qualified pitcher's biggest side gap is already 19 points, so a floor
// below ~20 would fire for half the league and mean nothing. At GAP_FLOOR the
// family fires for ~26% of qualified pitchers, and — the reason to trust it —
// that share holds at 26-28% across every MIN_SIDE from 75 to 300, so the
// signal is a real property of the arsenal and not an artifact of the floor.
const MIN_SIDE = 150 // pitches to THAT side before any share is trustworthy
const MIN_TYPE_PITCHES = 25 // the busier side of a type, so a share is not 3-of-9
const GAP_FLOOR = 25 // percentage points between the two sides' usage shares
// A pitch he essentially only shows one side ("he has not thrown a lefty a
// cutter all year") is its own story and does NOT need to clear GAP_FLOOR — a
// type at 9% one side and 0% the other is a 9-point gap but a total secret.
const ONLY_HIGH = 8
const ONLY_LOW = 1.5
// Arsenal BREADTH by side: how many pitch types he actually shows each side.
const BREADTH_SHOWN = 5 // a type at >= 5% of that side counts as shown
const BREADTH_GAP = 2 // "six pitches to lefties, four to righties"

const share = (n, d) => Math.round((n / d) * 1000) / 10

// Pure: SQLite rows -> Map(`${level}:${personId}` -> sideSplit entry, or no
// entry at all when nothing about him clears the floors above). Exported
// separately from loadArsenalSide so a test can drive it with a synthetic row
// array, no SQLite involved.
export function arsenalSideFromRows(rows) {
  const byKey = new Map()
  for (const r of rows) {
    // '?' is the feed naming no side. It is CARRIED in the table on purpose
    // (so every side summed gives back the pre-split season) but it is
    // meaningless HERE: a pitch to an unknown batter says nothing about L vs
    // R, so it is excluded from numerator and denominator both. MLB feeds
    // always name a side; a MiLB one may not.
    if (r.stand !== 'L' && r.stand !== 'R') continue
    const key = `${r.level}:${r.person_id}`
    let e = byKey.get(key)
    if (!e) {
      e = { L: 0, R: 0, types: new Map() }
      byKey.set(key, e)
    }
    e[r.stand] += r.pitches
    let t = e.types.get(r.code)
    if (!t) {
      t = { code: r.code, description: r.description, L: 0, R: 0 }
      e.types.set(r.code, t)
    }
    t.L += r.stand === 'L' ? r.pitches : 0
    t.R += r.stand === 'R' ? r.pitches : 0
  }

  const out = new Map()
  for (const [key, e] of byKey) {
    if (e.L < MIN_SIDE || e.R < MIN_SIDE) continue
    const types = []
    for (const t of e.types.values()) {
      const l = share(t.L, e.L)
      const r = share(t.R, e.R)
      const gap = Math.round(Math.abs(l - r) * 10) / 10
      const hi = Math.max(l, r)
      const lo = Math.min(l, r)
      const only = hi >= ONLY_HIGH && lo <= ONLY_LOW ? (l > r ? 'L' : 'R') : null
      if (Math.max(t.L, t.R) < MIN_TYPE_PITCHES) continue
      if (gap < GAP_FLOOR && !only) continue
      types.push({
        code: t.code,
        description: t.description,
        l: t.L,
        lShare: l,
        r: t.R,
        rShare: r,
        gap,
        ...(only ? { only } : {}),
      })
    }
    // Biggest gap first, so the note layer can take types[0] as the headline.
    types.sort((a, b) => b.gap - a.gap)

    // The pitch he goes to MOST each side, written only when the two differ —
    // "against lefties his go-to is the changeup, against righties the sinker".
    // Half the league swaps its primary by side, so the swap alone is not
    // worth a note; it rides along for a note that already has a reason to fire.
    const top = (side) =>
      [...e.types.values()].reduce((best, t) => (best && best[side] >= t[side] ? best : t), null)
    const tl = top('L')
    const tr = top('R')
    const primary =
      tl && tr && tl.code !== tr.code
        ? { l: tl.code, lDescription: tl.description, r: tr.code, rDescription: tr.description }
        : null

    const shownTypes = (side, tot) => [...e.types.values()].filter((t) => share(t[side], tot) >= BREADTH_SHOWN)
    const sl = shownTypes('L', e.L)
    const sr = shownTypes('R', e.R)
    const bl = sl.length
    const br = sr.length
    // WHICH pitches disappear is the note; the count alone is trivia ("six and
    // four" is a table, "the sweeper and the curve stay in the bag against
    // righties" is a scouting report). Named most-thrown first on the side
    // that still sees them, so the note leads with the pitch that matters.
    const missing = (fewer, more, side, tot) => {
      const keep = new Set(fewer.map((t) => t.code))
      return more
        .filter((t) => !keep.has(t.code))
        .sort((a, b) => b[side] - a[side])
        .map((t) => t.description)
    }
    const dropped = bl > br ? missing(sr, sl, 'L', e.L) : missing(sl, sr, 'R', e.R)
    const breadth =
      Math.abs(bl - br) >= BREADTH_GAP ? { l: bl, r: br, ...(dropped.length ? { dropped } : {}) } : null

    if (types.length === 0 && !breadth) continue
    out.set(key, {
      lPitches: e.L,
      rPitches: e.R,
      ...(types.length ? { types } : {}),
      ...(primary ? { primary } : {}),
      ...(breadth ? { breadth } : {}),
    })
  }
  return out
}

export async function loadArsenalSide() {
  const db = await openDb()
  const rows = db
    .prepare(
      // One row per pitcher/level/type/SIDE. Unlike century-club.mjs's read
      // this does NOT group the side away — the side is the whole point.
      `SELECT person_id, level, code, stand, MIN(description) AS description,
              SUM(pitches) AS pitches
       FROM pitch_arsenal_totals
       GROUP BY person_id, level, code, stand
       HAVING SUM(pitches) > 0`,
    )
    .all()
  return arsenalSideFromRows(rows)
}
