import assert from 'node:assert/strict'
import test from 'node:test'
import { managerFactParts } from '../src/components/team/managerFactParts.js'

test('managerFactParts reads spoken order with a bare number (no #) and asks for a photo', () => {
  const m = managerFactParts({ name: 'Kevin Cash', lastFirst: 'Cash, Kevin', personId: 112, jersey: '16', interim: false })
  assert.deepEqual(m, { personId: 112, name: 'Kevin Cash', jersey: '16', interim: false, photo: true })
})

test('managerFactParts keeps a jersey of "0"', () => {
  assert.equal(managerFactParts({ name: 'A B', personId: 1, jersey: '0' }).jersey, '0')
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

test('seasonOfRun counts the unbroken run with one club, ending at the season asked', async () => {
  const { seasonOfRun } = await import('../src/api/managers.js')
  const row = (teamId, season) => ({ teamId, season, isManager: true })
  const stints = [row(139, 2015), row(139, 2016), row(139, 2017), row(158, 2018), row(139, 2020), row(139, 2021)]
  assert.equal(seasonOfRun(stints, 139, 2017), 3)
  assert.equal(seasonOfRun(stints, 139, 2021), 2) // the return in 2020 starts a new run
  assert.equal(seasonOfRun(stints, 139, 2019), null) // not his club that season
  assert.equal(seasonOfRun([{ teamId: 139, season: 2017, isManager: false }], 139, 2017), null) // a coach, not the manager
})
