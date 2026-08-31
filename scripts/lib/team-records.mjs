// The derivations behind scripts/gen-team-records.mjs — the per-game FACTS a
// club's situational records are summed from, the export-time flags those
// facts collapse into, and the small role-fact store the opener split reads.
// Nothing here reaches the network: the one function that needs a feed takes
// the fetcher as an argument, which is what makes its failure path testable.
//
// WHY THIS SPLIT EXISTS. The generator stores raw facts per (game, club) and
// derives every flag at EXPORT time, never at ingest. A Final game's linescore
// is immutable, so it is fetched exactly once and never again — but a
// DEFINITION is not immutable ("batted around" at 9 batters or 10? does a
// two-game sweep count?). Storing flags would mean re-fetching ten thousand
// games every time one of those calls changed, which is precisely the bill
// gen-pitch-arsenal.mjs and gen-comeback-wins.mjs have both already paid
// (a --since backfill and a --rebuild respectively, both for a column
// addition). Storing facts means a changed definition costs `--export-only`
// and no network at all. Read scripts/CLAUDE.md's generator rules before
// moving anything here into the ingest path.
//
// A generator file is a top-level script: importing one RUNS it. These helpers
// live here rather than in the generator so test/team-records.test.js can
// import them (the lib/roster.mjs convention).

// ---------------------------------------------------------------------------
// Linescore
// ---------------------------------------------------------------------------

// The per-inning run pairs, `{ a, h }` per inning in order. `h` is NULL when
// the home team did not bat in that inning — a real and common shape, not a
// thin feed: the home side skips the bottom half when it is already ahead
// after the top of the last inning, and a walk-off ends the half early. Every
// consumer below has to treat "home never batted" differently from "home
// batted and scored nothing", which is why this keeps null rather than
// coalescing to 0.
export function inningRuns(linescore) {
  return (linescore?.innings ?? []).map((i) => ({
    a: Number(i?.away?.runs) || 0,
    h: i?.home && i.home.runs != null ? Number(i.home.runs) || 0 : null,
  }))
}

// The stored form of the same line: a flat array of `[away, home]` pairs, home
// null when that side did not bat. Compact on purpose — the committed SQL dump
// carries one of these per club per game (~20,600 a season across five
// levels), and `[[0,1],[2,0]]` is a quarter the bytes of the `{a,h}` objects
// the rest of this module reads.
export function encodeInnings(innings) {
  return innings.map((i) => [i.a, i.h])
}
export function decodeInnings(encoded) {
  return (encoded ?? []).map(([a, h]) => ({ a, h }))
}

// The club's OWN scoring line, as a bitmask: bit `n-1` is set when the club
// scored in inning `n` of the half it bats (the top when it is the road club,
// the bottom when it is at home). One small integer instead of the pair array
// — the shipped per-game row is ~160 rows per club per season and committed,
// and every situational-record predicate only ever asks "did we score there",
// never how many.
//
// A home side that did not bat (`h` null — it was already ahead after the top
// of the last inning, or walked the game off early) never scored, so its bit
// stays clear. That is the same distinction inningRuns keeps null for.
//
// Capped at 31 bits so the value stays a positive 32-bit integer: bit 31 would
// make it negative and `put`'s omit-if-falsy path would still keep it, but a
// reader's `1 << 31` comparison would then have to reason about the sign. The
// longest game on record is 26 innings, so the cap is unreachable in practice.
const MASK_BITS = 31
export function inningsScoredMask(innings, isHome) {
  let mask = 0
  for (let i = 0; i < innings.length && i < MASK_BITS; i++) {
    const mine = isHome ? innings[i].h : innings[i].a
    if (mine != null && mine > 0) mask |= 1 << i
  }
  return mask
}

// Did the club score after the game's SCHEDULED length ran out? A separate
// flag rather than "any bit at or above the ninth", because a MiLB
// doubleheader is scheduled for seven and its eighth inning is extra baseball
// — reading extras off a fixed bit position would miss every one of those and
// would also call a nine-inning game's ninth inning regulation at a level
// where it is not. `scheduledInnings` is the game's own answer, the same field
// the `x` (went to extras) flag is derived from.
export function scoredInExtras(innings, isHome, scheduledInnings) {
  if (!scheduledInnings) return false
  for (let i = scheduledInnings; i < innings.length; i++) {
    const mine = isHome ? innings[i].h : innings[i].a
    if (mine != null && mine > 0) return true
  }
  return false
}

