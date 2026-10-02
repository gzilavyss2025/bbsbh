// Builds the data the innings-console mockup steps through (mockup/template.html).
//
// It runs the APP'S OWN pure modules over real game feeds, so every mark the
// mockup draws is the mark the app would draw: computeHalfInningFeed (with its
// stepCap), Express Lane's expressDeck/runnersOnBase (the runner boxes),
// lineupEntering/defenseEntering (the rails), pitchLadder and the #22 notation
// helpers. atBatMarks lives in a .jsx file Node cannot import, so this script
// copies that one function out of AtBatBox.jsx into a temp module at run time.
//
// Usage (from the repo root):
//   node .scratch/innings-console-redesign/mockup/build-data.mjs [out.json] [gamePk ...]
// Defaults: node_modules/.cache/innings-console/data.json and the six games
// listed in ../README.md. Then run build-page.mjs to make the HTML.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { cachedGetJson } from '../../../scripts/lib/statsapi.mjs'
import { computeHalfInningFeed } from '../../../src/api/playbyplay/halfInningFeed.js'
import { expressDeck, runnersOnBase } from '../../../src/api/expresslane/runners.js'
import { lineupEntering } from '../../../src/api/battingorder.js'
import { defenseEntering } from '../../../src/api/defense.js'
import { pitchLadder } from '../../../src/api/playbyplay/pitchInfo.js'
import { classifyOut, scorecardCenterCode } from '../../../src/api/scorecard/notation.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const boxSrc = fs.readFileSync(path.join(ROOT, 'src/components/scoring/AtBatBox.jsx'), 'utf8')
const marksSrc = boxSrc.slice(boxSrc.indexOf('export function atBatMarks'), boxSrc.indexOf('export function AtBatBox'))
const tmp = path.join(os.tmpdir(), `atbatmarks-${process.pid}.mjs`)
fs.writeFileSync(tmp, marksSrc)
const { atBatMarks } = await import(pathToFileURL(tmp).href)
fs.rmSync(tmp)

