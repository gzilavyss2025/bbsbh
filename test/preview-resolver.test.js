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

test('a slot the group does not define resolves to empty, never "undefined"', () => {
  // ConsentModal asks for a fixed set of slots and skips the empty ones. A group
  // that never defines one must resolve to '' so the modal omits the paragraph
  // rather than printing the string "undefined" into a consent sheet.
  const resolve = makePreviewResolver('scoresUnlocked', { ...DEFAULTS }, TIME)
  assert.equal(resolve('noSuchSlot'), '')
  assert.equal(DEFAULTS['scoresUnlocked.noSuchSlot'], undefined)
})

test('a null/undefined values map is safe (falls back to defaults)', () => {
  const resolve = makePreviewResolver('scoresUnlocked', null, TIME)
  assert.equal(resolve('title'), DEFAULTS['scoresUnlocked.title'])
  assert.equal(resolve('nope'), '')
})

test('resolves every slot the consent modal reads', () => {
  const resolve = makePreviewResolver('scoresUnlocked', { ...DEFAULTS }, TIME)
  for (const slot of ['title', 'body', 'changesNote', 'humorLine', 'resetNote', 'confirm', 'dismiss']) {
    assert.equal(resolve(slot), fillOf(`scoresUnlocked.${slot}`), `${slot} resolves`)
  }
  function fillOf(id) {
    return DEFAULTS[id].replaceAll('{time}', TIME)
  }
})
