// The "last time" callouts for a triple play, cycle or no-hitter (api/callout-notes/lastTime.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLastTimeNotes, detectPlayFeat, detectNoHitters, LEAGUE_GAP_DAYS } from '../src/api/callout-notes/lastTime.js'

const club = (id, abbr = 'XXX') => ({ id, abbr, name: abbr, runs: 0 })
const row = (gamePk, officialDate, side, extra = {}) => ({
  gamePk, officialDate, gameType: 'R', gameNumber: 1, away: club(158, 'MIL'), home: club(112, 'CHC'), side, ...extra,
})
const feed = (date = '2026-06-10') => ({
  gamePk: 999,
  gameData: {
    datetime: { officialDate: date },
    game: { gameNumber: 1 },
    teams: { away: { id: 158, teamName: 'Brewers' }, home: { id: 112, teamName: 'Cubs' } },
  },
})
const tp = { kind: 'tripleplays', side: 'away' }
const docsOf = (kind, rows) => ({ [kind]: { rows } })
const texts = (notes) => notes.map((n) => n.text)

test('a club with no earlier row gets no note', () => {
  const docs = docsOf('tripleplays', [row(1, '2020-05-01', 'home')]) // the Cubs', not the Brewers'
  const notes = buildLastTimeNotes(docs, feed(), tp)
  assert.deepEqual(notes.filter((n) => n.kind === 'lastTimeClub'), [])
})

test('the club line names the date of the club\'s last one', () => {
  const docs = docsOf('tripleplays', [row(1, '2026-05-03', 'away'), row(2, '2015-04-01', 'away')])
  assert.deepEqual(texts(buildLastTimeNotes(docs, feed(), tp)), ["The Brewers' first triple play since May 3, 2026."])
})

test('a last find older than the floor reads "since at least"', () => {
  const docs = docsOf('tripleplays', [row(1, '1955-08-03', 'away')])
  const [club] = buildLastTimeNotes(docs, feed(), tp)
  assert.equal(club.text, "The Brewers' first triple play since at least 1960.")
  // The same year is inside the floor for a cycle.
  const cyc = docsOf('cycles', [row(2, '1955-08-03', 'away', { player: { id: 7, name: 'A' } })])
  assert.equal(buildLastTimeNotes(cyc, feed(), { kind: 'cycles', side: 'away', player: { id: 8, name: 'B' } })[0].text, "The Brewers' first cycle since Aug. 3, 1955.")
})

test('a renamed club still matches by team id', () => {
  const old = row(1, '1975-06-01', 'away', { away: club(158, 'OLD') })
  const notes = buildLastTimeNotes(docsOf('tripleplays', [old]), feed(), tp)
  assert.match(notes[0].text, /since June 1, 1975/)
})

test('tonight\'s own row, and a later row, never count as the earlier one', () => {
  const docs = docsOf('tripleplays', [row(999, '2026-06-10', 'away'), row(5, '2026-07-01', 'away')])
  assert.deepEqual(buildLastTimeNotes(docs, feed(), tp), [])
})

test('a player\'s first cycle has no player line; his second does', () => {
  const me = { id: 7, name: 'Hitter' }
  const feat = { kind: 'cycles', side: 'away', player: me }
  const first = docsOf('cycles', [row(1, '2024-05-01', 'home', { player: { id: 9, name: 'Other' } })])
  assert.equal(buildLastTimeNotes(first, feed(), feat).some((n) => n.kind === 'lastTimePlayer'), false)
  const second = docsOf('cycles', [row(1, '2024-05-01', 'away', { player: me })])
  const line = buildLastTimeNotes(second, feed(), feat).find((n) => n.kind === 'lastTimePlayer')
  assert.equal(line.text, 'His second cycle; the first was May 1, 2024.')
  assert.equal(line.personId, 7)
  const third = docsOf('cycles', [row(1, '2024-05-01', 'away', { player: me }), row(2, '2022-05-01', 'away', { player: me })])
  assert.equal(buildLastTimeNotes(third, feed(), feat).find((n) => n.kind === 'lastTimePlayer').text, 'His third cycle; the last was May 1, 2024.')
})

test('the league line shows only after a gap of a year or more', () => {
  const recent = docsOf('tripleplays', [row(1, '2026-06-01', 'home')])
  assert.deepEqual(buildLastTimeNotes(recent, feed(), tp).filter((n) => n.kind === 'lastTimeLeague'), [])
  const long = docsOf('tripleplays', [row(1, '2024-08-01', 'home')])
  const [league] = buildLastTimeNotes(long, feed(), tp)
  assert.equal(league.text, 'The first triple play in the majors since Aug. 1, 2024.')
  assert.ok(LEAGUE_GAP_DAYS >= 365)
})

