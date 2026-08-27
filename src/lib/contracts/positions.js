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
// (still `isPlayer: true` when the row plainly is a player, e.g. the 67
// blanks) or `isPlayer: false` (a front-office title, or the leaked id).
//
// `isPlayer` and `role` answer two different questions -- do not use one for
// the other. `isPlayer` says whether the CELL ITSELF asserts a position;
// `role` says which of three buckets the ROW's cell content falls in:
//
//   - `'front-office'` -- the cell matches one of the six known job titles.
//   - `'player'` -- the cell names a real position, or is blank (confirmed
//     against real rows: Alex Rodriguez, Josh Hamilton, Carl Crawford among
//     the 67 blanks), or is the one leaked numeric id (confirmed against a
//     real row -- see below).
//   - `'unknown'` -- the cell is neither: it failed to tokenize into any
//     recognized position AND it is not one of the six known titles. This is
//     the loud-failure bucket parseMoney calls `'unparsed'` -- a title this
//     module has never seen ("pitching coach", "asst GM") must land here,
//     not fall through to `'player'` and get silently priced as payroll. The
//     one 275-character transaction narrative also lands here: it is not a
//     known title either, and this module has no way to positively confirm
//     it belongs to a player from the string alone.
//
// `role` is a per-cell classification, not a per-row one -- it does NOT know
// whether the person actually played that season. "mgr" always classifies
// `role: 'front-office'`, even on a row where the man was still an active
// player and the cell simply carries his LATER title (Robin Ventura, 2001:
// `role: 'front-office'` from this function, but he stayed on salaries.csv's
// roster because a season-players cross-check -- done by the row-level
// `resolveRole()` below, not this function -- found him in that year's
// pool). Splitting salaries.csv on `normalizePosition().role` alone, with no
// cross-check, would silently exclude every mislabeled player row.
//
// The leaked numeric id ("72000017", salaries#4035, Tyler O'Neill, 2023) is
// the one case `isPlayer` and `role` disagree on `'player'`'s definition:
// its cell asserts nothing (`isPlayer: false`), but it is a real row --
// carries real service time (`mls: 4.059`) that no front-office title ever
// does, confirmed against the season-players cache and the identity
// crosswalk, both of which resolve it to a real outfielder, not a guess.

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

// Object.create(null): a plain {} object literal inherits Object.prototype,
// so TOKEN_MAP['constructor'] returns the Object constructor function
// instead of undefined -- a real cell reading "constructor" never appears
// today, but nothing rules it out of a future export, and a plain object
// would resolve it to a function as `primary` instead of failing the lookup.
// A null-prototype object has no inherited keys to collide with.
const TOKEN_MAP = Object.assign(Object.create(null), {
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
})

const NUMERIC_ID = /^\d+$/

/**
 * Normalizes one salaries.csv `position` cell. Pure and string-only -- it has
 * no way to know whether the named person actually played that season. See
 * the header comment for what `role` does and does not mean, and see
 * `resolveRole()` below for the row-level check that can tell a mislabeled
 * player's "mgr" cell from a genuine front-office one.
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
    // Could not confidently parse every token, and it is not one of the six
    // known titles either -- e.g. the transaction narrative, or a future
    // title this module has never seen ("pitching coach"). Flag it loudly
    // instead of guessing which bucket it belongs in: primary stays
    // 'unknown' (never truncated into something that looks like a
    // position), and role ALSO stays 'unknown' rather than defaulting to
    // 'player', which would let an unrecognized front-office row hide in the
    // player pool in silence.
    return { primary: 'unknown', secondary: [], isPlayer: true, role: 'unknown', raw: original }
  }

  const [primary, ...rest] = resolved
  const secondary = [...new Set(rest)].filter((code) => code !== primary)
  return { primary, secondary, isPlayer: true, role: 'player', raw: original }
}

/**
 * Row-level classification: normalizePosition()'s `role`, corrected for a
 * cell that carries the person's LATER front-office title on an EARLIER
 * season he was still playing (see the header comment's Robin Ventura
 * example). `seasonPlayerNames` is the set of `lastFirstName` values from
 * that row's own year, e.g.
 * public/data/contracts-history/season-players/{year}.json -- pass it only
 * when a `role: 'front-office'` cell needs the cross-check; omit it (or pass
 * undefined) to get normalizePosition()'s cell-only role unchanged.
 *
 * @param {{ position: string, player: string }} row
 * @param {Set<string>} [seasonPlayerNames]
 * @returns {'player'|'front-office'|'unknown'}
 */
export function resolveRole(row, seasonPlayerNames) {
  const { role } = normalizePosition(row?.position)
  if (role === 'front-office' && seasonPlayerNames?.has(row.player)) {
    return 'player' // the cell's title was real, just for a later season
  }
  return role
}
