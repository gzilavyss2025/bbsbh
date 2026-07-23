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
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

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
