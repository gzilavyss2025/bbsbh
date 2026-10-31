// #2514: the crash signal. The payload is rebuilt from an allowlist (ADR-0028's idea), so no
// score, id, name, message or stack can leave the device.
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCrashPayload, createCrashReporter } from '../src/lib/crash/report.js'
import { SlotBoundary } from '../src/screens/player/next/SlotBoundary.js'

test('the builder keeps the four allowed keys and drops everything else', () => {
  const out = buildCrashPayload({
    kind: 'render', route: 'player', status: 404, build: 'abc1234',
    message: 'Brewers 5, Cubs 3', stack: 'at x', gamePk: 823035, url: '/07052026/milari/box',
  })
  assert.deepEqual(out, { kind: 'render', route: 'player', status: 404, build: 'abc1234' })
})

test('the builder rejects a value outside its enum or shape', () => {
  assert.equal(buildCrashPayload({ kind: 'score' }), null)
  const out = buildCrashPayload({ kind: 'fetch', route: 'x'.repeat(200), status: 'Brewers 5', build: 'not a sha!' })
  assert.deepEqual(out, { kind: 'fetch', route: '', status: null, build: '' })
  assert.equal(buildCrashPayload({ kind: 'chunk', route: '/07052026/milari' }).route, '')
  assert.equal(buildCrashPayload({ kind: 'chunk', status: 9999 }).status, null)
})

test('the reporter sends at most the session limit, and repeats only once each', () => {
  const sent = []
  const report = createCrashReporter((p) => sent.push(p), { limit: 3 })
  report({ kind: 'render', route: 'player' })
  report({ kind: 'render', route: 'player' })
  report({ kind: 'chunk', route: 'team' })
  report({ kind: 'fetch', route: 'home', status: 503 })
  report({ kind: 'unhandled', route: 'home' })
  assert.equal(sent.length, 3)
  assert.deepEqual(sent.map((p) => p.kind), ['render', 'chunk', 'fetch'])
})

test('a thrown render in SlotBoundary reports once, as kind render', () => {
  const sent = []
  const boundary = new SlotBoundary({ slotKey: 'awards', onFail() {}, report: (p) => sent.push(p) })
  const realError = console.error
  console.error = () => {}
  try { boundary.componentDidCatch(new Error('boom')) } finally { console.error = realError }
  assert.equal(sent.length, 1)
  assert.equal(sent[0].kind, 'render')
})
