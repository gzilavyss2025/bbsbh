// Regenerates public/data/career-matchups.json — for each upcoming game, how
// every batter on a club has fared in his career against the OPPOSING club's
// probable starting pitcher, already shaped for the lineup page's card
// (src/api/careerMatchups.js just reads this file).
//
// Scope note (this replaced a full roster-vs-roster build). The card used to
// cross every batter with every pitcher on the other club — ~340 pairs per
// matchup — then throw most of it away: ROWS_PER_MATCHUP_CAP kept the top 30
// by career plate appearances, and a check of the committed file found ALL 91
// matchups pinned at exactly 30 rows, i.e. the cap was binding everywhere and
// the ranking was by raw PA across both clubs at once. That systematically
// filled the card with long-tenured veterans' trivia while the one line a
// scorer actually wants — tonight's lineup against tonight's starter — only
// appeared if it happened to survive a popularity cut. Scoping the build to
// the probable starter drops the pair count ~13x AND removes the cap: every
// batter with real history against tonight's arm now makes the page.
//
// Keyed by gamePk, not by team pair. A three-game series is the same two
// clubs on three nights with three different starters, and a doubleheader is
// two in one day — a team-pair key (what this file used before) cannot
// represent either, and silently kept whichever game was processed last.
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at
// request time, for two reasons. Cost is the smaller one. The real one is
// spoilers: vsPlayerTotal for the CURRENT season already reflects a game's
// plate appearances the moment they happen (verified live against a game in
// progress), so fetching this mid-game would leak whether/how tonight's
// batter and pitcher have already matched up before the user reveals that
// half. Running only overnight, before that night's games are played, is
// itself the spoiler guard — there is no extra code enforcing it.
//
// DO NOT "simplify" this to one call per batter with `opposingTeamId`.
// GET /people/{batterId}/stats?stats=vsPlayer&opposingTeamId={teamId} looks
// like exactly the endpoint this script wants — it returns a batter's whole
// career book against a franchise, every pitcher, every season, in ONE
// request. It is the wrong data: it filters by the uniform the pitcher was
// WEARING AT THE TIME, not by who is on that staff today, so all the history
// a pitcher accrued with his previous clubs is missing. Measured against a
// real PIT@MIL card: it found 41 of the 141 real batter/pitcher pairs and
// 140 of 495 plate appearances — 72% of the history gone, and it quietly
// UNDERCOUNTS the pairs it does return rather than omitting them. Modern
// roster churn makes that the common case, not an edge case. Per-pair
// vsPlayerTotal (below) is the only accurate source.
//
// Run by hand: node scripts/gen-career-matchups.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'career-matchups.json')
const BASE = 'https://statsapi.mlb.com'

// Today + tomorrow, so late-night and next-day browsing both find their game.
// Deliberately narrower than the sibling generators' three-day window: those
// key by team pair and so pay once per matchup no matter how many days it
// spans, while this one pays per GAME (each night's starter is a different
// set of pairs), making the window a direct multiplier on the run's cost.
const WINDOW_DAYS = 1
const MILB_SPORT_IDS = [11, 12, 13, 14]
const MATCHUP_SPORT_IDS = [1, ...MILB_SPORT_IDS]
const SPORT_LABEL = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A' }

// Which levels to check a pair's shared history at, given the level the game
// itself is being played at. MLB games check MLB only: measured across a real
// slate's starter pairs, every pair with any history had it at MLB and NONE
// had MiLB-only history, so the four extra calls per pair bought nothing. A
// MiLB game also checks one level DOWN, which is where the genuinely
// interesting case lives — "these two last faced off in A+ last year" — since
// players move up through a system mid-season. Going deeper than one level
// multiplies the run for a rapidly thinning tail.
function levelsFor(sportId) {
  if (sportId === 1) return [1]
  const below = sportId + 1
  return MILB_SPORT_IDS.includes(below) ? [sportId, below] : [sportId]
}

const isoDay = (offset = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- schedule: the games to precompute -------------------------------------
// `probablePitcher` is the whole input to this build, so a game without one
// posted yet is skipped entirely rather than half-built (verified live: every
// MLB game and all 15 AAA games on a sample date carried both probables).
// The next night's run picks it up once the club announces.
async function fetchGames() {
  const games = []
  for (let d = 0; d <= WINDOW_DAYS; d++) {
    for (const sportId of MATCHUP_SPORT_IDS) {
      let data
      try {
        data = await getJson(
          `/api/v1/schedule?sportId=${sportId}&date=${isoDay(d)}&hydrate=team,probablePitcher`,
        )
      } catch {
        continue
      }
      for (const date of data.dates ?? []) {
        for (const g of date.games ?? []) {
          const away = g.teams?.away
          const home = g.teams?.home
          if (!away?.team?.id || !home?.team?.id || !g.gamePk) continue
          games.push({
            gamePk: g.gamePk,
            sportId,
            sides: [
              // Each side pairs a club's BATTERS with the pitcher they will
              // face — i.e. the OTHER side's probable starter.
              { batterTeamId: away.team.id, pitcher: home.probablePitcher },
              { batterTeamId: home.team.id, pitcher: away.probablePitcher },
            ].filter((s) => s.pitcher?.id),
          })
        }
      }
    }
  }
  return games
}

// --- rosters: a club's batters ---------------------------------------------
// The active-roster endpoint reports every pitcher as the plain "P"
// abbreviation, so anyone else is a batter. A two-way player (Ohtani-type)
// carries a non-"P" primary position and is therefore correctly included here.
const rosterCache = new Map()
async function fetchBatters(teamId) {
  if (rosterCache.has(teamId)) return rosterCache.get(teamId)
  let batters = []
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    batters = (data.roster ?? [])
      .filter((r) => r.person?.id && r.position?.abbreviation !== 'P')
      .map((r) => ({ id: r.person.id, name: r.person.fullName ?? '' }))
  } catch {
    /* leave empty — that side of the game simply has no rows */
  }
  rosterCache.set(teamId, batters)
  return batters
}

