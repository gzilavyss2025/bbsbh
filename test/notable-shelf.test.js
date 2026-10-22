// shelfRows (src/lib/notable/shelf.js): the /notable shelf's rows. Offline; each row is a
// trimmed copy of a committed public/data/notable/ row.
import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { boxScoreOpensByDate } from '../src/lib/dates.js'
import { filterByClub, shelfRows } from '../src/lib/notable/shelf.js'

const club = (id, abbr, name, runs) => ({ id, abbr, name, runs })
const NOW = new Date('2026-10-22T18:00:00Z')

const buxton = {
  gamePk: 777134, officialDate: '2025-07-12', gameNumber: 1, side: 'home',
  away: club(134, 'PIT', 'Pittsburgh Pirates', 4), home: club(142, 'MIN', 'Minnesota Twins', 12),
  player: { id: 621439, name: 'Byron Buxton' },
}
const bleday = {
  gamePk: 825044, officialDate: '2026-08-22', gameNumber: 1, side: 'away',
  away: club(113, 'CIN', 'Cincinnati Reds', 11), home: club(109, 'AZ', 'Arizona Diamondbacks', 5),
  player: { id: 668709, name: 'JJ Bleday' },
}

test('newest first, each row with its final score and a sealed box score address', () => {
  const rows = shelfRows('cycles', { rows: [buxton, bleday] }, NOW)
  assert.deepEqual(rows.map((r) => r.date), ['2026-08-22', '2025-07-12'])
  assert.equal(rows[1].away.runs, 4)
  assert.equal(rows[1].home.runs, 12)
  assert.equal(rows[1].feat, 'Cycle: Byron Buxton')
  assert.equal(rows[1].href, '/07122025/pitmin/boxscore')
})

test('a game dated on or after the slate day is left off, and so is one with no real date', () => {
  const today = { ...buxton, gamePk: 1, officialDate: '2026-10-22' }
  const future = { ...buxton, gamePk: 2, officialDate: '2026-10-23' }
  const undated = { ...buxton, gamePk: 3, officialDate: '' }
  const yesterday = { ...buxton, gamePk: 4, officialDate: '2026-10-21' }
  const rows = shelfRows('cycles', { rows: [today, future, undated, yesterday] }, NOW)
  assert.deepEqual(rows.map((r) => r.date), ['2026-10-21'])
})

test('an old doubleheader keeps its own game number, later game first, in the address', () => {
  const g1 = { ...buxton, gamePk: 10, officialDate: '1904-09-26', gameNumber: 1 }
  const g2 = { ...buxton, gamePk: 11, officialDate: '1904-09-26', gameNumber: 2 }
  const rows = shelfRows('cycles', { rows: [g1, g2] }, NOW)
  assert.deepEqual(rows.map((r) => r.gameNumber), [2, 1])
  assert.equal(rows[0].href, '/09261904/pitmin-2/boxscore')
  assert.equal(rows[1].href, '/09261904/pitmin/boxscore')
})

test('thin data renders without a crash: no name, no abbreviation, no score, no doc', () => {
  const nameless = { ...buxton, gamePk: 5, player: { id: 1, name: '' } }
  const noAbbr = { ...buxton, gamePk: 6, away: club(134, '', '', null), officialDate: '2025-07-11' }
  const bare = { gamePk: 7, officialDate: '2025-07-10', side: 'home' }
  const rows = shelfRows('cycles', { rows: [nameless, noAbbr, bare] }, NOW)
  assert.equal(rows[0].feat, 'Cycle')
  assert.equal(rows[1].href, null)
  assert.equal(rows[1].away.runs, null)
  assert.equal(rows[2].href, null)
  assert.deepEqual(shelfRows('cycles', null, NOW), [])
  assert.deepEqual(shelfRows('cycles', { rows: [] }, NOW), [])
})

test('each kind prints its own feat line', () => {
  const nh = { ...buxton, pitchers: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], shortened: true }
  assert.equal(shelfRows('nohitters', { rows: [nh] }, NOW)[0].feat, 'Combined no-hitter (shortened): A, B')
  assert.equal(shelfRows('tripleplays', { rows: [buxton] }, NOW)[0].feat, 'Triple play: Minnesota Twins')
})