test('a no-hitter names each pitcher with an earlier one', () => {
  const docs = docsOf('nohitters', [row(1, '2023-04-01', 'away', { pitchers: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] })])
  const feat = { kind: 'nohitters', side: 'away', pitchers: [{ id: 2, name: 'B' }, { id: 3, name: 'C' }] }
  const notes = buildLastTimeNotes(docs, feed(), feat)
  assert.deepEqual(notes.filter((n) => n.kind === 'lastTimePlayer').map((n) => n.personId), [2])
})

test('no docs, or a failed load, add nothing', () => {
  assert.deepEqual(buildLastTimeNotes(null, feed(), tp), [])
  assert.deepEqual(buildLastTimeNotes({ tripleplays: null }, feed(), tp), [])
})

// --- detection ------------------------------------------------------------------------------
const play = (i, batterId, eventType, description = '') => ({
  about: { atBatIndex: i }, matchup: { batter: { id: batterId, fullName: `P${batterId}` } }, result: { eventType, description },
})
const withPlays = (plays) => ({ ...feed(), liveData: { plays: { allPlays: plays } } })

test('a triple play is the fielding club\'s', () => {
  const f = withPlays([play(0, 1, 'grounded_into_triple_play', 'grounded into a triple play')])
  assert.deepEqual(detectPlayFeat(f, 0, 'home'), { kind: 'tripleplays', side: 'away' })
})

test('a cycle is flagged on the hit that completes it, once', () => {
  const f = withPlays([
    play(0, 1, 'single'), play(1, 2, 'walk'), play(2, 1, 'double'), play(3, 1, 'triple'), play(4, 1, 'home_run'), play(5, 1, 'single'),
  ])
  assert.equal(detectPlayFeat(f, 3, 'away'), null)
  assert.deepEqual(detectPlayFeat(f, 4, 'away'), { kind: 'cycles', side: 'away', player: { id: 1, name: 'P1' } })
  assert.equal(detectPlayFeat(f, 5, 'away'), null)
})

test('a no-hitter needs a Final game and an opponent with no hits', () => {
  const box = (awayHits, homeHits) => ({
    teams: {
      away: { teamStats: { batting: { hits: awayHits } }, pitchers: [11], players: { ID11: { person: { fullName: 'Ace' } } } },
      home: { teamStats: { batting: { hits: homeHits } }, pitchers: [22], players: {} },
    },
  })
  const final = (b) => ({ ...feed(), gameData: { ...feed().gameData, status: { abstractGameState: 'Final' } }, liveData: { boxscore: b, linescore: { teams: { away: { runs: 1 }, home: { runs: 0 } } } } })
  assert.deepEqual(detectNoHitters(final(box(1, 0))), [{ kind: 'nohitters', side: 'away', pitchers: [{ id: 11, name: 'Ace' }] }])
  assert.deepEqual(detectNoHitters(final(box(1, 3))), [])
  const live = final(box(1, 0))
  live.gameData.status.abstractGameState = 'Live'
  assert.deepEqual(detectNoHitters(live), [])
})

// --- the link (#1570) ----------------------------------------------------------------------
test('the date links the earlier game\'s box score, with no score in the path', () => {
  const prev = row(1, '2026-05-03', 'away', { gameNumber: 2, away: club(158, 'MIL'), home: club(112, 'CHC') })
  const [note] = buildLastTimeNotes(docsOf('tripleplays', [prev]), feed(), tp)
  assert.deepEqual(note.link, {
    before: "The Brewers' first triple play since ", label: 'May 3, 2026', after: '.', path: '/05032026/milchc-2/boxscore',
  })
  assert.equal(note.link.before + note.link.label + note.link.after, note.text)
  assert.doesNotMatch(note.link.path, /\d+-\d+|\?/)
})

test('a "since at least" line has no date, so no link', () => {
  const [note] = buildLastTimeNotes(docsOf('tripleplays', [row(1, '1955-08-03', 'away')]), feed(), tp)
  assert.equal(note.link, null)
})

test('each line links its own earlier game and carries the club identity', () => {
  const me = { id: 7, name: 'Hitter' }
  const docs = docsOf('cycles', [row(1, '2024-05-01', 'away', { player: me }), row(2, '2026-06-01', 'home', { player: { id: 9, name: 'O' } })])
  const notes = buildLastTimeNotes(docs, feed(), { kind: 'cycles', side: 'away', player: me })
  const by = Object.fromEntries(notes.map((n) => [n.kind, n]))
  assert.equal(by.lastTimePlayer.link.label, 'May 1, 2024')
  assert.equal(by.lastTimePlayer.teamId, 158)
  assert.equal(by.lastTimePlayer.personName, 'Hitter')
})

test('game 2 of a doubleheader is the earlier game when it came last', () => {
  const g1 = row(1, '2026-05-03', 'away', { gameNumber: 1 })
  const g2 = row(2, '2026-05-03', 'away', { gameNumber: 2 })
  for (const rows of [[g1, g2], [g2, g1]]) {
    const [note] = buildLastTimeNotes(docsOf('tripleplays', rows), feed(), tp)
    assert.equal(note.link.path, '/05032026/milchc-2/boxscore')
  }
})
