// THE ACCUMULATED ROWS, TURNED INTO public/data/abs-challenges.json — the
// export half of the pure code behind gen-abs-challenges.mjs. Its other half,
// scripts/lib/abs/rows.mjs, turns one Final game's feed into the rows this
// reads.
//
// It lives here, apart from the generator, for the reason scripts/CLAUDE.md
// gives: a generator file does its work AT IMPORT, so a helper inside one can
// never be unit-tested. Everything below is pure — rows in, summary out — with
// no clock, no network and no database, and test/abs-challenges.test.js pins
// it.
//
// THE DISCIPLINE THIS FILE EXISTS TO KEEP. The database stores FACTS: one row
// per challenge, one row per game. Every split the report page shows — per
// club, per role, per plate umpire, call type, miss distance, run value — is
// computed HERE, at export time. So a new cut of the season costs
// `--export-only` and no re-sweep of two thousand game feeds, and adding one
// never needs a schema change or a backfill. Same rule gen-team-records.mjs
// follows.
//
// RANKING IS NOT DONE HERE. This file ships each club's, umpire's and player's
// own totals; sorting them against each other, and the minimum-sample floors
// that decide who appears on a board at all, live in the reader
// (src/api/around-the-game/absChallenges.js) where they are equally pure and
// where the page can change its mind about them without a regeneration. Same
// split gate.js and gen-gate.mjs already use.

import { replayBank } from './bank.mjs'
import { chancesByInning, challengesByInningRole } from './chances.mjs'
import { exposureByPlayer, exposureRates, hasExposure } from './exposure.mjs'
import { ranOutBoard } from './ranout.mjs'
import { momentumCuts } from './momentum.mjs'
import { streakBoards } from './streaks.mjs'
import { ROLES } from './rows.mjs'

// The four roles a challenge can come from. A batter challenges a called
// strike against him; a catcher or a pitcher challenges a called ball. `other`
// is the honest bucket for a challenger the feed named but the box score put
// at no recognisable position — it is expected to stay near zero, and a report
// that hid it would hide the day it stops being near zero.
//
// The list itself lives in rows.mjs beside roleFor, which is what produces it.
// Re-exported here because every board reads it from this file.
export { ROLES }

// How far the challenged pitch sat from the nearest edge of the buffered
// strike zone, in inches. The bands are read from the edge outward, because
// the question the page asks is "are challenges catching howlers or coin
// flips" and an inch either side of the line is the coin flip.
export const MISS_BANDS = [
  { key: 'b0', label: 'Under 1 in', min: 0, max: 1 },
  { key: 'b1', label: '1 to 2 in', min: 1, max: 2 },
  { key: 'b2', label: '2 to 3 in', min: 2, max: 3 },
  { key: 'b3', label: '3 to 4 in', min: 3, max: 4 },
  { key: 'b4', label: '4 in and out', min: 4, max: Infinity },
]

// A club is issued two challenges and keeps one every time it wins, so it is
// out of them after its SECOND loss. Entering the seventh with none left is
// the strategic cost the page reports, which makes the sixth the last inning a
// second loss can still be called early.
//
// THAT RULE IS REGULATION-ONLY, and this constant is safe because the sixth is
// as well. A club that has run out is armed again in extra innings — see
// bank.mjs, which replays it — so running out is not the end of a club's
// night the way it reads. Nothing about the sixth inning changes; everything
// about "ran out" as a phrase does, and ranOutByTeam below says what it counts
// rather than leaning on the phrase.
export const LAST_EARLY_INNING = 6

const rate = (n, d) => (d > 0 ? n / d : null)

// One { n, success, rate } tally. Used for every categorical split below, so a
// caller reads the same three keys whichever cut it asked for.
function tally() {
  return { n: 0, success: 0 }
}
function add(t, row) {
  t.n += 1
  if (row.outcome === 'success') t.success += 1
}
function sealed(t) {
  return { n: t.n, success: t.success, rate: rate(t.success, t.n) }
}

