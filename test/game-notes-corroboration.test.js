import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCallouts } from '../src/api/callout-notes.js'
import { buildPitcherNotes } from '../src/api/pitcher-callouts.js'
import {
  CORROBORATION_BONUS,
  corroborationBonus,
  magnitudeOf,
  rankNotes,
  SCORE_BASE,
} from '../src/api/callout-notes/shared.js'
import {
  buildCorroborationFile,
  CORROBORATION_SIGNALS,
  corroboratedFor,
  kindsForSignals,
  MAX_AGE_DAYS,
  MAX_ENTRIES_PER_TEAM,
  normalizeVerdicts,
} from '../scripts/lib/game-notes-corroboration.mjs'

// The Game Notes curation signal (issue #774). A club's own pre-game press
// notes writing about a fact bbsbh already computes is evidence the fact is
// worth a reader's attention — so the matching callout's worthiness score gets
// a small bounded nudge, and nothing else. Two halves are tested here:
//
//   1. The SCAN's validation (scripts/lib/game-notes-corroboration.mjs) — what
//      a hand classification may say, and above all what it may NOT: a
//      `result`-tier blurb is a recap of a game the reader has not watched, so
//      it is refused outright rather than merely ignored.
//   2. The NUDGE (corroborationBonus + the note builders) — that it lands on
//      the right note, is worth exactly CORROBORATION_BONUS, and stays smaller
//      than a family gap so it can never carry a family past a higher one.

// --- the scan's validation ----------------------------------------------------

const entry = (over = {}) => ({
  teamId: 158,
  personId: 669203,
  signals: ['leader'],
  tier: 'timeless',
  date: '2026-08-23',
  ...over,
})

test('a result-tier blurb is refused — it is the score of a game the reader has not watched', () => {
  const { teams, kept, dropped } = normalizeVerdicts([entry({ tier: 'result' })])
  assert.deepEqual(teams, {})
  assert.equal(kept, 0)
  assert.equal(dropped.result, 1)
})

test('timeless and standing are the only tiers that reach a score', () => {
  const { kept, dropped } = normalizeVerdicts([
    entry({ tier: 'timeless' }),
    entry({ personId: 2, tier: 'standing' }),
    entry({ personId: 3, tier: 'colour' }),
    entry({ personId: 4, tier: undefined }),
  ])
  assert.equal(kept, 2)
  assert.equal(dropped.tier, 2)
})

test('a signal outside the closed vocabulary buys nothing', () => {
  const { kept, dropped } = normalizeVerdicts([entry({ signals: ['vibes', 'franchiseTrivia'] })])
  assert.equal(kept, 0)
  assert.equal(dropped.signal, 1)
  assert.deepEqual(kindsForSignals(['vibes']), [])
})

test('an on-base signal covers the streak in all three tenses it is told in', () => {
  assert.deepEqual(kindsForSignals(['onBase']), ['onBaseRiding', 'onBaseExtended', 'onBaseEnded'])
})

test('an entry missing an id or a date is dropped rather than half-applied', () => {
  const { kept, dropped } = normalizeVerdicts([
    entry({ personId: null }),
    entry({ teamId: 'Brewers' }),
    entry({ date: 'yesterday' }),
  ])
  assert.equal(kept, 0)
  assert.equal(dropped.shape, 3)
})

test('two blurbs about one player fold together instead of doubling his weight', () => {
  const { teams, kept } = normalizeVerdicts([
    entry({ signals: ['leader'] }),
    entry({ signals: ['onBase'], date: '2026-08-24' }),
  ])
  assert.equal(kept, 1)
  assert.deepEqual(teams['158'], [
    {
      personId: 669203,
      kinds: ['leader', 'onBaseRiding', 'onBaseExtended', 'onBaseEnded'],
      tier: 'timeless',
      date: '2026-08-24', // the later of the two
    },
  ])
})

test('a club is capped, so one scan can never become a blanket boost', () => {
  const many = Array.from({ length: MAX_ENTRIES_PER_TEAM + 4 }, (_, i) => entry({ personId: 100 + i }))
  const { teams, kept, dropped } = normalizeVerdicts(many)
  assert.equal(teams['158'].length, MAX_ENTRIES_PER_TEAM)
  assert.equal(kept, MAX_ENTRIES_PER_TEAM)
  assert.equal(dropped.capped, 4)
})

test('the committed file carries the scan’s provenance, not the blurb text as data', () => {
  const { file } = buildCorroborationFile([entry({ player: 'Someone', quote: 'a blurb' })], {
    generatedAt: '2026-08-24T12:00:00.000Z',
    scannedThrough: '2026-08-23',
  })
  assert.equal(file.scannedThrough, '2026-08-23')
  assert.match(file.source, /scan-game-notes-insights/)
  // player/quote ride along for a human reading the file; the app reads neither.
  assert.equal(file.teams['158'][0].player, 'Someone')
})

// --- the staleness window ------------------------------------------------------

const fileWith = (date) => ({ teams: { 158: [{ personId: 669203, kinds: ['leader'], tier: 'timeless', date }] } })

test('a note inside the window corroborates; one past it has gone stale', () => {
  assert.deepEqual(corroboratedFor(fileWith('2026-08-24'), 158, '2026-08-24'), { 669203: ['leader'] })
  assert.deepEqual(corroboratedFor(fileWith('2026-08-17'), 158, '2026-08-24'), { 669203: ['leader'] })
  assert.deepEqual(corroboratedFor(fileWith('2026-08-16'), 158, '2026-08-24'), {})
  assert.equal(MAX_AGE_DAYS, 7)
})