// --- the career total itself ------------------------------------------------
// Sums vsPlayerTotal across the levels levelsFor() picked. Counting stats sum
// cleanly; rate stats are deliberately NOT read from the API here — the card
// prints scorebook shorthand ("2-for-7") built from the counts, so a summed
// avg/obp would be a number nothing renders. Levels are tracked by NAME only:
// verified live that vsPlayerTotal's splits carry no `season` field (it is a
// true aggregate, not one row per year — only the separate per-season
// `vsPlayer` type has that, and fetching both would double the request count
// for a cosmetic detail).
//
// Cached by (batter, pitcher, levels): the same pair recurs across the window
// whenever a club's series runs more than one night against the same starter,
// and re-asking would be pure waste.
const pairCache = new Map()
async function careerLine(batterId, pitcherId, levels) {
  const key = `${batterId}-${pitcherId}-${levels.join(',')}`
  if (pairCache.has(key)) return pairCache.get(key)
  const totals = { ab: 0, h: 0, hr: 0, bb: 0, hbp: 0, k: 0, pa: 0 }
  const byLevel = []
  for (const sportId of levels) {
    const q = [
      `stats=vsPlayerTotal`,
      `opposingPlayerId=${pitcherId}`,
      `group=hitting`,
      `sportId=${sportId}`,
    ]
    let data
    try {
      data = await getJson(`/api/v1/people/${batterId}/stats?${q.join('&')}`)
    } catch {
      continue
    }
    let levelPa = 0
    for (const s of data.stats?.[0]?.splits ?? []) {
      const st = s.stat ?? {}
      const pa = Number(st.plateAppearances ?? 0)
      if (pa <= 0) continue
      totals.ab += Number(st.atBats ?? 0)
      totals.h += Number(st.hits ?? 0)
      totals.hr += Number(st.homeRuns ?? 0)
      totals.bb += Number(st.baseOnBalls ?? 0) + Number(st.intentionalWalks ?? 0)
      totals.hbp += Number(st.hitByPitch ?? 0)
      totals.k += Number(st.strikeOuts ?? 0)
      totals.pa += pa
      levelPa += pa
    }
    if (levelPa > 0) byLevel.push(SPORT_LABEL[sportId] ?? String(sportId))
  }
  const line = totals.pa === 0 ? null : { ...totals, levels: byLevel }
  pairCache.set(key, line)
  return line
}

// --- main -------------------------------------------------------------------
const games = await fetchGames()
console.log(`${games.length} games in window (${isoDay(0)} .. ${isoDay(WINDOW_DAYS)})`)

// Every (batter, pitcher) job across every game, built up front so the whole
// run shares one concurrency pool rather than serializing game by game.
const jobs = []
for (const game of games) {
  for (const side of game.sides) {
    const batters = await fetchBatters(side.batterTeamId)
    for (const batter of batters) {
      jobs.push({
        gamePk: game.gamePk,
        levels: levelsFor(game.sportId),
        batter: { ...batter, teamId: side.batterTeamId },
        pitcher: { id: side.pitcher.id, name: side.pitcher.fullName ?? '' },
      })
    }
  }
}
console.log(`${jobs.length} batter/pitcher pairs to check`)

const lines = await mapConcurrent(jobs, 8, (j) => careerLine(j.batter.id, j.pitcher.id, j.levels))

// Group into gamePk -> [{ pitcher, batters: [...] }]. The pitcher's own club
// is the batting side's opponent, which the reader already knows, so the
// entry is keyed by the BATTING club — that is what the lineup page has in
// hand when it asks.
const matchups = {}
let totalRows = 0
jobs.forEach((j, i) => {
  const line = lines[i]
  if (!line) return
  const game = (matchups[j.gamePk] ??= { sides: {} })
  const side = (game.sides[j.batter.teamId] ??= {
    pitcher: { id: j.pitcher.id, name: j.pitcher.name },
    batters: [],
  })
  side.batters.push({ id: j.batter.id, name: j.batter.name, ...line })
  totalRows++
})

// Most career history first — the deepest sample is the most meaningful row,
// and unlike the old build nothing is dropped below a cap, so this is a
// reading order rather than a filter.
for (const game of Object.values(matchups)) {
  for (const side of Object.values(game.sides)) side.batters.sort((a, b) => b.pa - a.pa)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), matchups }))
console.log(
  `wrote ${out} (${Object.keys(matchups).length} games / ${totalRows} batter-vs-starter rows, ` +
    `${pairCache.size} unique pairs queried)`,
)
