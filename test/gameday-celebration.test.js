import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { celebrationForPlay } from '../src/screens/gameday/next/cutscene/integration/celebrationForPlay.js'
import { GamedayStage } from '../src/screens/gameday/next/stage/GamedayStage.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'

const F = JSON.parse(readFileSync(new URL('./fixtures/game-824716.gameday.json', import.meta.url)))
const plays = F.liveData.plays.allPlays
const hr = plays.find((p) => p.result.eventType === 'home_run')
const k = plays.find((p) => p.result.eventType === 'strikeout')
const clone = (p) => structuredClone(p)

test('home runs identify the revealed batter and batting club; strikeouts use the pitcher and defense', () => {
  assert.deepEqual(celebrationForPlay(hr, F.gameData), { scene: 'homeRun', name: 'Dominic Canzone', teamId: 136 })
  assert.deepEqual(celebrationForPlay(k, F.gameData), { scene: 'strikeout', name: 'Bryan Woo', teamId: 136 })
  const slam = clone(hr); slam.result.rbi = 4
  assert.equal(celebrationForPlay(slam, F.gameData).scene, 'grandSlam')
})

test('partial results, dropped-third-strike reaches and runs scored on strikeouts do not celebrate', () => {
  const unfinished = { about: { isComplete: false }, result: new Proxy({}, { get: () => { throw Error('read incomplete result') } }) }
  assert.equal(celebrationForPlay(unfinished, F.gameData), null)
  const reach = clone(k); reach.result.isOut = false
  assert.equal(celebrationForPlay(reach, F.gameData), null)
  const score = clone(k); score.runners.push({ movement: { end: 'score', isOut: false } })
  assert.equal(celebrationForPlay(score, F.gameData), null)
  assert.equal(celebrationForPlay(null, F.gameData), null)
})

test('defense needs a hard-hit air out and a credited outfielder, not an ordinary grounder or missing identity', () => {
  const p = clone(plays[0])
  assert.equal(celebrationForPlay(p, F.gameData), null)
  p.playEvents.at(-1).hitData = { trajectory: 'line_drive', launchSpeed: 110 }
  p.runners[0].credits = [{ player: { id: 701350 }, position: { abbreviation: 'LF' }, credit: 'f_putout' }]
  assert.deepEqual(celebrationForPlay(p, F.gameData), { scene: 'catch', name: 'Roman Anthony', teamId: 111 })
  p.playEvents.at(-1).hitData.launchSpeed = 109.9
  assert.equal(celebrationForPlay(p, F.gameData), null)
  p.playEvents.at(-1).hitData.launchSpeed = 110
  p.runners[0].credits[0].player = {}
  assert.equal(celebrationForPlay(p, F.gameData), null)
})

test('a real 113.1 mph outfield lineout names its credited fielder and club', () => {
  const f = JSON.parse(readFileSync(new URL('./fixtures/game-815625.gameday.json', import.meta.url)))
  const p = f.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 102)
  assert.deepEqual(celebrationForPlay(p, f.gameData), { scene: 'catch', name: 'Ryan Kreidler', teamId: 1960 })
})

test('missing club/person data degrades without inventing a name or assigning the wrong club', () => {
  const p = clone(hr); delete p.matchup.batter.fullName
  assert.deepEqual(celebrationForPlay(p, { ...F.gameData, players: {} }), { scene: 'homeRun', name: '', teamId: 136 })
  p.about.halfInning = 'unknown'
  assert.equal(celebrationForPlay(p, F.gameData), null)
})

const StageCanvas = ({ celebration }) => h('i', { 'data-celebration': celebration?.scene ?? '', 'data-name': celebration?.name ?? '' })
const open = ({ children }) => children()
const stage = (props) => renderToStaticMarkup(h(GamedayStage, { SealBox: open, StageCanvas, wall: wallFn(null), feed: F, ...props }))

test('the integration is lazy at the seal and reads no future results at rest', () => {
  const sealed = { ...F, liveData: { plays: new Proxy({}, { get: () => { throw Error('read before reveal') } }) } }
  assert.doesNotThrow(() => stage({ feed: sealed, shown: null }))
  assert.equal(stage({ feed: sealed, shown: hr.about.atBatIndex, SealBox: () => null }), '')
  assert.match(stage({ shown: hr.about.atBatIndex, playing: true }), /data-celebration="homeRun"/)
})

test('an open-at-bat pitch does not receive its future home-run celebration', () => {
  assert.doesNotMatch(stage({ inning: 1, half: 'top', shown: { count: 1, sub: 1, last: 0 }, playing: true }), /data-celebration="homeRun"/)
})
