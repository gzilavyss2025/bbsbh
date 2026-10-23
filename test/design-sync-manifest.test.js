import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diffManifests, hashDir, manifestText } from '../.design-sync/build/manifest.mjs'

// #2527: the design-sync build's file-hash manifest. A temp folder stands in for a build.
const tree = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-manifest-'))
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), body)
  }
  return dir
}

test('hashDir: one sha256 per file, paths with /, sorted by path, nested files included', () => {
  const h = hashDir(tree({ 'tokens/colors.css': 'a', 'README.md': 'b', 'fonts/x.woff2': 'c' }))
  assert.deepEqual(Object.keys(h), ['README.md', 'fonts/x.woff2', 'tokens/colors.css'])
  assert.match(h['README.md'], /^[0-9a-f]{64}$/)
})

test('hashDir: the same tree twice gives the same manifest text', () => {
  const files = { 'a.css': 'x', 'b/c.css': 'y' }
  assert.equal(manifestText(hashDir(tree(files))), manifestText(hashDir(tree(files))))
})

test('hashDir: a changed byte changes that file and no other', () => {
  const a = hashDir(tree({ 'a.css': 'x', 'b.css': 'y' }))
  const b = hashDir(tree({ 'a.css': 'x', 'b.css': 'z' }))
  assert.equal(a['a.css'], b['a.css'])
  assert.notEqual(a['b.css'], b['b.css'])
})

test('diffManifests: new, changed and removed files; nothing uploaded yet means all new', () => {
  const prev = { 'a.css': '1', 'b.css': '2', 'c.css': '3' }
  const next = { 'a.css': '1', 'b.css': '9', 'd.css': '4' }
  assert.deepEqual(diffManifests(prev, next), { added: ['d.css'], changed: ['b.css'], removed: ['c.css'] })
  assert.deepEqual(diffManifests(null, next), { added: ['a.css', 'b.css', 'd.css'], changed: [], removed: [] })
  assert.deepEqual(diffManifests(next, next), { added: [], changed: [], removed: [] })
})
