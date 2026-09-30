// A pitching change announced BEFORE a half's first pitch must not double up
// in the UI: HalfInning.jsx already shows it via its persistent "Now Pitching"
// card (selectHalfStartingPitcher reads the same matchup.pitcher), so
// computeHalfInningFeed must not also push it as its own leading 'event' entry
// — that duplicated the same headshot card once the half was revealed/stepped
// into (the persistent header stays up regardless of reveal state, unlike the
// staged pre-pitch list PrePitchChanges already excludes this case from — see
// its own doc in HalfInning.jsx). A genuine MID-half change — after the half's
// first pitch has actually been thrown — must still get its own card.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { runnerPitchLabel } from '../src/api/playbyplay/runnerNotes.js'
import {
  computeHalfInningFeed,
  nextStepBoundary,
  defensiveChangeFielder,
  focusWindows,
  windowReliefPitcherId,
} from '../src/api/playbyplay.js'

test('a pre-first-pitch pitching change is dropped from the half feed (no duplicate card)', () => {
  // Top 2 (mini-game.js): the home reliever (#201) enters before the half's
  // first pitch, alongside a defensive sub and a pinch-hitter announced the
  // same way.
  const entries = computeHalfInningFeed(buildFeed(), 2, 'top', 'away')
  const subEvents = entries.filter((e) => e.kind === 'event' && e.eventType === 'pitching_substitution')
  assert.deepEqual(subEvents, [])

  // The other pre-pitch stoppage (the defensive sub) is unaffected — only the
  // pitching change is deduplicated against the persistent header card.
  const defEvents = entries.filter((e) => e.kind === 'event' && e.eventType === 'defensive_substitution')
  assert.equal(defEvents.length, 1)
  assert.equal(defEvents[0].playerId, 20)
})

test('a genuine mid-half pitching change still gets its own card', () => {
  const feed = buildFeed()
  // Bottom 2: away's #300 already threw a pitch to the half's first batter
  // (id 14) before this synthetic mid-half relief appearance, announced
  // leading the next play (id 16) — same nesting the real feed uses.
  const bottom2 = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 16,
  )
  bottom2.playEvents.unshift({
    details: { eventType: 'pitching_substitution', description: 'Pitching Change' },
    position: { abbreviation: 'P' },
    player: { id: 301 },
  })

  const entries = computeHalfInningFeed(feed, 2, 'bottom', 'home')
  const subEvents = entries.filter((e) => e.kind === 'event' && e.eventType === 'pitching_substitution')
  assert.equal(subEvents.length, 1)
  assert.equal(subEvents[0].playerId, 301)
})

// ---- which STEP a mid-half stoppage belongs to ------------------------------
//
// The feed nests a stoppage at the head of the plate appearance that FOLLOWS
// it (655 of the 678 substitution/mound-visit playEvents in a three-day MLB
// sweep sit before their play's first pitch; none trail after its last). So
// "the notes between two at-bat cards" are the announcements made after the
// earlier at-bat ended — a scorer pencils them the moment he finishes charting
// that batter, before seeing what the new pitcher does to the next one. A step
// therefore runs at-bat-then-its-trailing-notes, not leading-notes-then-at-bat.

// The half's bottom-2 plays with a relief appearance announced ahead of batter
// #16, and a mound visit DURING batter #17's at-bat (between his two pitches).
function bottom2WithStoppages() {
  const feed = buildFeed()
  const play = (batterId) =>
    feed.liveData.plays.allPlays.find(
      (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === batterId,
    )
  play(16).playEvents.unshift({
    details: { eventType: 'pitching_substitution', description: 'Pitching Change' },
    position: { abbreviation: 'P' },
    player: { id: 301 },
  })
  const p17 = play(17)
  p17.playEvents = [
    p17.playEvents[0],
    { details: { eventType: 'mound_visit', description: 'Mound Visit.' } },
    { isPitch: true, pitchNumber: 2, details: { call: { code: 'X' } } },
  ]
  return feed
}

test('a stoppage announced between at-bats steps with the at-bat BEFORE it', () => {
  const entries = computeHalfInningFeed(bottom2WithStoppages(), 2, 'bottom', 'home')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Nash', 'atbat:Ott', 'event:pitching_substitution', 'atbat:Pena', 'event:mound_visit', 'atbat:Quin'],
  )
  // Nash alone.
  assert.equal(nextStepBoundary(entries, 0), 1)
  // Ott AND the change announced after him — one tap, so the change is on the
  // page before the new pitcher's first batter is.
  assert.equal(nextStepBoundary(entries, 1), 3)
  // Pena alone: the mound visit after him happened DURING Quin's at-bat, so it
  // belongs to Quin's step, not Pena's.
  assert.equal(nextStepBoundary(entries, 3), 4)
  // …and that visit leads Quin's step, the way a leading note always has.
  assert.equal(nextStepBoundary(entries, 4), entries.length)
})