const DEFAULT_GAMES = [823035, 823166, 824546, 824624, 824951, 823169]
const args = process.argv.slice(2)
const OUT = args[0] && args[0].endsWith('.json') ? args.shift() : path.join(ROOT, 'node_modules/.cache/innings-console/data.json')
const pks = args.length ? args.map(Number) : DEFAULT_GAMES
const MID_CODE = { stolen_base: 'SB', caught_stealing: 'CS', pickoff: 'PK', pickoff_caught_stealing: 'PKCS', balk: 'BK', wild_pitch: 'WP', passed_ball: 'PB', defensive_indiff: 'DI', other_advance: 'ADV', error: 'E', pickoff_error: 'E', stolen_base_error: 'E' }
const midCode = (et) => { const k = (et || '').replace(/_(1b|2b|3b|home)$/, ''); return MID_CODE[k] ?? k.toUpperCase() }
const games = [], imgIds = new Set()
for (const pk of pks) {
  const feed = await cachedGetJson(`/api/v1.1/game/${pk}/feed/live`)
  const gd = feed.gameData, ld = feed.liveData
  const slotOf = {}
  for (const side of ['away', 'home']) for (const p of Object.values(ld.boxscore.teams[side].players)) if (p.battingOrder) slotOf[p.person.id] = Math.floor(+p.battingOrder / 100)
  const playByAbi = new Map(ld.plays.allPlays.map(p => [p.about.atBatIndex, p]))
  const descByAbi = new Map(ld.plays.allPlays.map(p => [p.about.atBatIndex, p.result?.description ?? '']))
  const boxOf = (card) => {
    if (!card) return null
    const c = { ...card, outType: card.codeKind === 'out' ? classifyOut(card.eventType, descByAbi.get(card.atBatIndex)) : '', centerCode: scorecardCenterCode(card.code), ladder: pitchLadder(card.pitches ?? []) }
    const m = atBatMarks(c)
    const pr = card.pinchRunners?.length ? card.pinchRunners[card.pinchRunners.length - 1] : null
    return { ...m, reached: c.reached ?? 0, scored: !!c.scored, earned: c.earned ?? true, legNotations: c.legNotations ?? {}, outAt: c.outAt ?? null, outCode: c.outCode ?? '', outNumber: c.outNumber ?? null, ladder: c.ladder, prBase: pr?.base ?? null, prJersey: pr?.jersey ?? null, placedAt: card.kind === 'placed' ? card.base : null }
  }
  const who = (card) => { const b = card.kind === 'placed' ? card.runner : card.batter; const id = card.kind === 'placed' ? card.runnerId : card.batterId; imgIds.add(id); return { id, last: b?.last, slot: slotOf[id] ?? null, pos: b?.pos, jersey: b?.jersey } }
  const halves = []
  let away = 0, home = 0
  const pitchCount = {}
  const innings = ld.linescore.innings
  for (let inn = 1; inn <= innings.length; inn++) for (const half of ['top', 'bottom']) {
    const side = half === 'top' ? 'away' : 'home', fld = half === 'top' ? 'home' : 'away'
    if (!ld.plays.allPlays.some(p => p.about.inning === inn && p.about.halfInning === half)) continue
    const entries = computeHalfInningFeed(feed, inn, half, side)
    const li = innings[inn - 1]
    const H = { inning: inn, half, startAway: away, startHome: home,
      line: { r: li[side].runs ?? 0, h: li[side].hits ?? 0, e: li[fld].errors ?? 0, lob: li[side].leftOnBase ?? 0 },
      lineup: (lineupEntering(feed, side, inn, half) || []).map(s => ({ slot: s.slot, entries: s.entries.map(e => ({ last: e.last, pos: e.position, jersey: e.jersey, inning: e.inning, replaced: e.replaced })) })),
      lineupOpp: (lineupEntering(feed, fld, inn, half) || []).map(s => ({ slot: s.slot, entries: s.entries.map(e => ({ last: e.last, pos: e.position, jersey: e.jersey, inning: e.inning, replaced: e.replaced })) })),
      defense: (defenseEntering(feed, fld, inn, half) || []).map(p => ({ pos: p.position, entries: p.entries.map(e => ({ last: e.last, inning: e.inning, replaced: e.replaced })) })),
      steps: [] }
    let prevAtbatIdx = -1
    const atIdx = entries.map((e, i) => (e.kind === 'atbat' ? i : -1)).filter(i => i >= 0)
    for (const i of atIdx) {
      const card = entries[i]
      const between = entries.slice(prevAtbatIdx + 1, i)
      const pre = between.filter(e => e.kind === 'event' && !e.midAtBat && e.eventType !== 'game_advisory').map(e => ({ eventType: e.eventType, text: e.text || (e.segments || []).map(s => s.text).join(''), playerId: e.playerId ?? e.pinchId ?? null, position: e.position ?? null }))
      pre.forEach(p => p.playerId && imgIds.add(p.playerId))
      // sealed state: cap through the last pre-pitch entry before this PA
      let capSealed = prevAtbatIdx + 1
      while (capSealed < i && (entries[capSealed].kind === 'placed' || (entries[capSealed].kind === 'event' && !entries[capSealed].midAtBat))) capSealed++
      const sealedEntries = capSealed > 0 ? computeHalfInningFeed(feed, inn, half, side, capSealed).slice(0, capSealed) : []
      const sealedRunners = runnersOnBase(sealedEntries).map(r => ({ base: r.base, who: who(r.card), box: boxOf(r.card) }))
      // revealed state, via Express Lane's deck
      const deck = expressDeck(feed, inn, half, { atBatIndex: card.atBatIndex, isTerminal: true })
      const play = playByAbi.get(card.atBatIndex)
      // mid-PA runner events from the raw play, with pitch position
      const pBefore = []; let pc = 0
      play.playEvents.forEach((ev, k) => { pBefore[k] = pc; if (ev.isPitch) pc++ })
      const lastIdx = play.playEvents.length - 1
      const byIdx = new Map()
      for (const r of play.runners || []) {
        const k = r.details.playIndex
        const batterEvent = k === lastIdx && r.details.eventType === play.result.eventType
        if (batterEvent || r.details.runner.id === card.batterId) continue
        const ev = play.playEvents[k]
        if (!byIdx.has(k)) byIdx.set(k, { onPitch: !!ev?.isPitch, n: pBefore[k] + (ev?.isPitch ? 1 : 0), pickoff: /^pickoff/.test(r.details.eventType || ''), text: ev?.details?.description || r.details.event, moves: [] })
        const cr = r.credits || []
        const chain = [...cr.filter(c => c.credit === 'f_assist'), ...cr.filter(c => c.credit === 'f_putout')].map(c => c.position?.code).join('-')
        const err = cr.find(c => /error/.test(c.credit))
        let code = midCode(r.details.eventType)
        if (code === 'E' && err) code = 'E' + err.position.code
        const rv = ev?.reviewDetails && !['MJ', 'MZ'].includes(ev.reviewDetails.reviewType) ? ev.reviewDetails : null
        if (rv) byIdx.get(k).review = { by: rv.challengeTeamId == null ? 'crew' : rv.challengeTeamId === gd.teams.away.id ? 'away' : 'home', overturned: !!rv.isOverturned, what: ((ev.details?.description || '').match(/\(([^)]+)\)/) || [])[1] || '' }
        byIdx.get(k).moves.push({ last: gd.players['ID' + r.details.runner.id]?.lastName, slot: slotOf[r.details.runner.id] ?? null, from: r.movement.start, to: r.movement.end, out: !!r.movement.isOut, outBase: r.movement.outBase, code: r.movement.isOut ? `${code} ${chain}`.trim() : code })
      }
      const mid = [...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
      // track: ladder + pitch detail
      const ladder = pitchLadder(card.pitches ?? [])
      let b = 0, s = 0
      const track = (card.pitchDetails ?? []).map((p, k) => {
        const cat = p.cat
        if (cat === 'ball') b = Math.min(4, b + 1); else if (cat === 'called' || cat === 'whiff') s = Math.min(3, s + 1); else if (cat === 'foul' && s < 2) s += 1
        const ch = p.challenge ? { side: p.challenge.side, outcome: p.challenge.outcome, who: (p.challenge.playerName || '').split(' ').slice(-1)[0] } : null
        const r2 = (x) => typeof x === 'number' ? Math.round(x * 100) / 100 : null
        return { label: ladder[k]?.label ?? String(k + 1), side: ladder[k]?.side ?? (cat === 'ball' ? 'ball' : 'strike'), cat, b, s, mph: p.mph, type: p.type, desc: p.callDesc, px: r2(p.px), pz: r2(p.pz), top: r2(p.szTop), bot: r2(p.szBottom), ch }
      })
      const pid = card.pitcher?.id
      pitchCount[pid] = (pitchCount[pid] || 0)
      const pcBefore = pitchCount[pid]
      pitchCount[pid] += track.length
      imgIds.add(pid)
      const runs = (play.runners || []).filter(r => r.movement.end === 'score' && !r.movement.isOut).length
      if (half === 'top') away += runs; else home += runs
      const after = runnersOnBase(deck.entries).map(r => r.base)
      const bat = who(card)
      H.steps.push({
        atBatIndex: card.atBatIndex, batter: { ...bat, bats: card.batSide }, pitcher: { id: pid, last: card.pitcher?.last, jersey: card.pitcher?.jersey, hand: card.pitcher?.hand, pcBefore, pcAfter: pitchCount[pid] },
        pre, sealedRunners,
        box: boxOf(deck.batter ?? card), code: card.code, codeKind: card.codeKind,
        runners: deck.runners.map(r => ({ base: r.base, who: who(r.card), box: boxOf(r.card) })),
        departed: deck.departed.map(d => ({ from: d.from, fate: d.fate, who: who(d.card), box: boxOf(d.card) })),
        mid, track, desc: play.result.description, event: play.result.event,
        hit: card.battedBall ? { ev: card.battedBall.exitVelo, la: card.battedBall.launchAngle, dist: card.battedBall.distance, traj: card.battedBall.trajectory } : null,
        outs: play.count.outs, bases: [1, 2, 3].map(x => play.count.outs < 3 && after.includes(x)), away, home, rbi: play.result.rbi ?? 0,
        endsHalf: play.count.outs >= 3,
        eventType: card.eventType, outsBefore: (() => { const prev = H.steps[H.steps.length - 1]; return prev ? prev.outs : 0 })(),
        scorers: (play.runners || []).filter(r => r.movement.end === 'score' && !r.movement.isOut).map(r => ({ rid: r.details.runner.id, pid: r.details.responsiblePitcher?.id ?? pid, earned: !!r.details.earned })),
        review: (() => { const rv = play.reviewDetails; if (!rv || ['MJ', 'MZ'].includes(rv.reviewType)) return null; const m = (play.result.description || '').match(/^(.*?(?:challenged|reviewed)) \(([^)]+)\), call on the field was (\w+)/); return { by: rv.challengeTeamId == null ? 'crew' : rv.challengeTeamId === gd.teams.away.id ? 'away' : 'home', overturned: !!rv.isOverturned, what: m ? m[2] : '', verdict: m ? m[3] : (rv.isOverturned ? 'overturned' : 'upheld') } })(),
      })
      prevAtbatIdx = i
    }
    halves.push(H)
  }
  const t = gd.teams
  games.push({ pk: +pk, date: gd.datetime.officialDate, venue: gd.venue.name, gameNumber: gd.game.gameNumber, doubleHeader: gd.game.doubleHeader,
    away: { id: t.away.id, abbr: t.away.abbreviation, name: t.away.teamName }, home: { id: t.home.id, abbr: t.home.abbreviation, name: t.home.teamName }, halves })
}
const img = {}
await Promise.all([...imgIds].map(async (id) => {
  const r = await fetch(`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_80,q_auto:good,f_jpg/v1/people/${id}/headshot/67/current`)
  if (r.ok) img[id] = 'data:image/jpeg;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64')
}))
const logo = {}
for (const g of games) for (const t of [g.away, g.home]) if (!logo[t.id]) {
  const r = await fetch(`https://www.mlbstatic.com/team-logos/team-cap-on-dark/${t.id}.svg`)
  if (r.ok) logo[t.id] = 'data:image/svg+xml;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64')
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ games, img, logo }))
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${games.length} games)`)
