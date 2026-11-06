// The Appearance preference's resolution rule (src/hooks/preferences/effectiveTheme.js):
// 'system' follows prefers-color-scheme, 'light' / 'dark' override it.
import assert from 'node:assert/strict'
import test from 'node:test'

import { effectiveTheme, themeAttribute } from '../src/hooks/preferences/effectiveTheme.js'

test('system follows prefers-color-scheme', () => {
  assert.equal(effectiveTheme('system', true), 'dark')
  assert.equal(effectiveTheme('system', false), 'light')
})

test('light and dark override the system query', () => {
  assert.equal(effectiveTheme('light', true), 'light')
  assert.equal(effectiveTheme('dark', false), 'dark')
})

test('only a forced theme writes data-theme; system writes nothing', () => {
  assert.equal(themeAttribute('light'), 'light')
  assert.equal(themeAttribute('dark'), 'dark')
  assert.equal(themeAttribute('system'), null)
})