// Which side put the game's first run on the board, or null for a 0-0 game
// (suspended/shortened — a Final regular-season game can be 0-0 only if it
// was called). The away side bats the top of every inning, so within one
// inning the away run is always FIRST; that ordering is what makes this exact
// without play-by-play.
export function scoredFirstSide(innings) {
  for (const i of innings) {
    if (i.a > 0) return 'away'
    if (i.h != null && i.h > 0) return 'home'
  }
  return null
}

// Running totals after each COMPLETED half-inning, oldest first, as
// `{ a, h }` cumulative pairs. The unit every "was this club ever ahead"
// question is answered over — a lead that existed only mid-half (before the
// other side finished batting) is not a lead anybody was ever ahead by.
export function cumulativeHalves(innings) {
  const out = []
  let a = 0
  let h = 0
  for (const i of innings) {
    a += i.a
    out.push({ a, h })
    if (i.h == null) continue
    h += i.h
    out.push({ a, h })
  }
  return out
}

// The club's lead state after `n` completed innings: 1 ahead, 0 tied, -1
// behind — or null when the game never finished that inning, which is what
// keeps a rain-shortened seven-inning game out of the "after 8 innings" rows
// instead of silently counting as tied. An inning counts as complete when a
// later inning exists, or when the home side batted in it.
export function leadStateAfter(innings, n, isHome) {
  if (innings.length < n) return null
  if (innings.length === n && innings[n - 1].h == null) return null
  let a = 0
  let h = 0
  for (let i = 0; i < n; i++) {
    a += innings[i].a
    h += innings[i].h ?? 0
  }
  const mine = isHome ? h : a
  const theirs = isHome ? a : h
  return mine > theirs ? 1 : mine < theirs ? -1 : 0
}

// Whether the club was ever ahead, and ever behind, at the end of some
// half-inning. Feeds come-from-behind wins and losses-after-leading, which are
// the same two facts read against the result.
export function leadTrailFlags(innings, isHome) {
  let led = false
  let trailed = false
  for (const c of cumulativeHalves(innings)) {
    const mine = isHome ? c.h : c.a
    const theirs = isHome ? c.a : c.h
    if (mine > theirs) led = true
    if (mine < theirs) trailed = true
  }
  return { led, trailed }
}

// Was the game decided in the winner's final at-bat, and was it a walk-off?
//
// DEFINITION, because there is no official one and the phrase gets used two
// ways: the winner took the lead FOR GOOD in the last half-inning it batted.
// That covers both shapes people mean by it — the home club walking it off,
// and the road club scoring in the top of the last inning to break a tie or
// take the lead it then holds. A club that was already ahead entering its
// final at-bat and simply padded the margin did not decide anything there.
//
// Returns `{ decided, walkOff }` from the WINNER's side; a tie returns both
// false. `walkOff` is true only for the home club's version.
export function lastAtBatOutcome(innings, homeWon) {
  if (homeWon == null || innings.length === 0) return { decided: false, walkOff: false }
  const last = innings[innings.length - 1]
  let a = 0
  let h = 0
  for (const i of innings) {
    a += i.a
    h += i.h ?? 0
  }
  if (homeWon) {
    // The home club's last at-bat is the bottom of the final inning. If it
    // never batted there, the game was decided earlier by definition.
    if (last.h == null) return { decided: false, walkOff: false }
    const beforeH = h - last.h
    return { decided: beforeH <= a, walkOff: beforeH <= a }
  }
  // The away club's last at-bat is the top of the final inning. Compare
  // against the home total ENTERING that half — the home side may still bat
  // afterwards (and lose), which does not change where the game was decided.
  const beforeA = a - last.a
  const homeBefore = h - (last.h ?? 0)
  return { decided: beforeA <= homeBefore, walkOff: false }
}

// ---------------------------------------------------------------------------
// Pitching
// ---------------------------------------------------------------------------

// Innings pitched ("5.1" = 5⅓) → outs. Same conversion as the app's own
// ipToOuts (src/screens/team/data/shared.js, api/teamLeaders.js); duplicated
// here rather than imported because those live under src/ and carry JSX-era
// imports a generator has no business loading.
export function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return (Number(whole) || 0) * 3 + (Number(frac[0]) || 0)
}

// A quality start: at least 6 innings, at most 3 earned runs. The standard
// definition, and deliberately not a house variant.
export function isQualityStart(outs, earnedRuns) {
  if (outs == null || earnedRuns == null) return false
  return outs >= 18 && earnedRuns <= 3
}

