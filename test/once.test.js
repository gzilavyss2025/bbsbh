import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from '../src/lib/react/once.js'

test('once runs the loader a single time, swallows rejection', async () => {
  let n = 0
  const go = once(() => {
    n++
    return Promise.reject(new Error('offline'))
  })
  go()
  go()
  await Promise.resolve()
  assert.equal(n, 1)
})
