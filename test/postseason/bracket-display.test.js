// Pure layout logic behind the bracket on the home page (#1224, slice 5):
// which series count as "today's" for the folded view, which clubs are
// still alive for the postseason window's Off Day grid, and which game gets
// the brief's "one bold moment" treatment. Same 2025 fixture as the other
// postseason tests (test/postseason/fixtures.js) — a real, finished season.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import {
  aliveClubs,
  bracketOpensByItself,
  byeSlotIndex,
  isDecidingGame,
  isElimination,
  leaguePhase,
  offDayAliveTeams,
  recordRowIsLabelled,
  seriesPlayingToday,
  winningSlotIndex,
} from '../../src/lib/postseason/bracketDisplay.js'
import { results, seriesWith, skeleton } from './fixtures.js'

const bracket2025 = (cutoff) => deriveBracket(skeleton(2025), results(2025), cutoff)

test('seriesPlayingToday: heading into 2025-10-09, only MIL and LAD play — the decided/tied series do not', () => {
  const b = bracket2025('2025-10-09')
  const today = seriesPlayingToday(b)
  const abbrs = today
    .map((s) => s.slots.map((slot) => slot.club?.abbreviation).sort().join('-'))
    .sort()
  assert.deepEqual(abbrs, ['CHC-MIL', 'LAD-PHI'])
})

test('seriesPlayingToday: an empty postseason window day has no tickets', () => {
  const b = bracket2025('2025-10-04')
  // Every Division Series plays Game 1 on 2025-10-04 in the real 2025 bracket.
  assert.ok(seriesPlayingToday(b).length > 0)
  assert.equal(seriesPlayingToday(null).length, 0)
})

test('aliveClubs: heading into 2025-10-09, TOR (decided winner), SEA and DET (tied) are alive; NYY is not', () => {
  const b = bracket2025('2025-10-09')
  const abbrs = new Set(aliveClubs(b).map((c) => c.abbreviation))
  assert.ok(abbrs.has('TOR'))
  assert.ok(abbrs.has('SEA'))
  assert.ok(abbrs.has('DET'))
  assert.ok(!abbrs.has('NYY'), 'NYY lost its Division Series and is out')
})

test('offDayAliveTeams: heading into 2025-10-09, TOR/SEA/DET are off (not eliminated, not playing today)', () => {
  const b = bracket2025('2025-10-09')
  const playingIds = new Set(
    seriesPlayingToday(b).flatMap((s) => s.slots.map((slot) => slot.club?.id)),
  )
  const off = offDayAliveTeams(b, playingIds).map((c) => c.abbreviation).sort()
  assert.deepEqual(off, ['DET', 'SEA', 'TOR'])
})

test('offDayAliveTeams: null/undefined playingIds never throws and keeps every alive club off', () => {
  const b = bracket2025('2025-10-09')
  const off = offDayAliveTeams(b, undefined).map((c) => c.abbreviation).sort()
  assert.deepEqual(off, aliveClubs(b).map((c) => c.abbreviation).sort())
})

test('isDecidingGame / isElimination: a 2-1 series is elimination for the trailing club only', () => {
  const b = bracket2025('2025-10-09')
  const mil = seriesWith(b, 'NL', 'division', 'MIL') // MIL 2, CHC 1 heading into 10-09, plays today
  assert.equal(isDecidingGame(mil), false, 'both clubs are not one win from the series at 2-1')
  assert.equal(isElimination(mil), true, 'CHC is one loss from out')
})

test('isDecidingGame: a decided series is not a deciding game', () => {
  const b = bracket2025('2025-10-09')
  const tor = seriesWith(b, 'AL', 'division', 'TOR') // decided 3-1, no longer plays
  assert.equal(isDecidingGame(tor), false)
  assert.equal(isElimination(tor), false)
})

test('isDecidingGame: a tied series is a decider even when it does not play today (SEA-DET 2-2, next day)', () => {
  const b = bracket2025('2025-10-09')
  const sea = seriesWith(b, 'AL', 'division', 'SEA') // 2-2, deciding, but its Game 5 is the NEXT day
  assert.equal(isDecidingGame(sea), true, '2-2 of a best-of-5 is a symmetric decider')
  assert.equal(sea.playsOnCutoff, false)
})

