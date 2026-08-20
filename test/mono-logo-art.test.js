// scripts/lib/mono-logo-art.mjs's override merge — the half of #767/ADR-0054
// that makes a drawer save actually reach the generated file, on the
// generator's own schedule. readMonoInkStore (file only) is exercised
// indirectly through this; the seam worth pinning is that
// readMonoInkStoreWithOverrides degrades to the plain file on any network
// failure, and merges a fetched override in exactly the way a real page
// render would (applyIdentityOverrides — the same function api/identity.js's
// write-validator uses).

import assert from 'node:assert/strict'
import test from 'node:test'
import { readMonoInkStore, readMonoInkStoreWithOverrides } from '../scripts/lib/mono-logo-art.mjs'

// A team id the committed store carries no entry for, so these tests can't be
// confused by a real club's data drifting under them.
const SCRATCH = '999999'

function withFetch(impl, run) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return run().finally(() => {
    globalThis.fetch = original
  })
}

test('with no override for anyone, the store comes back exactly as the file has it', async () => {
  const file = await readMonoInkStore()
  await withFetch(
    async () => ({ ok: true, json: async () => ({ identity: {} }) }),
    async () => {
      const merged = await readMonoInkStoreWithOverrides()
      assert.deepEqual(merged, file)
    },
  )
})

test('a fetched mono override lands on the club it names, additively across its fields', async () => {
  await withFetch(
    async (url) => {
      assert.match(String(url), /\/api\/identity$/)
      return {
        ok: true,
        json: async () => ({
          identity: {
            [`identity.mono.${SCRATCH}.parts`]: '{"0":"ink"}',
            [`identity.mono.${SCRATCH}.art`]: '5:aaa1111',
          },
        }),
      }
    },
    async () => {
      const merged = await readMonoInkStoreWithOverrides()
      assert.deepEqual(merged[SCRATCH], { parts: { 0: 'ink' }, art: '5:aaa1111' })
    },
  )
})

test('an override for another store, or a malformed value, never reaches mono-ink', async () => {
  await withFetch(
    async () => ({
      ok: true,
      json: async () => ({
        identity: {
          'identity.colors.158.primary': '#111111',
          [`identity.mono.${SCRATCH}.art`]: 'not-a-fingerprint',
        },
      }),
    }),
    async () => {
      const merged = await readMonoInkStoreWithOverrides()
      assert.equal(merged[SCRATCH], undefined)
    },
  )
})

test('a fetch failure, a non-OK response, and a malformed body all degrade to the file alone', async () => {
  const file = await readMonoInkStore()

  await withFetch(
    async () => {
      throw new Error('network down')
    },
    async () => assert.deepEqual(await readMonoInkStoreWithOverrides(), file),
  )

  await withFetch(
    async () => ({ ok: false, status: 501 }),
    async () => assert.deepEqual(await readMonoInkStoreWithOverrides(), file),
  )

  await withFetch(
    async () => ({ ok: true, json: async () => ({ identity: 'not an object' }) }),
    async () => assert.deepEqual(await readMonoInkStoreWithOverrides(), file),
  )
})
