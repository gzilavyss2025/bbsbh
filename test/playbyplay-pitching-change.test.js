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
import { computeHalfInningFeed, nextStepBoundary, defensiveChangeFielder } from '../src/api/playbyplay.js'

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