// The starter's line out of one side of a boxscore. `pitchers[0]` is the
// actual starter, which is the point — a probable pitcher is a prediction and
// is wrong often enough (late scratch, opener, bullpen game) to be useless for
// a record. Returns nulls for a side with no pitching line at all rather than
// throwing, since a thin MiLB feed does occur.
export function starterLine(side) {
  const id = side?.pitchers?.[0]
  const stat = id != null ? side?.players?.[`ID${id}`]?.stats?.pitching : null
  if (id == null || !stat) return { id: id ?? null, outs: null, earnedRuns: null }
  return {
    id,
    outs: ipToOuts(stat.inningsPitched),
    earnedRuns: Number(stat.earnedRuns) || 0,
  }
}

// ---------------------------------------------------------------------------
// The first pitcher's role
// ---------------------------------------------------------------------------

// A planned OPENER and a starter yanked after five outs are the same shape in
// the feed. statsapi carries no role, note or flag anywhere that separates
// them, at any level, so the two records that want to name one of them have to
// infer it.
//
// LENGTH ALONE WILL NOT DO IT, which is the finding that put this here. Over
// the 2026 MLB season, of the first-pitcher appearances of five outs or fewer
// about a quarter belonged to pitchers who start for a living — an injury, an
// ejection, a first inning that got away. The ceiling is still right where it
// was: the very next band up, six to eight outs, is majority real starter, so
// reaching higher would cost more than it buys. It is the FLOOR that misleads,
// and the shortest outings of all split roughly evenly.
const SHORT_START_OUTS = 5

// So the pitcher's own season decides it: what share of his appearances AT
// THIS LEVEL were starts. Half is the line, and it is a judgement call rather
// than a standard — named here so that moving it is one edit and an
// `--export-only` run, never a re-fetch.
const ROTATION_START_SHARE = 0.5

// 'rotation' | 'relief' | null. Null is a real answer, not a failure: a level
// whose season stats carry no row for the pitcher leaves the question open,
// and the caller must not guess.
export function starterProfile(facts) {
  const played = Number(facts?.gamesPlayed)
  const started = Number(facts?.gamesStarted)
  if (!Number.isFinite(played) || !Number.isFinite(started) || played <= 0) return null
  return started / played >= ROTATION_START_SHARE ? 'rotation' : 'relief'
}

// What the game's first pitcher was doing, as the one small number the shipped
// row carries: 1 an opener, 2 a starter who exited early, 0 for everything
// else — an ordinary outing, a role the join could not answer, or a side with
// no pitching line at all. 0 is omitted from the shipped row like every other
// falsy value, so an unclassified game enters NEITHER specialized record and
// the general "Starter goes under 6" row still holds it.
//
// All four records read this single number, so the club and opponent forms can
// never disagree, and no reader ever re-applies the five-out test itself.
const FIRST_PITCHER_OPENER = 1
const FIRST_PITCHER_EARLY_EXIT = 2
export function firstPitcherKind(outs, facts) {
  if (outs == null || outs > SHORT_START_OUTS) return 0
  const profile = starterProfile(facts)
  if (!profile) return 0
  return profile === 'relief' ? FIRST_PITCHER_OPENER : FIRST_PITCHER_EARLY_EXIT
}

// One season's role facts are keyed by LEVEL and pitcher together: the same
// arm can start at Triple-A and relieve in the majors, and a game has to be
// read against the role its own level saw.
export const roleKey = (sportId, personId) => `${sportId}:${personId}`

// The (level, pitcher) pairs a season's ledger can ever ask about — the arms
// that actually threw a first pitch, either side. `rows` is the stored ledger,
// `{ sport_id, payload_json }` per (game, club).
export function firstPitchersOnFile(rows) {
  const wanted = new Set()
  for (const r of rows ?? []) {
    const p = JSON.parse(r.payload_json)
    for (const id of [p.starterId, p.oppStarterId]) {
      if (id != null) wanted.add(roleKey(r.sport_id, id))
    }
  }
  return wanted
}

// The stored role table, as the map both the refresh and the export read.
export function storedRoleFacts(rows) {
  return new Map(
    (rows ?? []).map((r) => [
      roleKey(r.sport_id, r.person_id),
      {
        sportId: r.sport_id,
        personId: r.person_id,
        gamesPlayed: r.games_played,
        gamesStarted: r.games_started,
      },
    ]),
  )
}

