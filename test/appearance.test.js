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

// ADR-0131: a device in dark mode no longer turns night mode on by itself. Until
// the person picks a theme, the page is forced light and the bar offers night mode.
import { NIGHT_SNOOZE_MS, offerNightMode } from '../src/hooks/preferences/effectiveTheme.js'

test('the bar shows only on a dark device with no theme chosen and no live snooze', () => {
  const now = 1_000_000
  assert.equal(offerNightMode({ chosen: false, systemDark: true, snoozedUntil: 0, now }), true)
  assert.equal(offerNightMode({ chosen: false, systemDark: false, snoozedUntil: 0, now }), false)
  assert.equal(offerNightMode({ chosen: true, systemDark: true, snoozedUntil: 0, now }), false)
  assert.equal(offerNightMode({ chosen: false, systemDark: true, snoozedUntil: now + 1, now }), false)
  assert.equal(offerNightMode({ chosen: false, systemDark: true, snoozedUntil: now, now }), true)
})

test('a dismissal snoozes for two days', () => {
  assert.equal(NIGHT_SNOOZE_MS, 2 * 24 * 60 * 60 * 1000)
})
