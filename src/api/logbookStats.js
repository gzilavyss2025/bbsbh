// The Logbook's retrospective — Tier 1 (ADR-0035, the game-stamps PRD §6).
//
// ===========================================================================
// PURE. No fetching, no React, no storage. That is the point.
// ===========================================================================
// Everything here is `(stamps, gameFacts) -> numbers`, so the interesting parts
// — records, streaks, aggregation, tie-breaks — land in the CI-gated unit suite
// (test/logbook-stats.test.js) instead of being verifiable only by eye on a
// rendered page. FirstScorebookPage.jsx computes its equivalent math inline in
// `useMemo`s, which is exactly why none of it is tested; do not repeat that
// here. If a number is worth showing, it is worth pinning.
//
// ===========================================================================
// REVEAL-ONLY BY CLASSIFICATION — ADR-0001 applies
// ===========================================================================
// This module reads and returns SCORES. It is therefore reveal-only in the same
// sense as src/api/linescore.js and src/api/derive.js, and callable only from
// the Logbook screens — whose entire safety argument is that every game they
// read is one the user already finished revealing (the server refuses to mint a
// stamp otherwise). There is no SealBox to sit inside here, so the discipline is
// the INPUT: only ever pass this the user's own stamps, never an arbitrary game
// list. Handed a slate, it would silently turn a spoiler-free screen into a
// score-revealing one.
//
// ===========================================================================
// The two inputs
// ===========================================================================
//   `stamps`    — live stamp records, `{ gamePk, mode, stampedAt, note, date }`,
//                 as `stampsForSeason` / the useStamps hook hand them out.
//                 Tombstones must already be filtered out; this module does not
//                 know the store's vocabulary.
//   `gameFacts` — `{ [gamePk]: facts }` from src/api/logbook.js's
//                 `fetchStampGames` (or, signed in, the `game` blob
//                 /api/stamps joins on — deliberately the same shape).
//
// A stamp whose facts have not resolved (offline, a failed batch, a game the
// cache has not seen) counts as `pending` rather than being dropped or guessed
// at. Same graceful-degradation posture as the MiLB feeds: the page says how
// many are still resolving instead of quietly reporting a smaller total as if
// it were the whole book.

// A game is a blowout at this margin or wider. Five is the conventional line —
// it is where a game stops being one swing away in the ninth — and it sits well
// clear of the one-run band the page counts separately.
export const BLOWOUT_MARGIN = 5

// Extra innings, as far as the stamp facts can tell. The facts blob carries the
// innings actually played but NOT `scheduledInnings`, so this is nine: right for
// every MLB game, and wrong for a seven-inning MiLB doubleheader game that went
// to eight (it reads as regulation here). Fixing that means adding a field to a
// blob with two producers and an immutable server-side cache of already-written
// entries to migrate — not worth it for a miscount on a game type the Logbook
// rarely holds. Stated rather than hidden; see `stampGameFacts` in
// src/api/logbook.js for the other half of that shape.
export const REGULATION_INNINGS = 9

// The empty result, so a caller destructures the same shape whether the
// collection is empty, still resolving, or complete. Every list is a list and
// every count is a number — the page never has to null-check a field.
function emptyStats() {
  return {
    stamps: 0,
    games: 0,
    pending: 0,
    innings: 0,
    runs: 0,
    runsPerGame: 0,
    oneRunGames: 0,
    shutouts: 0,
    extraInningGames: 0,
    blowouts: 0,
    dateRange: null,
    seasons: [],
    modes: { watched: 0, followed: 0 },
    homeRoad: { homeWins: 0, awayWins: 0, ties: 0 },
    clubs: [],
    venues: [],
    matchups: [],
    mostSeenClub: null,
    mostSeenOpponent: null,
    longestWinStreak: null,
    longestLossStreak: null,
    pitchers: [],
  }
}

// Does this stamp's game carry enough to count? Both sides need a real run
// total — a Final game missing one is a feed gap, not a 0, and reading it as
// zero would invent a shutout that never happened.
function isCountable(game) {
  return (
    !!game &&
    game.status === 'Final' &&
    typeof game.away?.runs === 'number' &&
    typeof game.home?.runs === 'number'
  )
}

// Chronological, and deterministic on the ties that actually occur: a
// doubleheader shares a date, so `gameNumber` orders it, and gamePk settles
// anything left. The streak math below depends on this ordering, which is why
// it is stated here rather than inherited from whatever order the caller's
// store happened to yield.
function chronological(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.gameNumber !== b.gameNumber) return a.gameNumber - b.gameNumber
  return a.gamePk - b.gamePk
}