// The role rows to hold after a refresh, keyed the same way, within one
// season. `snapshots` is one entry per swept level, `{ sportId, roles }`, with
// `roles` NULL when that level's bulk call failed.
//
// A FAILED LEVEL CONTRIBUTES NOTHING and its stored rows survive untouched.
// That is the whole reason these facts are persisted rather than fetched at
// export time: the export re-writes every club file on every run, so one bad
// response would otherwise strip two records from 150 shards at once and
// nothing about the output would look wrong.
//
// `wanted` narrows what is KEPT to the arms that actually threw a first pitch
// on file. Fetching is bulk and costs the same either way; storing every
// pitcher at six levels would nearly treble the committed dump with rows no
// record can read.
export function mergeRoleFacts(stored, snapshots, wanted = null) {
  const out = new Map(stored)
  for (const { sportId, roles } of snapshots ?? []) {
    if (!roles) continue
    for (const [id, facts] of Object.entries(roles)) {
      const personId = Number(id)
      const key = roleKey(sportId, personId)
      if (wanted && !wanted.has(key)) continue
      out.set(key, {
        sportId,
        personId,
        gamesPlayed: Number(facts?.gamesPlayed) || 0,
        gamesStarted: Number(facts?.gamesStarted) || 0,
      })
    }
  }
  return out
}

// Re-read one season's role facts into the ledger's own SQLite group, so the
// export joins them with no network at all — which is what keeps
// `--export-only` a genuinely offline mode. Returns the line to log.
//
// `fetchRoles(sportId, season)` is injected rather than imported, which is
// what makes the failure path testable: a level whose fetch returns null keeps
// every row it already had, and the re-exported shards keep their flags. The
// generator calls this AFTER its sweep, since tonight's games can introduce a
// first pitcher nobody had seen and the wanted set is read off the ledger as
// it then stands.
export async function refreshRoleFacts(db, season, sportIds, fetchRoles) {
  const wanted = firstPitchersOnFile(
    db.prepare('SELECT sport_id, payload_json FROM team_record_games WHERE season = ?').all(season),
  )
  const stored = storedRoleFacts(
    db.prepare('SELECT * FROM team_record_pitcher_roles WHERE season = ?').all(season),
  )
  const snapshots = []
  for (const sportId of sportIds) snapshots.push({ sportId, roles: await fetchRoles(sportId, season) })
  const failed = snapshots.filter((s) => !s.roles).map((s) => s.sportId)
  const merged = mergeRoleFacts(stored, snapshots, wanted)
  const put = db.prepare(
    `INSERT OR REPLACE INTO team_record_pitcher_roles
       (person_id, season, sport_id, games_played, games_started) VALUES (?, ?, ?, ?, ?)`,
  )
  for (const f of merged.values()) put.run(f.personId, season, f.sportId, f.gamesPlayed, f.gamesStarted)
  return (
    `${merged.size} pitcher role fact(s) on file for ${season}` +
    (failed.length ? `; kept the last snapshot for sportId ${failed.join(', ')}` : '')
  )
}

// ---------------------------------------------------------------------------
// Play-by-play
// ---------------------------------------------------------------------------

// How many half-innings each side sent `minBatters`+ hitters to the plate in.
//
// DEFINITION: 10 plate appearances, so the leadoff hitter of the inning bats a
// second time. "Batting around" gets used for 9 (everyone hits once) too; 10
// is the stricter reading and the one that makes the count mean something.
// Change the constant, re-run --export-only, and no game is refetched.
//
// Filters on `result.type === 'atBat'`. allPlays interleaves top-level
// baserunning plays (steals, pickoffs, balks, wild pitches) with real plate
// appearances — gen-run-expectancy.mjs's header records the same trap — and
// counting those would inflate a half-inning that never turned the lineup over.
export function battedAroundHalves(allPlays, minBatters = 10) {
  const perHalf = new Map()
  for (const p of allPlays ?? []) {
    if (p?.result?.type !== 'atBat') continue
    const inning = p?.about?.inning
    const half = p?.about?.halfInning
    if (inning == null || !half) continue
    const key = `${half}-${inning}`
    perHalf.set(key, (perHalf.get(key) ?? 0) + 1)
  }
  let away = 0
  let home = 0
  for (const [key, count] of perHalf) {
    if (count < minBatters) continue
    if (key.startsWith('top')) away++
    else home++
  }
  return { away, home }
}

// ---------------------------------------------------------------------------
// Series (needs the club's ORDERED ledger, not one game)
// ---------------------------------------------------------------------------

