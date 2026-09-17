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
// TWO FIGURES, NOT FIVE. An entry prints games and one rate — AVG for a bat,
// ERA for an arm — the same two a chip prints, so an entry and its rows cannot
// disagree about more than they have room to say. OPS and OBP are deliberately
// absent: LOG_FIELDS carries no `hitByPitch` and no `sacFlies`, so they cannot
// be computed honestly from these rows at all.
//
// Class: spoiler-free (spoiler-manifest.json). It reads no score, no date and
// no reveal mark — `runs` and `oppRuns` are on every row it folds and it never
// looks at them. It counts rows boxlines/rows.js already approved, and a fold
// can only ever describe a set the gate allowed.

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
  const list = rows ?? []
  if (group === 'pitching') {
    // INNINGS ARE THIRDS. The row carries MLB's own out count for exactly this
    // reason (rows.js): 16 outs and 5 outs are 21, which is seven innings —
    // where Number('5.1') + Number('1.2') is 6.3, a real-looking wrong number.
    const outs = list.reduce((t, r) => t + num(r.counts?.outs), 0)
    const earned = list.reduce((t, r) => t + num(r.counts?.earnedRuns), 0)
    return { games: list.length, rate: outs ? ((earned * 27) / outs).toFixed(2) : null }
  }
  const atBats = list.reduce((t, r) => t + num(r.counts?.atBats), 0)
  const hits = list.reduce((t, r) => t + num(r.counts?.hits), 0)
  return { games: list.length, rate: atBats ? avg3(hits / atBats) : null }
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
