// BOX LINES — the fold behind a LIST door (ADR-0069, issue #1048). Most doors
// on the Game lines card are one question: a career line, and the games that
// add up to it. A few questions have too many answers to be doors — the nine
// spots in the batting order, and #998's thirty-six ballparks — so they get ONE
// door that opens a LIST: the groups, his line at each, and each group opening
// its own rows.
//
// THE FIGURES COME FROM THE ROWS, WHICH IS THE WHOLE POINT. Every other door
// takes its line from a career aggregate MLB publishes (careerSplits.js) and
// its rows from the game log, and the two agree or they nearly do. The batting
// order is the case where they do NOT, and not by a game or two: MLB's
// `sitCodes=b1…b9` count games with a PLATE APPEARANCE in a slot, where a
// lineup counts who STARTED there, and a pinch hitter bats in the slot he hit
// for. Yelich reads 18 games at b9 and started there 0 times. A door labelled
// "Batting ninth: 18 G" over an empty sheet is exactly the silent failure the
// registry's test file exists to prevent — and substitution concentrates in the
// low slots, so the worst cases are the ones a reader is most likely to tap.
// Folding the gated rows is what makes an entry and the sheet behind it agree
// BY CONSTRUCTION: they are the same rows, counted once and then shown.
//
// A FOLDED LINE IS THEREFORE NOT A CAREER LINE, and that is correct rather than
// a shortfall. On a page carrying `?d=` it stops where the rows stop, which is
// what the cutoff means. Do not "fix" it by labelling an entry from
// careerStatSplits: that is the disagreement above, reintroduced.
//
// TWO FIGURES IN THE LIST, TWELVE IN THE GROUP A READER PICKS. An ENTRY prints
// games and one rate — AVG for a bat, ERA for an arm — because it is one row of
// a comparison, and a comparison is read down a column. The group a reader then
// picks gets `foldStats`: the whole box-score vocabulary, folded from the same
// rows, because the drilldown is where someone went FOR the detail. They are
// two renderings of one fold, and a test pins them to each other.
//
// EVERY FIGURE IS FOLDED, none fetched. That is what lets the summary and the
// games under it agree — they are the same rows, added up once. `LOG_FIELDS`
// (fetch.js) asks for exactly the components these need: a hitter's
// `plateAppearances`, `hitByPitch` and `sacFlies` were added for the ON-BASE
// half, which cannot be computed honestly without them, and a pitcher's
// `homeRuns` because a ballpark's question IS the home run.
//
// Class: spoiler-free (spoiler-manifest.json). It reads no score, no date and
// no reveal mark — `runs` and `oppRuns` are on every row it folds and it never
// looks at them. It counts rows boxlines/rows.js already approved, and a fold
// can only ever describe a set the gate allowed.

import { outsToIp } from '../person/shared.js'

