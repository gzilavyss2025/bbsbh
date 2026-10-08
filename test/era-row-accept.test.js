// The era-art input offers only what describeEraArt takes: PNG and SVG (#1747).
// A JPEG raw-uploaded (trim off) failed as "not an SVG".

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the era-art file input accepts only PNG and SVG', () => {
  const src = readFileSync(new URL('../src/screens/identity-lab/editors/EraRow.jsx', import.meta.url), 'utf8')
  const accept = src.match(/accept="([^"]*)"/)?.[1]
  assert.equal(accept, 'image/svg+xml,image/png,.svg,.png')
})
