// The derivations behind scripts/gen-schedule-shape.mjs — how a season of raw
// schedule rows becomes each club's ORDERED ledger, and how that ledger is cut
// into the three segments a "when did we last..." question is asked about: the
// series, the homestand, and the road trip.
//
// Nothing here reaches the network. The generator fetches; this module only
// shapes, which is what lets test/schedule-shape.test.js import it.
//
// WHY THIS DATASET EXISTS, next to team-records. gen-team-records.mjs already
// keeps a per-game ledger, and its rows already carry series tags. Two things
// it cannot answer:
//
//   1. It holds ONE season. "Hasn't won a series opener in Chicago since 2019"
//      is a question about a decade, and its natural home is a ledger that
//      spans one.
//   2. It costs three calls PER GAME (schedule + box score + play-by-play),
//      because its rows carry errors, home runs, starter lines and a
//      batted-around count. A decade of that is ~73,000 requests. The
//      questions here need date, opponent, side and result and nothing else —
//      and those four all ride on the schedule endpoint, ONE call per season
//      for all thirty clubs. A twelve-season sweep is twelve requests.
//
// So this is deliberately the THIN ledger: fewer facts, far more history. It
// stores facts and never flags, the rule scripts/lib/team-records.mjs argues
// for at length — a changed definition of "road trip" must cost a re-export,
// never a re-fetch.

// ---------------------------------------------------------------------------
// Where a club actually played
// ---------------------------------------------------------------------------

// Each club's home park for ONE season: the venue it hosted the most games in.
//
// Inferred per season rather than read off teams.json, which carries only the
// CURRENT park. Clubs move — the Athletics to Sutter Health Park in 2025, the
// Rays to Steinbrenner Field the same year, the Rangers to Globe Life Field in
// 2020 — and a decade-long ledger that resolved every season against today's
// park would file a club's real home games as neutral-site ones for every year
// before the move. Inferring from the season's own games cannot drift, because
// the answer comes from the same rows the question is asked about.
//
// The mode, not the first seen: a club opening on the road at a neutral site
// (the Seoul and Tokyo Series both do this) would otherwise have that park
// recorded as its home for the year.
export function homeVenueByTeam(games) {
  const tally = new Map()
  for (const g of games) {
    if (g.homeId == null || g.venueId == null) continue
    const key = `${g.homeId}|${g.venueId}`
    tally.set(key, (tally.get(key) ?? 0) + 1)
  }
  const best = new Map()
  for (const [key, n] of tally) {
    const [teamId, venueId] = key.split('|').map(Number)
    const cur = best.get(teamId)
    if (!cur || n > cur.n) best.set(teamId, { venueId, n })
  }
  return new Map([...best].map(([teamId, v]) => [teamId, v.venueId]))
}

// Where one game was played, FROM THIS CLUB'S SIDE: 'home' in its own park,
// 'away' in the opponent's, 'neutral' in anyone else's.
//
// The designated home side is not the same question as the park. MLB names one
// club the home team in London, Mexico City, Seoul, Tokyo and at the Field of
// Dreams, and that club is no more at home than its opponent is. A ledger that
// read the designation alone would count those as homestand games and hand a
// club a homestand it never had.
export function siteOf(game, teamId, homeVenues) {
  const isHomeSide = game.homeId === teamId
  const opponentId = isHomeSide ? game.awayId : game.homeId
  const ownPark = homeVenues.get(teamId)
  const opponentPark = homeVenues.get(opponentId)
  if (isHomeSide) return game.venueId === ownPark ? 'home' : 'neutral'
  return game.venueId === opponentPark ? 'away' : 'neutral'
}

// One club's season, ordered the way it was played. `gameNumber` breaks a
// doubleheader's tie, exactly as gen-team-records.mjs orders its own rows —
// two games share a date, and the opener is whichever was played first.
export function ledgerFor(games, teamId, homeVenues) {
  const mine = games.filter((g) => g.awayId === teamId || g.homeId === teamId)
  mine.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameNumber - b.gameNumber))
  return mine.map((g) => {
    const isHomeSide = g.homeId === teamId
    const runsFor = isHomeSide ? g.homeScore : g.awayScore
    const runsAgainst = isHomeSide ? g.awayScore : g.homeScore
    return {
      date: g.date,
      gameNumber: g.gameNumber,
      opponentId: isHomeSide ? g.awayId : g.homeId,
      site: siteOf(g, teamId, homeVenues),
      result: runsFor > runsAgainst ? 'W' : runsFor < runsAgainst ? 'L' : 'T',
      // The game this row came from, so a caller that wants more than the four
      // shipped facts (the generator, reading a linescore) does not have to
      // re-find it. Never encoded — encodeRow and encodeDetailRow both name the
      // fields they ship.
      source: g,
    }
  })
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

