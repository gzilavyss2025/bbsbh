// Regenerates public/data/war.json — current-season WAR per player, keyed by
// MLB Stats API personId, plus a parallel `pa` map (hitter plate appearances,
// same keys) so a consumer can re-apply the PA regression. Pulled from
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

async function fetchLeaderboard(stats) {
  const url =
    `https://www.fangraphs.com/api/leaders/major-league/data` +
    `?age=&pos=all&stats=${stats}&lg=all&season=${season}&season1=${season}` +
    `&startdate=&enddate=&qual=0&type=8&pageitems=3000&pagenum=1`
  const res = await fetch(url, { headers: { Origin: 'https://bbsbh.vercel.app' } })
  if (!res.ok) throw new Error(`FanGraphs ${stats} leaderboard: HTTP ${res.status}`)
  const json = await res.json()
  const war = {}
  const pa = {}
  for (const row of json.data ?? []) {
    const id = row.xMLBAMID
    const w = Number(row.WAR)
    if (id && Number.isFinite(w)) war[id] = Math.round(w * 10) / 10
    // Plate appearances travel alongside WAR so a downstream consumer can apply
    // the same PA regression the nightly lineup-values build uses (the Lineup
    // Strength grade's runtime fallback for a just-traded starter absent from
    // that file — src/api/lineupStrength.js rpgFromWar). Batters only; a
    // pitcher's rate denominator is IP, which this metric never needs.
    const p = Number(row.PA)
    if (id && Number.isFinite(p)) pa[id] = p
  }
  return { war, pa }
}

const [batLb, pitLb] = await Promise.all([fetchLeaderboard('bat'), fetchLeaderboard('pit')])
const bat = batLb.war
const pit = pitLb.war
const pa = batLb.pa // hitter PA only (see fetchLeaderboard note)

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ season, generatedAt: new Date().toISOString(), bat, pit, pa }))
console.log(
  `wrote ${out} (${Object.keys(bat).length} batters, ${Object.keys(pit).length} pitchers, ${Object.keys(pa).length} PA)`,
)
