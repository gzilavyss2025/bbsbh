// The World Series scouting report's Film room (#2316): the model behind the card, and the
// rule that no meeting dated on or after the slate date reaches it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filmRoomModel, filmRoomNote, listNameOf } from '../src/lib/postseason/worldseries/scouting/filmRoom.js'
import { selectMeetings } from '../src/lib/postseason/worldseries/scouting/meetings.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'

const side = (id, abbr, runs, mix = {}) => ({
  id,
  abbr,
  runs,
  hits: 8,
  errors: 0,
  starter: { id: id * 10, name: `${abbr} Starter`, hand: 'R', ip: '6.0', h: 5, r: 3, er: 2, bb: 1, k: 7, pitches: 90, mix },
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

test('a mix with a deficit of two or more still sums to 100', () => {
  const mix = Object.fromEntries(['FF', 'SL', 'CH', 'CU', 'SI', 'FC', 'ST'].map((c) => [c, 1]))
  const [m] = filmRoomModel([game('2026-08-04', side(139, 'TB', 1, mix), side(158, 'MIL', 3))], {})
  assert.equal(m.starters[0].mix.reduce((n, p) => n + p.pct, 0), 100)
})

test('a suffix is not the surname, and no name gives no surname', () => {
  const named = (name) => filmRoomModel([game('2026-08-04', { ...side(139, 'TB', 1), starter: { ...side(139, 'TB', 1).starter, name } }, side(158, 'MIL', 3))], {})[0].starters[0].surname
  assert.equal(named('Luis Garcia Jr.'), 'Garcia')
  assert.equal(named('Ken Griffey Sr.'), 'Griffey')
  assert.equal(named('Nick Martinez'), 'Martinez')
  assert.equal(named(''), '')
})

test('the game number rides on the meeting, default 1', () => {
  assert.equal(filmRoomModel(M, {})[0].gameNumber, 1)
  assert.equal(filmRoomModel([{ ...M[0], gameNumber: 2 }], {})[0].gameNumber, 2)
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

test('the starter line also comes as seven cells, a missing figure kept as null', () => {
  const a = side(139, 'TB', 1)
  const m = filmRoomModel([game('2026-08-04', { ...a, starter: { ...a.starter, bb: null } }, side(158, 'MIL', 3))], {})[0]
  assert.deepEqual(m.starters[0].stats.map((c) => c.label), ['IP', 'H', 'R', 'ER', 'BB', 'K', 'P'])
  assert.deepEqual(m.starters[0].stats.map((c) => c.value), ['6.0', 5, 3, 2, null, 7, 90])
})

test('a pitcher is listed surname first, a suffix last', () => {
  assert.equal(listNameOf('Nick Martinez'), 'Martinez, Nick')
  assert.equal(listNameOf('Luis Garcia Jr.'), 'Garcia, Luis')
  assert.equal(listNameOf('Cher'), 'Cher')
  assert.equal(listNameOf(''), '')
})

test('a scoring play carries its arrow: up for the top half, down for the bottom', () => {
  const g = { ...M[0], scoring: [{ inning: 'T1', text: 'a', playId: 'p1' }, { inning: 'B6', text: 'b' }, { inning: 'T10', text: 'c' }] }
  const [m] = filmRoomModel([g], {})
  assert.deepEqual(m.scoring.map((p) => [p.teamId, p.playId]), [[139, 'p1'], [158, null], [139, null]])
  assert.deepEqual(m.scoring.map((p) => [p.tag, p.half, p.num]), [['▲', 'top', '1'], ['▼', 'bottom', '6'], ['▲', 'top', '10']].map(([a, h, n]) => [a + n, h, n]))
  assert.equal(filmRoomModel([g], { compact: true })[0].scoring, undefined)
})

test('the line score is one row of inning runs a club, a half never batted staying null', () => {
  const g = { ...M[0], innings: [[1, 0], [0, 2], [3, null]] }
  const [m] = filmRoomModel([g], {})
  assert.deepEqual(m.innings, [{ abbr: 'TB', runs: [1, 0, 3] }, { abbr: 'MIL', runs: [0, 2, null] }])
  assert.deepEqual(filmRoomModel([M[0]], {})[0].innings, [])
})

test('the W and SV pitchers are the winner\'s, the L pitcher the other club\'s, each with a person id', () => {
  const g = { ...M[0], decisions: { w: 'A', l: 'B', s: 'C' }, decisionIds: { w: 1, l: 2, s: 3 } }
  const [m] = filmRoomModel([g], {})
  assert.deepEqual(m.people.map((p) => [p.label, p.id, p.teamId]), [['W', 1, 158], ['L', 2, 139], ['SV', 3, 158]])
  const jr = filmRoomModel([{ ...M[0], decisions: { w: 'Luis Garcia Jr.', l: '', s: '' }, decisionIds: { w: 9 } }], {})[0]
  assert.equal(jr.people[0].surname, 'Garcia')
  const none = filmRoomModel([{ ...M[0], decisions: { w: '', l: '', s: '' } }], {})[0]
  assert.deepEqual(none.people, [])
})
