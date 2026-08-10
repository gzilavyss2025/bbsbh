import { getJson } from './statsapi.js'

// Per-game batting/pitching lines and win-probability "moments" for the
// Logbook retrospective's ported First Scorebook sections (ADR-0035).
//
// ===========================================================================
// REVEAL-ONLY, same footing as logbook.js
// ===========================================================================
// Both fetchers here ask statsapi for full stat lines and play descriptions —
// score-revealing, exactly like logbook.js's stampGameFacts. Safe for the
// identical reason: called only with the gamePks of the user's OWN STAMPS, and
// a stamp only exists for a game its owner already finished revealing. Do not
// call either of these with an arbitrary game list.
//
// ===========================================================================
// Why the PLAIN /boxscore and /winProbability endpoints, not feed/live
// ===========================================================================
// scripts/gen-scorebook-retrospective.mjs (First Scorebook's build-time
// generator) fetches the full /feed/live per game, because it also needs
// win-probability's play-by-play cross-reference for a live-game-style
// context. This module runs at RUNTIME over an arbitrary, possibly large,
// user-specific game list, so it uses the two lighter standalone endpoints
// instead — verified live 2026-08-10 (gamePk 823514) to carry everything
// needed with no full-feed fetch at all:
//   - /game/{pk}/boxscore already carries numberOfPitches, inningsPitched,
//     hits/runs/earnedRuns/baseOnBalls/strikeOuts, wins/losses/saves/holds/
//     blownSaves, and gamesStarted (the starter/reliever flag) per pitcher —
//     e.g. Paul Blackburn's line carried `"note":"(H, 5)"` and `holds: 1`.
//   - /game/{pk}/winProbability (the standalone endpoint, unlike the pruned
//     fetch api/game.js uses for a live game) already includes each entry's
//     own `playEvents`, so the terminal pitch's `playId` — the join key to a
//     highlight clip (api/highlights.js) — comes for free with no second
//     cross-referencing fetch.

// A phone on a live network, not a CI box — kept well below the generator's
// own concurrency (40): a handful of parallel requests is plenty to keep this
// from feeling sequential without saturating a mobile connection.
const CONCURRENCY = 6

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function uniquePks(gamePks) {
  return [...new Set((gamePks ?? []).map(Number).filter(Boolean))]
}

const ipOuts = (ip) => {
  const [whole, part] = String(ip ?? '0.0').split('.')
  return (Number(whole) || 0) * 3 + (Number(part) || 0)
}

// One side's appeared players, straight off the plain /boxscore response's
// own `teams[side].players` map — deliberately NOT reusing api/boxscore.js's
// row builders, which expect `feed.liveData`'s shape. Same narrow-
// reimplementation posture as logbook.js's stampGameFacts relative to the
// server's own fetch.
//
// One row per player, carrying BOTH halves (`batting`/`pitching`, null when
// that half wasn't played) rather than two separate lists — a two-way game
// needs both halves together to score with contextNeutralPoints
// (api/performanceScore.js), which takes one `{ batting, pitching }` object.
// Field names are passed through UNCHANGED from the raw stats block so
// callers (contextNeutralPoints, the leader-table formatting) can consume
// them directly with no second renaming step.
function oneSide(game, side) {
  const team = game?.teams?.[side] ?? {}
  const meta = team.team ?? {}
  const teamId = meta.id ?? null
  const teamAbbr = meta.abbreviation ?? ''
  const order = team.pitchers ?? []
  const orderIndex = new Map(order.map((id, i) => [id, i]))

  const players = []
  for (const p of Object.values(team.players ?? {})) {
    const id = p.person?.id
    if (!id) continue
    const b = p.stats?.batting ?? {}
    const s = p.stats?.pitching ?? {}
    const battingAppeared = (b.plateAppearances ?? 0) > 0
    const pitchingAppeared = (s.battersFaced ?? 0) > 0
    if (!battingAppeared && !pitchingAppeared) continue
    players.push({
      id,
      name: p.person?.fullName ?? '',
      teamId,
      teamAbbr,
      order: orderIndex.get(id) ?? Number.MAX_SAFE_INTEGER,
      battingAppeared,
      pitchingAppeared,
      batting: battingAppeared
        ? {
            atBats: b.atBats ?? 0,
            hits: b.hits ?? 0,
            doubles: b.doubles ?? 0,
            triples: b.triples ?? 0,
            homeRuns: b.homeRuns ?? 0,
            rbi: b.rbi ?? 0,
            runs: b.runs ?? 0,
            stolenBases: b.stolenBases ?? 0,
            caughtStealing: b.caughtStealing ?? 0,
            baseOnBalls: b.baseOnBalls ?? 0,
            hitByPitch: b.hitByPitch ?? 0,
            sacFlies: b.sacFlies ?? 0,
          }
        : null,
      pitching: pitchingAppeared
        ? {
            inningsPitched: s.inningsPitched ?? '0.0',
            outs: ipOuts(s.inningsPitched),
            numberOfPitches: s.numberOfPitches ?? 0,
            battersFaced: s.battersFaced ?? 0,
            hits: s.hits ?? 0,
            runs: s.runs ?? 0,
            earnedRuns: s.earnedRuns ?? 0,
            baseOnBalls: s.baseOnBalls ?? 0,
            strikeOuts: s.strikeOuts ?? 0,
            gamesStarted: (s.gamesStarted ?? 0) > 0,
            decision: s.wins ? 'W' : s.losses ? 'L' : s.saves ? 'S' : s.holds ? 'H' : '',
            saves: s.saves ?? 0,
            holds: s.holds ?? 0,
          }
        : null,
    })
  }
  players.sort((a, b) => a.order - b.order)

  return { team: { id: teamId, abbreviation: teamAbbr, name: meta.name ?? '' }, players }
}

