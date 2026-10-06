// The reverse index behind the manager page's coaching-tree band: for each
// manager, who held a coach job on the same club-season (gen-manager-history.mjs
// writes it; src/api/managers.js coachedUnder reads it).
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { buildStaffIndex } from '../scripts/lib/records/manager-staff-index.mjs'
import { coachedUnder } from '../src/api/managers.js'

const mgr = (teamId, season, jobId = 'MNGR') => ({ teamId, season, job: 'Manager', jobId })
const coach = (teamId, season, job = 'Bench Coach') => ({ teamId, season, job, jobId: 'COAB' })

// Two managers share club 1 in 1990 (A fired mid-year, B takes over); the
// bench coach (30) later managed, the pitching coach (31) never did.
const TABLE = {
  10: [mgr(1, 1989), mgr(1, 1990)],
  11: [mgr(1, 1990, 'NTRM'), mgr(1, 1991)],
  30: [coach(1, 1989), coach(1, 1990), mgr(2, 1995)],
  31: [coach(1, 1990, 'Pitching Coach'), coach(1, 1991, 'Pitching Coach')],
  32: [coach(3, 1990)], // another club: attached to nobody
}

test('a shared club-season credits its coaches to both managers', () => {
  const idx = buildStaffIndex(TABLE)
  assert.deepEqual(idx[10], [[30, 2, 1], [31, 1, 0]])
  assert.deepEqual(idx[11], [[31, 2, 0], [30, 1, 1]])
})

test('a manager is never listed as staff, and a club with no manager row adds no key', () => {
  const idx = buildStaffIndex(TABLE)
  assert.equal(idx[10].some(([id]) => id === 11), false)
  assert.equal(32 in idx, false)
})

test('laterManaged needs a manager season at or after the first season together', () => {
  const idx = buildStaffIndex({
    10: [mgr(1, 1990)],
    40: [mgr(2, 1985), coach(1, 1990)], // managed BEFORE coaching under 10
  })
  assert.deepEqual(idx[10], [[40, 1, 0]])
})

test('a person who held two coach jobs in one season counts that season once', () => {
  const idx = buildStaffIndex({
    10: [mgr(1, 1990)],
    50: [coach(1, 1990), coach(1, 1990, 'Hitting Coach')],
  })
  assert.deepEqual(idx[10], [[50, 1, 0]])
})

test('coachedUnder joins the shard, then names the staff; no staff gives []', async () => {
  const shard = { byManagerId: { 10: [[30, 2, 1], [31, 1, 0]] } }
  const f = mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url)
    if (u.includes('manager-staff/10.json')) return Response.json(shard)
    if (u.includes('personIds=30,31')) {
      return Response.json({ people: [{ id: 30, fullName: 'Bench B' }, { id: 31, fullName: 'Pitch P' }] })
    }
    return new Response('{}', { status: 404 })
  })
  assert.deepEqual(await coachedUnder(110), []) // shard 10 has no key 110
  assert.deepEqual(await coachedUnder(10), [
    { personId: 30, name: 'Bench B', seasons: 2, laterManaged: true },
    { personId: 31, name: 'Pitch P', seasons: 1, laterManaged: false },
  ])
  f.mock.restore()
})
