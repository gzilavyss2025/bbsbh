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