// Groups one club's season rows into series and tags each row with its place
// in one: `seriesGame` (1-based), `seriesLength`, `opener`, `finale`.
//
// DERIVED FROM THE LEDGER, not from the feed's own `seriesGameNumber` /
// `gamesInSeries`. Those two describe the series as SCHEDULED; a rained-out
// middle game leaves them describing a series that never happened, and a
// makeup game appended to the next trip carries the old series' numbering. A
// series here is what actually got played: consecutive games against the same
// opponent at the same venue, with no other opponent in between. Both halves
// of a doubleheader belong to the series they are played inside.
//
// `rows` must be sorted by (date, gameNumber) ascending — the order
// gen-team-records.mjs reads them out of SQLite in.
export function tagSeries(rows) {
  let seriesStart = 0
  const boundaries = []
  for (let i = 1; i <= rows.length; i++) {
    const prev = rows[i - 1]
    const cur = rows[i]
    const sameSeries =
      cur != null && cur.opp_id === prev.opp_id && cur.venue_id === prev.venue_id
    if (sameSeries) continue
    boundaries.push([seriesStart, i - 1])
    seriesStart = i
  }
  const tagged = rows.map((r) => ({ ...r }))
  for (const [start, end] of boundaries) {
    const length = end - start + 1
    for (let i = start; i <= end; i++) {
      tagged[i].seriesGame = i - start + 1
      tagged[i].seriesLength = length
      tagged[i].opener = i === start
      tagged[i].finale = i === end
    }
  }
  return tagged
}

// A getaway day: the last game of a series that this club then LEAVES — its
// next game is at a different venue. The everyday sense of the phrase is "we
// pack up tonight", which is a fact about the club's own next stop, so it is
// decided per club rather than per game: a home club whose next series is also
// at home is not getting away from anywhere, while the visitor in that same
// game is. A season's final game counts (there is no next venue to compare,
// and everyone goes home), which is why the null case returns true.
export function isGetawayDay(row, nextRow) {
  if (!row.finale) return false
  if (!nextRow) return true
  return nextRow.venue_id !== row.venue_id
}

// A sweep: every game of a series won by one club. `minGames` is 2 — a
// two-game set does get called a sweep — but `seriesLength` rides along on
// every row, so a surface that only wants three-plus can filter without this
// changing.
export function seriesSweeps(taggedRows, minGames = 2) {
  const bySeries = []
  let current = null
  for (const r of taggedRows) {
    if (r.opener || current == null) {
      current = { rows: [] }
      bySeries.push(current)
    }
    current.rows.push(r)
  }
  let swept = 0
  let sweptBy = 0
  for (const s of bySeries) {
    if (s.rows.length < minGames) continue
    if (s.rows.every((r) => r.result === 'W')) swept++
    else if (s.rows.every((r) => r.result === 'L')) sweptBy++
  }
  return { swept, sweptBy }
}

// ---------------------------------------------------------------------------
// Division rank by date
// ---------------------------------------------------------------------------

// Each club's division rank at the END of every date the division played, as
// `{ [teamId]: { [date]: rank } }`.
//
// COMPUTED FROM THE LEDGER rather than fetched. statsapi's standings endpoint
// has no history — one call answers for one date, so a season of daily ranks
// would be ~180 calls per league per run, and a completed season answers them
// all EMPTY anyway (the `date=` parameter returns no records once a season
// closes). The ledger already holds every result, so the ranks come free and
// stay right for past seasons.
//
// Ties share the best rank, which is the convention "days in first place"
// counts by: two clubs tied atop the division are both in first that day.
export function dailyDivisionRanks(rowsByTeam) {
  const teamIds = [...rowsByTeam.keys()]
  const dates = new Set()
  for (const rows of rowsByTeam.values()) for (const r of rows) dates.add(r.date)
  const ordered = [...dates].sort()

  const tally = new Map(teamIds.map((id) => [id, { w: 0, l: 0 }]))
  const cursor = new Map(teamIds.map((id) => [id, 0]))
  const out = Object.fromEntries(teamIds.map((id) => [id, {}]))

  for (const date of ordered) {
    for (const id of teamIds) {
      const rows = rowsByTeam.get(id)
      let i = cursor.get(id)
      while (i < rows.length && rows[i].date <= date) {
        const t = tally.get(id)
        if (rows[i].result === 'W') t.w++
        else if (rows[i].result === 'L') t.l++
        i++
      }
      cursor.set(id, i)
    }
    const standing = teamIds
      .map((id) => {
        const t = tally.get(id)
        return { id, pct: t.w + t.l > 0 ? t.w / (t.w + t.l) : 0, played: t.w + t.l }
      })
      .filter((s) => s.played > 0)
      .sort((x, y) => y.pct - x.pct)
    for (const s of standing) {
      out[s.id][date] = 1 + standing.filter((o) => o.pct > s.pct).length
    }
  }
  return out
}