// `{ [gamePk]: { away, home } }` — degrades to whatever resolved: a game
// whose fetch fails is simply absent, same graceful posture as
// fetchStampGames. Batched with limited concurrency since /boxscore has no
// bulk multi-gamePk form the way /schedule does.
export async function fetchStampBoxscores(gamePks, { signal } = {}) {
  const list = uniquePks(gamePks)
  if (!list.length) return {}
  const rows = await mapLimit(list, CONCURRENCY, async (gamePk) => {
    try {
      const game = await getJson(`/api/v1/game/${gamePk}/boxscore`, { signal })
      return [gamePk, { away: oneSide(game, 'away'), home: oneSide(game, 'home') }]
    } catch {
      return null
    }
  })
  return Object.fromEntries(rows.filter(Boolean))
}

// A game's win-probability swings worth calling out — First Scorebook's own
// threshold (an 18-point-or-bigger swing, or any scoring play from the 8th on),
// each carrying the join key to its highlight clip already resolved.
const SWING_THRESHOLD = 18
const LATE_INNING = 8

// `{ [gamePk]: [{ inning, half, description, swing, playId }] }`. Filtered
// here rather than left for the caller, so a book of 100+ games doesn't hold
// every one of their ~70-140 plays in memory for the sake of the handful that
// matter.
export async function fetchStampMoments(gamePks, { signal } = {}) {
  const list = uniquePks(gamePks)
  if (!list.length) return {}
  const rows = await mapLimit(list, CONCURRENCY, async (gamePk) => {
    try {
      const entries = await getJson(`/api/v1/game/${gamePk}/winProbability`, { signal })
      if (!Array.isArray(entries)) return null
      const moments = []
      let prior = 50
      for (const entry of entries) {
        const current = entry.homeTeamWinProbability
        if (typeof current !== 'number') continue
        const swing = Math.abs(current - prior)
        const lateScore = entry.about?.isScoringPlay && (entry.about?.inning ?? 0) >= LATE_INNING
        if (swing >= SWING_THRESHOLD || lateScore) {
          const pitches = (entry.playEvents ?? []).filter((e) => e.isPitch)
          moments.push({
            inning: entry.about?.inning ?? null,
            half: entry.about?.isTopInning ? 'Top' : 'Bottom',
            description: entry.result?.description ?? '',
            swing,
            playId: pitches.at(-1)?.playId ?? null,
          })
        }
        prior = current
      }
      return [gamePk, moments]
    } catch {
      return null
    }
  })
  return Object.fromEntries(rows.filter(Boolean))
}
