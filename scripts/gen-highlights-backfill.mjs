// One-time historical sweep for public/data/highlights/{teamId}.json AND
// public/data/highlights/day/{MMDDYYYY}.json — every Final MLB game in a date
// range that isn't already on file, classified and filed the same way the
// nightly job files a game.
//
// TWO OUTPUTS, ONE FETCH, TWO INDEPENDENT "already done" SETS. The per-team
// clip files and the per-day condensed-game index answer different questions
// and were built at different times, so a game can be complete in one and
// absent from the other — every game swept before day files existed is exactly
// that. A game is swept if EITHER is missing, and each output only takes what
// it was missing.
//
// NOT ON THE NIGHTLY CRON (see scripts/gen-highlights.mjs for that) — same
// category as gen-rookies-backfill.mjs / gen-war-history.mjs: a large one-time
// crawl, hand-run once to establish the season the nightly window can't reach,
// then re-run only to widen the range. A game already on file is skipped
// outright (no fetch at all), so widening the range later never re-sweeps or
// overwrites anything already done.
//
// It shares every bit of its per-game logic with the nightly job
// (scripts/lib/highlights.mjs) — the two scripts differ only in how they source
// their targets: a trailing window there, an explicit season range here.
//
// COST. One /content call per Final MLB game. A full regular season is ~2,430
// games, so a from-scratch season run is a genuinely large crawl (roughly 40-50
// minutes at this concurrency); --since/--until let it be chunked across
// invocations instead of one very long run.
//
// --days-only writes ONLY the day index, leaving the team files untouched.
// That matters because the two backfills have very different consequences: a
// full-season day index is ~1 MB total across ~130 small files that the slate
// reads one of, while a full-season CLIP backfill grows every team file to
// ~0.5 MB — and the team/player rails fetch a whole team file to render, so
// that is a page-weight decision about a different surface, not a free
// side effect of asking for posters.
//
// Run by hand:
//   node scripts/gen-highlights-backfill.mjs                        # season start → yesterday
//   node scripts/gen-highlights-backfill.mjs --since=2026-04-01 --until=2026-05-31
//   node scripts/gen-highlights-backfill.mjs --days-only            # condensed-game index only
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { parseArgs, isoDay } from './lib/args.mjs'
import {
  dayIndexedGamePks,
  fileByTeam,
  ingestedGamePks,
  loadBlocklist,
  sweepGame,
  writeDayFiles,
  writeTeamFiles,
  OUT_DIR,
} from './lib/highlights.mjs'

const CONCURRENCY = 6

const args = parseArgs(process.argv.slice(2))
const today = new Date()
const yesterday = new Date(today)
yesterday.setUTCDate(yesterday.getUTCDate() - 1)
// Defaults to the current season through yesterday — today's games belong to
// the nightly job, which runs after the slate has gone Final.
const startDate = args.since || `${today.getUTCFullYear()}-01-01`
const endDate = args.until || isoDay(yesterday)

const schedule = await getJson(
  `/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R,F,D,L,W,A`,
)
const all = []
for (const d of schedule.dates ?? []) {
  for (const g of d.games ?? []) {
    if (g.status?.abstractGameState !== 'Final') continue
    if (d.date !== g.officialDate) continue
    all.push({ gamePk: g.gamePk, date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10) })
  }
}

// Skip every game already done in BOTH outputs — the "don't recompute what's
// done" guard that makes a widened re-run cheap. The two are separate
// questions: a game's clips can be filed while its condensed cut isn't
// indexed, which is true of every game swept before day files existed, so a
// game is a target if EITHER is missing.
const done = await ingestedGamePks()
const dayDone = await dayIndexedGamePks()
const daysOnly = Boolean(args['days-only'] ?? args.daysOnly)
const targets = all.filter(
  (t) => (!daysOnly && !done.has(t.gamePk)) || !dayDone.has(t.gamePk),
)
console.log(
  `${all.length} finals in ${startDate}..${endDate}; ${done.size} with clips on file, ` +
    `${dayDone.size} in the day index; sweeping ${targets.length}`,
)

const blocklist = await loadBlocklist()
// One fetch, both outputs — see sweepGame. A game re-swept only for its day
// entry hands back its clips for free, so `games` below drops the ones already
// filed rather than re-writing team rows that exist.
const swept = await mapConcurrent(targets, CONCURRENCY, async (t) => ({
  ...t,
  ...(await sweepGame(t.gamePk, blocklist)),
}))

const generatedAt = new Date().toISOString()

const games = daysOnly ? [] : swept.filter((g) => g && g.clips.length && !done.has(g.gamePk))
const byTeam = fileByTeam(games)
const { added, teams } = await writeTeamFiles(byTeam, { generatedAt })

const byDate = new Map()
for (const g of swept) {
  if (!g?.condensed || !g.date) continue
  if (!byDate.has(g.date)) byDate.set(g.date, {})
  byDate.get(g.date)[g.gamePk] = g.condensed
}
const { days, entries } = await writeDayFiles(byDate, { generatedAt })

const clipCount = games.reduce((n, g) => n + g.clips.length, 0)
console.log(
  `wrote ${teams} team files under ${OUT_DIR} — ${clipCount} clips from ${games.length} clipped games ` +
    `(+${added} new game rows of ${targets.length} swept)`,
)
console.log(`wrote ${days} day files under ${OUT_DIR}/day — ${entries} condensed games`)