// The run expectancy one successful challenge moved, from the point of view of
// the club that called for it. `favor` is signed toward the BATTING team
// (src/lib/runExpectancy.js's convention, kept unchanged through the database
// so the number means the same thing here as it does in the box score): the
// umpire's call had handed the batting side that much, and the overturn takes
// it back. So the challenger's own gain is -favor when the challenger was
// batting and +favor when it was in the field.
//
// It is positive on virtually every overturn — a club challenges a call that
// hurt it — which makes the season total a standing check on the sign
// convention rather than only a figure to print: if the sign were inverted,
// `runsToChallenger` would come out as the negative of `runsRecovered` instead
// of within a run of it. The handful of exceptions are the run-expectancy
// table's own per-count noise, not a challenge that hurt the club that called
// for it.
export function challengerGain(row) {
  if (row.favor == null) return null
  const challengerBatting = (row.half === 'top') === (row.side === 'away')
  return challengerBatting ? -row.favor : row.favor
}

// Per club: the games it EMPTIED its bank in, and the ones it emptied early.
// Running out is the strategic cost of a failed challenge, and it is invisible
// in a success rate alone.
//
// WHAT "RAN OUT" COUNTS, now that the bank is modelled. It counts a game in
// which the club's bank reached zero at least once, and `ranOutEarly` counts
// one where that first happened by LAST_EARLY_INNING. It is deliberately NOT
// "the club finished the game with none", because in a game that goes to
// extras those are different facts: a club armed again in the tenth did run
// out in the fifth, and the cost it paid — playing four innings unable to
// argue — is exactly what the column is for.
//
// It replays the bank rather than counting to two, so a club that empties
// twice in one game counts once and the emptying inning is the FIRST one, and
// so the count stays right when the rule is used from anywhere else. Under the
// old count-to-two the two agree in regulation and diverge in extras.
//
// The replay is fed EVERY challenge, not only the lost ones. A club must hold
// one to ask at all, and an overturn hands it straight back — so `L L W` and
// `W L L` are the same failure count and different nights, and only the replay
// can tell them apart.
//
// THE REPLAY IS NOT GIVEN THE GAME'S LENGTH, and since #1058 that is a choice
// rather than a limit — `final_inning` and `scheduled_innings` are on the
// ledger now. Without a length the replay runs to the last inning the club
// challenged in, which is every emptying the rows can see: a top-up in an
// extra inning the club never challenged in cannot produce one. Checked rather
// than argued — passing both lengths changes `emptiedIn` on 0 of the 8,123
// club-games on file. The board that DOES pass them is ranout.mjs, which needs
// the emptying's half and not only its inning.
function ranOutByTeam(rows) {
  const byGameTeam = new Map()
  for (const r of rows) {
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r)
    byGameTeam.set(key, list)
  }
  const out = new Map() // teamId -> { ranOut, ranOutEarly }
  for (const [key, challenges] of byGameTeam) {
    // EVERY challenge, not only the lost ones: a club has to hold one to ask
    // at all, and an overturn refunds it, so `L L W` and `W L L` leave the
    // club in different places despite the same failure count.
    const { emptiedIn } = replayBank(challenges)
    if (emptiedIn.length === 0) continue
    const teamId = Number(key.split(':')[1])
    // The FIRST time it emptied. A club can empty more than once in a game
    // that goes to extras, and the game still counts once: the column is
    // "games it ran out in", not "times it ran out". An emptying the club
    // immediately undid with an overturn is not one — replayBank takes the
    // refund off before it records anything.
    const emptiedAt = emptiedIn[0]
    const cur = out.get(teamId) ?? { ranOut: 0, ranOutEarly: 0 }
    cur.ranOut += 1
    if (emptiedAt <= LAST_EARLY_INNING) cur.ranOutEarly += 1
    out.set(teamId, cur)
  }
  return out
}

// The one challenge the season is most likely to be remembered by: the
// overturn that moved the most run expectancy. Ties break on the later date,
// so a fresh one displaces an equal older one rather than the file freezing on
// April forever.
function biggestOverturn(rows) {
  let best = null
  for (const r of rows) {
    if (r.outcome !== 'success' || r.favor == null) continue
    const swing = Math.abs(r.favor)
    if (!best || swing > best.swing || (swing === best.swing && r.date > best.row.date)) {
      best = { swing, row: r }
    }
  }
  return best
}

