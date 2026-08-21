import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeLiveDays } from '../src/api/transactions/clubFeed.js'

// ---------------------------------------------------------------------------
// The club card's live window, laid over the nightly file
// ---------------------------------------------------------------------------
// The club surfaces read a file the cron writes at 07:00 UTC; the home slate's
// wire reads the endpoint live. A move filed at noon was therefore on the home
// page in seconds and missing from the club's OWN page until the next morning.
// api/transactions/clubFeed.js closes that with a three-day live window laid
// over the file's newest days.
//
// The join is by DAY, never by story, and that is the whole safety argument: a
// day is told by exactly one of the two sources, so a story cannot print twice
// even when the two group the same rows differently. (They no longer do —
// team-transactions.test.js pins the ordering invariant that guarantees it —
// but the merge does not depend on that holding.)
// ---------------------------------------------------------------------------

const day = (date, ...ids) => ({ date, stories: ids.map((id) => ({ id, type: 'roster-move' })) })
const ids = (days) => days.map((d) => `${d.date}:${d.stories.map((s) => s.id).join('+')}`)

const WINDOW_START = '2026-08-19'

test('inside the window the live day replaces the file day', () => {
  const file = [day('2026-08-20', 'file-a'), day('2026-08-19', 'file-b')]
  const live = [day('2026-08-20', 'live-a'), day('2026-08-19', 'live-b')]
  assert.deepEqual(ids(mergeLiveDays(file, live, WINDOW_START)), [
    '2026-08-20:live-a',
    '2026-08-19:live-b',
  ])
})

test('a day the live fetch found and the file has not is prepended', () => {
  // The freshness win: today's moves, hours before the cron would write them.
  const file = [day('2026-08-19', 'file-b')]
  const live = [day('2026-08-21', 'live-today'), day('2026-08-19', 'live-b')]
  assert.deepEqual(ids(mergeLiveDays(file, live, WINDOW_START)), [
    '2026-08-21:live-today',
    '2026-08-19:live-b',
  ])
})

test('outside the window the file is untouched', () => {
  const file = [day('2026-08-18', 'file-old'), day('2026-07-04', 'file-older')]
  const live = [day('2026-08-20', 'live-a')]
  assert.deepEqual(ids(mergeLiveDays(file, live, WINDOW_START)), [
    '2026-08-20:live-a',
    '2026-08-18:file-old',
    '2026-07-04:file-older',
  ])
})

test('a day inside the window that only the file holds survives', () => {
  // The one row shape the wider fetch can still miss: post-dated, filed more
  // than FETCH_DAYS before the day it takes effect. Dropping the file's day
  // for it would lose a story the reader could already see yesterday.
  const file = [day('2026-08-20', 'file-a'), day('2026-08-19', 'file-b')]
  const live = [day('2026-08-20', 'live-a')]
  assert.deepEqual(ids(mergeLiveDays(file, live, WINDOW_START)), [
    '2026-08-20:live-a',
    '2026-08-19:file-b',
  ])
})

test('no day is ever told twice, and the run stays newest first', () => {
  const file = [day('2026-08-20', 'file-a'), day('2026-08-18', 'file-c'), day('2026-08-19', 'file-b')]
  const live = [day('2026-08-19', 'live-b'), day('2026-08-21', 'live-today')]
  const merged = mergeLiveDays(file, live, WINDOW_START)
  assert.equal(new Set(merged.map((d) => d.date)).size, merged.length)
  assert.deepEqual(merged.map((d) => d.date), ['2026-08-21', '2026-08-20', '2026-08-19', '2026-08-18'])
})

test('an empty live window leaves the file exactly as it was', () => {
  // What a failed fetch and a genuinely quiet three days both look like: the
  // card as it was before any of this existed.
  const file = [day('2026-08-20', 'file-a'), day('2026-08-19', 'file-b')]
  assert.deepEqual(ids(mergeLiveDays(file, [], WINDOW_START)), ['2026-08-20:file-a', '2026-08-19:file-b'])
  assert.deepEqual(ids(mergeLiveDays(file, null, WINDOW_START)), ['2026-08-20:file-a', '2026-08-19:file-b'])
})
