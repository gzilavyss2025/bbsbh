// The World Series scouting report's Film room (#2316): the model behind the card, and the
// rule that no meeting dated on or after the slate date reaches it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filmRoomModel, filmRoomNote } from '../src/lib/postseason/worldseries/scouting/filmRoom.js'
import { selectMeetings } from '../src/lib/postseason/worldseries/scouting/meetings.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'

const side = (id, abbr, runs, mix = {}) => ({
  id,
  abbr,
  runs,
  hits: 8,
  errors: 0,
  starter: { id: id * 10, name: `${abbr} Starter`, hand: 'R', ip: '6.0', h: 5, er: 2, bb: 1, k: 7, pitches: 90, mix },
  lineup: [{ id: 1, name: 'A Hitter', pos: 'CF' }],
})
const game = (date, away, home) => ({
  gamePk: 1,
  date,
  venue: 'American Family Field',
  ump: 'A. Umpire',
  decisions: { w: 'W Pitcher', l: 'L Pitcher', s: '' },
  away,
  home,
  scoring: [{ inning: 'T1', text: 'A run scores.' }],
})
const M = [
  game('2026-08-04', side(139, 'TB', 1), side(158, 'MIL', 3, { FF: 1, SL: 1, CH: 1 })),
  game('2026-08-05', side(139, 'TB', 5), side(158, 'MIL', 2)),
  game('2026-08-06', side(139, 'TB', 0), side(158, 'MIL', 4)),
]

test('each meeting carries its day, plate umpire, rows and the winner flag', () => {
  const [m] = filmRoomModel(M, { compact: false })
  assert.equal(m.ump, 'A. Umpire')
  assert.match(m.day, /Aug/)
  assert.deepEqual(m.rows.map((r) => [r.abbr, r.runs, r.win]), [['TB', 1, false], ['MIL', 3, true]])
  assert.deepEqual(filmRoomModel(M, {})[1].rows.map((r) => r.win), [true, false])
})

test('the decisions line names the winner, loser and save, and skips an empty one', () => {
  assert.equal(filmRoomModel(M, {})[0].decisions, 'W W Pitcher · L L Pitcher')
  const s = { ...M[0], decisions: { w: 'A', l: 'B', s: 'C' } }
  assert.equal(filmRoomModel([s], {})[0].decisions, 'W A · L B · SV C')
})

test('a pitch mix is sorted and its percents sum to 100', () => {
  const [m] = filmRoomModel(M, {})
  const mix = m.starters[1].mix
  assert.equal(mix.reduce((n, p) => n + p.pct, 0), 100)
  assert.deepEqual(mix.map((p) => p.pct), [34, 33, 33])
  assert.deepEqual(m.starters[0].mix, [])
})

test('the starter reads club, hand and line', () => {
  const s = filmRoomModel(M, {})[0].starters[0]
  assert.equal(s.abbr, 'TB')
  assert.equal(s.hand, 'RHP')
  assert.equal(s.surname, 'Starter')
  assert.equal(s.line, '6.0 IP · 5 H · 2 ER · 1 BB · 7 K · 90 P')
})

test('compact drops the scoring plays and the lineups', () => {
  const [full] = filmRoomModel(M, { compact: false })
  const [thin] = filmRoomModel(M, { compact: true })
  assert.equal(full.scoring.length, 1)
  assert.equal(full.lineups.length, 2)
  assert.equal(thin.scoring, undefined)
  assert.equal(thin.lineups, undefined)
  assert.equal(thin.rows.length, 2)
})

test('zero meetings gives an empty list and no note', () => {
  assert.deepEqual(filmRoomModel([], {}), [])
  assert.deepEqual(filmRoomModel(undefined, {}), [])
  assert.equal(filmRoomNote([], 158), '')
})

test('the head note counts the club\'s wins against the opponent', () => {
  assert.equal(filmRoomNote(M, 158), 'Brewers 2-1')
  assert.equal(filmRoomNote(M, 139), 'Rays 1-2')
})

test('no meeting dated on or after the slate date reaches the model', () => {
  const row = (gamePk, officialDate) => ({
    gamePk,
    gameType: 'R',
    officialDate,
    status: { abstractGameState: 'Final' },
    teams: { away: { team: { id: 139 } }, home: { team: { id: 158 } } },
  })
  const rows = [row(1, '2026-08-04'), row(2, '2026-10-19'), row(3, '2026-10-20')]
  assert.deepEqual(selectMeetings(rows, { clubA: 139, clubB: 158, slateDate: '2026-10-19' }).map((g) => g.gamePk), [1])
})

test('Film is on both day types and drops with zero meetings', () => {
  for (const dayType of ['off', 'game']) {
    const ids = scoutingModel({ dayType, meetings: M }).map((c) => c.id)
    assert.ok(ids.includes('film-room'), dayType)
    assert.ok(!scoutingModel({ dayType, meetings: [] }).some((c) => c.id === 'film-room'))
  }
  assert.deepEqual(scoutingModel({ dayType: 'off', meetings: M }), [{ id: 'film-room', label: 'Film' }])
})

test('Film sits last on an off day and after Matchup edges and the umpire on a game day', () => {
  const full = { nineKeys: true, edges: [{ id: 1 }], plateUmpire: { id: 9, name: 'U' }, meetings: M }
  assert.deepEqual(scoutingModel({ dayType: 'off', ...full }).map((c) => c.id), ['nine-keys', 'matchup-edges', 'film-room'])
  assert.deepEqual(scoutingModel({ dayType: 'game', ...full }).map((c) => c.id), ['matchup-edges', 'umpire-edge', 'film-room'])
})
