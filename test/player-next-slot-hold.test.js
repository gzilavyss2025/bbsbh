// Slice 07a of the player-page motion (#2073): a slot holds its height and shows no loading text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SLOTS } from '../src/screens/player/next/sections.js'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = stripComments(read('src/styles/player-next/page.css'))
const slot = read('src/screens/player/next/Slot.jsx')

test('every slot has a [phone, wide] height hint in px', () => {
  for (const s of SLOTS) {
    assert.ok(Array.isArray(s.minH) && s.minH.length === 2, `${s.id} has minH`)
    for (const n of s.minH) assert.ok(Number.isInteger(n) && n >= 0, `${s.id} minH is whole px`)
  }
})

test('the hints are the measured floors', () => {
  const by = Object.fromEntries(SLOTS.map((s) => [s.id, s.minH]))
  assert.deepEqual(by.splits, [1040, 580])
  assert.deepEqual(by.plate, [2480, 1840])
  assert.deepEqual(by.arsenal, [1720, 1180])
  assert.deepEqual(by.path, [240, 240])
  for (const id of ['tbd-season', 'tbd-gamelog', 'tbd-mound', 'tbd-career', 'tbd-history', 'milestones']) {
    assert.deepEqual(by[id], [0, 0], `${id} holds nothing`)
  }
})

test('the hold class reads the two hints', () => {
  assert.equal(ruleBody(page, '.pnext__slot--hold').trim(), 'min-height: var(--slot-hold, 0px);')
  assert.match(page, /@media \(min-width: 740px\)\s*\{\s*\.pnext__slot--hold\s*\{\s*min-height:\s*var\(--slot-hold-wide, 0px\);/)
})

test('the slot shows no loading text and sets the hints', () => {
  assert.doesNotMatch(slot, /Loading \{inst\.label\}/)
  assert.match(slot, /fallback=\{null\}/)
  assert.match(slot, /'--slot-hold': `\$\{phone\}px`/)
  assert.match(slot, /'--slot-hold-wide': `\$\{wide\}px`/)
  assert.match(slot, /pnext__slot--hold/)
})

test('the body rises once per player and slot', () => {
  assert.match(slot, /useInViewOnce\(viewKey\(bio\.id, inst\.key\)\)/)
  assert.match(slot, /riseClass\(phase\)/)
  assert.match(slot, /aria-busy="true"/)
})
