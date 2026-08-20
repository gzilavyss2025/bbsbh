// Two ways the half-inning feed used to misreport what the API actually sent:
// notes from one play rendered out of the order they happened in, and the
// delay advisories never rendered at all.
//
// 1. ORDER. Stoppage notes (mound visit, pitching change, ejection, a
//    substitution) are pushed as the playEvents are scanned; the baserunning
//    events in the same play (a steal, a wild pitch, a balk) were collected and
//    flushed afterwards. So every baserunning event sorted AFTER every stoppage
//    in its play no matter when each happened — 49 plays across an 854-game
//    sweep, and the inversions read as cause and effect reversed:
//      gamePk 823514, bottom 5 — "Spencer Jones scores on a balk" (playEvents
//        index 1) rendered AFTER "Braves manager Walt Weiss ejected" (index 2),
//        i.e. the ejection before the balk the manager was arguing.
//      gamePk 823102, top 3 — a steal (index 2) and a wild pitch (index 6)
//        rendered after the mound visit (index 7) they prompted.
//      gamePk 823753 top 7 and gamePk 824664 bottom 10, same wild-pitch shape.
//
// 2. DELAY ADVISORIES. `game_advisory` playEvents were skipped wholesale
//    because most of them are the feed's own lifecycle bookkeeping ("Status
//    Change - Pre-Game/Warmup/In Progress"). The same eventType also carries
//    the in-game stoppages — "Injury Delay." (444 across the sweep),
//    "On-field Delay." (292), and the weather "Status Change - Delayed…" lines
//    — so the reason a half stopped never appeared anywhere, including the
//    injury delay that explains a pinch-hitter arriving mid-count (gamePk
//    816170's top 1).
//
//    Which of those stoppages is worth a card is a SECOND question, settled
//    later and separately: only the ones that produced a personnel change or
//    ran long enough to matter (ADR-0060, and test/delay-advisory.test.js).
//    The two tests below pin the part this file is about — that a delay which
//    does reach the feed lands in the right place, in the right order.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { isDelayAdvisory } from '../src/api/playbyplay/eventTypes.js'

// Bottom 1's third plate appearance (#12, a strikeout), rewritten to carry a
// balk and then an ejection inside its own playEvents — the gamePk 823514
// shape, with the baserunning event FIRST.
function feedWithBalkThenEjection() {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 12,
  )
  play.playEvents = [
    { isPitch: true, pitchNumber: 1, details: { call: { code: 'C' } } },
    { details: { eventType: 'balk', description: 'Kal Kane scores on a balk.' }, player: { id: 11 } },
    { details: { eventType: 'ejection', description: 'Manager ejected by HP umpire.' } },
    { isPitch: true, pitchNumber: 2, details: { call: { code: 'S' } } },
    { isPitch: true, pitchNumber: 3, details: { call: { code: 'S' } } },
  ]
  return feed
}

const eventOrder = (entries) => entries.filter((e) => e.kind === 'event').map((e) => e.eventType)

test('same-play notes render in the order the feed reports them, not stoppages first', () => {
  const entries = computeHalfInningFeed(feedWithBalkThenEjection(), 1, 'bottom', 'home')
  const balk = entries.findIndex((e) => e.eventType === 'balk')
  const ejection = entries.findIndex((e) => e.eventType === 'ejection')

  assert.ok(balk !== -1, 'the balk still gets its own note')
  assert.ok(ejection !== -1, 'the ejection still gets its own note')
  // playEvents order was balk (index 1) then ejection (index 2).
  assert.ok(balk < ejection, `balk must precede the ejection it caused (got ${balk} vs ${ejection})`)
})

test('the reordered notes still lead the at-bat card they happened inside of', () => {
  const entries = computeHalfInningFeed(feedWithBalkThenEjection(), 1, 'bottom', 'home')
  const lastNote = Math.max(
    entries.findIndex((e) => e.eventType === 'balk'),
    entries.findIndex((e) => e.eventType === 'ejection'),
  )
  const card = entries.findIndex((e) => e.kind === 'atbat' && e.batterId === 12)
  assert.ok(lastNote < card)
})

