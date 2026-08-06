// The one-shot contextual-prompt store (src/lib/account/prompts.js, PRD §6.2).
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_PROMPTS,
  PROMPT_IDS,
  hasSeenPrompt,
  isPromptId,
  markPromptSeen,
  parsePrompts,
  serializePrompts,
} from '../src/lib/account/prompts.js'

test('the three contextual-prompt ids are exactly what the PRD scoped', () => {
  assert.deepEqual(PROMPT_IDS, ['first-stamp', 'third-game', 'scores-unlocked-local'])
})

test('intro-account and settings-pitch are deliberately NOT one-shot ids here', () => {
  // intro-account is governed by its own bbsbh:intro flag; settings-pitch is
  // the one panel allowed to persist. Neither belongs to the generic store.
  assert.equal(isPromptId('intro-account'), false)
  assert.equal(isPromptId('settings-pitch'), false)
})

test('parsePrompts degrades to {} on anything malformed', () => {
  assert.deepEqual(parsePrompts(null), {})
  assert.deepEqual(parsePrompts(undefined), {})
  assert.deepEqual(parsePrompts('not json'), {})
  assert.deepEqual(parsePrompts('[]'), {})
  assert.deepEqual(parsePrompts('"a string"'), {})
  assert.deepEqual(parsePrompts('42'), {})
})

test('parsePrompts drops unknown ids and invalid timestamps, keeps the rest', () => {
  assert.deepEqual(
    parsePrompts(
      JSON.stringify({
        'first-stamp': 100,
        'not-a-real-prompt': 200,
        'third-game': -5,
        'scores-unlocked-local': 1.5,
      }),
    ),
    { 'first-stamp': 100 },
  )
})

test('hasSeenPrompt is false for an absent id and true for a stored one', () => {
  assert.equal(hasSeenPrompt({}, 'first-stamp'), false)
  assert.equal(hasSeenPrompt({ 'first-stamp': 0 }, 'first-stamp'), true)
  assert.equal(hasSeenPrompt(null, 'first-stamp'), false)
})

test('markPromptSeen adds the id with the given clock', () => {
  const next = markPromptSeen({}, 'first-stamp', 12345)
  assert.deepEqual(next, { 'first-stamp': 12345 })
})

test('markPromptSeen returns the SAME reference when already dismissed', () => {
  const map = { 'first-stamp': 100 }
  const next = markPromptSeen(map, 'first-stamp', 999)
  assert.equal(next, map, 'a no-op transform must not allocate a new object')
})

test('markPromptSeen is a no-op for an unknown id', () => {
  const map = { 'first-stamp': 100 }
  const next = markPromptSeen(map, 'not-a-real-prompt', 999)
  assert.equal(next, map)
})

test('the closed id set can never exceed MAX_PROMPTS — the prune branch is a backstop, not a live path', () => {
  // Today's registry has three ids, so `markPromptSeen` can never actually be
  // asked to prune under the CLOSED set — `scrub` (called first) drops
  // anything not in PROMPT_IDS, so a caller cannot smuggle a fourth entry in
  // to force it. This pins that headroom rather than the prune branch itself:
  // MAX_PROMPTS only starts mattering the day PROMPT_IDS grows past it, and
  // this test is what would start failing that day, as a reminder to write a
  // real prune test alongside the growth.
  assert.ok(PROMPT_IDS.length < MAX_PROMPTS, 'PROMPT_IDS must stay under the prune ceiling')
  let map = {}
  for (const id of PROMPT_IDS) map = markPromptSeen(map, id, 1)
  assert.equal(Object.keys(map).length, PROMPT_IDS.length)
})

test('serializePrompts round-trips through parsePrompts, scrubbing on the way out too', () => {
  const dirty = { 'first-stamp': 5, bogus: 10, 'third-game': -1 }
  const json = serializePrompts(dirty)
  assert.deepEqual(parsePrompts(json), { 'first-stamp': 5 })
})

test('serializePrompts on a non-object is the empty document', () => {
  assert.equal(serializePrompts(null), '{}')
  assert.equal(serializePrompts(undefined), '{}')
  assert.equal(serializePrompts([1, 2, 3]), '{}')
})
