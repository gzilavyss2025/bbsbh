// Coverage for the Team Page's "Last 10 Games" roster projection
// (src/api/recentForm.js's buildRecentForm) — the pure aggregation over a
// fetched boxscore window. fetchRecentFormGames itself is a thin network
// wrapper (schedule slice + boxscore fetch), not covered here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRecentForm } from '../src/api/recentForm.js'

const hitter = (id, pos) => ({ person: { id }, position: { type: 'Hitter', abbreviation: pos } })
const pitcher = (id) => ({ person: { id }, position: { type: 'Pitcher', abbreviation: 'P' } })

// One team's boxscore.teams[side].players map for a single game, keyed the
// way statsapi actually keys it (ID<personId>) — battingOrder/starter/
// pitching lines are what buildRecentForm reads.
function box(side, players) {
  return { teams: { [side]: { players: Object.fromEntries(players.map((p) => [`ID${p.person.id}`, p])) } } }
}
function starter(id, order, pos) {
  return { person: { id }, battingOrder: String(order * 100), allPositions: [{ abbreviation: pos }] }
}
function sub(id, order, offset, pos) {
  return { person: { id }, battingOrder: String(order * 100 + offset), allPositions: [{ abbreviation: pos }] }
}
function pitchLine(id, { started = false, outs = 0, saves = 0 } = {}) {
  return { person: { id }, stats: { pitching: { gamesStarted: started ? 1 : 0, outs, saves } } }
}

const FULL_ROSTER = [
  hitter(1, 'C'), hitter(2, 'SS'), hitter(3, 'SS'), // two shortstops battling for the job
  pitcher(10), pitcher(11), pitcher(12),
]

test('preferred lineup picks the player with the most recent-window starts at a position', () => {
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [starter(2, 6, 'SS')]) },
    { apiDate: '2026-07-21', side: 'home', box: box('home', [starter(2, 6, 'SS')]) },
    { apiDate: '2026-07-22', side: 'home', box: box('home', [starter(3, 6, 'SS')]) },
  ]
  const { preferredLineupIds } = buildRecentForm(games, FULL_ROSTER)
  const ss = preferredLineupIds.find((p) => p.position === 'SS')
  assert.equal(ss.id, 2) // 2 starts vs. 3's 1 start
})

test('preferred lineup ties break on the more recent start', () => {
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [starter(3, 6, 'SS')]) },
    { apiDate: '2026-07-21', side: 'home', box: box('home', [starter(2, 6, 'SS')]) },
  ]
  const { preferredLineupIds } = buildRecentForm(games, FULL_ROSTER)
  assert.equal(preferredLineupIds.find((p) => p.position === 'SS').id, 2)
})

test('a player traded away (not on the current fullRoster) never wins a lineup spot', () => {
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [starter(999, 6, 'SS')]) },
  ]
  const { preferredLineupIds } = buildRecentForm(games, FULL_ROSTER)
  assert.equal(preferredLineupIds.find((p) => p.position === 'SS'), undefined)
})

test('a bench player who started elsewhere ranks as a substitute by games played, not claimed twice', () => {
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [starter(2, 6, 'SS'), sub(3, 6, 1, 'SS')]) },
    { apiDate: '2026-07-21', side: 'home', box: box('home', [starter(2, 6, 'SS'), sub(3, 6, 1, 'SS')]) },
  ]
  const { preferredLineupIds, substituteIds } = buildRecentForm(games, FULL_ROSTER)
  assert.equal(preferredLineupIds.find((p) => p.position === 'SS').id, 2)
  // 3 actually played (ranked first); 1 (the catcher, idle the whole window)
  // still shows up — appended after the ranked group, not dropped.
  assert.deepEqual(substituteIds, [3, 1])
})

test('a roster hitter who appeared in NONE of the window games still lands in Top Substitutes', () => {
  const games = [{ apiDate: '2026-07-20', side: 'home', box: box('home', [starter(2, 6, 'SS')]) }]
  const { substituteIds } = buildRecentForm(games, FULL_ROSTER)
  // 2 claimed the SS spot; 1 (catcher) and 3 (the other SS) both sat the
  // whole window and never claimed a spot, so both still show up.
  assert.deepEqual(substituteIds, [1, 3])
})

