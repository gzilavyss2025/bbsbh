// Unit coverage for the AdminCopy "View real modal" preview resolver (Task C).
// It must mirror PRODUCTION copy resolution so the preview can never show a
// state the live modal can't: an edited value wins, a blanked box falls back to
// the shipped default (because sanitizeOverrides drops empty overrides on save),
// {time} is filled, and an undefined slot resolves to ''.
import assert from 'node:assert/strict'
import test from 'node:test'
import { makePreviewResolver } from '../src/copy/previewResolver.js'
import { defaultCopy } from '../src/copy/registry.js'

const DEFAULTS = defaultCopy()
const TIME = '8:00 AM'

test('a dirty (edited) value wins over the default', () => {
  const values = { ...DEFAULTS, 'scoresUnlocked.title': 'Really show them?' }
  const resolve = makePreviewResolver('scoresUnlocked', values, TIME)
  assert.equal(resolve('title'), 'Really show them?')
})

test('a blanked box falls back to the shipped default (matches drop-empty on save)', () => {
  // The editor leaves an emptied field as '' — production drops it via
  // sanitizeOverrides and renders the default, so the preview must too.
  const values = { ...DEFAULTS, 'scoresUnlocked.title': '' }
  const resolve = makePreviewResolver('scoresUnlocked', values, TIME)
  assert.equal(resolve('title'), DEFAULTS['scoresUnlocked.title'])
})

test('{time} is filled in the resolved text', () => {
  const resolve = makePreviewResolver('scoresUnlocked', { ...DEFAULTS }, TIME)
  const confirm = resolve('confirm') // default: 'Show scores until {time}'
  assert.ok(!confirm.includes('{time}'), 'token substituted')
  assert.ok(confirm.includes(TIME), 'sample time present')
})

test('an undefined slot resolves to empty (ConsentModal then skips it)', () => {
  // scoresUnlocked has no changesNote field — resolving it must be '' so the
  // modal omits the paragraph, never renders "undefined".
  const resolve = makePreviewResolver('scoresUnlocked', { ...DEFAULTS }, TIME)
  assert.equal(resolve('changesNote'), '')
  assert.equal(DEFAULTS['scoresUnlocked.changesNote'], undefined)
})

test('a null/undefined values map is safe (falls back to defaults)', () => {
  const resolve = makePreviewResolver('followLive', null, TIME)
  assert.equal(resolve('title'), DEFAULTS['followLive.title'])
  assert.equal(resolve('nope'), '')
})

test('resolves for either group', () => {
  const resolve = makePreviewResolver('followLive', { ...DEFAULTS }, TIME)
  assert.equal(resolve('body'), fillOf('followLive.body'))
  function fillOf(id) {
    return DEFAULTS[id].replaceAll('{time}', TIME)
  }
})
