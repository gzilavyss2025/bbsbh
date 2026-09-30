import test from 'node:test'
import assert from 'node:assert/strict'
import { fakeStorage } from './helpers/fakeStorage.js'

test('fakeStorage reads, writes (as strings) and removes', () => {
  const s = fakeStorage({ a: '1' })
  assert.equal(s.getItem('a'), '1')
  assert.equal(s.getItem('missing'), null)
  s.setItem('b', 2)
  assert.equal(s.getItem('b'), '2')
  s.removeItem('a')
  assert.deepEqual(s.data, { b: '2' })
})

test('fakeStorage key(i) is positional and re-indexes after a removal', () => {
  const s = fakeStorage({ a: '1', b: '2', c: '3' })
  assert.equal(s.length, 3)
  assert.equal(s.key(1), 'b')
  s.removeItem('a')
  assert.equal(s.key(1), 'c')
  assert.equal(s.key(5), null)
})

test('fakeStorage copies its seed', () => {
  const seed = { a: '1' }
  fakeStorage(seed).setItem('b', '2')
  assert.deepEqual(seed, { a: '1' })
})

test('fakeStorage throws on demand, per option', () => {
  assert.throws(() => fakeStorage({}, { throwOnGet: true }).getItem('a'))
  const set = fakeStorage({ a: '1' }, { throwOnSet: true })
  assert.throws(() => set.setItem('a', 'x'))
  assert.throws(() => set.removeItem('a'))
  assert.equal(set.getItem('a'), '1', 'reads still work')
  const read = fakeStorage({ a: '1' }, { throwOnRead: true })
  assert.throws(() => read.length)
  assert.throws(() => read.key(0))
  assert.equal(read.getItem('a'), '1', 'getItem still works')
  const refuse = fakeStorage({ a: '1', b: '2' }, { refuse: (k) => k === 'a' })
  assert.throws(() => refuse.removeItem('a'))
  refuse.removeItem('b')
  assert.deepEqual(refuse.data, { a: '1' })
})