test("the card's own baserunningNotes are unchanged — callout-notes.js reads them", () => {
  const entries = computeHalfInningFeed(feedWithBalkThenEjection(), 1, 'bottom', 'home')
  const card = entries.find((e) => e.kind === 'atbat' && e.batterId === 12)
  assert.deepEqual(
    card.baserunningNotes.map((n) => n.eventType),
    ['balk'],
  )
})

// Top 1's second plate appearance, interrupted at 0-1 by an injury delay that
// takes the home left fielder out of the game — the gamePk 824319 shape (a
// stoppage and the substitution it caused, side by side, before the next
// pitch). The delay's own `player` is the BATTER, exactly as the feed writes
// it, so this fixture also pins that the note is not carded to him.
function feedWithConsequentialDelay() {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.matchup.batter.id === 2,
  )
  play.playEvents = [
    { isPitch: true, pitchNumber: 1, details: { call: { code: 'C' } } },
    { details: { eventType: 'game_advisory', description: 'Injury Delay.' }, player: { id: 2 } },
    {
      details: {
        eventType: 'defensive_substitution',
        description: 'Defensive Substitution: Tom Toro replaces left fielder Oli Ott.',
      },
      position: { abbreviation: 'LF' },
      player: { id: 20 },
      replacedPlayer: { id: 15 },
    },
    { isPitch: true, pitchNumber: 2, details: { call: { code: 'X' } } },
  ]
  return feed
}

test('a delay advisory becomes its own note, in place', () => {
  const entries = computeHalfInningFeed(feedWithConsequentialDelay(), 1, 'top', 'away')
  const note = entries.find((e) => e.eventType === 'game_advisory')
  assert.ok(note, 'the injury delay must reach the feed')
  assert.equal(note.kind, 'event')
  assert.equal(note.segments.map((s) => s.text).join(''), 'Injury Delay.')
  // It landed between pitches, so it interrupted this at-bat rather than
  // trailing the previous one — which is what decides its step (ADR-0016).
  assert.equal(note.midAtBat, true)
  assert.ok(entries.indexOf(note) < entries.findIndex((e) => e.kind === 'atbat' && e.batterId === 2))
})

test('the delay note leads the substitution it caused, not the other way round', () => {
  const entries = computeHalfInningFeed(feedWithConsequentialDelay(), 1, 'top', 'away')
  const delay = entries.findIndex((e) => e.eventType === 'game_advisory')
  const sub = entries.findIndex((e) => e.eventType === 'defensive_substitution')
  assert.ok(delay !== -1 && sub !== -1)
  assert.ok(delay < sub, `the stoppage must precede its own consequence (got ${delay} vs ${sub})`)
})

test("the feed's lifecycle 'Status Change' advisories stay out of the feed", () => {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.matchup.batter.id === 1,
  )
  play.playEvents.unshift(
    { details: { eventType: 'game_advisory', description: 'Status Change - Pre-Game' }, player: { id: 1 } },
    { details: { eventType: 'game_advisory', description: 'Status Change - Warmup' }, player: { id: 1 } },
    { details: { eventType: 'game_advisory', description: 'Status Change - In Progress' }, player: { id: 1 } },
  )

  const entries = computeHalfInningFeed(feed, 1, 'top', 'away')
  assert.deepEqual(eventOrder(entries).filter((t) => t === 'game_advisory'), [])
})

test('isDelayAdvisory keeps the stoppages and drops the lifecycle transitions', () => {
  for (const kept of [
    'Injury Delay.',
    'On-field Delay.',
    'Coaching visit to mound.',
    'Status Change - Delayed Start: Rain',
    'Status Change - Delayed: Lightning',
  ]) {
    assert.equal(isDelayAdvisory(kept), true, kept)
  }
  for (const dropped of [
    'Status Change - Pre-Game',
    'Status Change - Warmup',
    'Status Change - In Progress',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isDelayAdvisory(dropped), false, String(dropped))
  }
})
