// Builds per-player, per-team, per-season POSTSEASON playing time (PA for
// hitters, IP for pitchers) — the postseason-side counterpart to
// build-roster-age.mjs's regular-season pull. Exists to answer a specific
// question raised against spike #1 (docs/team-success-roster-age.md): a
// team's regular-season age is inflated by trade-deadline rentals who may or
// may not have actually played meaningful innings once October arrived. This
// gives every future factor spike, not just age, a real "did this player's
// October role match his regular-season role" measure — see
// analyze-usage-mismatch.mjs.
//
// SOURCE: public/data/postseason-history.json for the game list (every
// gamePk a team played that postseason, across every round), then
// GET /api/v1/game/{gamePk}/boxscore per distinct game (cached — ~900-1,000
// calls across the whole 2000-2025 window, one-tenth the regular-season
// pull, since a postseason is a handful of games per team per year).
//
// A player is credited to whichever SIDE of the boxscore (home/away) his
// team appears on for that specific game — a team's own postseason boxscore
// already segregates this, so there is no traded-player attribution problem
// here the way there is on the regular-season bulk endpoint (a postseason
// roster is fixed for that whole series/season by rule).
//
// Run: node .scratch/team-success/build-postseason-usage.mjs
// Writes: .scratch/team-success/postseason-usage.json
// Caches boxscores in: .scratch/team-success/postseason-boxscore-cache.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const CACHE_PATH = join(__dirname, 'postseason-boxscore-cache.json')
const OUT_PATH = join(__dirname, 'postseason-usage.json')

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {}
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
}
function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache))
}

async function fetchWithRetry(url, attempts = 4) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`statsapi ${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw lastErr
}

function parseInnings(ip) {
  const [whole, frac] = String(ip ?? '0').split('.')
  const wholeNum = Number(whole) || 0
  const fracNum = frac === '1' ? 1 / 3 : frac === '2' ? 2 / 3 : 0
  return wholeNum + fracNum
}

// Slim boxscore side down to just what this spike reads, same reasoning as
// build-roster-age.mjs's slimSplit — a full boxscore per game is large and
// almost none of it is used here.
function slimSide(side) {
  return Object.values(side.players ?? {}).map((p) => ({
    personId: p.person?.id ?? null,
    name: p.person?.fullName ?? null,
    pa: p.stats?.batting?.plateAppearances ?? 0,
    ip: parseInnings(p.stats?.pitching?.inningsPitched ?? '0'),
  }))
}

async function fetchBoxscore(cache, gamePk) {
  const key = String(gamePk)
  if (cache[key]) return cache[key]
  const json = await fetchWithRetry(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`)
  const slim = {
    home: { teamId: json.teams.home.team.id, players: slimSide(json.teams.home) },
    away: { teamId: json.teams.away.team.id, players: slimSide(json.teams.away) },
  }
  cache[key] = slim
  return slim
}

async function main() {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, 'public', 'data', 'postseason-history.json'), 'utf8'),
  )
  const cache = loadCache()

  // Every (season, gamePk) this team played, deduped — a team can appear in
  // more than one round, each contributing its own games.
  const gamesBySeason = new Map() // year -> Set(gamePk)
  for (const season of raw.seasons) {
    const set = gamesBySeason.get(season.year) ?? new Set()
    for (const round of season.rounds) {
      for (const series of round.series) {
        for (const game of series.games) set.add(game.gamePk)
      }
    }
    gamesBySeason.set(season.year, set)
  }

  const seasons = []
  let done = 0
  const totalGames = [...gamesBySeason.values()].reduce((sum, s) => sum + s.size, 0)

  for (const [year, gamePks] of [...gamesBySeason.entries()].sort((a, b) => a[0] - b[0])) {
    const teams = {} // teamId -> { hitting: Map<personId, {name,pa}>, pitching: Map<personId,{name,ip}> }
    const ensureTeam = (teamId) => {
      if (!teams[teamId]) teams[teamId] = { hitting: new Map(), pitching: new Map() }
      return teams[teamId]
    }
    const addSide = (side) => {
      const t = ensureTeam(side.teamId)
      for (const p of side.players) {
        if (p.pa > 0) {
          const cur = t.hitting.get(p.personId) ?? { name: p.name, pa: 0 }
          cur.pa += p.pa
          t.hitting.set(p.personId, cur)
        }
        if (p.ip > 0) {
          const cur = t.pitching.get(p.personId) ?? { name: p.name, ip: 0 }
          cur.ip += p.ip
          t.pitching.set(p.personId, cur)
        }
      }
    }

    for (const gamePk of gamePks) {
      const box = await fetchBoxscore(cache, gamePk)
      addSide(box.home)
      addSide(box.away)
      done += 1
      if (done % 100 === 0) {
        console.log(`${done}/${totalGames} postseason boxscores pulled`)
        saveCache(cache)
      }
    }

    const teamsOut = {}
    for (const [teamId, t] of Object.entries(teams)) {
      teamsOut[teamId] = {
        hitting: [...t.hitting.entries()].map(([personId, v]) => ({ personId: Number(personId), ...v })),
        pitching: [...t.pitching.entries()].map(([personId, v]) => ({ personId: Number(personId), ...v })),
      }
    }
    seasons.push({ year, teams: teamsOut })
  }

  saveCache(cache)
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'public/data/postseason-history.json game list + /api/v1/game/{gamePk}/boxscore',
        seasons,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${seasons.length} seasons of postseason usage to ${OUT_PATH}`)
}

main()
