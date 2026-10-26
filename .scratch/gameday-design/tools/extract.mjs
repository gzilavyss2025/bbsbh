// Pull the top 2nd (and AB 45) of gamePk 824716 through the repo's engine, for prototype/data.js.
// node extract.mjs <feed.json> <out.json> [atBatIndexes, comma-separated]  (feed: the game's /api/v1.1/game/{gamePk}/feed/live, saved to a file)
import fs from 'node:fs'
const R = new URL('../../../src/lib', import.meta.url).href
const { realFlight } = await import(R + '/pitch/pitchFlight.js')
const { fitLift } = await import(R + '/ballpark/flightModel.js')
const { hitCoordToSvg } = await import(R + '/ballpark/hitProjection.js')
const { ballBearing, wallOnLine } = await import(R + '/ballpark/ballFlight.js')
const { resolveBallparkLayout } = await import(R + '/ballpark/layout/resolveLayout.js')
const { wallDistanceAt } = await import(R + '/ballpark/ballparkGeometry.js')

const g = JSON.parse(fs.readFileSync(process.argv[2]))
const gd = g.gameData
const layout = resolveBallparkLayout({ venueId: gd.venue.id, venueName: gd.venue.name, gameDate: gd.datetime.officialDate })
const r2 = (v) => Math.round(v * 100) / 100
const out = { gamePk: gd.game.pk, date: gd.datetime.officialDate, venue: gd.venue.name,
  away: { id: gd.teams.away.id, abbr: gd.teams.away.abbreviation, name: gd.teams.away.teamName },
  home: { id: gd.teams.home.id, abbr: gd.teams.home.abbreviation, name: gd.teams.home.teamName },
  wall: [], plays: [] }
for (let d = -45; d <= 45; d += 5) { const w = wallOnLine(layout, d); out.wall.push([d, w?.ft ?? wallDistanceAt(layout, d), w?.height ?? null]) }
const want = new Set(process.argv[4] ? process.argv[4].split(',').map(Number) : [7, 8, 9, 10, 11, 12, 13, 14, 15, 45])
for (const p of g.liveData.plays.allPlays) {
  if (!want.has(p.atBatIndex)) continue
  const pitches = []
  for (const e of p.playEvents) {
    if (!e.isPitch) { pitches.push({ event: e.details?.description }); continue }
    const c = e.pitchData?.coordinates ?? {}
    const ext = e.pitchData?.extension
    const f = realFlight({ vx0: c.vX0, vy0: c.vY0, vz0: c.vZ0, ax: c.aX, ay: c.aY, az: c.aZ, px: c.pX, pz: c.pZ, release: [c.x0, 60.5 - (ext ?? 6.3), c.z0] })
    pitches.push({
      n: e.pitchNumber, type: e.details?.type?.code, typeName: e.details?.type?.description, call: e.details?.call?.description,
      code: e.details?.code, mph: e.pitchData?.startSpeed, b: e.count?.balls, s: e.count?.strikes,
      px: c.pX, pz: c.pZ, szTop: e.pitchData?.strikeZoneTop, szBot: e.pitchData?.strikeZoneBottom,
      plateTime: e.pitchData?.plateTime, ext,
      T: f ? r2(f.T * 1000) / 1000 : null,
      path: f ? Array.from({ length: 25 }, (_, i) => f.at(i / 24).map(r2)) : null,
      hit: e.hitData ?? null,
    })
  }
  const last = p.playEvents.findLast((e) => e.hitData)
  let ball = null
  if (last?.hitData) {
    const h = last.hitData
    const land = hitCoordToSvg(h.coordinates?.coordX, h.coordinates?.coordY)
    const deg = land ? ballBearing(land) : null
    let fl = null
    if (h.launchSpeed && h.launchAngle != null && h.totalDistance) {
      const { lift, flight } = fitLift(h.launchSpeed, h.launchAngle, h.totalDistance)
      const step = Math.max(1, Math.round(flight.pts.length / 60))
      fl = { lift: r2(lift), T: r2(flight.T), dist: Math.round(flight.dist), pts: flight.pts.filter((_, i) => i % step === 0).map(([x, z, t]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10, r2(t)]) }
    }
    ball = { ev: h.launchSpeed, la: h.launchAngle, dist: h.totalDistance, traj: h.trajectory, loc: h.location, hardness: h.hardness,
      coord: h.coordinates, bearing: deg == null ? null : r2(deg), wall: deg == null ? null : wallOnLine(layout, deg), flight: fl }
  }
  out.plays.push({
    ab: p.atBatIndex, half: p.about.halfInning, inning: p.about.inning,
    batter: { id: p.matchup.batter.id, name: p.matchup.batter.fullName, side: p.matchup.batSide.code },
    pitcher: { id: p.matchup.pitcher.id, name: p.matchup.pitcher.fullName, hand: p.matchup.pitchHand.code },
    event: p.result.event, eventType: p.result.eventType, desc: p.result.description, rbi: p.result.rbi,
    awayScore: p.result.awayScore, homeScore: p.result.homeScore, outs: p.count.outs,
    runners: p.runners.map((r) => ({ id: r.details.runner.id, name: r.details.runner.fullName, start: r.movement.originBase, end: r.movement.end, out: r.movement.isOut, scored: r.details.isScoringEvent })),
    credits: (p.runners.find((r) => r.details.runner.id === p.matchup.batter.id)?.credits ?? []).map((c) => [c.position?.abbreviation, c.credit]),
    pitches, ball,
  })
}
const ls = g.liveData.linescore
out.linescore = ls.innings.map((i) => ({ n: i.num, away: i.away, home: i.home }))
fs.writeFileSync(process.argv[3], JSON.stringify(out))
console.log('plays', out.plays.length, 'bytes', JSON.stringify(out).length)
for (const p of out.plays) console.log(p.ab, p.half, p.inning, p.event, p.batter.name, p.batter.side, 'P', p.pitches.filter(x=>x.n).length, 'T', p.pitches.filter(x=>x.n).map(x=>x.T+'/'+x.plateTime).join(' '), '|', p.ball && [p.ball.ev, p.ball.la, p.ball.dist, p.ball.bearing, JSON.stringify(p.ball.wall), p.ball.flight?.T].join(' '))
console.log('wall', JSON.stringify(out.wall))
