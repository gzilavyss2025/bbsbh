import { getJson } from './statsapi.js'

// The Logbook's game facts — runs, clubs, venue, innings — for a set of stamped
// gamePks (ADR-0035).
//
// ===========================================================================
// REVEAL-ONLY, and a narrow exception to how the rest of api/ prunes scores
// ===========================================================================
// Every other schedule fetcher in this directory deliberately strips each side's
// score out of the response with `fields=` — a payload win and a spoiler win
// (see the block comment above GAMES_BY_PK_FIELDS in schedule.js). This one
// asks for the score on purpose, which is why it lives here rather than there:
// putting a score-bearing fetcher next to the spoiler-free ones is exactly how
// a future caller reaches for the wrong function.
//
// It is safe for one reason, and only that reason: it is called with the gamePks
// of the user's OWN STAMPS, and a stamp only exists for a game its owner already
// finished revealing (the server enforces that on every mint). Do not call this
// with an arbitrary list of games.
//
// WHY THE CLIENT RESOLVES THESE AT ALL, given /api/stamps already joins them
// server-side: the Logbook is local-first. A signed-out user has a real
// collection on their device and no server to ask, and the local store
// deliberately holds no score (src/lib/stamps.js) — so the page needs one way to
// get facts that works signed in or out. This is it, and it means the Logbook
// renders identically either way instead of having two code paths.

// The same call api/stamps.js makes server-side, so the two produce byte-equal
// facts. `hydrate=team` is what supplies `abbreviation` and `sport.id`, which
// the bare schedule row does not carry.
const HYDRATE = 'linescore,decisions,venue,team'

// statsapi accepts a comma-separated `gamePks` (verified live, 2026-08-04:
// two pks in one call returned both games hydrated). Batched rather than one
// request per stamp, but capped — a 500-stamp season would otherwise build a
// URL long enough to be refused.
const BATCH = 25

// One schedule row -> the `game:final` shape api/stamps.js caches and GameStamp
// draws. Kept identical to that function's `fetchGameFinal` on purpose: one
// shape, two producers, so a stamp looks the same whichever resolved it.
export function stampGameFacts(game) {
  if (!game?.gamePk) return null
  const line = game.linescore ?? {}
  const rows = Array.isArray(line.innings) ? line.innings : []
  const last = rows.length ? rows[rows.length - 1] : null
  // A home club leading after the top of the last inning never bats again — the
  // reveal gate has to know that, or it would demand a half nobody played.
  const homeBattedLast = typeof last?.home?.runs === 'number'

  const side = (key) => {
    const team = game.teams?.[key]?.team ?? {}
    const totals = line.teams?.[key] ?? {}
    return {
      id: team.id ?? null,
      abbreviation: team.abbreviation ?? '',
      name: team.name ?? '',
      runs: typeof totals.runs === 'number' ? totals.runs : (game.teams?.[key]?.score ?? null),
      hits: typeof totals.hits === 'number' ? totals.hits : null,
      errors: typeof totals.errors === 'number' ? totals.errors : null,
    }
  }
  const away = side('away')
  const home = side('home')

  return {
    gamePk: game.gamePk,
    date: game.officialDate ?? (game.gameDate ?? '').slice(0, 10),
    gameNumber: Number.isInteger(game.gameNumber) ? game.gameNumber : 1,
    sportId: game.teams?.home?.team?.sport?.id ?? 1,
    gameType: game.gameType ?? 'R',
    venue: game.venue?.name ?? '',
    innings: rows.length,
    homeBattedLast,
    status: game.status?.abstractGameState ?? '',
    away,
    home,
    winnerId: game.teams?.away?.isWinner ? away.id : game.teams?.home?.isWinner ? home.id : null,
    decisions: {
      winner: game.decisions?.winner?.fullName ?? '',
      loser: game.decisions?.loser?.fullName ?? '',
      save: game.decisions?.save?.fullName ?? '',
    },
  }
}

// `{ [gamePk]: facts }` for the given list. Degrades to whatever resolved: a
// batch that fails leaves those stamps without facts, and the Logbook renders
// them as a plain "still resolving" row rather than dropping a keepsake from
// the page or failing the whole grid.
export async function fetchStampGames(gamePks, { signal } = {}) {
  const list = [...new Set((gamePks ?? []).map(Number).filter(Boolean))]
  if (!list.length) return {}

  const batches = []
  for (let i = 0; i < list.length; i += BATCH) batches.push(list.slice(i, i + BATCH))

  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        return await getJson(
          `/api/v1/schedule?gamePks=${batch.join(',')}&hydrate=${HYDRATE}`,
          { signal },
        )
      } catch {
        return null
      }
    }),
  )

  const out = {}
  for (const data of results) {
    for (const day of data?.dates ?? []) {
      for (const game of day.games ?? []) {
        const facts = stampGameFacts(game)
        if (facts) out[facts.gamePk] = facts
      }
    }
  }
  return out
}
