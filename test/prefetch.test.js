import test from 'node:test'
import assert from 'node:assert/strict'
import { prefetch, isPrefetchFailure } from '../src/lib/react/prefetch.js'

test('a failed prefetch is marked so vite:preloadError recovery can skip it', async () => {
  const err = new Error('offline')
  prefetch(() => Promise.reject(err))
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(isPrefetchFailure(err), true)
  assert.equal(isPrefetchFailure(new Error('route import')), false)
  assert.equal(isPrefetchFailure(undefined), false)
})

test('a failed prefetch is retried on the next call', async () => {
  let n = 0
  const load = () => (n++, Promise.reject(new Error('x')))
  prefetch(load)
  prefetch(load)
  assert.equal(n, 2)
})
