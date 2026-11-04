// The nightly job's failure issues: one open needs-triage issue per failing
// step, a comment when it fails again, closed the first night it passes. A
// step the input gates skipped proves nothing either way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planIssues, titleFor } from '../scripts/nightly/failure-issues.mjs'

const steps = (o) => Object.fromEntries(Object.entries(o).map(([id, outcome]) => [id, { outcome }]))

test('a new failure opens an issue', () => {
  assert.deepEqual(planIssues(steps({ tensest: 'failure', war: 'success' }), []), { open: ['tensest'], comment: [], close: [] })
})

test('a failure that already has an open issue is a comment, not a second issue', () => {
  const open = [{ number: 7, title: titleFor('tensest') }]
  assert.deepEqual(planIssues(steps({ tensest: 'failure' }), open), { open: [], comment: [{ id: 'tensest', number: 7 }], close: [] })
})

test('a pass closes its open issue; a skipped step leaves it open', () => {
  const open = [{ number: 7, title: titleFor('tensest') }, { number: 8, title: titleFor('spray') }]
  assert.deepEqual(planIssues(steps({ tensest: 'success', spray: 'skipped' }), open), { open: [], comment: [], close: [{ id: 'tensest', number: 7 }] })
})

test('an unrelated open issue is never touched', () => {
  assert.deepEqual(planIssues(steps({ war: 'success' }), [{ number: 9, title: 'Explore moving nightly data out of git' }]), { open: [], comment: [], close: [] })
})
