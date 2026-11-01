import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimRecovery, clearRecoveryFlag, recoverOnce } from '../src/lib/crash/recover.js'

function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
}

test('repairs once a session, then stops so a broken build cannot loop', () => {
  const storage = memoryStorage()
  let repairs = 0
  assert.equal(recoverOnce(storage, () => repairs++), true)
  assert.equal(recoverOnce(storage, () => repairs++), false)
  assert.equal(repairs, 1)
})

test('a clean load clears the flag, so the next deploy can repair too', () => {
  const storage = memoryStorage()
  assert.equal(claimRecovery(storage), true)
  clearRecoveryFlag(storage)
  assert.equal(claimRecovery(storage), true)
})

test('blocked storage never auto-reloads (it could not stop a loop)', () => {
  const blocked = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  let repairs = 0
  assert.equal(recoverOnce(blocked, () => repairs++), false)
  assert.equal(repairs, 0)
})
