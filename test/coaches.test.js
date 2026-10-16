import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coachingStaffFrom } from '../src/api/staff/coaches.js'
import { rangeLabel } from '../src/screens/team/next/roster/coachingData.js'

// Rows in the shape /api/v1/teams/158/coaches?season=2026 returns (checked live, 2026-10-16).
const row = (id, fullName, jerseyNumber, job, jobId, title = job) => ({
  person: { id, fullName },
  jerseyNumber,
  job,
  jobId,
  title,
})

test('one card per person: the feed repeats a coach once per jersey number', () => {
  const staff = coachingStaffFrom([
    row(580268, 'Pat Murphy', '00', 'Manager', 'MNGR'),
    row(580268, 'Pat Murphy', '49', 'Manager', 'MNGR'),
    row(453390, 'Eric Theisen', '85', 'Hitting Coach', 'COAT', 'Lead Hitting Coach'),
  ])
  assert.deepEqual(staff.map((c) => c.id), [580268, 453390])
  assert.equal(staff[0].jersey, '00')
})

test('the role is the specific title, not the job group', () => {
  const [c] = coachingStaffFrom([row(449104, 'Jim Henderson', '71', 'Pitching Coach', 'COAP', 'Major League Pitching Coordinator')])
  assert.equal(c.title, 'Major League Pitching Coordinator')
})

test('a row with no title falls back to its job', () => {
  const [c] = coachingStaffFrom([{ person: { id: 1, fullName: 'A B' }, job: 'Bullpen Coach', jobId: 'COAU' }])
  assert.equal(c.title, 'Bullpen Coach')
  assert.equal(c.jersey, '')
})

test('the feed order is kept, so the staff stays grouped by role', () => {
  const staff = coachingStaffFrom([
    row(1, 'A', '1', 'Hitting Coach', 'COAT'),
    row(2, 'B', '2', 'Pitching Coach', 'COAP'),
    row(3, 'C', '3', 'First Base Coach', 'COA1'),
  ])
  assert.deepEqual(staff.map((c) => c.id), [1, 2, 3])
})

test('the manager leads, and is flagged', () => {
  const staff = coachingStaffFrom([
    row(1, 'A', '1', 'Hitting Coach', 'COAT'),
    row(2, 'B', '2', 'Manager', 'MNGR'),
  ])
  assert.deepEqual(staff.map((c) => [c.id, c.manager]), [[2, true], [1, false]])
})

test('an active interim manager replaces the permanent one, as the box score does', () => {
  const staff = coachingStaffFrom([
    row(10, 'Carlos Mendoza', '64', 'Manager', 'MNGR'),
    row(11, 'Andy Green', '14', 'Interim Manager', 'NTRM'),
    row(12, 'A Coach', '5', 'Hitting Coach', 'COAT'),
  ])
  assert.deepEqual(staff.map((c) => c.id), [11, 12])
})

test('an Associate Manager is not a manager', () => {
  const [c] = coachingStaffFrom([row(7, 'Senior Advisor', '9', 'Associate Manager', 'ASSM')])
  assert.equal(c.manager, false)
})

test('rows with no person id or no name are dropped; nothing in, nothing out', () => {
  assert.deepEqual(coachingStaffFrom([{ person: {}, job: 'Coach' }, { job: 'Coach' }, { person: { id: 5 } }]), [])
  assert.deepEqual(coachingStaffFrom(undefined), [])
  assert.deepEqual(coachingStaffFrom([]), [])
})

test('the position label names the coaches in view', () => {
  assert.equal(rangeLabel(1, 2, 16), '1–2 of 16')
  assert.equal(rangeLabel(15, 16, 16), '15–16 of 16')
  assert.equal(rangeLabel(3, 3, 16), '3 of 16')
  assert.equal(rangeLabel(1, 4, 4), '1–4 of 4')
})
