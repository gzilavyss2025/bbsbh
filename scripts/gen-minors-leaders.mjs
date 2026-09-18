// Regenerates public/data/minors-leaders.json — the ALL-MINORS combined leader
// pool: every full-season farm level's season lines (hitting + pitching), summed
// per player across the levels he's climbed this year, so a two-level slugger
// ranks on his COMBINED total (see src/api/statsLevels.js for the why + the math).
//
// Why static, unlike the live per-level/org/team leader pools: this one board is
// league-wide across four levels — eight full-level stat pulls, ~4-5MB raw and
// several thousand players — far too heavy to fetch + combine on a phone page
// load. So a daily cron precomputes the combined pool (see
// .github/workflows/update-nightly-data.yml) and the app just reads the shaped
// file (src/api/minorsLeaders.js) and ranks it client-side with the same
// computeLeaders it uses everywhere. Same build-time-fetch pattern as war.js /
// rehab.js (docs/data-enrichment.md §5); still spoiler-free (season aggregates).
//
// Unlike the FanGraphs/rehab generators — which keep self-contained copies of
// their logic — this imports the app's OWN combine AND ranking (statsLevels.js +
// teamLeaders.js). Those modules are pure and node-safe, and the live scopes use
// the very same combineToPool + computeLeaders, so importing keeps the static
// board in exact lockstep with the live ones rather than risking a drifting copy.
//
// It stores PRE-RANKED leaderboards, not the raw ~4,700-player pool: the pool is
// ~2.4MB (committed daily = a lot of git churn), while the top rows per category
// are a couple dozen KB. Ranking over the FULL pool here (not a trimmed one) is
// also what keeps the leader-relative qualifier's playing-time floor correct —
// the app can't reproduce that floor from a trimmed pool, so it must be baked in.
// Run by hand: node scripts/gen-minors-leaders.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchLevelSeasonStats, combineToPool } from '../src/api/statsLevels.js'
import { computeLeaders, ALL_CATEGORIES } from '../src/api/teamLeaders.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { levelSpan, seasonWindows } from './lib/level-path.mjs'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'minors-leaders.json')
const teamsFile = join(here, '..', 'public', 'data', 'teams.json')
const season = new Date().getFullYear()

// Same "leader shows its MLB parent affiliate's mark, not its own farm club's"
// resolution TeamLeaders.jsx's live scopes get from api/statsLevels.js's
// attachDisplayTeams — reimplemented here (rather than imported) because that
// version reads public/data/teams.json via a same-origin `fetch()`, which has
// no base URL in a plain Node script; this reads the same file straight off
// disk instead. Keeps the precomputed all-minors board's leader tags (and the
// favorite-team highlight, which keys off the same field) in step with every
// live scope.
async function attachDisplayTeams(pool) {
  const { bySportId } = JSON.parse(await readFile(teamsFile, 'utf8'))
  const byId = new Map(Object.values(bySportId ?? {}).flat().map((t) => [t.id, t]))
  return pool.map((p) => {
    const team = byId.get(p.teamId)
    if (!team?.parentOrgId) return { ...p, displayTeamId: p.teamId, displayTeamAbbr: p.teamAbbr }
    const parent = byId.get(team.parentOrgId)
    return {
      ...p,
      displayTeamId: team.parentOrgId,
      displayTeamAbbr: parent?.abbreviation ?? p.teamAbbr,
    }
  })
}

// The four full-season farm levels (AAA/AA/A+/A) — matches ORG_SPORT_IDS in
// api/leaders.js; Rookie/complex ball is excluded, as it is from every board.
const LEVEL_SPORT_IDS = [11, 12, 13, 14]

// WHICH WAY EACH SEASON WENT — issue #1122.
//
// `levels` on a pool entry is a Set sorted by level, so it says which levels a
// season touched and nothing about the order. Any surface that reads its two
// ends as a climb — the minor levels' offseason page did — cannot tell a
// promotion from a demotion, and reads a rehab cameo as a rise.
//
// The order is recoverable in BULK. `stats=byDateRange` is the same league-wide
// call the pool itself comes from, date-bounded, so asking each level who played
// there in each half-month of its season says, for every player, when he first
// and last appeared at each level — which is the order he played them in. `fields=` trims a response from ~480KB to ~47KB, which
// is what makes this affordable: twelve windows x four levels x two groups is
// ~96 calls of ~47KB against the eight full-season pulls above.
//
// Each level's own regular season bounds the windows, because the four do not
// start or finish together — A+ 2026 ran April 2 to September 6, AAA March 27
// to September 20. Reading each level's published row is one small call per
// level, the same reading the app's own offseason gate makes (ADR-0079).
const LEVEL_PATH_CONCURRENCY = 6

// MILB_LEVELS' order, low to high — ROK(0) through AAA(4). A span's two ends
// are compared on these, never on the raw sportIds, which run the other way.
const LEVEL_RANK = new Map([[16, 0], [14, 1], [13, 2], [12, 3], [11, 4]])
const rankOf = (sportId) => (LEVEL_RANK.has(sportId) ? LEVEL_RANK.get(sportId) : null)

async function windowsForLevel(sportId) {
  try {
    const row = (await getJson(`/api/v1/seasons/${season}?sportId=${sportId}`)).seasons?.[0]
    return seasonWindows(row?.regularSeasonStartDate, row?.regularSeasonEndDate)
  } catch {
    return []
  }
}