// Walks `rows` once and calls `onSegment(indices)` at every point where `keyOf`
// changes — the shared spine under both taggers below. `keyOf` returning null
// drops a row out of the segmentation entirely WITHOUT ending the run around
// it, which is the whole of the neutral-site rule in tagTrips.
function eachRun(rows, keyOf, onSegment) {
  const live = rows.map((_, i) => i).filter((i) => keyOf(rows[i]) != null)
  let start = 0
  for (let p = 1; p <= live.length; p++) {
    const prev = rows[live[p - 1]]
    const cur = live[p] != null ? rows[live[p]] : null
    if (cur && keyOf(cur) === keyOf(prev)) continue
    onSegment(live.slice(start, p))
    start = p
  }
}

// SERIES: consecutive games against the same opponent in the same place.
//
// Derived from the ledger, NOT from the schedule feed's own seriesGameNumber /
// gamesInSeries — the same call gen-team-records.mjs makes, for the same
// reason. Those two fields describe the series as SCHEDULED: a rained-out
// middle game leaves them describing a set that never happened, and a makeup
// appended to a later trip still carries the original series' numbering. A
// series here is what actually got played.
//
// Neutral-site games are transparent here for the same reason they are in
// tagTrips, and the case that proved it is real: on 2020-09-25 the Brewers
// played a designated HOME game against the Cardinals at Busch Stadium, a
// COVID makeup relocated to save a trip. It sits in the middle of a four-game
// Milwaukee visit to St. Louis. Keyed on its own site it split that visit in
// two and handed the club a series opener on 2020-09-26 that nobody played —
// which is precisely the phantom opener this dataset must never invent.
export function tagSeries(rows) {
  eachRun(
    rows,
    (r) => (r.site === 'neutral' ? null : `${r.opponentId}|${r.site}`),
    (seg) => {
      seg.forEach((i, n) => {
        rows[i].seriesGame = n + 1
        rows[i].seriesLength = seg.length
        rows[i].seriesOpener = n === 0
        rows[i].seriesFinale = n === seg.length - 1
      })
    },
  )
  return rows
}

// HOMESTANDS and ROAD TRIPS: consecutive games on the same side of the road.
// A homestand is a run of home games however many opponents visit inside it; a
// road trip is a run of away games however many cities it crosses. That is the
// everyday sense of both words, and it is the sense the stat this dataset was
// built for uses ("the last time they won game 1 of a road trip").
//
// NEUTRAL-SITE GAMES ARE TRANSPARENT. They belong to no stand and no trip, and
// they do not break the run around them. The alternative — letting one cut a
// run in two — would take a club that played three at home, one at the Field
// of Dreams and three more at home and report TWO homestands, the second with
// an "opener" that was nothing of the kind. A phantom opener is worse than a
// one-game gap, because saying when an opener was last won is the entire job
// of this dataset.
export function tagTrips(rows) {
  eachRun(
    rows,
    (r) => (r.site === 'neutral' ? null : r.site),
    (seg) => {
      const kind = rows[seg[0]].site === 'home' ? 'homestand' : 'trip'
      seg.forEach((i, n) => {
        rows[i].segment = kind
        rows[i].segmentGame = n + 1
        rows[i].segmentLength = seg.length
        rows[i].segmentOpener = n === 0
        rows[i].segmentFinale = n === seg.length - 1
      })
    },
  )
  return rows
}

// ---------------------------------------------------------------------------
// The shipped form
// ---------------------------------------------------------------------------

// A shipped row is a 4-element array, not an object: [mmdd, opponentId, site,
// result]. One club's decade is ~1,900 rows, and the object form spends more
// than half its bytes re-printing the same four key names on every one of them.
//
// The season prefix comes off the date because the rows already sit under their
// season's key. Site and result are small integers for the same reason. SITE
// and RESULT are the only place those integers are named on this side; the
// reader (src/api/scheduleShape.js) imports nothing from a scripts/ module, so
// it carries its own copy and test/schedule-shape.test.js pins the two together.
export const SITE = { away: 0, home: 1, neutral: 2 }
export const RESULT = { L: 0, W: 1, T: 2 }

export function encodeRow(row) {
  return [row.date.slice(5), row.opponentId, SITE[row.site], RESULT[row.result]]
}

// ---------------------------------------------------------------------------
// Per-game detail (the recent seasons only)
// ---------------------------------------------------------------------------

