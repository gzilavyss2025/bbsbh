// Round 2 data: the checkpoint pages, the half's at-bats and the lineups for gamePk 824716, read
// through the repo's own engine (checkpointPages, computeHalfInningFeed). Design data, not app code.
// node extract2.mjs <feed.json> <out.js>   (the feed is /api/v1.1/game/824716/feed/live, saved to disk)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src')
const load = (p) => import(pathToFileURL(path.join(SRC, p)).href)
const { checkpointPages } = await load('api/gameday/checkpoint.js')
const { computeHalfInningFeed } = await load('api/playbyplay/halfInningFeed.js')
const { halfIndex } = await load('api/select.js')
const { pitchCallCode, FOUL_CODES } = await load('api/playbyplay.js')

const [feedFile, out] = process.argv.slice(2)
const feed = JSON.parse(fs.readFileSync(feedFile, 'utf8'))
const side = (half) => (half === 'top' ? 'away' : 'home')

// Each pitcher's game pitch count after each at-bat (by atBatIndex), walking every play's pitches.
const pcAfter = {}
{
  const n = {}
  for (const play of feed.liveData.plays.allPlays) {
    let id = play.matchup.pitcher.id
    for (const e of play.playEvents) {
      if (e.details?.eventType === 'pitching_substitution' && e.player?.id) id = e.player.id
      if (e.isPitch) n[id] = (n[id] ?? 0) + 1
    }
    pcAfter[play.about.atBatIndex] = n[play.matchup.pitcher.id] ?? 0
  }
}

// Fouls per pitcher in one half (Gary, round 2: page 2 needs fouls). checkpoint.js's page 2 has no fouls
// field yet, so this walks the half the way it does (the pitcher on the mound per pitch) and counts
// FOUL_CODES, the same set derive.js's tally counts. A build adds this to the page model (#2605).
function foulsByPitcher(inning, half) {
  const target = halfIndex(inning, half), out = {}, onMound = {}
  for (const play of feed.liveData.plays.allPlays) {
    const i = halfIndex(play.about.inning, play.about.halfInning)
    if (i > target) break
    const s = play.about.halfInning === 'top' ? 'home' : 'away', fin = play.matchup.pitcher.id
    let cur = onMound[s] ?? null
    for (const e of play.playEvents) {
      if (e.details?.eventType === 'pitching_substitution' && e.player?.id != null) { cur = e.player.id; continue }
      if (!e.isPitch || i !== target) continue
      const id = cur ?? fin
      if (FOUL_CODES.has(pitchCallCode(e))) out[id] = (out[id] ?? 0) + 1
      else out[id] ??= 0
    }
    onMound[s] = fin
  }
  return out
}
function withFouls(pages, inning, half) {
  const f = foulsByPitcher(inning, half), pg = pages.find((p) => p.id === 'pitching').fields
  for (const l of pg.pitchers) l.fouls = f[l.id] ?? 0
  pg.fouls = pg.pitchers.reduce((n, l) => n + l.fouls, 0)
  return pages
}

// One row per card, as a scorer copies it: the code, the RBI, the out number, the pitches.
function rows(inning, half) {
  return computeHalfInningFeed(feed, inning, half, side(half)).map((c) => (c.kind === 'atbat'
    ? { kind: 'ab', ab: c.atBatIndex, num: c.batter.jersey, first: c.batter.first, last: c.batter.last, pos: c.batter.pos,
        code: c.code, rbi: c.rbi, out: c.outNumber, scored: c.scored, pitches: c.pitches, bases: c.basesAfter,
        line: c.descSegments.map((s) => s.text).join(''), pitcher: c.pitcher.last, bat: c.batSide, pc: pcAfter[c.atBatIndex] }
    : { kind: 'event', type: c.eventType, text: c.text }))
}

// The line score, inning by inning, from the feed's own linescore.
const innings = feed.liveData.linescore.innings.map((i) => ({ n: i.num, away: i.away, home: i.home }))
// The score and R/H/E through a half index, clamped there (the checkpoint's "game so far").
function soFar(through) {
  const t = { away: { r: 0, h: 0, e: 0 }, home: { r: 0, h: 0, e: 0 } }
  for (const i of innings) for (const s of ['away', 'home']) {
    if (halfIndex(i.n, s === 'away' ? 'top' : 'bottom') > through) continue
    t[s].r += i[s].runs ?? 0; t[s].h += i[s].hits ?? 0
  }
  // E belongs to the side in the field: an error in the top half is the home side's.
  for (const i of innings) for (const s of ['away', 'home']) {
    if (halfIndex(i.n, s === 'away' ? 'bottom' : 'top') > through) continue
    t[s].e += i[s].errors ?? 0
  }
  return t
}

// The starting nine of each side (battingOrder ending in 00): nobody was replaced before the 3rd.
function starters(s) {
  const t = feed.liveData.boxscore.teams[s]
  return Object.values(t.players).filter((p) => p.battingOrder && p.battingOrder.endsWith('00'))
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((p) => ({ slot: +p.battingOrder / 100, num: p.jerseyNumber, name: p.person.fullName, pos: p.position.abbreviation, id: p.person.id }))
}

// The batting order as the box score ends it (the end-of-game checkpoint's lineup panel).
function finalOrder(s) {
  const t = feed.liveData.boxscore.teams[s]
  return t.battingOrder.map((id) => t.players['ID' + id]).map((p) => ({ slot: Math.floor(+p.battingOrder / 100), num: p.jerseyNumber, name: p.person.fullName, pos: p.position.abbreviation, id: p.person.id }))
}

const data = {
  game: { pk: feed.gamePk, date: feed.gameData.datetime.officialDate, away: 'SEA', home: 'BOS', venue: feed.gameData.venue.name },
  innings,
  lineups: { away: starters('away'), home: starters('home') },
  lineupsFinal: { away: finalOrder('away'), home: finalOrder('home') },
  halves: {
    top2: { inning: 2, half: 'top', idx: halfIndex(2, 'top'), rows: rows(2, 'top'),
      pages: withFouls(checkpointPages(feed, { inning: 2, half: 'top', revealedThrough: halfIndex(2, 'top') }), 2, 'top'), soFar: soFar(halfIndex(2, 'top')) },
    // Drop 2: the bottom 6th (Duran's at-bat with the wild pitch), rows only.
    bot6: { inning: 6, half: 'bottom', idx: halfIndex(6, 'bottom'), rows: rows(6, 'bottom') },
    bot9: { inning: 9, half: 'bottom', idx: halfIndex(9, 'bottom'), rows: rows(9, 'bottom'),
      pages: withFouls(checkpointPages(feed, { inning: 9, half: 'bottom', revealedThrough: halfIndex(9, 'bottom') }), 9, 'bottom'), soFar: soFar(halfIndex(9, 'bottom')) },
  },
}
fs.writeFileSync(out, '// Real data for round 2, made by tools/extract2.mjs from gamePk 824716. Checked against the feed.\nwindow.GD_R2 = ' + JSON.stringify(data) + '\n')
console.log('wrote', out, JSON.stringify(data.halves.top2.soFar), JSON.stringify(data.halves.bot9.soFar))
