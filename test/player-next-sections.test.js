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

test('the game log button shows the season game total, and stays with no games (the slots decide)', () => {
  assert.equal(jumpSections({}, [hit]).find((s) => s.key === 'game-log').count, 151)
  const none = jumpSections({}, [{ group: 'hitting', seasonGames: 0 }])
  assert.ok(keys(none).includes('game-log'))
  assert.equal(none.find((s) => s.key === 'game-log').count, undefined)
})

test('a two-way player counts the larger of his two game totals, not the sum', () => {
  const log = (blocks) => jumpSections({ twoWay: true }, blocks).find((s) => s.key === 'game-log').count
  assert.equal(log([{ group: 'hitting', seasonGames: 135 }, { group: 'pitching', seasonGames: 14 }]), 135)
  assert.equal(log([{ group: 'hitting', seasonGames: 0 }, { group: 'pitching', seasonGames: 14 }]), 14)
})

test('no season games empties the log and foul-ball slots only: Similar players keeps the section', () => {
  const inst = slotInstances(['hitting'])
  const gone = seedEmpty(inst, [{ group: 'hitting', seasonGames: 0 }])
  assert.deepEqual(
    inst.filter((i) => gone[i.key]).map((i) => i.module),
    ['batlog', 'fouls'],
  )
  assert.ok(keys(shownSections(jumpSections({}, [{ group: 'hitting', seasonGames: 0 }]), inst, gone)).includes('game-log'))
  // With games, nothing is seeded. A two-way player's pitching side is judged by its own block.
  assert.deepEqual(seedEmpty(inst, [hit]), {})
  const two = slotInstances(BOTH)
  const g2 = seedEmpty(two, [hit, { group: 'pitching', seasonGames: 0 }])
  assert.deepEqual(two.filter((i) => g2[i.key]).map((i) => i.module), ['pitchlog', 'pfouls'])
})

test('postseason games keep the log: a call-up with only October games still has one', () => {
  const inst = slotInstances(['hitting'])
  const october = [{ group: 'hitting', seasonGames: 0, postseason: { games: 3, tiles: [] } }]
  assert.deepEqual(seedEmpty(inst, october), {})
})

test('a pitcher with no stat block yet still gets the pitcher bar, with no counts', () => {
  const list = jumpSections({ isPitcher: true }, [])
  assert.ok(keys(list).includes('pitches'))
  assert.ok(list.every((s) => s.count === undefined))
})

// ---- module wiring (#1884): every slot pre-wired, which buttons show ----
import { SLOTS, rolesOf, seedEmpty, shownSections, slotInstances } from '../src/screens/player/next/sections.js'

const BOTH = ['hitting', 'pitching']

test('the slots are the 31 module folders, with each section holding its modules in order', () => {
  assert.deepEqual(
    [...new Set(SLOTS.map((s) => s.module))].sort(),
    ['advanced', 'arsenal', 'awards', 'batlog', 'command', 'contact', 'contract', 'firsts', 'form', 'fouls', 'highlights', 'innings', 'milestones', 'mound', 'moves', 'path', 'percentile', 'pform', 'pfouls', 'photos', 'pitchlog', 'plate', 'prospect', 'prospects', 'runvalue', 'season', 'similar', 'splits', 'target', 'tbd', 'teams'],
  )
  const at = (section) => SLOTS.filter((s) => s.section === section).map((s) => s.module)
  assert.deepEqual(at('season'), ['season', 'percentile', 'advanced', 'runvalue', 'tbd'])
  assert.deepEqual(at('career'), ['path', 'prospects', 'prospect', 'tbd'])
  assert.deepEqual(at('history'), ['firsts', 'innings', 'awards', 'contract', 'teams', 'moves', 'photos', 'highlights', 'tbd'])
  assert.deepEqual(at('form-trend'), ['form', 'pform'])
  assert.deepEqual(at('on-the-mound'), ['mound', 'command', 'target', 'tbd'])
  assert.equal(new Set(SLOTS.map((s) => s.id)).size, SLOTS.length)
})

test('the Game log section runs logs, foul balls, similar players, milestones, then the tbd slot', () => {
  assert.deepEqual(SLOTS.filter((s) => s.section === 'game-log').map((s) => s.module), ['batlog', 'pitchlog', 'pfouls', 'fouls', 'similar', 'milestones', 'tbd'])
})