test('a stoppage between pitches is marked as belonging to its own at-bat', () => {
  const entries = computeHalfInningFeed(bottom2WithStoppages(), 2, 'bottom', 'home')
  const change = entries.find((e) => e.eventType === 'pitching_substitution')
  const visit = entries.find((e) => e.eventType === 'mound_visit')
  // The change led its play (no pitch thrown to Pena yet) — it reports the
  // half's previous at-bat. The visit came between Quin's pitches.
  assert.equal(change.midAtBat, false)
  assert.equal(visit.midAtBat, true)
})

// ---- the "now playing {position}" phrase ------------------------------------

test('a switch to DH still says what he switched to', () => {
  // A defensive SWITCH can move a fielder to DH — 8 of them in a three-day MLB
  // sweep (Rosario, Cowser, Muncy, Polanco…). POSITION_LOWER covers the nine
  // fielding spots because "a DH never takes the field", which is true and
  // beside the point: the card still has to name the slot he moved INTO, and
  // without an entry it rendered "Now playing for the Orioles" with the
  // position silently missing.
  const fielder = defensiveChangeFielder(buildFeed(), 20, 'DH')
  assert.equal(fielder.position, 'designated hitter')
})

test('an unknown position abbreviation still degrades to no phrase', () => {
  // Not every abbreviation is a place on the field ('PH' shows up on odd
  // substitution rows) — those keep falling back to the bare "Now playing for
  // the …" rather than inventing a position.
  assert.equal(defensiveChangeFielder(buildFeed(), 20, 'PH').position, '')
  assert.equal(defensiveChangeFielder(buildFeed(), 20, '').position, '')
})

test('the half-leading notes still bundle FORWARD with the first at-bat', () => {
  // Top 2's subs are announced before the half's first pitch, so there is no
  // earlier at-bat to hang them on — they open the half's first step, exactly
  // as before.
  const entries = computeHalfInningFeed(buildFeed(), 2, 'top', 'away')
  assert.equal(entries[0].kind, 'event')
  const firstAtBat = entries.findIndex((e) => e.kind === 'atbat')
  assert.equal(nextStepBoundary(entries, 0), firstAtBat + 1)
})

// ---- a steal belongs to the at-bat it happened in ---------------------------
//
// Unlike a substitution, a steal is not an announcement made once the earlier
// batter was retired: the runner goes while the NEXT batter is at the plate, so
// it is part of that at-bat. The feed still nests it at the head of that
// batter's play, before his first pitch, which used to read as "trailing the
// previous at-bat" — so "Reveal next at-bat" put the steal on the page of a
// batter who had nothing to do with it.
function bottom2WithSteal() {
  const feed = buildFeed()
  const pena = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 16,
  )
  pena.playEvents.unshift({
    details: { eventType: 'stolen_base_2b', description: 'Ned Nash steals (1) 2nd base.' },
    player: { id: 14 },
  })
  return feed
}

test('a steal announced ahead of the first pitch still belongs to the batter at the plate', () => {
  const entries = computeHalfInningFeed(bottom2WithSteal(), 2, 'bottom', 'home')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Nash', 'atbat:Ott', 'event:stolen_base_2b', 'atbat:Pena', 'atbat:Quin'],
  )
  assert.equal(entries.find((e) => e.eventType === 'stolen_base_2b').midAtBat, true)
  // Ott alone — then the steal rides with Pena's tap, not Ott's.
  assert.equal(nextStepBoundary(entries, 1), 2)
  assert.equal(nextStepBoundary(entries, 2), 4)
})

// ---- the reliever's card is repeated on the first batter he faces -----------