function overturnCard(row, swing) {
  return {
    gamePk: row.game_pk,
    date: row.date,
    level: row.level,
    teamId: row.team_id,
    oppId: row.opp_id ?? null,
    side: row.side,
    playerId: row.player_id ?? null,
    playerName: row.player_name ?? '',
    role: row.role,
    inning: row.inning,
    half: row.half,
    umpireId: row.umpire_id ?? null,
    umpireName: row.umpire_name ?? '',
    callType: row.call_type ?? null,
    missInches: row.miss_inches ?? null,
    runs: swing,
  }
}

// Everything one level (MLB or Triple-A) shows, from that level's own rows and
// its own swept games. `games` rows carry the two club ids and the plate
// umpire, which is what lets a club that was never challenged still appear
// with a games denominator — a rate over "games in which somebody challenged"
// would flatter the clubs nobody bothers to challenge.
export function summarizeLevel(rows, games) {
  const total = rows.length
  const success = rows.filter((r) => r.outcome === 'success').length

  const byRole = new Map(ROLES.map((r) => [r, tally()]))
  const byCall = new Map([['strike', tally()], ['ball', tally()]])
  const byInning = new Map()
  const byBand = new Map(MISS_BANDS.map((b) => [b.key, tally()]))
  const teamCounts = new Map()
  const umpCounts = new Map()
  const players = new Map()

  let runsRecovered = 0
  let runsToChallenger = 0
  let runsToBatting = 0
  let scoredOverturns = 0

  for (const r of rows) {
    add(byRole.get(r.role) ?? byRole.get('other'), r)
    if (byCall.has(r.call_type)) add(byCall.get(r.call_type), r)

    const inningKey = r.inning
    if (!byInning.has(inningKey)) byInning.set(inningKey, tally())
    add(byInning.get(inningKey), r)

    if (r.miss_inches != null) {
      const band = MISS_BANDS.find((b) => r.miss_inches >= b.min && r.miss_inches < b.max)
      if (band) add(byBand.get(band.key), r)
    }

    if (!teamCounts.has(r.team_id)) teamCounts.set(r.team_id, tally())
    add(teamCounts.get(r.team_id), r)

    if (r.umpire_id != null) {
      if (!umpCounts.has(r.umpire_id)) umpCounts.set(r.umpire_id, { ...tally(), name: r.umpire_name ?? '' })
      add(umpCounts.get(r.umpire_id), r)
    }

    if (r.player_id != null) {
      if (!players.has(r.player_id)) {
        // `role` is the role of his FIRST challenge, which is all this list
        // claims. THE HONEST SPLIT IS NOT HERE: a catcher who also hits
        // challenges from two places, and each of his counts can only be
        // divided by its own denominator, so the split lives beside those
        // denominators in abs-exposure.json (rolesByPlayer, exposure.mjs).
        players.set(r.player_id, {
          ...tally(),
          name: r.player_name ?? '',
          teamId: r.team_id,
          role: r.role,
        })
      }
      add(players.get(r.player_id), r)
    }

    if (r.outcome === 'success' && r.favor != null) {
      const gain = challengerGain(r)
      runsRecovered += Math.abs(r.favor)
      runsToChallenger += gain
      runsToBatting += -r.favor
      scoredOverturns += 1
    }
  }

  // Games played, per club and per umpire — the denominators. Read off the
  // ledger, not off the challenge rows, for the reason in this function's
  // header.
  const teamGames = new Map()
  const umpGames = new Map()
  for (const g of games) {
    for (const id of [g.away_team_id, g.home_team_id]) {
      if (id != null) teamGames.set(id, (teamGames.get(id) ?? 0) + 1)
    }
    if (g.umpire_id != null) umpGames.set(g.umpire_id, (umpGames.get(g.umpire_id) ?? 0) + 1)
  }

  const ranOut = ranOutByTeam(rows)
  const dates = games.map((g) => g.date).filter(Boolean).sort()
  const best = biggestOverturn(rows)

  // THE CHANCES DENOMINATOR — half-innings a club played still holding a
  // challenge, which is what "challenges by inning" has to be divided by
  // before it says anything (chances.mjs, docs/adr/0075).
  const chances = chancesByInning(rows, games)
  const inningRoles = challengesByInningRole(rows)

  // THE NIGHTS, not the per-club count — which clubs emptied earliest, and the
  // shape of the whole season behind them (ranout.mjs).
  const ranOutNights = ranOutBoard(rows, games)

  return {
    games: games.length,
    gamesWithChallenge: games.filter((g) => (g.challenges ?? 0) > 0).length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    total,
    success,
    successRate: rate(success, total),
    perGame: rate(total, games.length),
    // The headline. Every overturn moved run expectancy off the umpire's call
    // and onto the correct one; this is that movement added up, which is what
    // the challenge system has been worth this season in runs.
    runsRecovered,
    runsToChallenger,
    runsToBatting,
    scoredOverturns,
    byRole: ROLES.map((role) => ({ role, ...sealed(byRole.get(role)) })),
    byCall: [...byCall].map(([callType, t]) => ({ callType, ...sealed(t) })),
    // Per inning: the raw count, the chances that count sat against, and the
    // rate between them. `perChance` is a SHARE — challenges per chance — and
    // the page multiplies by 100 to print it, the same way successRate is
    // shipped as a share rather than as a percentage.
    byInning: [...byInning]
      .sort((a, b) => a[0] - b[0])
      .map(([inning, t]) => {
        const c = chances.byInning.get(inning) ?? 0
        return { inning, ...sealed(t), chances: c, perChance: rate(t.n, c) }
      }),
    // The same cut crossed with role, on the SAME club denominator so the
    // roles add back up to the club figure. See chances.mjs for why a role's
    // own half of the chances is the wrong divisor.
    byInningRole: [...inningRoles]
      .sort((a, b) => a[0] - b[0])
      .flatMap(([inning, roles]) => {
        const c = chances.byInning.get(inning) ?? 0
        return ROLES.map((role) => {
          const t = roles.get(role)
          return { inning, role, ...sealed(t), chances: c, perChance: rate(t.n, c) }
        })
      }),
    // What the denominator was built from. `chancesGamesDropped` is games with
    // no length on file, which --recheck backfills — it is expected to be
    // zero, and is shipped so the page can say every game counted rather than
    // print a drop count that reads as data loss.
    chances: chances.total,
    chancesGames: chances.games,
    chancesGamesDropped: chances.dropped,
    perChance: rate(total, chances.total),
    byMiss: MISS_BANDS.map((b) => ({
      key: b.key,
      label: b.label,
      ...sealed(byBand.get(b.key)),
    })),
    byTeam: [...teamGames]
      .map(([teamId, gp]) => {
        const t = teamCounts.get(teamId) ?? tally()
        const ro = ranOut.get(teamId) ?? { ranOut: 0, ranOutEarly: 0 }
        return {
          teamId,
          games: gp,
          ...sealed(t),
          perGame: rate(t.n, gp),
          ranOut: ro.ranOut,
          ranOutEarly: ro.ranOutEarly,
        }
      })
      .sort((a, b) => a.teamId - b.teamId),
    byUmpire: [...umpCounts]
      .map(([umpireId, t]) => ({
        umpireId,
        name: t.name,
        games: umpGames.get(umpireId) ?? 0,
        ...sealed(t),
        perGame: rate(t.n, umpGames.get(umpireId) ?? 0),
      }))
      .sort((a, b) => a.umpireId - b.umpireId),
    // Each player's own challenge totals, and NOTHING HE IS DIVIDED BY. The
    // denominators and the rates they make live in abs-exposure.json
    // (buildExposureExport): they are ten fields on every one of 1,553 rows,
    // 321 KB on a file the report page downloads whole and shows none of them
    // on, and the board that will want them wants the men who NEVER
    // challenged too — who are not in this list at all.
    byPlayer: [...players]
      .map(([playerId, t]) => ({
        playerId,
        name: t.name,
        teamId: t.teamId,
        role: t.role,
        ...sealed(t),
      }))
      .sort((a, b) => a.playerId - b.playerId),
    biggest: best ? overturnCard(best.row, best.swing) : null,
    // Out of challenges, per GAME. `byTeam.ranOut` above is the same fact
    // counted per club; this is the band of nights that reached zero soonest,
    // with the distribution they sit in. Rows only for the earliest inning —
    // see ranout.mjs for why that cut is made here and not in the reader.
    ranOutNights,
    // Runs of being right, and runs of being wrong, by role — across the
    // season and inside one game (streaks.mjs).
    streaks: streakBoards(rows),
    // After a win, after a loss — counted straight AND held against the
    // challenges the rule leaves a club holding. Both, because showing them
    // side by side is the point (momentum.mjs).
    momentum: momentumCuts(rows, games),
  }
}