test('the tbd slots for the pitcher boards: On the mound for a pitcher only, Game log for both', () => {
  const tbd = (r) => slotInstances(r).filter((i) => i.module === 'tbd').map((i) => i.id)
  assert.deepEqual(tbd(['hitting']), ['tbd-season', 'tbd-gamelog', 'tbd-career', 'tbd-history'])
  assert.deepEqual(tbd(['pitching']), ['tbd-season', 'tbd-gamelog', 'tbd-mound', 'tbd-career', 'tbd-history'])
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
  assert.equal(history.length, 9)
})

test('a once slot gets one instance for a two-way player, with no role suffix; a pitcher-only slot is not once', () => {
  const two = slotInstances(BOTH)
  for (const id of ['runvalue', 'awards', 'teams', 'moves', 'photos', 'highlights']) {
    const mine = two.filter((i) => i.id === id)
    assert.equal(mine.length, 1, id)
    assert.equal(mine[0].role, 'hitting', id)
    assert.ok(!mine[0].label.includes('·'), id)
  }
  assert.equal(slotInstances(['pitching']).find((i) => i.id === 'awards').role, 'pitching')
  // A slot that is not once still doubles: Percentile rank per role, with the suffix.
  assert.deepEqual(two.filter((i) => i.id === 'percentile').map((i) => i.label), ['Percentile rank · Batting', 'Percentile rank · Pitching'])
})

test('the pitcher slots: Command, Target command and Foul balls (pitching) are pitcher-only', () => {
  assert.deepEqual(slotInstances(['hitting']).filter((i) => ['command', 'target', 'pfouls'].includes(i.id)), [])
  assert.deepEqual(slotInstances(['pitching']).filter((i) => ['command', 'target', 'pfouls'].includes(i.id)).map((i) => i.id), ['pfouls', 'command', 'target'])
})

test('a two-way player tells the two Foul balls cards apart; a one-way player keeps the bare name', () => {
  const two = slotInstances(BOTH)
  assert.equal(two.find((i) => i.id === 'fouls').label, 'Foul balls · Batting')
  assert.equal(two.find((i) => i.id === 'pfouls').label, 'Foul balls · Pitching')
  assert.equal(slotInstances(['hitting']).find((i) => i.id === 'fouls').label, 'Foul balls')
  assert.equal(slotInstances(['pitching']).find((i) => i.id === 'pfouls').label, 'Foul balls')
})

test('pairs: Innings beside Awards, Photos beside Highlights; no other slot is paired', () => {
  const pairs = SLOTS.filter((s) => s.pair).map((s) => `${s.id}:${s.pair}`)
  assert.deepEqual(pairs, ['innings:a', 'awards:b', 'photos:a', 'highlights:b'])
  // Each b follows its a directly in the history order.
  const h = SLOTS.filter((s) => s.section === 'history').map((s) => s.id)
  assert.equal(h[h.indexOf('innings') + 1], 'awards')
  assert.equal(h[h.indexOf('photos') + 1], 'highlights')
  // The instance keeps the hint, so Slot can draw it.
  assert.equal(slotInstances(['hitting']).find((i) => i.id === 'awards').pair, 'b')
})

// ---- "not built yet" is not "no data" ----
import { readFileSync } from 'node:fs'

test('with every slot a stub, all nine batter buttons show', () => {
  const sections = jumpSections({ isPitcher: false }, [hit])
  const shown = shownSections(sections, slotInstances(['hitting']), {})
  assert.equal(shown.length, 9)
  assert.deepEqual(keys(shown), keys(sections))
})

// Modules an issue has built: real modules, which may return null and call onEmpty when
// they have no data. Add a module here in the PR that builds it; every other module must
// still be a stub.
const BUILT = new Set(['tbd', 'similar', 'prospects', 'prospect', 'innings', 'contract', 'mound', 'form', 'season', 'firsts', 'pform', 'path', 'splits', 'contact', 'fouls', 'arsenal', 'pitchlog', 'plate', 'batlog', 'runvalue', 'percentile', 'target', 'advanced', 'milestones', 'awards', 'command', 'moves', 'teams', 'photos', 'pfouls', 'highlights'])

