// Regenerates public/data/war.json — current-season WAR per player, keyed by
// MLB Stats API personId, plus parallel `wrc` (wRC+, offense only) and `fld`
// (season fielding runs) maps on the same keys. The last two feed the Lineup
// Strength value model, which needs a bat and a glove SEPARATELY rather than
// the WAR total that bundles them.
//
// The `pa` (hitter plate appearances) map this file used to carry is GONE:
// it rode along on the FanGraphs VALUE view, and `stats=sabermetrics`
// publishes no plate-appearance field. Nothing read it — it was kept for a
// Lineup Strength runtime fallback that was removed with the grade itself
// (`.scratch/lineup-strength/README.md`, whose model.md §1 asked that these
// maps not be pruned casually). If that model ever comes back, PA is a plain
// `stats=season&group=hitting` pull away; it is not unobtainable, just not
// free on this request the way it was on the old one.
//
// Pulled from statsapi.mlb.com's own `stats=sabermetrics` stat type — an
// undocumented but public, first-party endpoint (verified 2026-08-25) that
// carries MLB Advanced Media's OWN sabermetrics calculation: `war`, `wRcPlus`,
// `fielding`, `baseRunning`, `positional`, `replacement`, and (pitching) a
// FIP-based `war` alongside a separate RA9-based `ra9War`. It is NOT a mirror
// of FanGraphs' fWAR or Baseball-Reference's bWAR — it's MLB's own number,
// same methodology family (identical component names — wOBA-derived linear
// weights, the standard Tango/wRAA/UBR framework both sites also use), but not
// numerically identical to either. A live full-league diff against the prior
// FanGraphs-scraped file (2026 season, 711 batters + 821 pitchers matched)
// found correlation 0.998 and mean absolute difference ~0.04 WAR both ways —
// close enough that the two numbers move together, not close enough to call
// this "fWAR". Label it "WAR (MLB calc)" in the UI, never "FanGraphs" or
// "fWAR" — see docs/api/static-data.md.
//
// This replaces the earlier FanGraphs leaderboard scrape: same statsapi.mlb.com
// domain the rest of the app already depends on (no separate CORS-open
// third-party endpoint to go stale), and it needs `playerPool=ALL` — the
// default pool is "QUALIFIED" only (~140 players), which silently drops
// everyone below a playing-time minimum.
//
// COVERAGE, measured rather than assumed: even at `playerPool=ALL` this
// source returns no row for roughly 13% of the player-seasons the FanGraphs
// pull carried (counted across 4 of the 100 war-history shards, 2010-2025).
// Every single one of those was FanGraphs WAR EXACTLY 0.0 — a September
// cameo, a position player mopping up an inning. No non-zero value is lost
// anywhere, and the values that do match track to |delta| <= 0.1. What this
// costs is a register cell reading "—" instead of "0.0" for those seasons,
// which is the honest rendering of a number this source does not publish.
// Note the shape of that check: a matched-set correlation CANNOT see a
// dropped row, so re-measure by diffing shards player-season by
// player-season, split by value, if this source is ever swapped again.
//
// This runs nightly via .github/workflows/update-nightly-data.yml, NOT at request
// time: the live app only ever fetches this small same-origin static file
// (src/api/war.js), never statsapi.mlb.com's whole-league leaderboard directly.
// Run by hand: node scripts/gen-war.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'war.json')
const season = new Date().getFullYear()

async function fetchSabermetrics(group) {
  const url =
    `https://statsapi.mlb.com/api/v1/stats?stats=sabermetrics&group=${group}` +
    `&season=${season}&sportId=1&limit=3000&playerPool=ALL`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`statsapi sabermetrics ${group} leaderboard: HTTP ${res.status}`)
  const json = await res.json()
  return json.stats?.[0]?.splits ?? []
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const bat = {}
const wrc = {}
const fld = {}
for (const split of await fetchSabermetrics('hitting')) {
  const id = split.player?.id
  if (!id) continue
  const w = num(split.stat?.war)
  if (w != null) bat[id] = Math.round(w * 10) / 10
  const r = num(split.stat?.wRcPlus)
  if (r != null) wrc[id] = Math.round(r * 10) / 10
  const f = num(split.stat?.fielding)
  if (f != null) fld[id] = Math.round(f * 10) / 10
}

// Pitcher WAR uses the FIP-based `war` field, not the RA9-based `ra9War` —
// matches the philosophy (and, per the header comment above, closely matches
// the numbers) of the FanGraphs fWAR this replaced.
const pit = {}
for (const split of await fetchSabermetrics('pitching')) {
  const id = split.player?.id
  if (!id) continue
  const w = num(split.stat?.war)
  if (w != null) pit[id] = Math.round(w * 10) / 10
}

await writeJsonAtomic(out, { season, generatedAt: new Date().toISOString(), bat, pit, wrc, fld })
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers, ` +
    `${Object.keys(wrc).length} wRC+, ${Object.keys(fld).length} Fld)`,
)