// One trimmed date-bounded pull. Only the fields a span needs come back — who
// played, at which level, and whether he played at all — which is the whole
// reason this is cheap enough to do ~96 times.
async function windowRows(sportId, group, start, end) {
  try {
    const data = await getJson(
      `/api/v1/stats?stats=byDateRange&group=${group}&season=${season}&sportId=${sportId}` +
        `&startDate=${start}&endDate=${end}&playerPool=all&limit=5000` +
        `&fields=stats,splits,player,id,sport,stat,gamesPlayed`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// playerId -> { from, to }: the level his season began at and the level it
// ended at, which is the only reading that can tell a call-up from a demotion
// or a rehab stint.
async function levelSpansBySeason() {
  const perLevel = await Promise.all(LEVEL_SPORT_IDS.map((sid) => windowsForLevel(sid)))
  // ONE window index shared across every level, so spans measured at four
  // different levels are on the same clock. The four seasons overlap almost
  // entirely, so this is a single calendar of half-months covering all of
  // them rather than four separate ones.
  // Keyed on the HALF-MONTH, never on a window's own start date: the four
  // levels open on four different days, so each one's first window is clamped
  // to its own opener and their April dates do not match. Ordering on those
  // would put a level that started earlier ahead of one that started later
  // inside the same fortnight (seasonWindows says what that cost).
  const calendar = [...new Set(perLevel.flat().map((w) => w.key))].sort()
  const windowIndex = new Map(calendar.map((key, i) => [key, i]))

  const jobs = []
  LEVEL_SPORT_IDS.forEach((sportId, i) => {
    for (const w of perLevel[i]) {
      for (const group of ['hitting', 'pitching']) {
        jobs.push({ sportId, group, ...w, window: windowIndex.get(w.key) })
      }
    }
  })

  const observations = new Map()
  await mapConcurrent(jobs, LEVEL_PATH_CONCURRENCY, async (job) => {
    for (const split of await windowRows(job.sportId, job.group, job.start, job.end)) {
      const id = split.player?.id
      if (!id) continue
      if (!observations.has(id)) observations.set(id, [])
      observations.get(id).push({
        window: job.window,
        // The split's OWN sport, not the one asked for: a level's date-range
        // call answers about that level, but reading it off the row costs
        // nothing and cannot drift if that ever stops being true.
        sportId: split.sport?.id ?? job.sportId,
        games: split.stat?.gamesPlayed ?? 0,
      })
    }
  })

  const spans = new Map()
  for (const [id, rows] of observations) {
    // Null for a season spent at one level, which is the overwhelming majority
    // and says nothing a reader wants. A player who DID change level is stored
    // even when he ended where he began — a rehab assignment, or a demotion he
    // played his way back from — because "he moved and finished level" is a
    // real answer, and one the reader of this field must not confuse with "this
    // board is too old to say".
    const span = levelSpan(rows, rankOf)
    if (span) spans.set(id, span)
  }
  console.log(`level spans: ${jobs.length} window pulls -> ${spans.size} players who changed level`)
  return spans
}

// A little deeper than any page shows (the leaders page renders 10) so a future
// "see more" has headroom without a regen.
const DEPTH = 25

const settled = (results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

const [hit, pit] = await Promise.all([
  Promise.allSettled(LEVEL_SPORT_IDS.map((sid) => fetchLevelSeasonStats(sid, 'hitting', season))),
  Promise.allSettled(LEVEL_SPORT_IDS.map((sid) => fetchLevelSeasonStats(sid, 'pitching', season))),
])
const pool = await attachDisplayTeams(combineToPool(settled(hit), settled(pit)))

// Rank the full pool once per category, exactly as the app would, and keep the
// top DEPTH rows — the SAME 'leader-relative' qualifier the leaders page passes.
const leaders = {}
for (const category of ALL_CATEGORIES) {
  const entries = computeLeaders(pool, category, { limit: DEPTH, qualifier: 'leader-relative' })
  if (entries.length) leaders[category.key] = entries
}

// `fromLevel`/`toLevel` are attached AFTER ranking rather than carried through
// the pool, so nothing about the live boards changes: combineToPool and
// computeLeaders are the app's own modules, shared with every live scope, and a
// date-windowed fan-out has no business inside either. They ride on the ranked
// entry because that is what the app reads.
const spans = pool.length ? await levelSpansBySeason() : new Map()
let tagged = 0
for (const entries of Object.values(leaders)) {
  for (const entry of entries) {
    const span = spans.get(entry.id)
    if (span) {
      entry.fromLevel = span.from
      entry.toLevel = span.to
      tagged += 1
    }
  }
}

// DO NOT REPLACE A SEASON WITH AN EMPTY ONE. `season` is the calendar year this
// script runs in, so the first nightly run of January asks four levels for a
// season nobody has played a game of and gets nothing back. Written out, that
// board would replace a finished season's with an empty one and hold it there
// until April — through the exact months the minor levels' offseason page reads
// it (components/offseason/MovedUp.jsx, issue #1077), and through the leaders
// page's whole winter too.
//
// So an empty pool is treated as "nothing new to say", not as an answer. The
// file keeps the last season it had, `season` keeps naming that season, and a
// reader that checks the year (as MovedUp does) is told the truth either way.
// The rollover happens on its own once the new season has games in it.
if (pool.length === 0) {
  console.log(`skipped ${out} — ${season} returned no players, keeping the board already on disk`)
} else {
  await writeJsonAtomic(out, {
    season,
    generatedAt: new Date().toISOString(),
    poolSize: pool.length,
    leaders,
  })
  const cats = Object.keys(leaders).length
  console.log(
    `wrote ${out} (${pool.length} players ranked across ${cats} categories, top ${DEPTH} each; ` +
      `${tagged} ranked rows carry a level span)`,
  )
}
