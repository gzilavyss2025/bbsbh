// Normalizes the free-text `position` column of the historical contract CSVs
// (scripts/data/contracts/*.csv). The column was hand-typed over decades by a
// third party and holds five different kinds of thing, not one:
//
//   - a single real position, sometimes with trailing whitespace ("1b ")
//   - a compound of up to three positions a player logged that year,
//     dash-separated ("3b-of-c") or slash-separated ("of/1b")
//   - a pitcher tagged with throwing hand plus role: "rhp-s"/"lhp-s" (starter)
//     and "rhp-c"/"lhp-c" (closer). Confirmed against real rows on
//     2026-08-27, not guessed: every "rhp-c"/"lhp-c" row sampled was a known
//     closer (Hader, Iglesias, Williams, Diaz, Chapman, ...) and every
//     "rhp-s"/"lhp-s" row sampled was a known starter (Wheeler, deGrom,
//     Cole, Skubal, ...).
//   - a front-office job title ("GM", "Manager", "SVP, GM", "VP, AGM",
//     "spec ass't to GM", "mgr") -- the club paid a person, not a player
//   - garbage: one leaked numeric id ("72000017") and one 275-character
//     transaction narrative that overwrote the position cell entirely
//
// normalizePosition() is the single place that turns that mess into a closed
// set. Nothing else in the codebase should pattern-match this column by hand.
//
// A cell this cannot confidently parse never gets truncated into something
// that merely LOOKS like a position -- it comes back `primary: 'unknown'`
// (still `isPlayer: true` when the row plainly is a player, e.g. the
// transaction narrative and the 67 blanks) or `isPlayer: false` (a
// front-office title, or the leaked id).
//
// `isPlayer` and `role` answer two different questions -- do not use one for
// the other. `isPlayer` says whether the CELL ITSELF asserts a position;
// `role` says which dataset the ROW belongs in. They disagree on exactly one
// case: the leaked numeric id ("72000017", salaries#4035, Tyler O'Neill,
// 2023). Its cell asserts nothing (`isPlayer: false`), but the row carries
// real service time (`mls: 4.059`) that no front-office title ever does --
// confirmed against the season-players cache and the identity crosswalk,
// which both resolve it to a real outfielder, not a guess. Splitting on
// `isPlayer === false` would file a $4.95M Cardinals payroll row as
// executive compensation. `role` is the field a splitter must read:
// `'front-office'` for a genuine job title, `'player'` for everything else a
// corrupt or missing cell might hide, and `'unknown'` reserved for a future
// cell this function cannot confidently place in either bucket (no row in
// the current export needs it).

// Job titles a club paid, not a playing position. Field managers ("mgr" /
// "Manager") are included: they do not appear on a season player roster
// either, and salaries.csv carries their pay the same way it carries a GM's.
const NON_PLAYER_TITLES = new Set(['gm', 'svp, gm', 'vp, agm', "spec ass't to gm", 'manager', 'mgr'])

// The closed set `primary` and `secondary` resolve to, plus 'unknown'.
// RHP/LHP/SP/RP sit alongside the fielding positions because the source data
// itself splits pitchers two separate ways -- by throwing hand and, on a
// different subset of rows, by role -- and collapsing either into a single
// 'P' would throw away information the row actually carries.
export const POSITIONS = [
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'OF',
  'INF',
  'DH',
  'P',
  'RHP',
  'LHP',
  'SP',
  'RP',
]

const TOKEN_MAP = {
  c: 'C',
  '1b': '1B',
  '2b': '2B',
  '3b': '3B',
  ss: 'SS',
  lf: 'LF',
  cf: 'CF',
  rf: 'RF',
  of: 'OF',
  inf: 'INF',
  dh: 'DH',
  p: 'P',
  rhp: 'RHP',
  lhp: 'LHP',
  sp: 'SP',
  rp: 'RP',
}

const NUMERIC_ID = /^\d+$/

/**
 * Normalizes one salaries.csv `position` cell.
 *
 * @param {string|null|undefined} raw
 * @returns {{
 *   primary: string,
 *   secondary: string[],
 *   isPlayer: boolean,
 *   role: 'player'|'front-office'|'unknown',
 *   raw: string,
 * }}
 */
export function normalizePosition(raw) {
  const original = raw == null ? '' : String(raw)
  const folded = original.trim().toLowerCase()

  if (folded === '') {
    // A blank cell in this file is a real player row with the position never
    // recorded (confirmed against real rows: Alex Rodriguez, Josh Hamilton,
    // Carl Crawford among them), not a non-player row.
    return { primary: 'unknown', secondary: [], isPlayer: true, role: 'player', raw: original }
  }
  if (NON_PLAYER_TITLES.has(folded)) {
    return { primary: 'unknown', secondary: [], isPlayer: false, role: 'front-office', raw: original }
  }
  if (NUMERIC_ID.test(folded)) {
    // A leaked identifier (e.g. a person id), not a position at all -- but,
    // confirmed against a real row (see the header comment), still a
    // player's row. `role` stays 'player' even though `isPlayer` is false:
    // the cell tells us nothing, but nothing here says "front office" either.
    return { primary: 'unknown', secondary: [], isPlayer: false, role: 'player', raw: original }
  }

  // A parenthetical is an editorial aside ("rhp (prev ss)"), not part of the
  // position itself -- drop it before tokenizing.
  const withoutAside = folded.replace(/\(.*?\)/g, '').trim()
  const tokens = withoutAside
    .split(/[-/]/)
    .map((token) => token.trim())
    .filter(Boolean)

  const resolved = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prev = tokens[i - 1]
    const afterPitcherHand = prev === 'rhp' || prev === 'lhp'
    if (afterPitcherHand && token === 's') {
      resolved.push('SP') // e.g. "rhp-s" -- starter, verified above
    } else if (afterPitcherHand && token === 'c') {
      resolved.push('RP') // e.g. "rhp-c" -- closer, verified above
    } else if (TOKEN_MAP[token]) {
      resolved.push(TOKEN_MAP[token])
    } else {
      resolved.push(null) // an unrecognized token voids the whole cell below
    }
  }

  if (resolved.length === 0 || resolved.includes(null)) {
    // Could not confidently parse every token -- e.g. the transaction
    // narrative. The row is still a real player (the name and salary are
    // intact); leave the position unknown rather than guess at one.
    return { primary: 'unknown', secondary: [], isPlayer: true, role: 'player', raw: original }
  }

  const [primary, ...rest] = resolved
  const secondary = [...new Set(rest)].filter((code) => code !== primary)
  return { primary, secondary, isPlayer: true, role: 'player', raw: original }
}