// What a game DID, beyond who won it: runs, hits, errors, the lead carried into
// the 8th and 9th, and the handful of one-bit facts a linescore settles.
//
// These ride on the SAME schedule request as everything else, behind
// `hydrate=linescore` — which is why a decade of them would be affordable and
// is still not stored. An event drought is counted in chances, and these events
// come around every twenty games or so, so the longest one a club can plausibly
// be carrying is a season or two; DETAIL_SEASONS in the generator keeps three.
// The twelve-season depth exists for the opponent-narrowed SLOT droughts, where
// a club visits one park twice a year and the question genuinely reaches back.
//
// FACTS, NOT VERDICTS, the same rule as everywhere else here. `everTrailed` and
// `everLed` are stored; "came from behind" and "blew it" are the reader's
// definitions, built from those two and the result. Storing the verdicts would
// make "does a tie count as trailing?" a re-fetch instead of an edit.
export const FLAG = {
  extra: 1,
  walkOffWin: 2,
  walkOffLoss: 4,
  scoredIn1st: 8,
  scoredFirst: 16,
  oppScoredFirst: 32,
  everTrailed: 64,
  everLed: 128,
}

// The cumulative score after each HALF inning, from this club's side. A home
// side that did not bat carries its previous total forward rather than a null:
// "we were still three up" is true whether or not the bottom half was played.
function leadTrack(innings, isHome) {
  const marks = []
  let away = 0
  let home = 0
  let everTrailed = false
  let everLed = false
  const see = () => {
    const me = isHome ? home : away
    const them = isHome ? away : home
    if (me < them) everTrailed = true
    if (me > them) everLed = true
  }
  for (const inn of innings) {
    away += inn.a
    see()
    if (inn.h != null) home += inn.h
    see()
    marks.push((isHome ? home : away) - (isHome ? away : home))
  }
  return { marks, everTrailed, everLed, awayTotal: away }
}

// `innings` is the `{ a, h }` shape per inning, `h` null when the home side did
// not bat.
export function detailFacts({ innings, scheduledInnings, isHome }) {
  const { marks, everTrailed, everLed, awayTotal } = leadTrack(innings, isHome)

  // A walk-off: the home side scored in the final half, was not already ahead
  // when that half began, and finished in front. Read off the linescore because
  // no feed field says so — and the "not already ahead" clause is what
  // separates a walk-off from a home side adding runs in the bottom of the
  // ninth of a game it was winning anyway.
  const last = innings[innings.length - 1]
  let homeBefore = 0
  for (let i = 0; i < innings.length - 1; i++) homeBefore += innings[i].h ?? 0
  const homeTotal = homeBefore + (last?.h ?? 0)
  const walkOff = Boolean(last?.h > 0 && homeBefore <= awayTotal && homeTotal > awayTotal)

  let first = 0
  for (const inn of innings) {
    if (inn.a > 0) { first = isHome ? -1 : 1; break }
    if (inn.h > 0) { first = isHome ? 1 : -1; break }
  }

  let flags = 0
  if (innings.length > (scheduledInnings ?? 9)) flags |= FLAG.extra
  if (walkOff) flags |= isHome ? FLAG.walkOffWin : FLAG.walkOffLoss
  if ((isHome ? innings[0]?.h : innings[0]?.a) > 0) flags |= FLAG.scoredIn1st
  if (first === 1) flags |= FLAG.scoredFirst
  if (first === -1) flags |= FLAG.oppScoredFirst
  if (everTrailed) flags |= FLAG.everTrailed
  if (everLed) flags |= FLAG.everLed

  return {
    // The margin carried INTO the 8th and INTO the 9th — i.e. after 7 and after
    // 8 complete innings. Null when the game did not get there, which a
    // rain-shortened game and a seven-inning doubleheader both do: a club
    // cannot blow a ninth-inning lead in a game with no ninth inning, and the
    // row must say "no chance" rather than "no lead".
    leadAfter7: marks.length >= 7 ? marks[6] : null,
    leadAfter8: marks.length >= 8 ? marks[7] : null,
    flags,
  }
}

// The wide shipped row: the thin four, then runs, hits and errors both ways,
// the two lead marks, and the flag word. A season either ships all-thin rows or
// all-wide ones, and the reader tells them apart by LENGTH — self-describing,
// with no alignment to keep between two parallel arrays.
export function encodeDetailRow(row, detail) {
  return [
    ...encodeRow(row),
    row.runsFor, row.runsAgainst,
    row.hits ?? null, row.oppHits ?? null,
    row.errors ?? null, row.oppErrors ?? null,
    detail.leadAfter7, detail.leadAfter8, detail.flags,
  ]
}
