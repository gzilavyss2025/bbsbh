// Regenerates public/data/highlights/{teamId}.json — one small file per MLB
// club holding that club's per-play video highlights, game by game, newest
// first. Read by src/api/gamehighlights.js for the Team hub's Games tab rail
// and the player page's rail (see .scratch/highlights-cascade/PRD.md).
//
// WHY PRECOMPUTED. The box score already fetches a single game's clips live at
// reveal time (src/api/highlights.js) and keeps doing so — that surface is
// unaffected by this script. The RAILS can't work that way: a full-season sweep
// for one regular found real 12-day gaps with zero credited clips, so a
// "last 10 games" window would render an empty rail on a day when 48 real clips
// exist just outside it. The rails need the whole season, and fetching ~115
// games' worth of `content` on every visit to a player page is not viable on a
// phone. Known lag, accepted: a game finishing tonight doesn't reach a rail
// until this job's next run, same as every other precomputed feature here.
//
// SCAN BY GAME, NOT BY TEAM. Each game belongs to two clubs, so scanning
// per-team schedules would fetch the same game's `content` twice for nothing.
// One pass over newly-Final MLB games, one fetchHighlights() call each, and
// every surviving clip filed under the team its own `team_id` names — which is
// what makes a mid-season trade fall out correctly for free (pre-trade clips
// stay filed under the old club).
//
// APPEND-ONLY/INCREMENTAL, like gen-umpire-accuracy.mjs / gen-game-notes.mjs: a
// Final game's clips are immutable, so each run sweeps only a small trailing
// window and merges rows in deduped by gamePk. scripts/gen-highlights-backfill.mjs
// (hand-run, NOT on the cron) establishes the rest of the season once.
//
// FILTERING happens here, never in the reader — the shipped JSON only ever
// contains clips already past the abs/challenge exclusion, the non-play-content
// gate, and the hand-maintained blocklist, so the rails stay dumb readers with
// no policy of their own to keep in sync. All three live in
// src/api/highlights.js + scripts/lib/highlights.mjs.
//
// MLB only (sportId 1), same as highlights.js today — an off-MLB game returns
// no content, so MiLB team/player pages simply show no rail.
//
// Runs on a cron (.github/workflows/update-nightly-data.yml); also by hand:
//   node scripts/gen-highlights.mjs               # trailing 3 days
//   node scripts/gen-highlights.mjs --days=7
//   node scripts/gen-highlights.mjs --since=2026-07-01 [--until=2026-07-10]
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { parseArgs, dateRange } from './lib/args.mjs'
import { clipsForGame, fileByTeam, loadBlocklist, writeTeamFiles, OUT_DIR } from './lib/highlights.mjs'

const DEFAULT_DAYS = 3
// Matches the two existing per-game sweepers (gen-umpire-accuracy.mjs's 6).
const CONCURRENCY = 6

const args = parseArgs(process.argv.slice(2))
const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)

// Final MLB games in the window. Same postponed/replay dedup guard as
// gen-umpire-accuracy.mjs: a replayed game is listed under both its original
// date and its officialDate, so keep only the bucket matching officialDate.
// The Final filter is also the spoiler guard — an in-progress game's clips
// never enter a precomputed file.
const schedule = await getJson(
  `/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R,F,D,L,W,A`,
)
const targets = []
for (const d of schedule.dates ?? []) {
  for (const g of d.games ?? []) {
    if (g.status?.abstractGameState !== 'Final') continue
    if (d.date !== g.officialDate) continue
    targets.push({ gamePk: g.gamePk, date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10) })
  }
}

const blocklist = await loadBlocklist()
const swept = await mapConcurrent(targets, CONCURRENCY, async (t) => ({
  ...t,
  clips: await clipsForGame(t.gamePk, blocklist),
}))

// A game MLB hasn't clipped contributes nothing — don't write it an empty row.
const games = swept.filter((g) => g && g.clips.length)
const byTeam = fileByTeam(games)
const { added, teams } = await writeTeamFiles(byTeam, { generatedAt: new Date().toISOString() })

const clipCount = games.reduce((n, g) => n + g.clips.length, 0)
console.log(
  `wrote ${teams} team files under ${OUT_DIR} — ${clipCount} clips from ${games.length} clipped games ` +
    `(+${added} new game rows, ${targets.length} finals swept, ${startDate}..${endDate}` +
    `${blocklist.size ? `, ${blocklist.size} blocklisted` : ''})`,
)