// A player's challenges split BY THE JOB HE WAS DOING, which is what each rate
// has to be taken over. Francisco Alvarez called for 102 reviews, some standing
// at the plate and some squatting behind it, and dividing all 102 by the
// pitches he saw as a BATTER invents a man who argues with every other pitch
// (exposure.mjs). It is taken over the rows of ONE level, because a man who
// played at both is two different populations with two different denominators.
// The same fold, keyed by CLUB as well as by man. A traded catcher's calls
// belong to whichever club he was squatting for when he made them, and the
// per-club file is the only place that distinction survives.
function rolesByPlayerTeam(rows) {
  const out = new Map()
  for (const r of rows ?? []) {
    if (r.player_id == null || r.team_id == null) continue
    const key = `${r.team_id}:${r.player_id}`
    const cur = out.get(key) ?? {}
    cur[r.role] = (cur[r.role] ?? 0) + 1
    out.set(key, cur)
  }
  return out
}

function rolesByPlayer(rows) {
  const out = new Map()
  for (const r of rows ?? []) {
    if (r.player_id == null) continue
    const cur = out.get(r.player_id) ?? {}
    cur[r.role] = (cur[r.role] ?? 0) + 1
    out.set(r.player_id, cur)
  }
  return out
}

// The whole report file. Rows and games arrive as they come out of SQLite
// (snake_case columns); the split by level happens here so a caller never has
// to know which levels are on file.
//
// IT CARRIES NO DENOMINATOR A PLAYER IS DIVIDED BY. Everything that needs the
// roster call is in the other file (buildExposureExport), because this one is
// fetched by every visitor to /abs-challenges and that one is fetched by the
// board that asks the question.
export function buildExport(rows, games, { season, generatedAt } = {}) {
  const levels = {}
  const names = [...new Set([...games.map((g) => g.level), ...rows.map((r) => r.level)])].sort()
  for (const level of names) {
    levels[level] = summarizeLevel(
      rows.filter((r) => r.level === level),
      games.filter((g) => g.level === level),
    )
  }
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    levels,
  }
}