test('isDecidingGame/isElimination: an empty slot is neither', () => {
  const b = bracket2025('2025-10-04')
  const alcs = b.leagues.AL.lcs
  assert.equal(isDecidingGame(alcs), false)
  assert.equal(isElimination(alcs), false)
})

test('leaguePhase: the full bracket’s current round, per league (Concept A)', () => {
  // Heading into 2025-10-04, every Wild Card is already decided and every
  // Division Series is 0-0: Division is current for both leagues.
  const wc = bracket2025('2025-10-04')
  assert.equal(leaguePhase(wc.leagues.AL), 'division')
  assert.equal(leaguePhase(wc.leagues.NL), 'division')

  // Heading into 2025-10-09, AL's Division round is NOT fully decided
  // (SEA-DET is tied 2-2) even though TOR's series is — Division stays
  // current for AL. NL's is not fully decided either (MIL/LAD in progress).
  const mid = bracket2025('2025-10-09')
  assert.equal(leaguePhase(mid.leagues.AL), 'division')
  assert.equal(leaguePhase(mid.leagues.NL), 'division')
})

test('winningSlotIndex / byeSlotIndex: read off the real away/home slots, never assumed position', () => {
  const b = bracket2025('2025-10-09')
  const tor = seriesWith(b, 'AL', 'division', 'TOR') // ALDS 'A': NYY (slot 0), TOR the bye seed (slot 1)
  assert.equal(byeSlotIndex(tor), 1)
  assert.equal(winningSlotIndex(tor), 1, 'TOR (the bye seed) won, and TOR sits in slot 1')

  const sea = seriesWith(b, 'AL', 'division', 'SEA') // not decided yet
  assert.equal(winningSlotIndex(sea), -1)
})

// Review of #1233: a series with a game on the cutoff date but a slot the
// bracket never filled (a missed feeder match) must not become a ticket —
// the ticket reads both clubs, and a missing one crashed the slate.
test('seriesPlayingToday: a series with an empty slot is not a ticket', () => {
  const b = bracket2025('2025-10-09')
  const mil = b.series.find((s) => s.playsOnCutoff && s.slots.some((slot) => slot.club?.abbreviation === 'MIL'))
  const broken = { ...b, series: b.series.map((s) => (s === mil ? { ...s, slots: [s.slots[0], { ...s.slots[1], club: null }] } : s)) }
  const abbrs = seriesPlayingToday(broken).map((s) => s.slots.map((slot) => slot.club?.abbreviation).sort().join('-'))
  assert.deepEqual(abbrs, ['LAD-PHI'])
})

// Review of #1233: the Season record row drops its tape and its warning only
// when the champion is on its own face (ADR-0081 addendum). A minor level's
// row, or an MLB row with no champion, still only links to results, so it
// still says so.
test('recordRowIsLabelled: the warning stays unless the champion is on the face', () => {
  assert.equal(recordRowIsLabelled(null), true)
  assert.equal(recordRowIsLabelled({ id: 119, abbreviation: 'LAD' }), false)
})

// Gary, 2026-09-28: on a day with no postseason game the full bracket opens
// by itself; on a game day it stays folded behind the tickets.
test('bracketOpensByItself: open on a day with no game, folded on a game day', () => {
  assert.equal(bracketOpensByItself(bracket2025('2025-10-09')), false)
  const offDay = bracket2025('2025-10-09')
  assert.equal(bracketOpensByItself({ ...offDay, series: offDay.series.map((s) => ({ ...s, playsOnCutoff: false })) }), true)
})

// Gary, 2026-09-28: the slate pages past today in the postseason again. The
// bracket above a future day still reads heading into TODAY (the hook caps
// its cutoff), so today's tickets must not stand above that later day's
// cards: a slate date after the bracket's cutoff gets no tickets, and the
// full bracket opens by itself, as on an off day.
test('a slate date after the cutoff: no tickets, and the full bracket opens by itself', () => {
  const b = bracket2025('2025-10-09')
  assert.ok(seriesPlayingToday(b).length > 0)
  assert.deepEqual(seriesPlayingToday(b, '2025-10-10'), [])
  assert.equal(bracketOpensByItself(b, '2025-10-10'), true)
  // On the cutoff date itself, nothing changes.
  assert.equal(seriesPlayingToday(b, '2025-10-09').length, seriesPlayingToday(b).length)
  assert.equal(bracketOpensByItself(b, '2025-10-09'), false)
})
