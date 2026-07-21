// Slate-wide "Top Performers" leaderboard — the day's top 5 batters and top 5
// pitchers, across every in-progress/final game at the current level, ranked
// by win-probability added PLUS the stat line's context-neutral points
// (performanceScore.js; ADR-0013 — pure WPA buried a near-no-hitter thrown in
// a blowout under every reliever who protected a one-run lead). SPOILER RULE:
// reveal-only, exactly like linescore.js, derive.js, and boxscore.js's
// computeThreeStars — only ever call computeTopPerformers from inside a
// SealBox's reveal render function. Never at render top-level or in a
// pre-reveal useMemo.
//
// Distinct from computeThreeStars (per-game, top 3, batters and pitchers
// mixed into one ranking): this fans out across every game on the slate and
// keeps two separate leaderboards. Player identity/stat lines come from the
// lighter /api/v1/game/{gamePk}/boxscore endpoint rather than the full
// /feed/live (no play-by-play needed here) — verified 2026-07-08 against
// gamePk 823035 that its teams.{away,home}.players[...] subtree has the same
// shape findBoxscorePlayer already expects from feed.liveData.boxscore, and
// that player.person carries a ready-made fullName (unlike gameData.players,
// this endpoint has no separate useName/firstName to build one from).
import { getJson } from './statsapi.js'
import { fetchWinProbability } from './game.js'
import {
  findBoxscorePlayer,
  positionLabel,
  battingStat,
  pitchingStat,
} from './boxscore.js'
import { batterPoints, pitcherPoints } from './performanceScore.js'
import { prospectRankById, orgProspectRankById } from './prospects.js'
import { gamePath } from '../lib/route.js'

async function fetchGameBoxscore(gamePk) {
  try {
    return await getJson(`/api/v1/game/${gamePk}/boxscore`)
  } catch {
    return null
  }
}

function addWpa(map, person, delta) {
  if (!person?.id) return
  const e = map.get(person.id) ?? { id: person.id, w: 0 }
  e.w += delta
  map.set(person.id, e)
}

// Same batter-earns-his-team's-swing / pitcher-earns-the-opposite credit as
// computeThreeStars, split into two maps instead of one merged ranking.
function accumulateGame(winProb, battingWpa, pitchingWpa) {
  for (const e of winProb) {
    const h = e.homeTeamWinProbabilityAdded
    if (typeof h !== 'number') continue
    const top = e.about?.isTopInning
    addWpa(battingWpa, e.matchup?.batter, top ? -h : h)
    addWpa(pitchingWpa, e.matchup?.pitcher, top ? h : -h)
  }
}

// `ctx` is { boxscore, game }, `game` being this entry's slate-list row
// (carries the away/home abbreviations + gameNumber the boxscore response
// itself doesn't need to repeat) — used to build the score + box-score link.
function resolveEntry(ctx, id, role, dateStr) {
  const { boxscore, game } = ctx
  const found = findBoxscorePlayer(boxscore, id)
  if (!found) return null
  const { side, player: bp } = found
  const team = boxscore.teams[side].team
  const stats = (role === 'pitching' ? bp.stats?.pitching : bp.stats?.batting) ?? {}
  return {
    id,
    name: bp.person?.fullName ?? '',
    teamId: team?.id ?? null,
    teamAbbr: team?.abbreviation ?? '',
    // A MiLB player's parent MLB org id (present even for an MLB player, where
    // it's just his own team) — used to fetch the org-prospect pill's logo.
    parentOrgId: bp.parentTeamId ?? team?.id ?? null,
    position: positionLabel(bp),
    stat: role === 'pitching' ? pitchingStat(stats) : battingStat(stats),
    // The game this performance came from — shown under the stat line, linking
    // to that game's (already-sealed) box score. Team run totals sit on each
    // side's teamStats.batting (the same field selectBoxscore's battingTotals
    // reads for the full box score's line), live or final either way.
    game: {
      boxScorePath: gamePath(
        dateStr,
        game.away.abbreviation,
        game.home.abbreviation,
        'boxscore',
        game.gameNumber,
      ),
      awayAbbr: game.away.abbreviation,
      homeAbbr: game.home.abbreviation,
      awayScore: boxscore.teams.away?.teamStats?.batting?.runs ?? 0,
      homeScore: boxscore.teams.home?.teamStats?.batting?.runs ?? 0,
    },
  }
}

