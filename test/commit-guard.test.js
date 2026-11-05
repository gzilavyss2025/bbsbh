import assert from 'node:assert/strict'
import test from 'node:test'
import { assetProblems, metaCommit } from '../scripts/bundle/check-commit-not-in-js.mjs'

// The pure half of the post-build commit guard (#2873); the build itself is
// checked in CI by `npm run check:commit`.
const SHA = 'abcdef0123456789abcdef0123456789abcdef01'

test('metaCommit reads the build-commit tag, and null when it is missing', () => {
  assert.equal(metaCommit(`<head><meta name="build-commit" content="${SHA}"></head>`), SHA)
  assert.equal(metaCommit('<head></head>'), null)
})

test('assetProblems flags the full and the short SHA', () => {
  assert.equal(assetProblems(`const c="${SHA}"`, SHA).length, 1)
  assert.equal(assetProblems('const c=`abcdef0`', SHA).length, 1)
})

test('assetProblems ignores the short SHA inside a longer token', () => {
  assert.deepEqual(assetProblems('import"./x-Zabcdef0q.js";const k=0xabcdef01', SHA), [])
})

test('assetProblems flags the env object a bare import.meta.env read inlines', () => {
  const bare = 'const e={BASE_URL:`/`,DEV:!1,MODE:`production`,PROD:!0,SSR:!1,VITE_VERCEL_URL:`x.vercel.app`}'
  assert.equal(assetProblems(bare, SHA).length, 1)
  assert.deepEqual(assetProblems('const e={MODE:`production`,VITE_PLAYER_PHOTOS:void 0}', SHA), [])
})
