import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankNotes,
  magnitudeOf,
  skewBonus,
  MAGNITUDE_MAX,
  SHOWN_DECAY,
  ONCE_PER_GAME_KINDS,
  RECORD_KINDS,
} from '../src/api/callout-notes/shared.js'

// Three rules keep a nine-inning game from showing the reader the same card
// fifteen times, and each of them was a way to get repetition wrong:
//   1. a note DECAYS by SHOWN_DECAY for each earlier half it was shown on;
//   2. a fact that cannot change during a game DROPS after one showing;
//   3. one note per kind per surface, and one W-L record note per strip.
// A fourth test covers the scale those rules sort on.

const note = (kind, score, key = kind) => ({ kind, score, dedupeKey: key, text: kind })
const counts = (pairs) => new Map(pairs)

test('with an empty ledger a surface ranks exactly as it always did', () => {
  const out = rankNotes([note('tto', 20), note('veloDecay', 46), note('laboring', 48)], { limit: 2 })
  assert.deepEqual(out.map((n) => n.kind), ['laboring', 'veloDecay'])
})

test('a prior showing decays a note by SHOWN_DECAY per half, letting a fresh one through', () => {
  const candidates = [note('laboring', 48), note('tto', 30)]
  // Shown on one earlier half: 48 - 25 = 23, so the plain trip fact now leads.
  const once = rankNotes(candidates, { shownCounts: counts([['laboring', 1]]), limit: 2 })
  assert.deepEqual(once.map((n) => n.kind), ['tto', 'laboring'])
  // Never shown: the higher base still wins, so decay is the only difference.
  const fresh = rankNotes(candidates, { limit: 2 })
  assert.deepEqual(fresh.map((n) => n.kind), ['laboring', 'tto'])
})

test('decay demotes, it never bans — a decayed note with nothing to beat it still shows', () => {
  const out = rankNotes([note('laboring', 48)], { shownCounts: counts([['laboring', 3]]), limit: 2 })
  assert.deepEqual(out.map((n) => n.kind), ['laboring'])
})

test('a fact that cannot change during a game drops after one showing', () => {
  const candidates = [note('dayOfWeek', 50, 'dayOfWeek-away'), note('laboring', 20)]
  const out = rankNotes(candidates, { shownCounts: counts([['dayOfWeek-away', 1]]), limit: 5 })
  assert.deepEqual(out.map((n) => n.kind), ['laboring'])
  // …and it is the ONCE_PER_GAME_KINDS membership that does it, not the score.
  assert.ok(ONCE_PER_GAME_KINDS.has('dayOfWeek'))
  assert.ok(!ONCE_PER_GAME_KINDS.has('laboring'))
})

test('the ledger only subtracts — a note absent from the pool is never added back', () => {
  const out = rankNotes([note('laboring', 48)], { shownCounts: counts([['dayOfWeek-away', 1]]), limit: 5 })
  assert.deepEqual(out.map((n) => n.dedupeKey), ['laboring'])
})

test('one note per kind per surface, whatever their scores', () => {
  const out = rankNotes([
    note('tiedAfter', 60, 'tiedAfterLive-away-7'),
    note('tiedAfter', 59, 'tiedAfterLive-home-7'),
    note('laboring', 10),
  ], { limit: 2 })
  assert.deepEqual(out.map((n) => n.dedupeKey), ['tiedAfterLive-away-7', 'laboring'])
})

test('a two-slot strip holds at most one "the club is W-L when X" note', () => {
  const out = rankNotes([
    note('starterRec', 60, 'starterRec-1'),
    note('dayOfWeek', 58, 'dayOfWeek-away'),
    note('scorelessThrough', 57, 'scorelessThroughLive-away-6'),
    note('pitchPace', 32),
  ], { maxRecordNotes: 1, limit: 2 })
  assert.deepEqual(out.map((n) => n.kind), ['starterRec', 'pitchPace'])
  assert.ok(RECORD_KINDS.has('starterRec') && RECORD_KINDS.has('dayOfWeek'))
  assert.ok(!RECORD_KINDS.has('pitchPace'))
})

