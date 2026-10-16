// The audit's World Series option (scripts/audit-callouts.mjs --world-series=YYYY): the history it
// replays against stops before the replayed season, so the Series itself comes only from the bundle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { historyBefore } from '../../scripts/lib/world-series/audit.mjs'
import { HISTORY, EVENTS_JSON } from './ws-fixture.js'

test('historyBefore drops the replayed season and every later one, from both files', () => {
  const { seriesHistory, eventHistory } = historyBefore(HISTORY, EVENTS_JSON, 1992)
  assert.deepEqual(seriesHistory.series.map((s) => s.season), [1990, 1991])
  assert.ok(eventHistory.events.length > 0)
  assert.ok(eventHistory.events.every((r) => r.season < 1992))
})
