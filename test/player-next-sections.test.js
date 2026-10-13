// The new player page's jump-bar sections (src/screens/player/next/sections.js, #1884).
import test from 'node:test'
import assert from 'node:assert/strict'
import { jumpSections } from '../src/screens/player/next/sections.js'

const keys = (list) => list.map((s) => s.key)
const hit = { group: 'hitting', seasonGames: 151 }
const pit = { group: 'pitching', seasonGames: 22 }

test('a batter gets the nine batter sections, in order', () => {
  assert.deepEqual(
    jumpSections({ isPitcher: false }, [hit]).map((s) => s.label),
    ['Overview', 'Season', 'Splits', 'Plate approach', 'Contact', 'Form trend', 'Game log', 'Career', 'History'],
  )
})

test('a pitcher gets the pitcher bar', () => {
  assert.deepEqual(
    jumpSections({ isPitcher: true }, [pit]).map((s) => s.label),
    ['Overview', 'Season', 'Pitches', 'Splits', 'On the mound', 'Form trend', 'Game log', 'Career', 'History'],
  )
})

test('a two-way player gets the batter sections, then the pitcher-only ones', () => {
  const list = keys(jumpSections({ isPitcher: true, twoWay: true }, [hit, pit]))
  assert.equal(list.length, 11)
  assert.deepEqual(list.slice(-2), ['pitches', 'on-the-mound'])
  assert.equal(new Set(list).size, list.length)
})

test('the game log shows its season game total, and hides when no block has games', () => {
  assert.equal(jumpSections({}, [hit]).find((s) => s.key === 'game-log').count, 151)
  assert.ok(!keys(jumpSections({}, [{ group: 'hitting', seasonGames: 0 }])).includes('game-log'))
  assert.ok(keys(jumpSections({}, [{ group: 'hitting', seasonGames: 0 }, pit])).includes('game-log'))
})

test('a pitcher with no stat block yet still gets the pitcher bar, with no counts', () => {
  const list = jumpSections({ isPitcher: true }, [])
  assert.ok(keys(list).includes('pitches'))
  assert.ok(list.every((s) => s.count === undefined))
})

// ---- module wiring (#1884): every slot pre-wired, which buttons show ----
import { SLOTS, rolesOf, shownSections, slotInstances } from '../src/screens/player/next/sections.js'

const BOTH = ['hitting', 'pitching']

test('the slots are the 18 module folders, with each section holding its modules in order', () => {
  assert.deepEqual(
    [...new Set(SLOTS.map((s) => s.module))].sort(),
    ['arsenal', 'batlog', 'contact', 'contract', 'firsts', 'form', 'fouls', 'innings', 'mound', 'path', 'pform', 'pitchlog', 'plate', 'prospects', 'season', 'similar', 'splits', 'tbd'],
  )
  const at = (section) => SLOTS.filter((s) => s.section === section).map((s) => s.module)
  assert.deepEqual(at('season'), ['season', 'tbd'])
  assert.deepEqual(at('career'), ['path', 'prospects', 'tbd'])
  assert.deepEqual(at('history'), ['firsts', 'innings', 'contract', 'tbd'])
  assert.deepEqual(at('form-trend'), ['form', 'pform'])
  assert.equal(new Set(SLOTS.map((s) => s.id)).size, SLOTS.length)
})

test('the Game log section ends with foul balls, then similar players', () => {
  assert.deepEqual(SLOTS.filter((s) => s.section === 'game-log').map((s) => s.module), ['batlog', 'pitchlog', 'fouls', 'similar'])
})

test('the batter Form trend and the pitcher Form trend are two modules', () => {
  const form = (r) => slotInstances([r]).filter((i) => i.section === 'form-trend').map((i) => i.module)
  assert.deepEqual(form('hitting'), ['form'])
  assert.deepEqual(form('pitching'), ['pform'])
})

test('every slot sits in a section its roles have a button for', () => {
  const batter = keys(jumpSections({}, [hit]))
  const pitcher = keys(jumpSections({ isPitcher: true }, [pit]))
  for (const s of SLOTS) {
    if (s.roles.includes('hitting')) assert.ok(batter.includes(s.section), s.id)
    if (s.roles.includes('pitching')) assert.ok(pitcher.includes(s.section), s.id)
  }
})

test('rolesOf reads the blocks, then the bio', () => {
  assert.deepEqual(rolesOf({}, [hit]), ['hitting'])
  assert.deepEqual(rolesOf({}, [hit, pit]), BOTH)
  assert.deepEqual(rolesOf({ isPitcher: true }, []), ['pitching'])
})

test('a slot for both roles gets one instance per role the player has; a one-role slot only its own', () => {
  const season = slotInstances(['hitting', 'pitching']).filter((i) => i.id === 'season')
  assert.deepEqual(season.map((i) => i.role), BOTH)
  assert.notEqual(season[0].key, season[1].key)
  assert.notEqual(season[0].label, season[1].label)
  const pitcher = slotInstances(['pitching'])
  assert.ok(pitcher.every((i) => i.role === 'pitching'))
  assert.ok(!pitcher.some((i) => i.id === 'plate'))
  assert.equal(pitcher.find((i) => i.id === 'season').label, 'Season')
})

test('a button hides only when every slot in its section is empty', () => {
  const sections = [{ key: 'overview' }, { key: 'career' }, { key: 'history' }]
  const inst = slotInstances(['hitting'])
  const career = inst.filter((i) => i.section === 'career')
  const history = inst.filter((i) => i.section === 'history')
  // Nothing reported yet: every button stays. The Overview has no slot, so it always stays.
  assert.deepEqual(keys(shownSections(sections, inst, {})), ['overview', 'career', 'history'])
  // One of several empty: the section stays.
  assert.deepEqual(keys(shownSections(sections, inst, { [career[0].key]: true })), ['overview', 'career', 'history'])
  // Both empty: it goes.
  const gone = Object.fromEntries(career.map((i) => [i.key, true]))
  assert.deepEqual(keys(shownSections(sections, inst, gone)), ['overview', 'history'])
  assert.equal(history.length, 4)
})

// ---- "not built yet" is not "no data" ----
import { readFileSync } from 'node:fs'

test('with every slot a stub, all nine batter buttons show', () => {
  const sections = jumpSections({ isPitcher: false }, [hit])
  const shown = shownSections(sections, slotInstances(['hitting']), {})
  assert.equal(shown.length, 9)
  assert.deepEqual(keys(shown), keys(sections))
})

test('a stub module renders its placeholder line: it never returns null or calls onEmpty', () => {
  for (const slot of SLOTS) {
    const src = readFileSync(new URL(`../src/screens/player/next/modules/${slot.module}/index.jsx`, import.meta.url), 'utf8')
    assert.ok(!/return null/.test(src), `${slot.module} returns null`)
    assert.ok(!/onEmpty\(/.test(src), `${slot.module} calls onEmpty`)
  }
})
