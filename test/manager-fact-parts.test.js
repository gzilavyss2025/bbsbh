import assert from 'node:assert/strict'
import test from 'node:test'
import { managerFactParts } from '../src/components/team/managerFactParts.js'

test('managerFactParts reads spoken order with a #-prefixed number and asks for a photo', () => {
  const m = managerFactParts({ name: 'Kevin Cash', lastFirst: 'Cash, Kevin', personId: 112, jersey: '16', interim: false })
  assert.deepEqual(m, { personId: 112, name: 'Kevin Cash', jersey: '#16', interim: false, photo: true })
})

test('managerFactParts keeps a jersey of "0"', () => {
  assert.equal(managerFactParts({ name: 'A B', personId: 1, jersey: '0' }).jersey, '#0')
})

test('managerFactParts with no personId asks for no photo and no link', () => {
  const m = managerFactParts({ name: 'Pat Murphy', jersey: '', interim: true })
  assert.equal(m.photo, false)
  assert.equal(m.personId, null)
  assert.equal(m.jersey, '')
  assert.equal(m.interim, true)
})

test('managerFactParts is null until the manager resolves', () => {
  assert.equal(managerFactParts(null), null)
})