test('the first batter a reliever faces carries who relieved', () => {
  const entries = computeHalfInningFeed(bottom2WithStoppages(), 2, 'bottom', 'home')
  const byName = Object.fromEntries(entries.filter((e) => e.kind === 'atbat').map((e) => [e.batter.last, e]))
  assert.equal(byName.Pena.reliefPitcherId, 301)
  // Only the FIRST batter — Quin faces him too, but the card is an entrance, not a header.
  assert.equal(byName.Quin.reliefPitcherId ?? null, null)
  assert.equal(byName.Ott.reliefPitcherId ?? null, null)
})

test('a change between pitches leads its own at-bat, so that at-bat does not repeat it', () => {
  const feed = buildFeed()
  const pena = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 16,
  )
  pena.playEvents = [
    pena.playEvents[0],
    {
      details: { eventType: 'pitching_substitution', description: 'Pitching Change' },
      position: { abbreviation: 'P' },
      player: { id: 301 },
    },
    ...pena.playEvents.slice(1),
  ]
  const entries = computeHalfInningFeed(feed, 2, 'bottom', 'home')
  const change = entries.find((e) => e.eventType === 'pitching_substitution')
  assert.equal(change.midAtBat, true)
  assert.equal(entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Pena').reliefPitcherId ?? null, null)
})

test('the half-opening change is the persistent header’s, never a repeat on the first batter', () => {
  const entries = computeHalfInningFeed(buildFeed(), 2, 'top', 'away')
  for (const e of entries.filter((x) => x.kind === 'atbat')) assert.equal(e.reliefPitcherId ?? null, null)
})

test('windowReliefPitcherId reads the relief off the window’s own at-bat', () => {
  const entries = computeHalfInningFeed(bottom2WithStoppages(), 2, 'bottom', 'home')
  const wins = focusWindows(entries, entries.length)
  assert.deepEqual(
    wins.map((w) => windowReliefPitcherId(entries.slice(w.start, w.end))),
    [null, null, 301, null],
  )
})

// ---- which pitch a steal / caught stealing / pickoff came on ----------------
//
// The feed logs the action directly AFTER the pitch the runner went on (sampled
// 2026-09-25..27, MLB: 49 of 49 sat after at least one pitch), so the pitches
// thrown before it are its number.

function bottom2WithEventAfterPitches(eventType, pitchesBefore) {
  const feed = buildFeed()
  const pena = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 16,
  )
  // Three called balls then the ball in play, so there is always a pitch on
  // both sides of the event.
  const pitches = ['B', 'B', 'B', 'X'].map((code, i) => ({
    isPitch: true,
    pitchNumber: i + 1,
    details: { call: { code } },
  }))
  pena.playEvents = [
    ...pitches.slice(0, pitchesBefore),
    { details: { eventType, description: 'Ned Nash runs.' }, player: { id: 14 } },
    ...pitches.slice(pitchesBefore),
  ]
  return feed
}
const labelOf = (feed, eventType) =>
  computeHalfInningFeed(feed, 2, 'bottom', 'home').find((e) => e.eventType === eventType)?.pitchLabel

test('a steal and a caught stealing say which pitch they came on', () => {
  assert.equal(labelOf(bottom2WithEventAfterPitches('stolen_base_2b', 1), 'stolen_base_2b'), 'Pitch 1')
  assert.equal(labelOf(bottom2WithEventAfterPitches('caught_stealing_2b', 2), 'caught_stealing_2b'), 'Pitch 2')
})

test('a pickoff says which pitch it FOLLOWED — it is a throw between pitches', () => {
  assert.equal(labelOf(bottom2WithEventAfterPitches('pickoff_1b', 1), 'pickoff_1b'), 'After pitch 1')
})

test('with no pitch before it there is no pitch to name, except for a pickoff', () => {
  assert.equal(runnerPitchLabel('stolen_base_2b', 0), null)
  assert.equal(runnerPitchLabel('caught_stealing_3b', 0), null)
  assert.equal(runnerPitchLabel('pickoff_2b', 0), 'Before pitch 1')
})

test('only steals, caught stealing and pickoffs carry a pitch label', () => {
  for (const t of ['wild_pitch', 'passed_ball', 'balk', 'mound_visit', undefined]) {
    assert.equal(runnerPitchLabel(t, 3), null, String(t))
  }
})
