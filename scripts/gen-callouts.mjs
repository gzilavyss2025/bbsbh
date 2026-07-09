// Regenerates public/data/callouts/<MMDDYYYY>.json — the per-game "call-out"
// enrichment for ONE day's MLB slate: the season context that makes a live play
// notable. Four families, all keyed so the app can look them up at render time
// with no live fetch of its own:
//
//   1. Leader call-outs — for each club playing, the season leader (rank 1) in a
//      handful of marquee categories (HR / triple / double / walk / SB / HBP for
//      hitters, strikeouts for pitchers), so the play card can note "going into
//      today, X leads the Brewers in walks" when that leader does the thing.
//   2. Player streaks — a hitter's current on-base streak and stolen-base run,
//      from his game log.
//   3. Situational team records — extra-inning and one-run W-L (from standings
//      splitRecords), plus "record when scoring first" / "when the opponent
//      scores first" (joined from each club's game-by-game linescore).
//   4. Player-homer records — a club's W-L in games the hitter homered, kept
//      only when the split is lopsided enough to be worth surfacing.
//
// WHY a nightly precompute (the war.js / minors-leaders.js build-time pattern,
// docs/data-enrichment.md §5) rather than live: scoped to the NEXT day's teams
// this is still ~hundreds of statsapi calls (a roster + a full-season linescore
// sweep per club, a game log per hitter) — far too heavy for a phone page load.
// So .github/workflows/update-callouts.yml runs this on a nightly cron, commits
// the small shaped file, and the app (src/api/callouts.js) reads it same-origin
// and degrades to nothing when it's absent (MiLB games, an un-generated date, a
// failed run). Everything written here is a SEASON AGGREGATE — spoiler-free; the
// app's spoiler-safety comes entirely from WHERE each note renders (inside an
// already-revealed play card / on an extras page), not from this file.
//
// Like gen-minors-leaders.mjs it is NOT self-contained for RANKING: it imports
// the app's own computeLeaders + category descriptors + normalizeRosterToPool
// (src/api/teamLeaders.js) so a leader here can never drift from the team page.
// The raw fetches are done inline (self-contained, like the other gen-*.mjs) to
// avoid the app's browser-oriented fetch/cache layers.
//
// Runs for TOMORROW's slate by default (the games it precomputes); pass a
// YYYY-MM-DD as argv[2] to (re)generate a specific date by hand:
//   node scripts/gen-callouts.mjs 2026-07-10
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../src/api/statsapi.js'
import {
  computeLeaders,
  normalizeRosterToPool,
  HITTING_CATEGORIES,
  PITCHING_CATEGORIES,
} from '../src/api/teamLeaders.js'
import { HIT_CATEGORY_KEYS } from '../src/api/callout-notes.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'callouts')

const DAY_MS = 24 * 60 * 60 * 1000
const iso = (d) => d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

// The slate to precompute: tomorrow by default, or an explicit YYYY-MM-DD.
const arg = process.argv[2]
const target = arg ? new Date(`${arg}T12:00:00Z`) : new Date(Date.now() + DAY_MS)
const targetApi = iso(target)
// "Entering the game day" cutoff for streaks/records — the day before the slate.
const asOf = iso(new Date(target.getTime() - DAY_MS))
const season = target.getUTCFullYear()
const [ty, tm, td] = targetApi.split('-')
const outFile = join(outDir, `${tm}${td}${ty}.json`)

// Pitcher strikeouts (not a hit category, so separate from HIT_CATEGORY_KEYS).
const PIT_KEYS = ['so_p']

// Show floors — a streak/split only surfaces once it's genuinely notable, so the
// feed isn't peppered with "2-game on-base streak" noise.
const ONBASE_FLOOR = 8
const SB_FLOOR = 4
const HOMER_MIN_GAMES = 5
const HOMER_LOPSIDED = 0.7 // win% ≥ .700 or ≤ .300

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// A tiny bounded-concurrency map so the per-hitter game-log sweep doesn't open
// hundreds of sockets at once. Failures degrade to null for that item.
async function mapPool(items, size, fn) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        out[i] = await fn(items[i], i)
      } catch {
        out[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, worker))
  return out
}

// One club's 40-man roster with season hitting+pitching hydrated — the exact
// request fetchTeamRoster builds, inlined so this script needn't import the
// app's browser-oriented team.js. rosterType=40Man so an injured leader (e.g. a
// club's HR leader on the IL) still counts.
async function fetchRoster(teamId) {
  const data = await getJson(
    `/api/v1/teams/${teamId}/roster?rosterType=40Man&hydrate=person(stats(type=season,group=[hitting,pitching],sportId=1,season=${season}))`,
  )
  return data.roster ?? []
}

