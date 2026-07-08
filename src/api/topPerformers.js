// Slate-wide "Top Performers" leaderboard — the day's top 5 batters and top 5
// pitchers by win-probability added, across every in-progress/final game at
// the current level. SPOILER RULE: reveal-only, exactly like linescore.js,
// derive.js, and boxscore.js's computeThreeStars — only ever call
// computeTopPerformers from inside a SealBox's reveal render function. Never
// at render top-level or in a pre-reveal useMemo.
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
import { prospectRankById, orgProspectRankById } from './prospects.js'

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

function resolveEntry(boxscore, id, role) {
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
  }
}

function topN(map, boxscoreById, role, n = 5) {
  return [...map.values()]
    .sort((a, b) => b.w - a.w)
    .slice(0, n)
    .map((e) => {
      const boxscore = boxscoreById.get(e.id)
      return boxscore ? resolveEntry(boxscore, e.id, role) : null
    })
    .filter(Boolean)
}

// `games`: eligible (non-Preview) games on the current slate, each `{ gamePk }`.
// `prospects`: the app-wide snapshot from fetchTopProspects() (session-memoized
// upstream, so passing it in here avoids a second fetch). One game's failure —
// bad gamePk, an MiLB park with no WPA — just drops that game.
export async function computeTopPerformers({ games, prospects }) {
  const perGame = await Promise.all(
    (games ?? []).map(async ({ gamePk }) => {
      const [boxscore, winProb] = await Promise.all([
        fetchGameBoxscore(gamePk),
        fetchWinProbability(gamePk),
      ])
      if (!boxscore || !Array.isArray(winProb) || winProb.length === 0) return null
      return { boxscore, winProb }
    }),
  )

  const battingWpa = new Map()
  const pitchingWpa = new Map()
  // Which game resolves a given player's identity/stat line. A player who
  // appears in two games the same day (a doubleheader) resolves to the later
  // game — an acceptable simplification for a leaderboard, not a full-day line.
  const boxscoreById = new Map()

  for (const game of perGame) {
    if (!game) continue
    accumulateGame(game.winProb, battingWpa, pitchingWpa)
    for (const e of game.winProb) {
      if (e.matchup?.batter?.id) boxscoreById.set(e.matchup.batter.id, game.boxscore)
      if (e.matchup?.pitcher?.id) boxscoreById.set(e.matchup.pitcher.id, game.boxscore)
    }
  }

  const attachProspect = (entry) => ({
    ...entry,
    prospectRank: prospectRankById(prospects?.players, entry.id),
    orgProspectRank: orgProspectRankById(prospects?.orgProspects, entry.id),
  })

  return {
    batters: topN(battingWpa, boxscoreById, 'batting').map(attachProspect),
    pitchers: topN(pitchingWpa, boxscoreById, 'pitching').map(attachProspect),
  }
}
