// Regenerates public/data/xwoba-table/{season}.json — the xwOBA (est.) lookup
// on exit velocity and launch angle that the hitter grid reads for each ball in
// play of a game of the same season (#1411 Part C, ADR-0097). The estimator and
// the gate are in lib/pitch/xwoba.mjs.
//
// NOT ON THE NIGHTLY CRON, like gen-run-expectancy.mjs: a table built from the
// earlier months of a season holds on the next month (the Part C spike). Run it
// by hand, then re-walk the season's hitter half so every ball uses it:
//   node scripts/gen-xwoba-table.mjs [--season=2026] [--cache=DIR]
//   node scripts/gen-pitch-arsenal.mjs --clear-hitters=2026 --since=2026-03-20
//   node scripts/gen-xwoba-table.mjs --gate [--season=2026]
// Each season needs its own table: a 2025 table fails the gate on 2026. Build
// the first one about 30 days into a season, and again when the season ends.
//
// THE PULL. One Savant search request per day with a Final MLB game
// (regular season and postseason), balls in play only (hfPR, about 0.63 MB),
// a 1 s pause between requests, 4 tries each. Each day is cached OUTSIDE the
// repo (default: $TMPDIR/bbsbh-xwoba/{season}/), so a second run resumes. Only
// a day at least a day old with every game Final is pulled, and a reply with no rows
// is a failure. Stop rule: 3 days in a row that fail every try stop the run,
// and no table is written.
//
// --gate compares the committed hitter-grid/{season}/ files with Savant's
// pitch-arsenal-stats batter board (rows of 40 or more PA). It fails (exit 1)
// over a mean gap of 0.006, over 1% of rows above 0.020, or any row above 0.040.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { setTimeout as sleep } from 'node:timers/promises'
import { isoDay, parseArgs } from './lib/args.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { csvObjects, fetchArsenalBoard, num, withRetry } from './lib/savant.mjs'
import { fitTable, gateRows, gateVerdict, tablePath } from './lib/pitch/xwoba.mjs'
import { POSTSEASON_GAME_TYPES } from './lib/records/postseason.mjs'

const args = parseArgs(process.argv.slice(2))
const season = Number(args.season ?? new Date().getUTCFullYear())
const cacheDir = String(args.cache ?? join(tmpdir(), 'bbsbh-xwoba', String(season)))
const SAVANT = 'https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=pitcher'
const dayUrl = (day) =>
  `${SAVANT}&game_date_gt=${day}&game_date_lt=${day}&hfGT=R%7CF%7CD%7CL%7CW%7C&hfPR=hit%5C.%5C.into%5C.%5C.play%7C`

if (args.gate) await gate()
else await build()

async function build() {
  const sched = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=R,${POSTSEASON_GAME_TYPES}`)
  const days = (sched.dates ?? [])
    // Every game over, at least one played (a rained-out day has no balls in
    // play), and a day old, so Savant has posted the late games.
    .filter((d) => d.date < isoDay(new Date(Date.now() - 864e5)) &&
      d.games.every((g) => g.status?.abstractGameState === 'Final') && d.games.some((g) => g.status?.codedGameState === 'F'))
    .map((d) => d.date)
  await mkdir(cacheDir, { recursive: true })
  const balls = []
  let streak = 0
  for (const day of days) {
    const file = join(cacheDir, `${day}.csv.gz`)
    if (!existsSync(file)) {
      try {
        const text = await withRetry(`Savant ${day}`, 4, async () => {
          const res = await fetch(dayUrl(day))
          const body = await res.text()
          // A day with Final games has balls in play; none means Savant has not posted it yet.
          if (!res.ok || !csvObjects(body)[0]?.pitch_type) throw new Error(`HTTP ${res.status}, no rows`)
          return body
        })
        // Savant cuts a reply at 25,000 rows with no error. A day of balls in play is near 800.
        if (csvObjects(text).length >= 25000) throw new Error(`${day}: 25,000 rows, the reply is cut`)
        await writeFile(file, gzipSync(text))
        streak = 0
        console.log(`${day} pulled`)
      } catch (err) {
        console.error(err.message)
        if (++streak >= 3) throw new Error(`stop rule: 3 days in a row failed (last ${day}); no table written`)
        continue
      }
      await sleep(1000)
    } else streak = 0
    for (const r of csvObjects(gunzipSync(await readFile(file)).toString('utf8'))) {
      const ball = [num(r.launch_speed), num(r.launch_angle), num(r.estimated_woba_using_speedangle)]
      if (r.description === 'hit_into_play' && ball.every((v) => v != null)) balls.push(ball)
    }
  }
  const missing = days.filter((d) => !existsSync(join(cacheDir, `${d}.csv.gz`)))
  if (missing.length) throw new Error(`${missing.length} days not pulled (${missing.join(', ')}); run again to resume`)
  await writeJsonAtomic(tablePath(season), { season, through: days.at(-1), balls: balls.length, ...fitTable(balls) })
  console.log(`wrote xwoba-table/${season}.json: ${balls.length} balls in play, ${days.length} days through ${days.at(-1)}`)
}

async function gate() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'hitter-grid', String(season))
  const shard = { bat: {} }
  for (const f of readdirSync(dir).filter((n) => /^\d\d\.json$/.test(n))) {
    const file = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    Object.assign(shard.bat, file.bat)
    shard.xwoba = file.xwoba
  }
  const { gaps, missing } = gateRows(await fetchArsenalBoard('batter', { season }), shard)
  const v = gateVerdict(gaps)
  const f = (x) => x?.toFixed(4)
  console.log(`gate ${season}: ${v.n} rows (40+ PA), ${missing} with no grid value; mean gap ${f(v.mean)}, ` +
    `${v.over} above 0.020 (${f(v.over / v.n)}), max ${f(v.max)} -> ${v.pass ? 'PASS' : 'FAIL'}`)
  if (!v.pass) process.exitCode = 1
}
