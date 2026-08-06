// One-time historical sweep for public/data/highlights/{teamId}.json — every
// Final MLB game in a date range that isn't already on file, classified and
// filed the same way the nightly job files a game.
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
// Run by hand:
//   node scripts/gen-highlights-backfill.mjs                        # season start → yesterday
//   node scripts/gen-highlights-backfill.mjs --since=2026-04-01 --until=2026-05-31
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { parseArgs, isoDay } from './lib/args.mjs'
import {
  clipsForGame,
  fileByTeam,
  ingestedGamePks,
  loadBlocklist,
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

// Skip every game already present in a team file — the "don't recompute what's
// done" guard that makes a widened re-run cheap.
const done = await ingestedGamePks()
const targets = all.filter((t) => !done.has(t.gamePk))
console.log(
  `${all.length} finals in ${startDate}..${endDate}; ${done.size} game(s) already on file; sweeping ${targets.length}`,
)

const blocklist = await loadBlocklist()
const swept = await mapConcurrent(targets, CONCURRENCY, async (t) => ({
  ...t,
  clips: await clipsForGame(t.gamePk, blocklist),
}))

const games = swept.filter((g) => g && g.clips.length)
const byTeam = fileByTeam(games)
const { added, teams } = await writeTeamFiles(byTeam, { generatedAt: new Date().toISOString() })

const clipCount = games.reduce((n, g) => n + g.clips.length, 0)
console.log(
  `wrote ${teams} team files under ${OUT_DIR} — ${clipCount} clips from ${games.length} clipped games ` +
    `(+${added} new game rows of ${targets.length} swept)`,
)
