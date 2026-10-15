// scripts/layout/check-z-index.mjs rejects a raw z-index above 3 (#1179). Each
// case feeds a fixture to the guard's scanner: a bad value must fail, a good or
// exempt one must pass.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { findRawZIndex } from '../scripts/layout/check-z-index.mjs'

const z = (src, kind = 'css') => findRawZIndex(src, kind).map((f) => `${f.line}:${f.value}`)

test('a raw value above 3 fails, in CSS and in an inline style', () => {
  assert.deepEqual(z('.a {\n  z-index: 20;\n}\n'), ['2:20'])
  assert.deepEqual(z('.a { z-index:4 }'), ['1:4'])
  assert.deepEqual(z('<div style={{ zIndex: 1000 }} />', 'js'), ['1:1000'])
})

test('3 and below, a negative, a token and a banded calc pass', () => {
  assert.deepEqual(z('.a { z-index: 3; } .b { z-index: 0; } .c { z-index: -1; }'), [])
  assert.deepEqual(z('.a { z-index: var(--z-modal); }'), [])
  assert.deepEqual(z('.a { z-index: calc(var(--z-sticky) - 10); }'), [])
  assert.deepEqual(z('.a { z-index: calc(var(--z-overlay) + 20); }'), [])
  assert.deepEqual(z('.a { z-index: auto; } .b { z-index: inherit !important; }'), [])
  assert.deepEqual(z("<div style={{ zIndex: 'var(--z-toast)' }} />", 'js'), [])
})

test('a calc, a custom property or a quoted number cannot hide a raw layer (#1831)', () => {
  assert.deepEqual(z('.a { z-index: calc(var(--z-modal) + 500); }'), ['1:calc(var(--z-modal) + 500)'])
  assert.deepEqual(z('.a { z-index: calc(var(--z-raised) + 16); }'), ['1:calc(var(--z-raised) + 16)'])
  assert.deepEqual(z('.a { z-index: calc(var(--z-sticky) - 16); }'), ['1:calc(var(--z-sticky) - 16)'])
  assert.deepEqual(z('.a { z-index: calc(1000 + 1); }'), ['1:calc(1000 + 1)'])
  assert.deepEqual(z('.a { z-index: var(--mine); }'), ['1:var(--mine)'])
  assert.deepEqual(z('.a { z-index: var(--z-nope); }'), ['1:var(--z-nope)'])
  assert.deepEqual(z("<div style={{ zIndex: '9999' }} />", 'js'), ['1:9999'])
  assert.deepEqual(z('el.style.zIndex = 50', 'js'), ['1:50'])
  assert.deepEqual(z("el.style.zIndex = 'calc(var(--z-toast) + 5000)'", 'js'), ['1:calc(var(--z-toast) + 5000)'])
  assert.deepEqual(z('<div style={{ zIndex: depth }} />', 'js'), ['1:depth'])
  assert.deepEqual(z("<div style={{ zIndex: 'calc(var(--z-raised) + 1)' }} />", 'js'), [])
  assert.deepEqual(z('if (el.style.zIndex === "5") run()', 'js'), [])
})

test('a comment that quotes a value does not fail', () => {
  assert.deepEqual(z('/* was z-index: 100 */\n.a { z-index: 1; }'), [])
  assert.deepEqual(z('// zIndex: 50 once\nconst a = 1', 'js'), [])
})

test('the exempt marker needs a reason, on the line or the line above', () => {
  assert.deepEqual(z('.a { z-index: 20; /* z-index-exempt: local to the lens */ }'), [])
  assert.deepEqual(z('/* z-index-exempt: local to the lens */\n.a { z-index: 20; }'), [])
  assert.deepEqual(z('.a { z-index: 20; /* z-index-exempt */ }'), ['1:20'])
  assert.deepEqual(z('/* z-index-exempt: a reason */\n\n.a { z-index: 20; }'), ['3:20'])
})

test('layout.css defines every tier the guard tells authors to read', () => {
  const doc = readFileSync(new URL('../src/tokens/layout.css', import.meta.url), 'utf8')
  for (const tier of ['raised', 'sticky', 'overlay', 'modal', 'toast']) {
    assert.match(doc, new RegExp(`--z-${tier}:\\s*\\d+;`), tier)
  }
})