// EVERY MAN WHO PLAYED, not only the ones who challenged — and its OWN FILE.
//
// THE QUESTION THIS FILE ANSWERS is how often a man ASKS, which is not how
// often he argues: "Yelich challenged 14 times" is a fact about how much he
// played. Divided by the pitches he stood in against it becomes a habit, and
// the spread is so wide that the mean describes nobody — four qualified MLB
// hitters never challenged once all season, and Gary Sánchez called for 32 in
// 1,085 pitches.
//
// WHY IT IS NOT IN abs-challenges.json, twice over.
//
// The men who never challenged ARE THE FINDING, and most of them leave no
// challenge row anywhere: 115 of the 659 MLB men here have no byPlayer entry to
// hang off, and three of the four qualified hitters are among them. They need a
// list of their own whatever else is decided.
//
// And the ten fields cost 321 KB across 1,553 byPlayer rows on a file every
// visitor to /abs-challenges downloads whole and shows none of them on. Kept
// there the report file ran 526 KB against main's 198 KB; moved here it is
// 206 KB, and the board that comes to want the rates (issues #1063, #1066,
// #1069) fetches the file that has them.
//
// Rows with no denominator at all are dropped rather than shipped as nulls
// (`hasExposure`): a pitcher who never batted and never caught supports no
// rate, and cannot answer the never-challenged question either, because there
// is nothing he had the opportunity to do.
//
// The whole split, and the rule it generalises to, is docs/adr/0076.
export function buildExposureExport(rows, exposure, { season, generatedAt } = {}) {
  const levels = {}
  for (const level of [...new Set((exposure ?? []).map((e) => e.level))].sort()) {
    const seen = exposureByPlayer((exposure ?? []).filter((e) => e.level === level))
    const roles = rolesByPlayer((rows ?? []).filter((r) => r.level === level))
    levels[level] = {
      players: [...seen]
        .filter(([, e]) => hasExposure(e))
        .map(([playerId, e]) => ({
          playerId,
          name: e.name,
          position: e.position,
          ...exposureRates(roles.get(playerId), e),
        }))
        .sort((a, b) => a.playerId - b.playerId),
    }
  }
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    levels,
  }
}

