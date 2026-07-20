import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPitcherNotes, buildMarginNotes } from '../src/api/pitcher-callouts.js'
import { selectHalfStartingPitcher } from '../src/api/select.js'
import { buildFeed } from './fixtures/mini-game.js'

// A reliever who ALSO has a starts record on file (he starts elsewhere in the
// rotation) but is appearing in relief tonight. Regression for the Ryan Gusto
// case: the Pitchers table showed "Marlins are 1-2 in his road starts this
// year" under a pitcher's line while he was pitching the 8th in relief — a
// starts-only stat quoted on a night he wasn't starting.
const bundle = {
  starterRecords: {
    reliever1: { homeAway: { away: '1-2', home: '3-1' } },
    starter1: { homeAway: { away: '4-5', home: '2-2' } },
  },
}

test('buildPitcherNotes omits the starts-record note for a pitcher appearing in relief', () => {
  const row = { id: 'reliever1', ip: '2.1' }
  const notes = buildPitcherNotes(row, 'away', 'Miami Marlins', bundle, {}, false)
  assert.ok(!notes.some((n) => n.text.includes('road starts')))
})

test('buildPitcherNotes keeps the starts-record note for the actual starter', () => {
  const row = { id: 'starter1', ip: '5.0' }
  const notes = buildPitcherNotes(row, 'away', 'Miami Marlins', bundle, {}, true)
  assert.ok(notes.some((n) => n.text === 'Miami Marlins are 4-5 in his road starts this year'))
})

test('buildPitcherNotes defaults isStarter to false when the caller omits it', () => {
  const row = { id: 'reliever1', ip: '1.0' }
  const notes = buildPitcherNotes(row, 'away', 'Miami Marlins', bundle)
  assert.ok(!notes.some((n) => n.text.includes('road starts')))
})

test('buildPitcherNotes returns scored objects with kind/dedupeKey/personId/side', () => {
  const row = { id: 'starter1', ip: '5.0' }
  const notes = buildPitcherNotes(row, 'home', 'Miami Marlins', bundle, {}, true)
  const note = notes.find((n) => n.kind === 'homeAway')
  assert.ok(note)
  assert.equal(note.personId, 'starter1')
  assert.equal(note.side, 'home')
  assert.equal(note.dedupeKey, 'homeAway-starter1')
  assert.ok(typeof note.score === 'number' && note.score >= 0 && note.score <= 100)
})

// selectHalfStartingPitcher — the entering-identity source for the persistent
// "Now Pitching" card (HalfInning.jsx). Uses the mini-game fixture: home
// starter #200 pitches top 1; a pre-pitch change to reliever #201 is
// announced entering top 2 (its matchup.pitcher already reflects the change).
test('selectHalfStartingPitcher returns the half-1 starter once it is reachable', () => {
  const feed = buildFeed()
  const pitcher = selectHalfStartingPitcher(feed, 1, 'top', -1)
  assert.equal(pitcher?.id, 200)
})

test('selectHalfStartingPitcher withholds a half further out than the next reveal', () => {
  const feed = buildFeed()
  // Nothing revealed yet (-1) — top of the 2nd is two halves away, not next.
  const pitcher = selectHalfStartingPitcher(feed, 2, 'top', -1)
  assert.equal(pitcher, null)
})

test('selectHalfStartingPitcher reflects a pre-announced pitching change once that half is next-to-reveal', () => {
  const feed = buildFeed()
  // revealedThrough=1 (bottom 1 revealed) — top of the 2nd is next up.
  const pitcher = selectHalfStartingPitcher(feed, 2, 'top', 1)
  assert.equal(pitcher?.id, 201)
})

// buildMarginNotes — the ranked digest spanning both teams' pitchers. The
// builder itself does not cap; MarginNotes.jsx caps what's shown up front and
// reveals the rest on tap (see MARGIN_NOTES_SHOWN there), so with three
// qualifying pitchers this fixture legitimately produces more than 5 notes —
// pinning that is itself the regression check that the builder stopped
// truncating.
test('buildMarginNotes sorts by score, does not truncate, and respects the isStarter gate', () => {
  const feed = buildFeed()
  const marginBundle = {
    starterRecords: {
      200: { homeAway: { home: '3-1' }, cgShutout: 1, scorelessStreak: 4, sixIp: '2-1' },
      201: {
        homeAway: { home: '9-0' }, // reliever — must NOT surface (not tonight's starter)
        reliever: true,
        recentAppearances: 3,
        recentPitches: 40,
        pitchedYesterday: true,
        backToBack: { era: 5.4, restEra: 3.1 },
        leverage: { ahead: { avg: '.180' }, behind: { avg: '.310' } },
      },
      300: { homeAway: { away: '2-2' }, scorelessStreak: 6, cgShutout: 1 },
    },
    bullpen: { avgPitches: 10, windowDays: 3 },
  }
  const notes = buildMarginNotes(feed, 3, marginBundle, { away: 'Aways', home: 'Homes' })
  assert.equal(notes.length, 9) // 3 notes apiece for 200, 201, 300 — more than the old hard cap of 5
  for (let i = 1; i < notes.length; i++) {
    assert.ok(notes[i - 1].score >= notes[i].score)
  }
  assert.ok(!notes.some((n) => n.personId === 201 && n.kind === 'homeAway'))
})

// Dedup guard: every note the digest returns must carry a unique dedupeKey —
// regardless of how many pitcher/health builders fire, the caller (and
// React's key={n.dedupeKey}) must never see the same fact twice.
test('buildMarginNotes never returns two notes with the same dedupeKey', () => {
  const feed = buildFeed()
  const marginBundle = {
    starterRecords: {
      200: { homeAway: { home: '3-1' }, cgShutout: 1, scorelessStreak: 4 },
      201: { reliever: true, recentAppearances: 3, recentPitches: 40, bullpen: true },
      300: { homeAway: { away: '2-2' }, scorelessStreak: 6, cgShutout: 1 },
    },
    bullpen: { avgPitches: 10, windowDays: 3 },
  }
  const notes = buildMarginNotes(feed, 3, marginBundle, { away: 'Aways', home: 'Homes' })
  const keys = notes.map((n) => n.dedupeKey)
  assert.equal(keys.length, new Set(keys).size)
})

test('buildMarginNotes returns [] with no bundle', () => {
  const feed = buildFeed()
  assert.deepEqual(buildMarginNotes(feed, 3, null, { away: 'Aways', home: 'Homes' }), [])
})
