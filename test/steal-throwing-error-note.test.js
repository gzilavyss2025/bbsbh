// A steal (or wild pitch/balk/…) that breaks on the SAME pitch a plate
// appearance ends on gets no playEvent of its own — the feed folds it
// straight into `play.runners[]` instead, so the usual playEvents-scanned
// hoisting in halfInningFeed.js never sees it. Verified against gamePk
// 816025's bottom 2nd: Jud Fabian's strikeout carried four `isPitch`
// playEvents and nothing else, while `runners[]` held Luis Vázquez's steal of
// 2nd plus a further leg to 3rd on a throwing error — both silently absorbed
// into the strikeout's own prose with no notification card, unlike every
// OTHER steal in the app. See runnerNotes.js's header for the full shape.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

// Bottom 2's strikeout (#15, Oli Ott) rewritten to the gamePk 816025 shape:
// no baserunning playEvent at all, just the runners[] legs — a steal of 2nd
// then a throwing-error leg to 3rd, both credited to #14 (Ned Nash).
function feedWithBuriedStealAndError() {
  const feed = buildFeed()
  feed.gameData.players.ID302 = { lastName: 'León', fullName: 'Sandy León' }
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 15,
  )
  play.runners = [
    {
      movement: { start: null, end: null, outBase: '1B', isOut: true },
      details: { eventType: 'strikeout', runner: { id: 15, fullName: 'Oli Ott' } },
      credits: [],
    },
    {
      movement: { start: '1B', end: '2B', isOut: false },
      details: { eventType: 'stolen_base_2b', runner: { id: 14, fullName: 'Ned Nash' } },
      credits: [],
    },
    {
      movement: { start: '2B', end: '3B', isOut: false },
      details: { eventType: 'error', runner: { id: 14, fullName: 'Ned Nash' } },
      credits: [{ player: { id: 302 }, position: { code: '2', name: 'Catcher' }, credit: 'f_throwing_error' }],
    },
  ]
  return feed
}

test('a steal with no playEvent of its own still gets a leading notification card', () => {
  const entries = computeHalfInningFeed(feedWithBuriedStealAndError(), 2, 'bottom', 'home')
  const note = entries.find((e) => e.kind === 'event' && e.eventType === 'stolen_base_2b')
  assert.ok(note, 'the steal must surface as its own card even with no playEvent behind it')
  assert.equal(note.playerId, 14)
  // It leads the strikeout card it happened during, same as every other
  // playEvents-sourced baserunning note (ADR-0017's leading-card convention).
  const card = entries.findIndex((e) => e.kind === 'atbat' && e.batterId === 15)
  assert.ok(entries.indexOf(note) < card)
})

test('the trailing throwing-error leg folds into the SAME card, naming the fielder', () => {
  const entries = computeHalfInningFeed(feedWithBuriedStealAndError(), 2, 'bottom', 'home')
  const note = entries.find((e) => e.kind === 'event' && e.eventType === 'stolen_base_2b')
  const text = note.segments.map((s) => s.text).join('')
  assert.equal(text, 'Ned Nash steals second. Advances to third on a throwing error by catcher León.')
  // León is linked, not just named in plain text.
  const fielderSeg = note.segments.find((s) => s.text === 'León')
  assert.equal(fielderSeg.id, 302)
})

test('a steal that DID get its own playEvent is never doubled up by the runners[]-only pass', () => {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 2 && p.about.halfInning === 'bottom' && p.matchup.batter.id === 15,
  )
  play.playEvents.unshift({
    details: { eventType: 'stolen_base_2b', description: 'Ned Nash steals (1) 2nd base.' },
    player: { id: 14 },
  })
  play.runners = [
    {
      movement: { start: '1B', end: '2B', isOut: false },
      details: { eventType: 'stolen_base_2b', runner: { id: 14, fullName: 'Ned Nash' } },
      credits: [],
    },
  ]

  const entries = computeHalfInningFeed(feed, 2, 'bottom', 'home')
  const notes = entries.filter((e) => e.kind === 'event' && e.eventType === 'stolen_base_2b')
  assert.equal(notes.length, 1, 'the covered leg must not also get a synthesized card')
  assert.equal(notes[0].segments.map((s) => s.text).join(''), 'Ned Nash steals (1) 2nd base.')
})