// What an entry's two figures are CALLED, in the order `foldLine` returns them
// and the vocabulary the card's own columns already print (careerSplits.js's
// DOOR_COLUMNS, whose first name is the same G).
export const LIST_COLUMNS = {
  hitting: ['G', 'AVG'],
  pitching: ['G', 'ERA'],
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Every counting stat a set of rows holds, added once. Both readers below take
// their figures from here, so an entry and the grid it opens cannot be folded
// two different ways.
function totals(rows, group) {
  const list = rows ?? []
  const sum = (k) => list.reduce((t, r) => t + num(r.counts?.[k]), 0)
  if (group === 'pitching') {
    return {
      games: list.length,
      starts: sum('starts'),
      // INNINGS ARE THIRDS. The row carries MLB's own out count for exactly
      // this reason (rows.js): 16 outs and 5 outs are 21, which is seven
      // innings — where Number('5.1') + Number('1.2') is 6.3, a real-looking
      // wrong number. Every rate below divides by these outs, never by a
      // summed "6.1".
      outs: sum('outs'),
      hits: sum('hits'),
      runs: sum('runs'),
      earnedRuns: sum('earnedRuns'),
      homeRuns: sum('homeRuns'),
      baseOnBalls: sum('baseOnBalls'),
      strikeOuts: sum('strikeOuts'),
    }
  }
  const hits = sum('hits')
  const doubles = sum('doubles')
  const triples = sum('triples')
  const homeRuns = sum('homeRuns')
  return {
    games: list.length,
    plateAppearances: sum('plateAppearances'),
    atBats: sum('atBats'),
    hits,
    doubles,
    triples,
    homeRuns,
    rbi: sum('rbi'),
    baseOnBalls: sum('baseOnBalls'),
    strikeOuts: sum('strikeOuts'),
    stolenBases: sum('stolenBases'),
    hitByPitch: sum('hitByPitch'),
    sacFlies: sum('sacFlies'),
    // TOTAL BASES, built rather than fetched: a single is one base, so the sum
    // is the hits plus one more for each double, two for each triple and three
    // for each home run. MLB publishes `totalBases` on an aggregate and not on
    // a game log, and this is the identity it would have sent.
    totalBases: hits + doubles + 2 * triples + 3 * homeRuns,
  }
}

// ".293" — three places, no leading zero, the way a scorebook writes an
// average. The same shape careerSplits.js's own rate3 keeps, and for the same
// reason: two renderings of one figure must not spell it two ways.
function avg3(v) {
  const s = v.toFixed(3)
  return s.startsWith('0.') ? s.slice(1) : s
}

// ONE LINE OVER A SET OF ROWS: how many games, and the one rate that answers
// "how well". A RATE IS NOT AN AVERAGE OF RATES — 1 for 4 and 2 for 2 is 3 for
// 6, .500, where the average of .250 and 1.000 is .625 — so this adds the
// counting stats and divides once, which is what the combined rate IS. It is
// the same arithmetic mergeCareerSplits does over two MLB aggregates, done
// here over n gated rows.
//
// `rate` is null, never a zero, when the denominator is missing: a group of
// games with no at-bats would print ".000" and say he came up and failed, and a
// group with no outs would divide by zero. The surfaces draw the card's quiet
// mark there, the way a games-only door's four empty cells do.
export function foldLine(rows, group) {
  const t = totals(rows, group)
  return group === 'pitching'
    ? { games: t.games, rate: era(t) }
    : { games: t.games, rate: t.atBats ? avg3(t.hits / t.atBats) : null }
}

// MLB'S OWN ROUNDING, copied deliberately: OPS is not OBP + SLG at full
// precision. Each half is rounded to three places and THOSE are added, which is
// how .559 + .630 comes to 1.189 where the unrounded sum is 1.1884 and would
// print 1.188. careerSplits.js's merge does the same, and both are held to
// MLB's own published strings.
const round3 = (v) => Math.round(v * 1000) / 1000

// Earned runs times nine, over innings — which is outs/3, so `* 27 / outs`.
// Null and never "0.00" when he recorded no out: a zero there is a claim, and
// it is not a true one.
function era(t) {
  return t.outs ? ((t.earnedRuns * 27) / t.outs).toFixed(2) : null
}

// THE WHOLE LINE, for the group a reader picked — counts first, then rates,
// which is the order a box score is read in and the order this app's own stat
// grids print. Each cell is `{ k, v }`: the name, and the figure, or NULL where
// there is no denominator to divide by. A null draws the grid's quiet mark; a
// zero would be a claim nobody made.
export function foldStats(rows, group) {
  const t = totals(rows, group)
  const int = (v) => String(v)
  if (group === 'pitching') {
    const innings = t.outs / 3
    return [
      { k: 'G', v: int(t.games) },
      // Whether these were starts or relief outings, which changes what every
      // figure under it means.
      { k: 'GS', v: int(t.starts) },
      { k: 'IP', v: outsToIp(t.outs) },
      { k: 'H', v: int(t.hits) },
      { k: 'R', v: int(t.runs) },
      { k: 'ER', v: int(t.earnedRuns) },
      // A PARK'S QUESTION IS THE HOME RUN, which is why the pitching log now
      // asks for it: Coors against Oracle is this cell.
      { k: 'HR', v: int(t.homeRuns) },
      { k: 'BB', v: int(t.baseOnBalls) },
      { k: 'K', v: int(t.strikeOuts) },
      { k: 'ERA', v: era(t) },
      // Walks and hits per inning, and strikeouts per nine — the two rates that
      // survive a short sample (a dozen games at one park), where a win-loss
      // record says almost nothing about how he pitched.
      { k: 'WHIP', v: innings ? ((t.baseOnBalls + t.hits) / innings).toFixed(2) : null },
      { k: 'K/9', v: innings ? ((t.strikeOuts * 9) / innings).toFixed(2) : null },
    ]
  }
  // THE SLASH LINE, which says the thing OPS alone cannot: whether he got on
  // base or hit for power. On-base needs `hitByPitch` and `sacFlies`, and that
  // is the whole reason LOG_FIELDS asks for them.
  const reached = t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies
  const obp = reached ? (t.hits + t.baseOnBalls + t.hitByPitch) / reached : null
  const slg = t.atBats ? t.totalBases / t.atBats : null
  return [
    { k: 'G', v: int(t.games) },
    { k: 'PA', v: int(t.plateAppearances) },
    { k: 'H', v: int(t.hits) },
    { k: 'HR', v: int(t.homeRuns) },
    { k: 'RBI', v: int(t.rbi) },
    { k: 'BB', v: int(t.baseOnBalls) },
    { k: 'K', v: int(t.strikeOuts) },
    { k: 'SB', v: int(t.stolenBases) },
    { k: 'AVG', v: t.atBats ? avg3(t.hits / t.atBats) : null },
    { k: 'OBP', v: obp == null ? null : avg3(obp) },
    { k: 'SLG', v: slg == null ? null : avg3(slg) },
    { k: 'OPS', v: obp == null || slg == null ? null : avg3(round3(obp) + round3(slg)) },
  ]
}

// Biggest group first, ties broken on the NAME — never on the order the rows
// happened to arrive in, or a list re-sorts itself when one game lands, which
// on thirty-six ballparks is most of the list moving for no reason a reader
// can see.
function byGames(a, b) {
  return b.games - a.games || String(a.name).localeCompare(String(b.name))
}

// Up the sequence. Numeric when both keys are numbers (the batting order),
// otherwise by name, so a future list keyed by a string still orders sanely.
function byKey(a, b) {
  const numeric = typeof a.key === 'number' && typeof b.key === 'number'
  return numeric ? a.key - b.key : String(a.name).localeCompare(String(b.name))
}

// THE GROUPS BEHIND ONE LIST DOOR. `list` is the descriptor a registry entry
// carries (boxlines/cardFacets.js): `groupBy` says which group a row belongs
// to, `name` what that group is called, `order` how the groups are read, and
// `facet` what the sheet asks for when a reader taps one.
//
// A null group key DROPS the row. The rows handed in are all of his gated
// games, and the ones a list cannot describe leave it rather than collecting
// under a tenth heading — a bench appearance is under no slot in the order.
//
// A GROUP WITH NO ROWS CANNOT EXIST, because the groups are built FROM the
// rows: a player who has never batted ninth gets eight entries, not a ninth
// reading "0 G, .000". That is also why an entry never needs to be hidden.
export function foldGroups(rows, list, group) {
  if (!list || !rows?.length) return []
  const groups = new Map()
  for (const row of rows) {
    const key = list.groupBy(row)
    if (key == null) continue
    const found = groups.get(key)
    if (found) found.push(row)
    else groups.set(key, [row])
  }
  const out = [...groups.entries()].map(([key, mine]) => ({
    key,
    // The rows arrive newest first (rows.js sorts them), so `mine[0]` is the
    // group's newest — which is what #998's park name will be read off, so a
    // club that renamed its stadium is listed under what it is called now.
    name: list.name(key, mine[0]),
    games: mine.length,
    line: foldLine(mine, group),
    facet: list.facet(key),
  }))
  return out.sort(list.order === 'games' ? byGames : byKey)
}
