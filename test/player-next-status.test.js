// The status band's mark map (src/screens/player/next/top/statusMarks.js, #2008).
import test from 'node:test'
import assert from 'node:assert/strict'
import { statusBannersView } from '../src/screens/player/statusBanners.js'
import { STATUS_MARK } from '../src/screens/player/next/top/statusMarks.js'

const all = { isAllStar: true, currentYear: 2026, onRehab: true, onIL: true, lastPlayedYear: 2023 }

test('every key statusBannersView emits has its own mark', () => {
  const keys = statusBannersView(all).map((b) => b.key)
  assert.deepEqual(keys, ['allstar', 'rehab', 'il', 'lastplayed'])
  assert.deepEqual(keys.map((k) => STATUS_MARK[k]), ['star', 'arrow', 'cross', 'dash'])
  assert.equal(new Set(Object.values(STATUS_MARK)).size, keys.length)
})

test('the words are the view text, and a starter today drops rehab and IL', () => {
  assert.equal(statusBannersView(all)[0].text, '2026 All-Star')
  assert.deepEqual(statusBannersView({ ...all, startingToday: true }).map((b) => b.key), ['allstar', 'lastplayed'])
  assert.deepEqual(statusBannersView({}), [])
})
