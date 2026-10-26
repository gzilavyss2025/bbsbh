// realFlight's flight time against the feed's plateTime for every pitch of one game, release at 60.5 - extension.
// node release-check.mjs <feed.json>
import fs from 'node:fs'
const { realFlight } = await import(new URL('../../../src/lib/pitch/pitchFlight.js', import.meta.url).href)
const g = JSON.parse(fs.readFileSync(process.argv[2]))
const d = [], noExt = []
for (const p of g.liveData.plays.allPlays) for (const e of p.playEvents) {
  if (!e.isPitch) continue
  const c = e.pitchData?.coordinates ?? {}, ext = e.pitchData?.extension, pt = e.pitchData?.plateTime
  if (ext == null) { noExt.push(1); continue }
  const f = realFlight({ vx0: c.vX0, vy0: c.vY0, vz0: c.vZ0, ax: c.aX, ay: c.aY, az: c.aZ, px: c.pX, pz: c.pZ, release: [c.x0, 60.5 - ext, c.z0] })
  if (f && pt) d.push(f.T - pt)
}
d.sort((a, b) => a - b)
const q = (p) => d[Math.floor(p * (d.length - 1))]
console.log(JSON.stringify({ n: d.length, noExt: noExt.length, p10: q(0.1).toFixed(4), median: q(0.5).toFixed(4), p90: q(0.9).toFixed(4), maxAbs: Math.max(...d.map(Math.abs)).toFixed(4) }))