test('starting pitchers rank by starts in the window, capped at 5', () => {
  const roster = [pitcher(10), pitcher(11), pitcher(12), pitcher(13), pitcher(14), pitcher(15)]
  const games = [
    { apiDate: '2026-07-11', side: 'away', box: box('away', [pitchLine(10, { started: true, outs: 18 })]) },
    { apiDate: '2026-07-12', side: 'away', box: box('away', [pitchLine(11, { started: true, outs: 18 })]) },
    { apiDate: '2026-07-13', side: 'away', box: box('away', [pitchLine(12, { started: true, outs: 18 })]) },
    { apiDate: '2026-07-14', side: 'away', box: box('away', [pitchLine(13, { started: true, outs: 18 })]) },
    { apiDate: '2026-07-15', side: 'away', box: box('away', [pitchLine(14, { started: true, outs: 18 })]) },
    { apiDate: '2026-07-16', side: 'away', box: box('away', [pitchLine(10, { started: true, outs: 18 })]) },
    { apiDate: '2026-07-17', side: 'away', box: box('away', [pitchLine(15, { started: true, outs: 18 })]) },
  ]
  const { startingPitcherIds } = buildRecentForm(games, roster)
  assert.equal(startingPitcherIds.length, 5)
  assert.equal(startingPitcherIds[0], 10) // 2 starts, most of anyone
  // 11-15 are tied at 1 start each; ties break on the more recent start, so
  // 11 (the earliest of the five, 2026-07-12) is the one bumped by the cap.
  assert.equal(startingPitcherIds.includes(11), false)
  assert.equal(startingPitcherIds.includes(15), true)
})

test('bullpen leads with the closer (most saves in the window), then ranks by appearances', () => {
  const roster = [pitcher(10), pitcher(20), pitcher(21), pitcher(22)]
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [
      pitchLine(10, { started: true, outs: 18 }),
      pitchLine(21, { outs: 3 }),
      pitchLine(20, { outs: 3, saves: 1 }),
    ]) },
    { apiDate: '2026-07-21', side: 'home', box: box('home', [
      pitchLine(10, { started: true, outs: 18 }),
      pitchLine(21, { outs: 3 }),
      pitchLine(22, { outs: 3, saves: 1 }),
    ]) },
    { apiDate: '2026-07-22', side: 'home', box: box('home', [
      pitchLine(10, { started: true, outs: 18 }),
      pitchLine(21, { outs: 3 }),
    ]) },
  ]
  const { startingPitcherIds, bullpenIds } = buildRecentForm(games, roster)
  assert.deepEqual(startingPitcherIds, [10])
  // 20 and 22 each have exactly one save — the earlier-recorded one wins the tie.
  assert.equal(bullpenIds[0], 20)
  assert.equal(bullpenIds.includes(21), true) // most appearances among non-closers
})

test('no saves in the window means no closer — everyone ranks by appearances/innings', () => {
  const roster = [pitcher(10), pitcher(20), pitcher(21)]
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [
      pitchLine(10, { started: true, outs: 18 }),
      pitchLine(21, { outs: 3 }),
      pitchLine(20, { outs: 6 }),
    ]) },
  ]
  const { bullpenIds } = buildRecentForm(games, roster)
  assert.deepEqual(bullpenIds, [20, 21]) // 20's 2 innings outrank 21's 1
})

test('a pitcher who threw not one pitch in the window is exposed for the caller to infer a role for', () => {
  const roster = [pitcher(10), pitcher(20)]
  const games = [
    { apiDate: '2026-07-20', side: 'home', box: box('home', [pitchLine(10, { started: true, outs: 18 })]) },
  ]
  const { pitcherAppearanceIds } = buildRecentForm(games, roster)
  assert.deepEqual(pitcherAppearanceIds, [10]) // 20 never took the mound — not in this list
})

test('empty window degrades to every roster hitter as a substitute and every other list empty, no throw', () => {
  const result = buildRecentForm([], FULL_ROSTER)
  assert.deepEqual(result, {
    preferredLineupIds: [],
    substituteIds: [1, 2, 3], // no games at all — every hitter is idle, none ranked
    startingPitcherIds: [],
    bullpenIds: [],
    pitcherAppearanceIds: [],
  })
})