test('a note dated after the slate is not evidence about it either', () => {
  assert.deepEqual(corroboratedFor(fileWith('2026-08-25'), 158, '2026-08-24'), {})
})

test('a missing or malformed file degrades to no nudge, never to a failed run', () => {
  assert.deepEqual(corroboratedFor(null, 158, '2026-08-24'), {})
  assert.deepEqual(corroboratedFor({ teams: { 158: 'nope' } }, 158, '2026-08-24'), {})
  assert.deepEqual(corroboratedFor({ teams: { 158: [{ personId: 1 }] } }, 158, '2026-08-24'), {})
  assert.deepEqual(corroboratedFor(fileWith('2026-08-24'), 999, '2026-08-24'), {})
})

// --- the nudge -----------------------------------------------------------------

test('the bonus is joined on BOTH the person and the family, never one alone', () => {
  const bundle = { corroborated: { 42: ['leader'] } }
  assert.equal(corroborationBonus(bundle, 'leader', 42), CORROBORATION_BONUS)
  assert.equal(corroborationBonus(bundle, 'sbStreak', 42), 0)
  assert.equal(corroborationBonus(bundle, 'leader', 43), 0)
  assert.equal(corroborationBonus(bundle, 'leader', null), 0)
  assert.equal(corroborationBonus({}, 'leader', 42), 0)
})

const LEADER_BUNDLE = {
  away: { teamId: 158, name: 'Brewers' },
  home: { teamId: 112, name: 'Cubs' },
  leaders: { 42: { team: 'Brewers', cats: { doubles: '20' } } },
  streaks: {},
  homerRecords: {},
  situational: {},
}
const doubleEntry = { atBatIndex: 3, batterId: 42, eventType: 'double' }
const leaderNote = (bundle) =>
  buildCallouts(doubleEntry, { bundle, battingSide: 'away' }).find((n) => n.kind === 'leader')

test('a corroborated leader note scores exactly its usual score plus the bonus', () => {
  const plain = leaderNote(LEADER_BUNDLE)
  const nudged = leaderNote({ ...LEADER_BUNDLE, corroborated: { 42: ['leader'] } })
  const base = SCORE_BASE.leader + magnitudeOf(20 / 4, 15)
  assert.equal(plain.score, Math.round(base))
  assert.equal(nudged.score, Math.round(base + CORROBORATION_BONUS))
  assert.equal(plain.text, nudged.text) // the signal moves the rank, never the words
})

test('a club writing about the wrong player leaves the note exactly as it was', () => {
  const other = leaderNote({ ...LEADER_BUNDLE, corroborated: { 43: ['leader'] } })
  assert.equal(other.score, leaderNote(LEADER_BUNDLE).score)
})

test('the nudge decides which of two true facts leads, and nothing more', () => {
  const notes = [
    { kind: 'leader', dedupeKey: 'a', score: 40 },
    { kind: 'sbStreak', dedupeKey: 'b', score: 43 },
  ]
  assert.deepEqual(rankNotes(notes, { limit: 1 }).map((n) => n.dedupeKey), ['b'])
  const withBonus = [{ ...notes[0], score: 40 + CORROBORATION_BONUS }, notes[1]]
  assert.deepEqual(rankNotes(withBonus, { limit: 1 }).map((n) => n.dedupeKey), ['a'])
})

test('the bonus stays smaller than a magnitude range, so a family cannot outrank its betters', () => {
  // A corroborated instance of a family at its FLOOR must still lose to an
  // uncorroborated instance of a family a full magnitude range above it.
  assert.ok(CORROBORATION_BONUS < 20)
  assert.ok(SCORE_BASE.onBaseRiding + CORROBORATION_BONUS < SCORE_BASE.homerRec)
})

// Margin Notes sit outside callout-notes/ with their own local bases, but the
// nudge has to mean the same thing there — a club's notes write about a
// reliever's scoreless run more often than about anything else the scan can
// name, so this is the path the signal earns its keep on.
const PEN_BUNDLE = { starterRecords: { 77: { scorelessStreak: 6, reliever: true } } }
const scorelessNote = (bundle) =>
  buildPitcherNotes({ id: 77, ip: '1.0' }, 'away', 'Brewers', bundle, {}, false).find(
    (n) => n.kind === 'scorelessStreak',
  )

test('a corroborated scoreless streak is nudged in Margin Notes too', () => {
  const plain = scorelessNote(PEN_BUNDLE)
  const nudged = scorelessNote({ ...PEN_BUNDLE, corroborated: { 77: ['scorelessStreak'] } })
  assert.ok(plain, 'expected a scorelessStreak note')
  assert.equal(nudged.score, plain.score + CORROBORATION_BONUS)
  assert.equal(nudged.text, plain.text)
})

test('a Margin Note the scan cannot name is never nudged, even with an entry on file', () => {
  // `workload` is a real Margin Notes kind and NOT in the scan's vocabulary, so
  // no committed file can ever carry it — the closed vocabulary is the gate.
  assert.ok(!Object.values(CORROBORATION_SIGNALS).flat().includes('workload'))
})