// Count-descending, then a stable alphabetical fallback so a tie renders the
// same way on every run (and a test can assert which side of it wins). Every
// "most-seen" list here sorts through this one comparator.
function byCountThenLabel(key = 'games') {
  return (a, b) =>
    b[key] - a[key] || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)
}

// The longest run of wins and of losses for one club, over the games in this
// user's book ONLY. The games in between are games the user did not see, so
// this is deliberately "your streak watching them", not the club's real one —
// the page has to say so.
//
// A tie (a suspended or called game, `winnerId: null`) counts as neither and
// BREAKS both runs: it is not a win, and scoring it as a loss would be worse.
function streaksFor(games, teamId) {
  let win = null
  let loss = null
  let kind = null
  let length = 0
  let from = ''
  let to = ''

  const close = () => {
    if (!kind) return
    const best = kind === 'win' ? win : loss
    if (best && best.length >= length) return
    const run = { length, from, to }
    if (kind === 'win') win = run
    else loss = run
  }

  for (const game of games) {
    const outcome =
      game.winnerId == null ? null : game.winnerId === teamId ? 'win' : 'loss'
    if (outcome && outcome === kind) {
      length += 1
      to = game.date
      continue
    }
    close()
    kind = outcome
    length = outcome ? 1 : 0
    from = outcome ? game.date : ''
    to = outcome ? game.date : ''
  }
  close()

  return { longestWin: win, longestLoss: loss }
}

// The unordered pair key for a matchup, so MIL at STL and STL at MIL are one
// matchup seen twice rather than two matchups seen once.
function matchupKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/**
 * Tier 1 of the Logbook retrospective.
 *
 * @param {Array} stamps     live stamp records (see the header)
 * @param {Object} gameFacts `{ [gamePk]: facts }`
 * @returns the whole page's data, fully populated even when empty
 */