// A stub renders nothing, so Slot's probe hides its card (and a section whose every slot is a
// stub loses its button) until the issue builds it: the live page never shows a "loads here"
// line (decided 2026-10-14, before the swap #2040 makes this page the live one).
test('a stub module renders nothing, so its card stays hidden until its issue builds it', () => {
  for (const slot of SLOTS.filter((s) => !BUILT.has(s.module))) {
    const src = readFileSync(new URL(`../src/screens/player/next/modules/${slot.module}/index.jsx`, import.meta.url), 'utf8')
    assert.match(src, /return null/, `${slot.module} renders something`)
    assert.ok(!/<[a-z]/.test(src), `${slot.module} draws markup`)
  }
})

// ---- the hero's age fact and the tiles' rank marks (heroData.js) ----
import { ageFact, rankFor } from '../src/screens/player/next/heroData.js'

test('the Age fact: a birthday flip for a living player, "Age at retirement" and no flip for a retired one', () => {
  assert.deepEqual(ageFact({ age: 26, birthDate: '1999-05-31' }, null), { label: 'Age', value: 26, flip: true })
  assert.deepEqual(ageFact({ age: 26 }, null), { label: 'Age', value: 26, flip: false })
  assert.deepEqual(ageFact({ age: 41, birthDate: '1985-01-01' }, { state: 'retired', retiredAge: 38 }), {
    label: 'Age at retirement',
    value: 38,
    flip: false,
  })
  assert.equal(ageFact({ age: 41 }, { state: 'retired' }).value, '—')
  // A free agent who has not retired still shows his age.
  assert.equal(ageFact({ age: 33, birthDate: '1993-01-01' }, { state: 'free-agent' }).label, 'Age')
})

test('a rank mark belongs to the tile its label names, W-L included', () => {
  const marks = [
    { key: 'wins', label: 'W–L', rank: 3, of: 473 },
    { key: 'era', label: 'ERA', rank: 1, of: 20 },
    { key: 'whip', label: 'WHIP', rank: 2, of: 20 },
  ]
  assert.deepEqual(rankFor(marks, 'W–L'), { rank: 3, of: 473 })
  assert.deepEqual(rankFor(marks, 'ERA'), { rank: 1, of: 20 })
  assert.equal(rankFor(marks, 'IP'), undefined)
  assert.equal(rankFor(undefined, 'ERA'), undefined)
})

// ---- the top cards (heroData.js): when each one hides ----
import { hasExtras, headerExtras } from '../src/screens/player/next/heroData.js'

const bio = { id: 1 }
const hitRating = { ovr: 70, bars: { power: 70, contact: 65, speed: 50, fielding: 60 } }

test('header extras hide with nothing to show, and show for any one of the five', () => {
  assert.equal(headerExtras({ bio }, null), null)
  assert.equal(headerExtras({ bio: { ...bio, nickname: 'Shohei' } }, null).nickname, 'Shohei')
  assert.equal(headerExtras({ bio, prospectRank: 4 }, null).rank, 4)
  assert.equal(headerExtras({ bio, orgProspectRank: 9 }, null).orgRank, 9)
  assert.equal(headerExtras({ bio: { ...bio, education: 'Rice' } }, null).education, 'Rice')
  const x = headerExtras({ bio }, { hitting: hitRating })
  assert.equal(x.bars[0].group, 'hitting')
  assert.ok(x.bars[0].rows.length > 0)
})

test('a minor leaguer (an OVR with no bars) adds no OVR bars', () => {
  assert.equal(headerExtras({ bio }, { hitting: { ovr: 55, level: 12 } }), null)
})

test('overview extras: a block counts for ranks, a postseason row or other levels, not for empty lists', () => {
  assert.equal(hasExtras({ ranks: [], otherLevels: [] }), false)
  assert.equal(hasExtras({}), false)
  assert.equal(hasExtras({ ranks: [{ league: 'NL' }] }), true)
  assert.equal(hasExtras({ postseason: { games: 3, tiles: [] } }), true)
  assert.equal(hasExtras({ otherLevels: [{ sportId: 11 }] }), true)
})
