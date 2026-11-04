// #2878: the SPA's runtime registry leaves the /learn guide prose out; the full
// registry (api/copy.js, api/page.js, AdminCopy) still accepts every learn.* field.
import assert from 'node:assert/strict'
import test from 'node:test'
import * as runtime from '../src/copy/registry.js'
import * as full from '../src/copy/registryFull.js'

test('runtime registry has no learn.* field', () => {
  assert.ok(runtime.FIELD_IDS.length > 0)
  assert.ok(!runtime.FIELD_IDS.some((id) => id.startsWith('learn.')))
  assert.deepEqual(runtime.sanitizeOverrides({ [Object.keys(full.defaultCopy()).find((i) => i.startsWith('learn.'))]: 'x' }), {})
})

test('full registry (what api/copy.js validates) accepts a learn.* field', () => {
  const id = Object.keys(full.defaultCopy()).find((i) => i.startsWith('learn.'))
  assert.ok(id)
  assert.deepEqual(full.mergeOverrides({}, { [id]: 'hello' }), { [id]: 'hello' })
  assert.deepEqual(full.sanitizeOverrides({ [id]: 'hello' }), { [id]: 'hello' })
  assert.ok(runtime.FIELD_IDS.every((i) => Object.keys(full.defaultCopy()).includes(i)))
})
