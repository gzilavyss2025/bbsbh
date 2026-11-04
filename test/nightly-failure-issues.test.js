// The nightly job's failure issues: one open needs-triage issue per failing
// step, a comment when it fails again, closed the first night it passes. A
// step the input gates skipped proves nothing either way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planIssues, titleFor } from '../scripts/nightly/failure-issues.mjs'

const ALL = { has: () => true } // every step gated, as when the note logic is not under test
const steps = (o) => Object.fromEntries(Object.entries(o).map(([id, outcome]) => [id, { outcome }]))

test('a new failure opens an issue', () => {
  assert.deepEqual(planIssues(steps({ tensest: 'failure', war: 'success' }), [], ALL), { open: ['tensest'], comment: [], close: [], note: [] })
})

test('a failure that already has an open issue is a comment, not a second issue', () => {
  const open = [{ number: 7, title: titleFor('tensest') }]
  assert.deepEqual(planIssues(steps({ tensest: 'failure' }), open, ALL), { open: [], comment: [{ id: 'tensest', number: 7 }], close: [], note: [] })
})

test('a pass closes its open issue; a skipped step leaves it open with one note', () => {
  const open = [{ number: 7, title: titleFor('tensest') }, { number: 8, title: titleFor('spray') }]
  assert.deepEqual(planIssues(steps({ tensest: 'success', spray: 'skipped' }), open, ALL), { open: [], comment: [], close: [{ id: 'tensest', number: 7 }], note: [{ id: 'spray', number: 8 }] })
})

test('a skipped step whose issue already carries the note is not noted again', () => {
  const open = [{ number: 8, title: titleFor('spray'), noted: true }]
  assert.deepEqual(planIssues(steps({ spray: 'skipped' }), open, ALL), { open: [], comment: [], close: [], note: [] })
})

test('an unrelated open issue is never touched', () => {
  assert.deepEqual(planIssues(steps({ war: 'success' }), [{ number: 9, title: 'Explore moving nightly data out of git' }], ALL), { open: [], comment: [], close: [], note: [] })
})

test('failedSteps lists every step that failed, whatever its id, and nothing that passed or was skipped', async () => {
  const { failedSteps } = await import('../scripts/nightly/failure-issues.mjs')
  // A step added to the workflow fails the job without being listed anywhere: the
  // hand-kept 60-line `if:` this replaced missed new generators twice (workflow header).
  assert.deepEqual(failedSteps(steps({ war: 'success', 'brand-new-gen': 'failure', spray: 'skipped', freshness: 'failure' })), ['brand-new-gen', 'freshness'])
})

test('the gate note goes only on a step the input gates own, not one its producer skipped', () => {
  const open = [{ number: 8, title: titleFor('spray') }, { number: 9, title: titleFor('salaries') }]
  // salaries is skipped because player-contracts failed: its `if:` names a producer, not a gate.
  assert.deepEqual(planIssues(steps({ spray: 'skipped', salaries: 'skipped' }), open, new Set(['spray'])).note, [{ id: 'spray', number: 8 }])
})

test('a failed input-gate step does not fail the job: the gates fail open by design', async () => {
  const { failedSteps } = await import('../scripts/nightly/failure-issues.mjs')
  assert.deepEqual(failedSteps(steps({ inputs: 'failure', war: 'success' })), [])
  assert.deepEqual(failedSteps(steps({ inputs: 'failure', war: 'failure' })), ['war'])
})
