// The champion's handoff from the home page bracket to the Season record row
// (#1224, slice 7). Two rules must never disagree about a date: ADR-0087's
// postseason window (the home page's `PostseasonBracket`) and the offseason
// phase (`SeasonRecord`'s row) are each other's complement, so a date is
// never left showing neither, and never both at once.
//
// Real 2025's own season row has no gap between the last World Series game
// (2025-11-01) and offseasonStartDate (2025-11-02) — see
// test/season-phase.test.js. So the season meta below is shaped like a year
// whose World Series finishes early, the case the brief calls out by name:
// "From the day after the last World Series game until the offseason page
// starts... There are no games, so the height limit does not apply." 2026's
// earliest possible last game (2026-10-27) leaves exactly this kind of gap
// before its offseasonStartDate (2026-11-01).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { isPostseasonWindow } from '../../src/lib/postseason/capSlateDate.js'
import { offseasonPhase } from '../../src/lib/time/seasonPhase.js'
import { results, skeleton } from './fixtures.js'

const seasonRecordSrc = readFileSync(
  fileURLToPath(new URL('../../src/components/offseason/SeasonRecord.jsx', import.meta.url)),
  'utf8',
)

// The tape and the warning come off ONLY when the champion is on the row's
// face (ADR-0081 addendum). A minor level's row, or an MLB row with no
// champion, still only links to results, so both stay, gated on one flag.
test('the tape and the warning show only on a row with no champion on its face (ADR-0081 addendum)', () => {
  assert.ok(seasonRecordSrc.includes('recordRowIsLabelled(champion)'), 'the row asks one helper whether it is labelled')
  assert.ok(/\{labelled && <div className="srecord__tape"/.test(seasonRecordSrc), 'the tape is gated on the label')
  assert.ok(/labelled && \([\s\S]{0,80}Opening this shows results/.test(seasonRecordSrc), 'the warning is gated on the label')
})

test('the row renders the champion through PostseasonBracket, never through the history file', () => {
  assert.ok(seasonRecordSrc.includes('PostseasonBracket'), 'the row should reuse the home page bracket component')
  assert.ok(seasonRecordSrc.includes('usePostseasonBracket'), 'the row should read the live-schedule bracket hook')
  assert.ok(
    !seasonRecordSrc.includes('loadPostseasonHistory') && !seasonRecordSrc.includes('postseason-history.json'),
    'the champion must never come from postseason-history.json',
  )
})

const SEASON_WITH_GAP = {
  seasonId: '2025',
  // The row's own `springStartDate` is that calendar year's spring — already
  // past by autumn — never next year's (see src/lib/time/seasonPhase.js).
  springStartDate: '2025-02-20',
  postSeasonStartDate: '2025-09-30',
  postSeasonEndDate: '2025-11-05',
  offseasonStartDate: '2025-11-06',
}

const bracket2025 = (cutoff) => deriveBracket(skeleton(2025), results(2025), cutoff)

test('before the last World Series game: the home page bracket is open, and there is no champion yet', () => {
  const date = '2025-10-24'
  assert.equal(isPostseasonWindow(date, SEASON_WITH_GAP), true)
  assert.equal(offseasonPhase(date, SEASON_WITH_GAP), null)
  assert.equal(bracket2025(date).champion, null)
})

test('on the day of the last World Series game: still no champion, since that game is on the cutoff date', () => {
  const date = '2025-11-01'
  assert.equal(isPostseasonWindow(date, SEASON_WITH_GAP), true)
  assert.equal(offseasonPhase(date, SEASON_WITH_GAP), null)
  assert.equal(bracket2025(date).champion, null)
})

test('after the last World Series game, before offseasonStartDate: the home page still shows the finished bracket, at full strength — there are no games', () => {
  const date = '2025-11-02'
  assert.equal(isPostseasonWindow(date, SEASON_WITH_GAP), true)
  assert.equal(offseasonPhase(date, SEASON_WITH_GAP), null)
  assert.equal(bracket2025(date).champion?.abbreviation, 'LAD')
})

test('from offseasonStartDate: the home page bracket closes and the Season record row takes over, still carrying the champion', () => {
  const date = '2025-11-06'
  assert.equal(isPostseasonWindow(date, SEASON_WITH_GAP), false)
  assert.notEqual(offseasonPhase(date, SEASON_WITH_GAP), null)
  assert.equal(bracket2025(date).champion?.abbreviation, 'LAD')
})

test('the row keeps the champion for the rest of the offseason', () => {
  const date = '2025-12-15'
  assert.equal(isPostseasonWindow(date, SEASON_WITH_GAP), false)
  assert.notEqual(offseasonPhase(date, SEASON_WITH_GAP), null)
  assert.equal(bracket2025(date).champion?.abbreviation, 'LAD')
})

test('no date is ever left with neither the home page bracket nor the row able to show', () => {
  const dates = [
    '2025-09-30', // postSeasonStartDate
    '2025-10-24', // before the last World Series game
    '2025-11-01', // the last World Series game itself
    '2025-11-02', // the day after — champion at full strength, still on the home page
    '2025-11-05', // the day before offseasonStartDate
    '2025-11-06', // offseasonStartDate — the row takes over
    '2025-12-31',
  ]
  for (const date of dates) {
    const onHomePage = isPostseasonWindow(date, SEASON_WITH_GAP)
    const onTheRow = offseasonPhase(date, SEASON_WITH_GAP) !== null
    assert.notEqual(onHomePage, onTheRow, `${date}: home page=${onHomePage}, row=${onTheRow}`)
  }
})
