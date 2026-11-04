// #2878: the SPA's runtime registry leaves the /learn guide prose out; the full
// registry (api/copy.js, api/page.js, AdminCopy) still accepts every learn.* field.
import assert from 'node:assert/strict'
import test from 'node:test'
import * as runtime from '../src/copy/registry.js'
import * as full from '../src/copy/registryFull.js'

const fullIds = new Set(Object.keys(full.defaultCopy()))
const learnId = [...fullIds].find((id) => id.startsWith('learn.'))

test('runtime registry has no learn.* field and no mergeOverrides', () => {
  assert.ok(learnId, 'the full registry has a learn.* id')
  assert.ok(runtime.FIELD_IDS.length > 0)
  assert.ok(!runtime.FIELD_IDS.some((id) => id.startsWith('learn.')))
  assert.deepEqual(runtime.sanitizeOverrides({ [learnId]: 'x' }), {})
  assert.equal('mergeOverrides' in runtime, false)
})

test('full registry (what api/copy.js validates) accepts a learn.* field', () => {
  assert.ok(learnId, 'the full registry has a learn.* id')
  assert.deepEqual(full.mergeOverrides({}, { [learnId]: 'hello' }), { [learnId]: 'hello' })
  assert.deepEqual(full.sanitizeOverrides({ [learnId]: 'hello' }), { [learnId]: 'hello' })
  assert.ok(runtime.FIELD_IDS.every((id) => fullIds.has(id)))
})
