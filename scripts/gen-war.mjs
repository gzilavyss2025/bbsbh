// Regenerates public/data/war.json — current-season WAR per player, keyed by
// MLB Stats API personId, plus parallel `pa` (hitter plate appearances), `wrc`
// (wRC+, offense only) and `fld` (season fielding runs) maps on the same keys.
// The last three feed the Lineup Strength value model, which needs a bat and a
// glove SEPARATELY rather than the WAR total that bundles them. Pulled from
// FanGraphs' internal leaderboard API,
// which is undocumented but CORS-open (verified 2026-07-07: returns
// access-control-allow-origin: *) and, conveniently, already tags each row
// with `xMLBAMID` — the SAME id as statsapi's personId, so no name-matching
// is needed to join it against a roster.
//
// This runs nightly via .github/workflows/update-nightly-data.yml, NOT at request
// time: the live app only ever fetches this small same-origin static file
// (src/api/war.js), never FanGraphs directly. That keeps a page load fast
// (this pulls the whole league's leaderboard, ~1MB+ raw JSON, trimmed here to
// a couple hundred KB) and keeps the app from depending on an unofficial
// third-party endpoint's uptime/shape at runtime — if FanGraphs changes
// something, this job fails in CI and the last-known-good file just keeps
// serving, rather than every visitor's team page breaking. See
// docs/data-enrichment.md for the full research trail and reasoning.
// Run by hand: node scripts/gen-war.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'war.json')
const season = new Date().getFullYear()

// `type=6` is FanGraphs' VALUE view. It carries the same `WAR`/`PA` the old
// `type=8` (Dashboard) view did, and additionally breaks WAR into its components
// — `Batting`, `BaseRunning`, `Fielding`, `Positional`, `Replacement` — alongside
// `wRC+`. The Lineup Strength grade needs the components rather than the WAR
// total: WAR bundles a player's bat with his glove AND with a positional
// adjustment that is prorated by his actual playing time, so any attempt to
// reconstruct one component from the total is wrong by however much of the
// season he has played. Same single request either way — see the header note in
// gen-lineup-values.mjs for what that reconstruction cost us.
async function fetchLeaderboard(stats) {
  const url =
    `https://www.fangraphs.com/api/leaders/major-league/data` +
    `?age=&pos=all&stats=${stats}&lg=all&season=${season}&season1=${season}` +
    `&startdate=&enddate=&qual=0&type=6&pageitems=3000&pagenum=1`
  const res = await fetch(url, { headers: { Origin: 'https://bbsbh.vercel.app' } })
  if (!res.ok) throw new Error(`FanGraphs ${stats} leaderboard: HTTP ${res.status}`)
  const json = await res.json()
  const war = {}
  const pa = {}
  const wrc = {}
  const fld = {}
  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  for (const row of json.data ?? []) {
    const id = row.xMLBAMID
    if (!id) continue
    const w = num(row.WAR)
    if (w != null) war[id] = Math.round(w * 10) / 10
    // Plate appearances travel alongside WAR so a downstream consumer can apply
    // the same PA regression the nightly lineup-values build uses (the Lineup
    // Strength grade's runtime fallback for a just-traded starter absent from
    // that file — src/api/lineupStrength.js rpgFromWar). Batters only; a
    // pitcher's rate denominator is IP, which this metric never needs.
    const p = num(row.PA)
    if (p != null) pa[id] = p
    // wRC+ (park- and league-adjusted OFFENSE only, 100 = league average) and
    // Fielding (season fielding runs above average, framing already folded in
    // for catchers — the components sum to WAR, so CFraming is NOT additive on
    // top). Together they replace WAR as the Lineup Strength value input.
    const r = num(row['wRC+'])
    if (r != null) wrc[id] = Math.round(r * 10) / 10
    const f = num(row.Fielding)
    if (f != null) fld[id] = Math.round(f * 10) / 10
  }
  return { war, pa, wrc, fld }
}

const [batLb, pitLb] = await Promise.all([fetchLeaderboard('bat'), fetchLeaderboard('pit')])
const bat = batLb.war
const pit = pitLb.war
const pa = batLb.pa // hitter PA only (see fetchLeaderboard note)
const wrc = batLb.wrc
const fld = batLb.fld

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ season, generatedAt: new Date().toISOString(), bat, pit, pa, wrc, fld }),
)
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers, ` +
    `${Object.keys(pa).length} PA, ${Object.keys(wrc).length} wRC+, ${Object.keys(fld).length} Fld)`,
)
