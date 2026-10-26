// Draws the tier-B check for #2603: on a tier-A game, each ball's MEASURED arc
// (its real exit velocity and angle) beside the ASSUMED arc tier B would draw
// from its trajectory class alone, plus ESPN's Bézier arc for comparison. Side
// view: ground distance across, height up, the hang time printed per arc.
//
//   node .scratch/gameday-engine/compare-arcs.mjs <feed.json> <out.svg>
//
// Picks the first two ground balls, line drives and fly balls with full data.
import { readFileSync, writeFileSync } from 'node:fs'
import { flightPath, TYPICAL_LAUNCH } from '../../src/lib/gameday/flightPath.js'

const [feedPath, out] = process.argv.slice(2)
const feed = JSON.parse(readFileSync(feedPath, 'utf8'))
const want = { ground_ball: 2, line_drive: 2, fly_ball: 2 }
const balls = []
for (const p of feed.liveData.plays.allPlays) {
  for (const e of p.playEvents ?? []) {
    const h = e.hitData
    if (!h || want[h.trajectory] == null || want[h.trajectory] === 0) continue
    if (typeof h.launchSpeed !== 'number' || typeof h.launchAngle !== 'number' || !h.coordinates) continue
    want[h.trajectory] -= 1
    balls.push({ h, who: p.matchup?.batter?.fullName ?? '', event: p.result?.event ?? '' })
  }
}
// ESPN's way (#2566 research note): a fixed curve per class, no physics.
const BEZIER_RISE = { ground_ball: 0, line_drive: 0.12, fly_ball: 0.35, popup: 1.2 }

const W = 520, H = 200, PAD = 28
const panels = balls.map(({ h, who, event }, i) => {
  const measured = flightPath(h)
  const { launchSpeed, launchAngle, totalDistance, ...stripped } = h
  const assumed = flightPath(stripped)
  const d = measured.distance
  const maxZ = Math.max(...measured.points.map((q) => q.z), ...assumed.points.map((q) => q.z), BEZIER_RISE[h.trajectory] * d * 0.5, 10)
  const sx = (W - 2 * PAD) / Math.max(d, 1)
  const sz = (H - 2 * PAD) / maxZ
  const s = Math.min(sx, sz * 3)
  const X = (g) => PAD + g * sx
  const Z = (z) => H - PAD - z * Math.min(sz, s)
  const line = (path) => path.points.map((q) => `${X(Math.hypot(q.x, q.y)).toFixed(1)},${Z(q.z).toFixed(1)}`).join(' ')
  const rise = BEZIER_RISE[h.trajectory] * d
  const bez = `M ${X(0)} ${Z(3)} Q ${X(d / 2)} ${Z(rise)} ${X(d)} ${Z(0)}`
  const t = TYPICAL_LAUNCH[h.trajectory]
  return `<g transform="translate(0 ${i * (H + 34)})">
  <text x="${PAD}" y="16" class="h">${h.trajectory.replace('_', ' ')} · ${who} · ${event} · ${d.toFixed(0)} ft</text>
  <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" class="g"/>
  <polyline points="${line(measured)}" class="m"/>
  <polyline points="${line(assumed)}" class="a"/>
  <path d="${bez}" class="b"/>
  <text x="${PAD}" y="${H - 8}" class="k"><tspan class="mk">measured</tspan> ${launchSpeed} mph, ${launchAngle}°, T ${measured.T.toFixed(2)} s   <tspan class="ak">assumed (tier B)</tspan> ${t.exitVelo} mph, ${t.launchAngle}°, T ${assumed.T.toFixed(2)} s   <tspan class="bk">Bézier</tspan> no time</text>
</g>`
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${balls.length * (H + 34)}" font-family="Helvetica, Arial, sans-serif">
<style>.h{font-size:13px;font-weight:700;fill:#1f2a44}.k{font-size:10px;fill:#333}.g{stroke:#999}.m{fill:none;stroke:#1f2a44;stroke-width:2.5}.a{fill:none;stroke:#c0392b;stroke-width:2;stroke-dasharray:6 4}.b{fill:none;stroke:#2e8b57;stroke-width:1.5;stroke-dasharray:2 3}.mk{fill:#1f2a44;font-weight:700}.ak{fill:#c0392b;font-weight:700}.bk{fill:#2e8b57;font-weight:700}</style>
<rect width="100%" height="100%" fill="#faf6ec"/>
${panels.join('\n')}
</svg>`
writeFileSync(out, svg)
console.log('wrote', out, balls.length, 'balls')
