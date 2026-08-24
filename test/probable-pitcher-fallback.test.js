// Issue #851 — gameData.probablePitchers is reliably empty for complex-league
// games (verified live: 4/4 sampled 2025 ACL Brewers games), but the same gap
// can appear at any level whenever a starter isn't formally announced
// pregame. selectHalfStartingPitcher's derivation (the half's first LOGGED
// play's own matchup.pitcher.id) already proved safe — matchup/forHalf.js's
// armFor has used it as the entering-arm source since before this fix. This
// pins the same fallback newly wired into the three call sites that read
// ONLY probablePitchers and rendered nothing when it was empty: selectTeamMeta
// (TeamInfo's Starting pitcher card), prehalf-callouts.js's starter-record
// note, and between-innings.js's starter-record note.
//
// mini-game.js's buildFeed() carries no gameData.probablePitchers at all —
// the exact shape statsapi returns for an unannounced starter — with a real
// play logged for every half: home #200 pitches top 1, away #300 pitches
// bottom 1.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectTeamMeta, derivedHalfStartingPitcherId } from '../src/api/select.js'
import { buildPreHalfCallouts } from '../src/api/prehalf-callouts.js'
import { buildBetweenInnings } from '../src/api/between-innings.js'
import { buildFeed } from './fixtures/mini-game.js'

// --- derivedHalfStartingPitcherId (the shared derivation) -------------------

test('derivedHalfStartingPitcherId reads the half\'s first play\'s pitcher', () => {
  const feed = buildFeed()
  assert.equal(derivedHalfStartingPitcherId(feed, 1, 'top', Infinity), 200)
  assert.equal(derivedHalfStartingPitcherId(feed, 1, 'bottom', Infinity), 300)
})

test('derivedHalfStartingPitcherId self-gates on revealedThrough, same as selectHalfStartingPitcher', () => {
  const feed = buildFeed()
  // halfIndex(1, 'bottom') = 1, which is past -1 + 1 = 0: not yet revealed.
  assert.equal(derivedHalfStartingPitcherId(feed, 1, 'bottom', -1), null)
  assert.equal(derivedHalfStartingPitcherId(feed, 1, 'bottom', 0), 300)
})

test('derivedHalfStartingPitcherId returns null with no play logged for that half', () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays = []
  assert.equal(derivedHalfStartingPitcherId(feed, 1, 'top', Infinity), null)
})

// --- selectTeamMeta (TeamInfo's Starting pitcher card) -----------------------

test('selectTeamMeta falls back to the derived starter when probablePitchers is empty', () => {
  const feed = buildFeed() // no gameData.probablePitchers
  const home = selectTeamMeta(feed, 'home').probablePitcher
  const away = selectTeamMeta(feed, 'away').probablePitcher
  assert.equal(home?.id, 200)
  assert.equal(home?.name, 'Hank Starter')
  assert.equal(away?.id, 300)
  assert.equal(away?.name, 'Walt Whit')
})

test('selectTeamMeta prefers an announced probable over the derived starter', () => {
  const feed = buildFeed()
  // A last-minute substitution: the announced probable (201) differs from
  // who actually threw the half's first pitch (200) — existing behavior for
  // an announced level must not regress to the derived identity.
  feed.gameData.probablePitchers = { home: { id: 201, fullName: 'Rob Reliever' } }
  assert.equal(selectTeamMeta(feed, 'home').probablePitcher.id, 201)
})

test('selectTeamMeta stays null pregame — no probable, no play logged yet', () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays = []
  assert.equal(selectTeamMeta(feed, 'home').probablePitcher, null)
  assert.equal(selectTeamMeta(feed, 'away').probablePitcher, null)
})

// --- prehalf-callouts.js's starter-record note --------------------------------

const RECORD_BUNDLE = {
  home: { teamId: 138, name: 'Home Club' },
  away: { teamId: 158, name: 'Away Club' },
  starterRecords: {
    200: { teamStarts: { w: 12, l: 5 } },
    300: { teamStarts: { w: 9, l: 9 } },
  },
}

test('prehalf-callouts falls back to the derived starter for the 1st-inning starterRec note', () => {
  const feed = buildFeed() // no probablePitchers
  const strip = buildPreHalfCallouts({
    feed, bundle: RECORD_BUNDLE, inning: 1, half: 'top', revealedThrough: -1,
  })
  const rec = strip.find((n) => n.kind === 'starterRec')
  assert.equal(rec?.personId, 200)
  assert.equal(rec?.text, 'The Home Club are 12-5 in his starts this season')
})

test('prehalf-callouts\' starter fallback still respects the half\'s own reveal gate', () => {
  const feed = buildFeed()
  // Bottom 1 (away #300) is not yet reached at revealedThrough -1 —
  // derivedHalfStartingPitcherId must withhold the same as the probable read did.
  const early = buildPreHalfCallouts({
    feed, bundle: RECORD_BUNDLE, inning: 1, half: 'bottom', revealedThrough: -1,
  })
  assert.ok(!early.some((n) => n.kind === 'starterRec'))

  const late = buildPreHalfCallouts({
    feed, bundle: RECORD_BUNDLE, inning: 1, half: 'bottom', revealedThrough: 0,
  })
  const rec = late.find((n) => n.kind === 'starterRec')
  assert.equal(rec?.personId, 300)
})

// --- between-innings.js's starter-record note ---------------------------------

test('between-innings falls back to the derived starter for both sides when probablePitchers is empty', () => {
  const feed = buildFeed() // no probablePitchers
  const cards = buildBetweenInnings({
    feed, bundle: RECORD_BUNDLE, marginNotes: [], inning: 1, half: 'top', revealedThrough: 0,
  })
  assert.ok(cards.some((c) => c.dedupeKey === 'starterRec-200'))
  assert.ok(cards.some((c) => c.dedupeKey === 'starterRec-300'))
})

test('between-innings\' starter fallback still respects each side\'s own reveal gate', () => {
  const feed = buildFeed()
  // At revealedThrough -1 only top 1 (home #200) is reachable; bottom 1
  // (away #300) is not, so its starterRec must stay withheld rather than
  // guessing ahead of the reveal mark.
  const cards = buildBetweenInnings({
    feed, bundle: RECORD_BUNDLE, marginNotes: [], inning: 1, half: 'top', revealedThrough: -1,
  })
  assert.ok(cards.some((c) => c.dedupeKey === 'starterRec-200'))
  assert.ok(!cards.some((c) => c.dedupeKey === 'starterRec-300'))
})
