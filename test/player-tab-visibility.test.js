import assert from 'node:assert/strict'
import test from 'node:test'
import { playerTabsFor } from '../src/screens/player/tabVisibility.js'

test('retired player pages omit Analytics while active and free-agent pages keep it', () => {
  assert.deepEqual(playerTabsFor({ state: 'retired' }).map((tab) => tab.key), [
    'overview',
    'stats',
    'history',
  ])
  assert.ok(playerTabsFor(null).some((tab) => tab.key === 'analytics'))
  assert.ok(playerTabsFor({ state: 'free-agent' }).some((tab) => tab.key === 'analytics'))
})