// Blend each accumulated WPA total with the player's context-neutral points
// for the role, read off his boxscore game line (ADR-0013). Both halves are
// on the same percentage-points-of-a-win scale, so a plain sum ranks them.
function scoredEntries(map, ctxById, role) {
  return [...map.values()].map((e) => {
    const found = findBoxscorePlayer(ctxById.get(e.id)?.boxscore, e.id)
    const stats = found?.player?.stats
    const points =
      role === 'pitching' ? pitcherPoints(stats?.pitching) : batterPoints(stats?.batting)
    return { ...e, score: e.w + points }
  })
}

function topN(map, ctxById, role, dateStr, n = 5) {
  return scoredEntries(map, ctxById, role)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((e) => {
      const ctx = ctxById.get(e.id)
      return ctx ? resolveEntry(ctx, e.id, role, dateStr) : null
    })
    .filter(Boolean)
}

// Fetches every game's light boxscore + win probability and builds the
// per-player WPA maps + the context needed to resolve a player's identity/stat
// line. Still split out from computeTopPerformers below (rather than inlined)
// because it's the whole expensive half of this module, and keeping the fetch
// fan-out separate from the ranking makes both readable on their own.
async function buildWpaMaps(games) {
  const perGame = await Promise.all(
    (games ?? []).map(async (game) => {
      const [boxscore, winProb] = await Promise.all([
        fetchGameBoxscore(game.gamePk),
        fetchWinProbability(game.gamePk),
      ])
      if (!boxscore || !Array.isArray(winProb) || winProb.length === 0) return null
      return { boxscore, winProb, game }
    }),
  )

  const battingWpa = new Map()
  const pitchingWpa = new Map()
  // Which game resolves a given player's identity/stat line. A player who
  // appears in two games the same day (a doubleheader) resolves to the later
  // game — an acceptable simplification for a leaderboard, not a full-day line.
  const ctxById = new Map()

  for (const g of perGame) {
    if (!g) continue
    accumulateGame(g.winProb, battingWpa, pitchingWpa)
    const ctx = { boxscore: g.boxscore, game: g.game }
    for (const e of g.winProb) {
      if (e.matchup?.batter?.id) ctxById.set(e.matchup.batter.id, ctx)
      if (e.matchup?.pitcher?.id) ctxById.set(e.matchup.pitcher.id, ctx)
    }
  }

  return { battingWpa, pitchingWpa, ctxById }
}

function attachProspect(prospects, entry) {
  return {
    ...entry,
    prospectRank: prospectRankById(prospects?.players, entry.id),
    orgProspectRank: orgProspectRankById(prospects?.orgProspects, entry.id),
  }
}

// `games`: eligible (non-Preview) games on the current slate (the normalized
// schedule rows GameSelect already has, each with `gamePk`/`away`/`home`/
// `gameNumber`). `prospects`: the app-wide snapshot from fetchTopProspects()
// (session-memoized upstream, so passing it in here avoids a second fetch).
// `dateStr`: the slate's queried date (YYYY-MM-DD), for building each entry's
// box-score link. One game's failure — bad gamePk, an MiLB park with no WPA —
// just drops that game.
export async function computeTopPerformers({ games, prospects, dateStr }) {
  const { battingWpa, pitchingWpa, ctxById } = await buildWpaMaps(games)
  return {
    batters: topN(battingWpa, ctxById, 'batting', dateStr).map((e) => attachProspect(prospects, e)),
    pitchers: topN(pitchingWpa, ctxById, 'pitching', dateStr).map((e) => attachProspect(prospects, e)),
  }
}
