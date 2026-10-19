// Unit coverage for the AdminCopy "View real modal" preview resolver (Task C).
// It must mirror PRODUCTION copy resolution so the preview can never show a
// state the live modal can't: an edited value wins, a blanked box falls back to
// the shipped default (because sanitizeOverrides drops empty overrides on save),
// and an undefined slot resolves to ''. The one group that composes a
// ConsentModal is Stamp In (ADR-0042) since the Scores Unlocked group was
// removed (ADR-0116).
import assert from 'node:assert/strict'
import test from 'node:test'
import { makePreviewResolver } from '../src/copy/previewResolver.js'
import { defaultCopy } from '../src/copy/registry.js'

const DEFAULTS = defaultCopy()

test('a dirty (edited) value wins over the default', () => {
  const values = { ...DEFAULTS, 'stampIn.title': 'Really show them?' }
  const resolve = makePreviewResolver('stampIn', values)
  assert.equal(resolve('title'), 'Really show them?')
})

test('a blanked box falls back to the shipped default (matches drop-empty on save)', () => {
  // The editor leaves an emptied field as '' — production drops it via
  // sanitizeOverrides and renders the default, so the preview must too.
  const values = { ...DEFAULTS, 'stampIn.title': '' }
  const resolve = makePreviewResolver('stampIn', values)
  assert.equal(resolve('title'), DEFAULTS['stampIn.title'])
})

test('a slot the group does not define resolves to empty, never "undefined"', () => {
  // ConsentModal asks for a fixed set of slots and skips the empty ones. A group
  // that never defines one must resolve to '' so the modal omits the paragraph
  // rather than printing the string "undefined" into a consent sheet.
  const resolve = makePreviewResolver('stampIn', { ...DEFAULTS })
  assert.equal(resolve('noSuchSlot'), '')
  assert.equal(DEFAULTS['stampIn.noSuchSlot'], undefined)
})

test('a null/undefined values map is safe (falls back to defaults)', () => {
  const resolve = makePreviewResolver('stampIn', null)
  assert.equal(resolve('title'), DEFAULTS['stampIn.title'])
  assert.equal(resolve('nope'), '')
})

test('resolves every slot the consent modal reads', () => {
  const resolve = makePreviewResolver('stampIn', { ...DEFAULTS })
  for (const slot of ['title', 'body', 'changesNote', 'humorLine', 'resetNote', 'confirm', 'dismiss']) {
    assert.equal(resolve(slot), DEFAULTS[`stampIn.${slot}`] ?? '', `${slot} resolves`)
  }
})