// THE SAME DENOMINATORS, SPLIT BY CLUB — a THIRD file, and the one cut the
// folded list above cannot give back.
//
// buildExposureExport folds a man's clubs into one row on purpose: a hitter
// traded in July clears a 200-plate-appearance floor on his SEASON, not on
// either half of it, and the league histograms would lose every traded regular
// if they did not. The same fold drops `team_id`, which the sweep's own rows
// carry — so a club board built on that file would have to attribute a traded
// man to whoever holds him now, counting a whole season against a club he
// played sixty games for.
//
// A THIRD FILE RATHER THAN A KEY IN THE SECOND is ADR-0076 applied again: one
// club's hub tab reads this, and abs-exposure.json is downloaded whole by
// every visitor to /abs-challenges. The duplication is small — 733 MLB rows
// against the fold's 659 — and docs/abs-challenges.md §6 carries the decision.
//
// IT SHIPS COUNTS AND DENOMINATORS, NEVER RATES. `per1000Pitches` prints as
// `11.224987798926305`, forty bytes for a number the reader divides in one
// line, and three of them a row was 210 KB of the first draft's 465. `name`
// DOES ride along: a team hub that had to fetch 418 KB to put a name on a dot
// would have paid for the file this one exists to avoid.
//
// MLB ONLY, and the reason is measured: a Triple-A club keeps 50.4% of its
// qualified hitters from April to September against MLB's 77.4%, so half its
// dots are a different man. docs/abs-challenges.md §6. Adding one is a word.
export const EXPOSURE_CLUB_LEVELS = ['MLB']

export function buildExposureClubsExport(
  rows,
  exposure,
  { season, generatedAt, levels = EXPOSURE_CLUB_LEVELS } = {},
) {
  const out = {}
  for (const level of levels) {
    const roles = rolesByPlayerTeam((rows ?? []).filter((r) => r.level === level))
    const byTeam = {}
    for (const e of (exposure ?? []).filter((x) => x.level === level)) {
      if (e.team_id == null) continue
      const seen = {
        pitches: e.pitches ?? null,
        plateAppearances: e.plate_appearances ?? null,
        catcherInnings: e.catcher_innings ?? null,
        catcherStarts: e.catcher_starts ?? null,
      }
      // Same gate as the folded file: a man with no opportunity at all supports
      // no rate and cannot answer the never-challenged question either.
      if (!hasExposure(seen)) continue
      const calls = roles.get(`${e.team_id}:${e.player_id}`) ?? {}
      const key = String(e.team_id)
      byTeam[key] = byTeam[key] ?? []
      byTeam[key].push({
        playerId: e.player_id,
        name: e.name ?? '',
        pitches: seen.pitches,
        plateAppearances: seen.plateAppearances,
        catcherInnings: seen.catcherInnings,
        asBatter: calls.batter ?? 0,
        asCatcher: calls.catcher ?? 0,
      })
    }
    for (const list of Object.values(byTeam)) list.sort((a, b) => a.playerId - b.playerId)
    out[level] = { byTeam }
  }
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    levels: out,
  }
}