// The rank-1 leader (id + formatted value) per marquee category for one club,
// ranked by the app's own computeLeaders so it can't drift from the team page.
// A category with no qualifying leader (nobody's done it — computeLeaders drops
// zeroes for "most" stats) simply doesn't appear.
function clubLeaders(pool) {
  const hitting = {}
  for (const key of HIT_CATEGORY_KEYS) {
    const cat = HITTING_CATEGORIES.find((c) => c.key === key)
    const top = computeLeaders(pool, cat, { limit: 1 })[0]
    if (top) hitting[key] = { id: top.id, display: top.display }
  }
  const pitching = {}
  for (const key of PIT_KEYS) {
    const cat = PITCHING_CATEGORIES.find((c) => c.key === key)
    const top = computeLeaders(pool, cat, { limit: 1 })[0]
    if (top) pitching[key] = { id: top.id, display: top.display }
  }
  return { hitting, pitching }
}

// Extra-inning + one-run W-L for every club, from the standings splitRecords as
// of the slate's eve (the endpoint honors `date`, so tonight's-in-progress games
// never fold in). Keyed by teamId; degrades to an empty map on failure.
async function fetchSplitRecords() {
  const map = {}
  const leagues = await Promise.allSettled(
    [103, 104].map((leagueId) =>
      getJson(
        `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason&date=${asOf}`,
      ),
    ),
  )
  for (const res of leagues) {
    if (res.status !== 'fulfilled') continue
    for (const rec of res.value.records ?? []) {
      for (const t of rec.teamRecords ?? []) {
        const id = t.team?.id
        if (id == null) continue
        const splits = t.records?.splitRecords ?? []
        const wl = (type) => {
          const s = splits.find((x) => x.type === type)
          return s ? `${s.wins}-${s.losses}` : null
        }
        map[id] = { extraInning: wl('extraInning'), oneRun: wl('oneRun') }
      }
    }
  }
  return map
}

// "Record when scoring first" / "when the opponent scores first" for one club,
// joined from its full-season schedule with per-inning linescore. Who scored
// first = the first inning (top before bottom) in which either side put up a
// run; W/L from the club's own isWinner. Cut off at `asOf` so a slate scored
// later never folds tonight's result into the record.
async function scoringRecord(teamId) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=team,linescore`,
  )
  const games = (data.dates ?? []).flatMap((d) => d.games ?? [])
  let sfW = 0, sfL = 0, osW = 0, osL = 0
  const seen = new Set()
  for (const g of games) {
    if (g.status?.abstractGameState !== 'Final') continue
    const date = g.officialDate ?? (g.gameDate ?? '').slice(0, 10)
    if (date && date > asOf) continue
    if (seen.has(g.gamePk)) continue
    seen.add(g.gamePk)
    const away = g.teams?.away
    const home = g.teams?.home
    const isHome = home?.team?.id === teamId
    const me = isHome ? home : away
    if (me?.isWinner == null) continue
    let firstScorer = null // 'away' | 'home'
    for (const inn of g.linescore?.innings ?? []) {
      if (num(inn.away?.runs) > 0) { firstScorer = 'away'; break }
      if (num(inn.home?.runs) > 0) { firstScorer = 'home'; break }
    }
    if (!firstScorer) continue
    const meScoredFirst = (firstScorer === 'home') === isHome
    const won = me.isWinner === true
    if (meScoredFirst) won ? sfW++ : sfL++
    else won ? osW++ : osL++
  }
  return {
    scoringFirst: `${sfW}-${sfL}`,
    opponentScoringFirst: `${osW}-${osL}`,
  }
}

// A hitter's game-log-derived enrichment: current on-base streak (consecutive
// games PLAYED reaching base), a conservative stolen-base run (SB accumulated
// back to his last caught stealing — a game-level view can't see intra-game
// order, so it stops at any CS rather than over-claiming), and his club's W-L in
// games he homered. Cut off at `asOf`.
async function hitterEnrich(personId) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=hitting&season=${season}`,
  )
  const rows = (data.stats?.[0]?.splits ?? [])
    .filter((s) => s.date && s.date <= asOf)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first

  let onBase = 0
  for (const s of rows) {
    const st = s.stat ?? {}
    if (num(st.plateAppearances) === 0) continue // didn't bat — neither breaks nor counts
    if (num(st.hits) + num(st.baseOnBalls) + num(st.hitByPitch) > 0) onBase++
    else break
  }

  let stolenBase = 0
  for (const s of rows) {
    const st = s.stat ?? {}
    if (num(st.caughtStealing) > 0) break
    stolenBase += num(st.stolenBases)
  }

  let hw = 0, hl = 0
  for (const s of rows) {
    if (num(s.stat?.homeRuns) > 0) s.isWin ? hw++ : hl++
  }

  return { onBase, stolenBase, homerW: hw, homerL: hl }
}

// ---------------------------------------------------------------------------

const slate = await getJson(`/api/v1/schedule?sportId=1&date=${targetApi}&hydrate=team`)
const games = (slate.dates ?? []).flatMap((d) => d.games ?? [])
if (games.length === 0) {
  console.log(`no MLB games on ${targetApi} — nothing to generate`)
  process.exit(0)
}

// Every club on the slate, and the metadata each game needs.
const teamMeta = new Map() // teamId -> { name }
for (const g of games) {
  for (const side of ['away', 'home']) {
    const t = g.teams?.[side]?.team
    if (t?.id != null && !teamMeta.has(t.id)) {
      teamMeta.set(t.id, { name: t.teamName ?? t.name ?? '' })
    }
  }
}
const teamIds = [...teamMeta.keys()]