test('a note a diversity rule turns down is deferred to the tail, not discarded', () => {
  // No limit: the Margin Notes digest hides its tail behind "Show N more", so a
  // turned-down note has to still be there to find.
  const out = rankNotes([
    note('tiedAfter', 60, 'tiedAfterLive-away-7'),
    note('tiedAfter', 59, 'tiedAfterLive-home-7'),
    note('laboring', 10),
  ])
  assert.deepEqual(out.map((n) => n.dedupeKey), [
    'tiedAfterLive-away-7', 'laboring', 'tiedAfterLive-home-7',
  ])
})

test('every magnitude bonus lands on the same 0–MAGNITUDE_MAX scale', () => {
  assert.equal(magnitudeOf(0, 15), 0)
  assert.equal(magnitudeOf(15, 15), MAGNITUDE_MAX)
  assert.equal(magnitudeOf(99, 15), MAGNITUDE_MAX) // saturates, never overshoots
  assert.equal(magnitudeOf(-4, 15), 0) // and never goes negative
  // A family whose bonus used to stop at 10 now reaches the same ceiling as one
  // that stopped at 20 — that is the whole point of the rescale.
  assert.equal(magnitudeOf(10, 10), magnitudeOf(20, 20))
  // A spotless record earns the whole bonus; a .500 one earns none.
  assert.equal(skewBonus(20, 0), MAGNITUDE_MAX)
  assert.equal(skewBonus(10, 10), 0)
  assert.equal(skewBonus(0, 0), 0)
  // A missing or nonsense measure is worth nothing, never NaN.
  assert.equal(magnitudeOf(undefined, 15), 0)
  assert.equal(magnitudeOf(5, 0), 0)
})

test('SHOWN_DECAY is the one tunable — the rules read it, they do not repeat it', () => {
  const decayed = rankNotes([note('laboring', SHOWN_DECAY + 1)], {
    shownCounts: counts([['laboring', 1]]),
  })
  assert.equal(decayed.length, 1)
  const beaten = rankNotes([note('laboring', SHOWN_DECAY + 1), note('tto', 2)], {
    shownCounts: counts([['laboring', 1]]),
    limit: 1,
  })
  assert.deepEqual(beaten.map((n) => n.kind), ['tto'])
})

// The thin-pool case the caps exist for, and the reason `strictCaps` is opt-in.
// A top half of inning 6+ very often offers NOTHING but record notes: both
// clubs' tiedAfterLive, or both clubs' bothScoreless. Without strictCaps the
// turned-down tail backfills the free slots and the cap delivers nothing — the
// strip says the same thing twice, which is what it was built to stop.
test('a strict strip whose whole pool is one kind keeps one note, not a full slate', () => {
  const pool = [
    note('tiedAfterLive', 52, 'tiedAfterLive-away'),
    note('tiedAfterLive', 48, 'tiedAfterLive-home'),
  ]
  const strict = rankNotes(pool, { maxPerKind: 1, maxRecordNotes: 1, limit: 2, strictCaps: true })
  assert.deepEqual(strict.map((n) => n.dedupeKey), ['tiedAfterLive-away'])
  // A short strip is the honest outcome: there is only one distinct thing to say.
  assert.equal(strict.length, 1)
})

test('a strict strip keeps one record note even when the pool is all records', () => {
  const pool = [
    note('bothScoreless', 50, 'bothScoreless-away'),
    note('scorelessThrough', 46, 'scorelessThrough-home'),
    note('pitchPace', 40, 'pitchPace-200'),
  ]
  const strict = rankNotes(pool, { maxPerKind: 1, maxRecordNotes: 1, limit: 2, strictCaps: true })
  assert.deepEqual(strict.map((n) => n.kind), ['bothScoreless', 'pitchPace'])
  assert.equal(strict.filter((n) => RECORD_KINDS.has(n.kind)).length, 1)
})

// The opposite contract, and why strictCaps is not the default: Between Innings
// backfills on purpose, because its card DEPTH is a spoiler invariant — a quiet
// half and a loud half must return the same count (between-innings.test.js).
test('a backfilling surface still fills its slots from the turned-down tail', () => {
  const pool = [
    note('tiedAfterLive', 52, 'tiedAfterLive-away'),
    note('tiedAfterLive', 48, 'tiedAfterLive-home'),
  ]
  const filled = rankNotes(pool, { maxPerKind: 1, maxRecordNotes: 1, limit: 2 })
  assert.equal(filled.length, 2)
})