export function computeLogbookStats(stamps, gameFacts) {
  const out = emptyStats()
  const list = Array.isArray(stamps) ? stamps : []
  out.stamps = list.length
  if (!list.length) return out

  // The mode split counts every stamp, resolved or not: it comes from the local
  // record, so a game whose facts are still in flight still knows how you took
  // it in.
  for (const stamp of list) {
    if (stamp?.mode === 'followed') out.modes.followed += 1
    else out.modes.watched += 1
  }

  const facts = gameFacts && typeof gameFacts === 'object' ? gameFacts : {}
  const games = []
  for (const stamp of list) {
    const game = facts[stamp?.gamePk]
    if (isCountable(game)) games.push(game)
    else out.pending += 1
  }
  games.sort(chronological)
  out.games = games.length
  if (!games.length) return out

  out.dateRange = [games[0].date, games[games.length - 1].date]

  const clubs = new Map()
  const gamesByClub = new Map()
  const opponentsOf = new Map()
  const venues = new Map()
  const matchups = new Map()
  const pitchers = new Map()
  const seasons = new Map()

  const clubRow = (side) => {
    if (side.id == null) return null
    if (!clubs.has(side.id)) {
      clubs.set(side.id, {
        id: side.id,
        abbreviation: side.abbreviation,
        name: side.name,
        // The sort key, kept as a field so one comparator serves every list
        // here. Falls back through name to the id so a MiLB club whose feed
        // carries no abbreviation still sorts somewhere stable.
        label: side.abbreviation || side.name || String(side.id),
        games: 0,
        wins: 0,
        losses: 0,
        ties: 0,
      })
      gamesByClub.set(side.id, [])
    }
    return clubs.get(side.id)
  }

  const pitcherRow = (name, field) => {
    if (!name) return
    if (!pitchers.has(name)) {
      pitchers.set(name, { name, label: name, wins: 0, losses: 0, saves: 0, decisions: 0 })
    }
    const row = pitchers.get(name)
    row[field] += 1
    // "Pitcher of record" is the win or the loss; a save is carried alongside
    // because the facts blob already has it, but it does not make a record.
    if (field !== 'saves') row.decisions += 1
  }

  for (const game of games) {
    const margin = Math.abs(game.away.runs - game.home.runs)
    out.runs += game.away.runs + game.home.runs
    out.innings += Number.isInteger(game.innings) ? game.innings : 0
    if (margin === 1) out.oneRunGames += 1
    if (margin >= BLOWOUT_MARGIN) out.blowouts += 1
    // "Shutout" here means a game in which somebody was blanked — the reading
    // that matters for a book of games you sat through, and the one
    // FirstScorebookPage's `gameNote` already uses. A 0-0 (a called game)
    // counts once, not twice.
    if (game.away.runs === 0 || game.home.runs === 0) out.shutouts += 1
    if (Number.isInteger(game.innings) && game.innings > REGULATION_INNINGS) {
      out.extraInningGames += 1
    }

    // Home vs. road, read as "which dugout won the games you logged". A stamp
    // carries no attendance record, so this can never mean "games you saw in
    // person" — do not relabel it that way on the page.
    if (game.winnerId == null) out.homeRoad.ties += 1
    else if (game.winnerId === game.home.id) out.homeRoad.homeWins += 1
    else out.homeRoad.awayWins += 1

    const season = Number(String(game.date).slice(0, 4))
    if (Number.isInteger(season)) seasons.set(season, (seasons.get(season) ?? 0) + 1)

    if (game.venue) venues.set(game.venue, (venues.get(game.venue) ?? 0) + 1)

    for (const side of [game.away, game.home]) {
      const row = clubRow(side)
      if (!row) continue
      row.games += 1
      if (game.winnerId == null) row.ties += 1
      else if (game.winnerId === side.id) row.wins += 1
      else row.losses += 1
      gamesByClub.get(side.id).push(game)
    }

    if (game.away.id != null && game.home.id != null) {
      const key = matchupKey(game.away.id, game.home.id)
      if (!matchups.has(key)) {
        // The lower id fixes the label, so a home-and-home reads as one matchup
        // with one name rather than flipping with whichever leg came last.
        const [first, second] =
          game.away.id < game.home.id ? [game.away, game.home] : [game.home, game.away]
        matchups.set(key, {
          key,
          teams: [
            { id: first.id, abbreviation: first.abbreviation, name: first.name },
            { id: second.id, abbreviation: second.abbreviation, name: second.name },
          ],
          label: `${first.abbreviation}${second.abbreviation}`,
          games: 0,
        })
      }
      matchups.get(key).games += 1

      for (const [self, other] of [
        [game.away.id, game.home],
        [game.home.id, game.away],
      ]) {
        if (!opponentsOf.has(self)) opponentsOf.set(self, new Map())
        const seen = opponentsOf.get(self)
        seen.set(other.id, (seen.get(other.id) ?? 0) + 1)
      }
    }

    pitcherRow(game.decisions?.winner, 'wins')
    pitcherRow(game.decisions?.loser, 'losses')
    pitcherRow(game.decisions?.save, 'saves')
  }

  out.runsPerGame = out.runs / out.games

  out.seasons = [...seasons.entries()]
    .map(([season, count]) => ({ season, games: count }))
    .sort((a, b) => b.season - a.season)

  out.venues = [...venues.entries()]
    .map(([name, count]) => ({ name, label: name, games: count }))
    .sort(byCountThenLabel())

  out.matchups = [...matchups.values()].sort(byCountThenLabel())

  out.pitchers = [...pitchers.values()].sort(byCountThenLabel('decisions'))

  // Streaks hang off the club rows, so the page can print "your streak with
  // them" beside a club's record — and the two headline streaks below are the
  // best of those rather than a second, separately-derived number that could
  // disagree with the table under it.
  out.clubs = [...clubs.values()]
    .map((row) => ({ ...row, ...streaksFor(gamesByClub.get(row.id), row.id) }))
    .sort(byCountThenLabel())

  // `out.clubs` is already sorted games-desc-then-label, and a strict `>`
  // keeps the first row that reaches a given length — so a streak tie goes to
  // the club you have seen more of, then alphabetically, exactly like every
  // other list here.
  const bestStreak = (field) => {
    let best = null
    for (const row of out.clubs) {
      const streak = row[field]
      if (!streak) continue
      if (!best || streak.length > best.length) {
        best = { ...streak, teamId: row.id, abbreviation: row.abbreviation, name: row.name }
      }
    }
    return best
  }
  // A one-game "streak" is not one; the headline needs at least a pair.
  const meaningful = (streak) => (streak && streak.length >= 2 ? streak : null)
  out.longestWinStreak = meaningful(bestStreak('longestWin'))
  out.longestLossStreak = meaningful(bestStreak('longestLoss'))

  // "Most-seen opponent" only means anything relative to a club, and the club
  // it means it relative to is the one you have seen most. The two are reported
  // together so the page can say "you logged MIL 40 times, most often against
  // STL" rather than printing two disconnected numbers.
  const top = out.clubs[0] ?? null
  if (top) {
    out.mostSeenClub = {
      id: top.id,
      abbreviation: top.abbreviation,
      name: top.name,
      games: top.games,
    }
    const seen = opponentsOf.get(top.id)
    if (seen?.size) {
      out.mostSeenOpponent = [...seen.entries()]
        .map(([id, count]) => {
          const row = clubs.get(id)
          return {
            id,
            abbreviation: row?.abbreviation ?? '',
            name: row?.name ?? '',
            label: row?.label ?? String(id),
            games: count,
          }
        })
        .sort(byCountThenLabel())[0]
    }
  }

  return out
}