// Per-club: roster pool → leaders, and the set of hitter ids to game-log.
const splitRecords = await fetchSplitRecords()
const leadersByTeam = new Map()
const scoringByTeam = new Map()
const hitterIdsByTeam = new Map() // teamId -> [personId] (position players)
const allHitterIds = new Set()

await mapPool(teamIds, 6, async (teamId) => {
  const roster = await fetchRoster(teamId)
  const pool = normalizeRosterToPool(roster, {
    id: teamId,
    abbreviation: '',
    sport: { id: 1 },
  })
  leadersByTeam.set(teamId, clubLeaders(pool))
  const hitters = roster
    .filter((r) => r.position?.type !== 'Pitcher' && r.person?.id)
    .map((r) => r.person.id)
  hitterIdsByTeam.set(teamId, hitters)
  for (const id of hitters) allHitterIds.add(id)
  scoringByTeam.set(teamId, await scoringRecord(teamId))
})

// Per-hitter game-log sweep (the heaviest fan-out) — bounded concurrency, each
// hitter fetched once even if his club plays a doubleheader.
const hitterList = [...allHitterIds]
const enrichList = await mapPool(hitterList, 8, (id) => hitterEnrich(id))
const enrichById = new Map()
hitterList.forEach((id, i) => enrichById.set(id, enrichList[i]))

// Assemble per-game bundles keyed by gamePk. Everything the render layer needs,
// pre-joined so the app only ever does one static read + object lookups.
const outGames = {}
for (const g of games) {
  const awayId = g.teams?.away?.team?.id
  const homeId = g.teams?.home?.team?.id
  if (awayId == null || homeId == null) continue

  // Leaders keyed by playerId across BOTH clubs, so AtBatCard looks up batter.id
  // directly. Each carries the club name for the note ("leads the Brewers …").
  const leaders = {}
  const pitcherLeaders = {}
  for (const teamId of [awayId, homeId]) {
    const teamName = teamMeta.get(teamId)?.name ?? ''
    const cl = leadersByTeam.get(teamId)
    if (!cl) continue
    for (const [key, top] of Object.entries(cl.hitting)) {
      const e = (leaders[top.id] ??= { team: teamName, cats: {} })
      e.cats[key] = top.display
    }
    for (const [key, top] of Object.entries(cl.pitching)) {
      const e = (pitcherLeaders[top.id] ??= { team: teamName, cats: {} })
      e.cats[key] = top.display
    }
  }

  // Streaks + homer records for THIS game's two clubs' rostered hitters,
  // clearing the show floors so the feed isn't peppered with thin notes.
  const streaks = {}
  const homerRecords = {}
  const gameHitterIds = [
    ...(hitterIdsByTeam.get(awayId) ?? []),
    ...(hitterIdsByTeam.get(homeId) ?? []),
  ]
  for (const id of gameHitterIds) {
    const e = enrichById.get(id)
    if (!e) continue
    const s = {}
    if (e.onBase >= ONBASE_FLOOR) s.onBase = e.onBase
    if (e.stolenBase >= SB_FLOOR) s.stolenBase = e.stolenBase
    if (s.onBase || s.stolenBase) streaks[id] = s
    const homerGames = e.homerW + e.homerL
    if (homerGames >= HOMER_MIN_GAMES) {
      const pct = e.homerW / homerGames
      if (pct >= HOMER_LOPSIDED || pct <= 1 - HOMER_LOPSIDED) {
        homerRecords[id] = `${e.homerW}-${e.homerL}`
      }
    }
  }

  outGames[g.gamePk] = {
    away: { teamId: awayId, name: teamMeta.get(awayId)?.name ?? '' },
    home: { teamId: homeId, name: teamMeta.get(homeId)?.name ?? '' },
    leaders,
    pitcherLeaders,
    streaks,
    homerRecords,
    teamRecords: {
      away: { ...(splitRecords[awayId] ?? {}), ...(scoringByTeam.get(awayId) ?? {}) },
      home: { ...(splitRecords[homeId] ?? {}), ...(scoringByTeam.get(homeId) ?? {}) },
    },
  }
}

await mkdir(outDir, { recursive: true })
await writeFile(
  outFile,
  JSON.stringify({ date: targetApi, season, generatedAt: new Date().toISOString(), games: outGames }),
)
console.log(`wrote ${outFile} (${Object.keys(outGames).length} games, ${hitterList.length} hitters swept)`)

// Prune old per-date files so the committed folder stays small — keep anything
// from the last ~10 days onward (a game scored a few days late still finds its
// file; older ones are unreachable slate history).
const keepFrom = iso(new Date(target.getTime() - 10 * DAY_MS)).replace(/-/g, '')
try {
  for (const name of await readdir(outDir)) {
    const m = name.match(/^(\d{2})(\d{2})(\d{4})\.json$/)
    if (!m) continue
    const ymd = `${m[3]}${m[1]}${m[2]}` // YYYYMMDD
    if (ymd < keepFrom) await rm(join(outDir, name))
  }
} catch {
  /* pruning is best-effort */
}
