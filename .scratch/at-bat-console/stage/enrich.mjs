// Adds what the animated stage needs to the canvas data: the park's real field
// geometry, the batter's side, and each batted ball's landing point and flight
// path, all through the app's own lib/ballpark modules. Mockup only.
// Optional third arg: a folder of Savant files per game: /gf ({gamePk}.json)
// for bat speed and pitch flight time, and the Statcast CSV ({gamePk}.csv)
// for the swing path (tilt, attack angle, swing length). The CSV fills in
// the morning after a game, so a live game has bat speed at most.
// Usage: node .scratch/at-bat-console/stage/enrich.mjs in.json out.json [savantDir]
import fs from 'node:fs'
import { cachedGetJson } from '../../../scripts/lib/statsapi.mjs'
import { ballparkFor } from '../../../src/lib/ballpark/ballparkData.js'
import { buildFieldGeometry, HOME } from '../../../src/lib/ballpark/ballparkGeometry.js'
import { hitCoordToSvg } from '../../../src/lib/ballpark/hitProjection.js'
import { ballFlightPath } from '../../../src/lib/ballpark/ballFlight.js'
import { pitchCardInfo } from '../../../src/api/playbyplay/pitchInfo.js'
import { atBatScenePitches, atBatZone } from '../../../src/lib/pitcherCard/atBat.js'
import { stage, releasePoint } from '../../../src/lib/pitcherCard/scene.js'

const [inPath, outPath, savantDir] = process.argv.slice(2)
const D = JSON.parse(fs.readFileSync(inPath, 'utf8'))
const HITS = new Set(['single', 'double', 'triple', 'home_run'])
for (const g of D.games) {
  const feed = await cachedGetJson(`/api/v1.1/game/${g.pk}/feed/live`)
  const park = ballparkFor(feed.gameData.venue.name) ?? ballparkFor('American Family Field')
  g.field = { home: HOME, ...buildFieldGeometry(park.dist, park.wall, park.arc), park: park.name ?? feed.gameData.venue.name }
  const byAbi = new Map(feed.liveData.plays.allPlays.map((p) => [p.about.atBatIndex, p]))
  // Savant's ab_number is the feed's atBatIndex + 1 (checked by batter name).
  const sv = new Map()
  const svPath = savantDir && `${savantDir}/${g.pk}.json`
  if (svPath && fs.existsSync(svPath)) {
    const gf = JSON.parse(fs.readFileSync(svPath, 'utf8'))
    for (const r of [...gf.team_home, ...gf.team_away]) sv.set(`${r.ab_number - 1}:${r.pitch_number}`, r)
  }
  const csvPath = savantDir && `${savantDir}/${g.pk}.csv`
  const sw = new Map()
  if (csvPath && fs.existsSync(csvPath)) {
    // Quoted-field CSV; Savant quotes any field with a comma in it.
    const rows = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').trim().split('\n').map((l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, '')).slice(0, -1))
    const [head, ...body] = rows
    const col = (k) => head.indexOf(k)
    for (const r of body) {
      const n = (k) => (r[col(k)] === '' ? null : +r[col(k)])
      if (n('swing_path_tilt') == null) continue
      sw.set(`${n('at_bat_number') - 1}:${n('pitch_number')}`, { tilt: n('swing_path_tilt'), attack: n('attack_angle'), len: n('swing_length') })
    }
  }
  for (const h of g.halves) for (const s of h.steps) {
    const play = byAbi.get(s.atBatIndex)
    if (!play) continue
    s.batSide = play.matchup?.batSide?.code ?? 'R'
    // The Now Pitching scene's at-bat replay (PR 1521), through the app's own model.
    const { pitchDetails } = pitchCardInfo(feed, play)
    const zone = atBatZone(pitchDetails)
    const r1 = (v) => Math.round(v * 10) / 10
    s.scene = {
      stage: stage(zone),
      release: releasePoint(play.matchup?.pitchHand?.code === 'L'),
      pitches: atBatScenePitches(pitchDetails).map((p) => ({ no: p.no, family: p.family, name: p.name, mph: p.mph, call: p.call, T: p.T, pts: p.pts.map((q) => q.map(r1)) })),
    }
    s.track.forEach((p, i) => { const r = sv.get(`${s.atBatIndex}:${i + 1}`); if (r) { p.bat = r.batSpeed ?? null; p.flight = r.plateTime ?? null }; const q = sw.get(`${s.atBatIndex}:${i + 1}`); if (q) p.swing = q })
    const ev = play.playEvents.findLast((e) => e.hitData?.coordinates?.coordX != null)
    if (!ev) continue
    const hd = ev.hitData, pt = hitCoordToSvg(hd.coordinates.coordX, hd.coordinates.coordY)
    const { d, grounded } = ballFlightPath(pt, hd.launchAngle, hd.trajectory)
    s.flight = { x: pt.x, y: pt.y, d, grounded, hr: play.result.eventType === 'home_run', hit: HITS.has(play.result.eventType) }
  }
}
fs.writeFileSync(outPath, JSON.stringify(D))
console.log('wrote', outPath)