test('a row carries who did it and who it was done against, and the people to show', () => {
  const [cycle] = shelfRows('cycles', { rows: [buxton] }, NOW)
  assert.equal(cycle.doerId, 142)
  assert.equal(cycle.foeId, 134)
  assert.deepEqual(cycle.players, [{ id: 621439, name: 'Byron Buxton' }])
  const nh = { ...buxton, side: 'away', pitchers: [{ id: 1, name: 'A' }, { id: null, name: 'B' }, { id: 3, name: '' }] }
  const [hitless] = shelfRows('nohitters', { rows: [nh] }, NOW)
  assert.equal(hitless.doerId, 134)
  assert.deepEqual(hitless.players.map((p) => p.id), [1, 3])
  assert.deepEqual(shelfRows('tripleplays', { rows: [buxton] }, NOW)[0].players, [])
})

test('the club filter: did it, done to them, either, and no club', () => {
  const twinsDid = { ...buxton, gamePk: 1, officialDate: '2025-07-12' }
  const twinsVictim = { ...buxton, gamePk: 2, officialDate: '2025-07-11', side: 'away' }
  const other = { ...bleday, gamePk: 3 }
  const rows = shelfRows('cycles', { rows: [twinsDid, twinsVictim, other] }, NOW)
  const pks = (list) => list.map((r) => r.key.split('-')[0]).sort()
  assert.deepEqual(pks(filterByClub(rows, null, 'did')), ['1', '2', '3'])
  assert.deepEqual(pks(filterByClub(rows, 142, 'did')), ['1'])
  assert.deepEqual(pks(filterByClub(rows, 142, 'against')), ['2'])
  assert.deepEqual(pks(filterByClub(rows, 142, 'either')), ['1', '2'])
  assert.deepEqual(filterByClub(rows, 999, 'either'), [])
})

test('a row with no side has no doer and no foe, and matches only either', () => {
  const sideless = { ...buxton, side: undefined }
  const rows = shelfRows('cycles', { rows: [sideless] }, NOW)
  assert.equal(rows[0].doerId, null)
  assert.equal(rows[0].foeId, null)
  assert.equal(filterByClub(rows, 142, 'did').length, 0)
  assert.equal(filterByClub(rows, 142, 'either').length, 1)
})

test('a row speaks its day, clubs, score, feat and who did it', () => {
  const [row] = shelfRows('cycles', { rows: [buxton] }, NOW)
  assert.equal(
    row.label,
    'Box score, July 12, 2025: Pittsburgh Pirates at Minnesota Twins, 4 to 12. Cycle: Byron Buxton. Minnesota Twins did it.',
  )
  const g2 = { ...buxton, officialDate: '1904-09-26', gameNumber: 2, side: undefined, away: club(134, 'PIT', '', null) }
  assert.equal(shelfRows('cycles', { rows: [g2] }, NOW)[0].label, 'Box score, September 26, 1904, game 2: PIT at Minnesota Twins. Cycle: Byron Buxton.')
})

// The backstop for the shelf's spoiler footing (ADR-0117): over the committed files, at three
// "today"s, every row it lists is a row whose box score opens by date, and the day itself is out.
for (const kind of ['nohitters', 'cycles', 'tripleplays']) {
  test(`${kind}: the shelf lists only games whose box score opens by date`, () => {
    const doc = JSON.parse(readFileSync(new URL(`../public/data/notable/${kind}.json`, import.meta.url), 'utf8'))
    for (const day of ['1950-06-15', '2020-09-27', '2026-10-22']) {
      const at = new Date(`${day}T18:00:00Z`)
      const rows = shelfRows(kind, doc, at)
      assert.ok(rows.every((r) => boxScoreOpensByDate(r.date, at)), `${kind} at ${day}`)
      assert.ok(rows.every((r) => r.date < day), `${kind} at ${day}: nothing on or after the day`)
    }
    assert.ok(shelfRows(kind, doc, new Date('2026-10-22T18:00:00Z')).length > 50, 'the shelf is not empty')
  })
}
