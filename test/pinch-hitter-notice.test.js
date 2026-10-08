// A pinch hitter announced BEFORE a half's first pitch already gets a staged
// "now batting" card (HalfInning.jsx's PrePitchChanges, selectPrePitchChanges).
// A pinch hitter announced MID-INNING — after the half is already underway —
// used to get no announcement of his own at all: computeHalfInningFeed's
// STOPPAGE_EVENTS deliberately skipped `offensive_substitution` (except the
// pinch-RUNNER branch), so he showed up only as his own at-bat card (tagged
// PH), the one substitution type with no in-feed notice while a defensive
// sub, a defensive switch, a pitching change, and a pinch runner all get one.
//
// Verified rendering asymmetry against gamePk 823759 (three mid-half pinch
// hitters, no notice card for any of them) — filed at
// .scratch/pbp-scoring-review/issues/05-substitution-surface-asymmetries.md.
// This fixture is a minimal two-batter half: a leadoff single (so a pitch has
// already been thrown in the half), then a pinch hitter announced before HIS
// own first pitch.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { computeHalfInningFeed, pinchHittingBatter, pitchingChangePitcher, focusWindows, windowLeadIn } from '../src/api/playbyplay.js'

function person(id, last, first, num) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(num) }
}

const LEADOFF = 1
const REPLACED = 2
const PINCH_HITTER = 10
const PITCHER = 9

const PLAYERS = {
  ID1: person(LEADOFF, 'Ashby', 'Aaron', 1),
  ID2: person(REPLACED, 'Bell', 'Ben', 2),
  ID10: person(PINCH_HITTER, 'Judge', 'Jim', 24),
  ID9: { ...person(PITCHER, 'Flores', 'Anthony', 45), pitchHand: { code: 'L' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

const LEADOFF_SINGLE = {
  about: { inning: 3, halfInning: 'top', atBatIndex: 20 },
  matchup: { batter: { id: LEADOFF, fullName: 'Aaron Ashby' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
  result: { type: 'atBat', eventType: 'single', description: 'Aaron Ashby singles.', rbi: 0 },
  count: { balls: 1, strikes: 0, outs: 0 },
  playEvents: [pitch('B', 1), pitch('D', 2)],
  runners: [
    {
      details: { runner: { id: LEADOFF, fullName: 'Aaron Ashby' }, eventType: 'single' },
      movement: { start: null, end: '1B', isOut: false },
    },
  ],
}

// The mid-inning pinch hitter, announced right before his own first pitch —
// the half is already underway (the leadoff single above threw real pitches).
const PINCH_HIT_PLAY = {
  about: { inning: 3, halfInning: 'top', atBatIndex: 21 },
  matchup: { batter: { id: PINCH_HITTER, fullName: 'Jim Judge' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: { type: 'atBat', eventType: 'strikeout', description: 'Jim Judge strikes out swinging.', rbi: 0 },
  count: { balls: 0, strikes: 3, outs: 1 },
  playEvents: [
    {
      details: { eventType: 'offensive_substitution', description: 'Offensive Substitution: Pinch-hitter Jim Judge replaces Ben Bell.' },
      position: { abbreviation: 'PH' },
      player: { id: PINCH_HITTER },
      replacedPlayer: { id: REPLACED },
    },
    pitch('S', 1),
    pitch('S', 2),
    pitch('S', 3),
  ],
  runners: [
    {
      details: { runner: { id: PINCH_HITTER, fullName: 'Jim Judge' }, eventType: 'strikeout' },
      movement: { start: null, end: null, isOut: true, outNumber: 1 },
    },
  ],
}

function buildFeed() {
  return {
    gamePk: 823759,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: { teams: { away: { players: {} }, home: { players: {} } } },
      plays: { allPlays: [LEADOFF_SINGLE, PINCH_HIT_PLAY] },
    },
  }
}

test('a pinch hitter announced mid-inning gets his own "now batting" notice, same as every other substitution type', () => {
  const entries = computeHalfInningFeed(buildFeed(), 3, 'top', 'away')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Ashby', 'event:pinch_hitting', 'atbat:Judge'],
  )
  const notice = entries[1]
  assert.equal(notice.playerId, PINCH_HITTER)
  assert.match(notice.text, /Pinch-hitter Jim Judge replaces Ben Bell/)
})

test('pinchHittingBatter resolves the notice card fields the same way the other substitution resolvers do', () => {
  const feed = buildFeed()
  const batter = pinchHittingBatter(feed, PINCH_HITTER)
  assert.deepEqual(batter, { id: PINCH_HITTER, name: 'Judge, Jim', jersey: '24' })
  assert.equal(pinchHittingBatter(feed, null), null)
})

// The notice trails the PREVIOUS at-bat's window (ADR-0016), so the next
// batter's own window — the live "next at-bat" view — repeated nothing. The
// lead-in is read off the window bounds: whatever trailed the previous at-bat
// inside the previous window.
const kinds = (list) => list.map((e) => e.eventType)
const leadIns = (entries) => {
  const wins = focusWindows(entries, entries.length)
  return wins.map((_, i) => kinds(windowLeadIn(entries, wins, i)))
}
function judgeFeed(head) {
  const feed = buildFeed()
  const judge = structuredClone(PINCH_HIT_PLAY)
  feed.liveData.plays.allPlays[1] = judge
  judge.playEvents = [...head, ...judge.playEvents]
  return feed
}
const PITCHING_CHANGE = { details: { eventType: 'pitching_substitution', description: 'Pitching Change' }, position: { abbreviation: 'P' }, player: { id: 77 } }
const MOUND_VISIT = { details: { eventType: 'mound_visit', description: 'Mound visit.' } }
const STEAL = { details: { eventType: 'stolen_base_2b', description: 'Aaron Ashby steals (1) 2nd base.' }, player: { id: LEADOFF } }

test('the next batter’s window repeats the notice that trailed the previous one', () => {
  const entries = computeHalfInningFeed(buildFeed(), 3, 'top', 'away')
  assert.deepEqual(leadIns(entries), [[], ['pinch_hitting']], 'the half’s first batter has nothing before him to repeat')
})

test('a notice between pitches leads its own window, so it is not repeated', () => {
  const feed = buildFeed()
  const judge = structuredClone(PINCH_HIT_PLAY)
  feed.liveData.plays.allPlays[1] = judge
  judge.playEvents = [judge.playEvents[1], judge.playEvents[0], ...judge.playEvents.slice(2)]
  assert.deepEqual(leadIns(computeHalfInningFeed(feed, 3, 'top', 'away')), [[], []])
})

test('a mound visit and a pitching change both repeat, in feed order', () => {
  const entries = computeHalfInningFeed(judgeFeed([MOUND_VISIT, PITCHING_CHANGE]), 3, 'top', 'away')
  assert.deepEqual(leadIns(entries), [[], ['mound_visit', 'pitching_substitution', 'pinch_hitting']])
})

test('the lead-in stops at the first between-pitches note, the same boundary focusWindows uses', () => {
  // [Ashby, pinch hit, steal (midAtBat), mound visit, Judge]: the steal opens
  // Judge's window, so the visit after it is already there; only the pinch-hit
  // notice before it trailed Ashby's window.
  const feed = judgeFeed([])
  const ev = feed.liveData.plays.allPlays[1].playEvents
  ev.splice(1, 0, STEAL, MOUND_VISIT)
  const entries = computeHalfInningFeed(feed, 3, 'top', 'away')
  assert.deepEqual(kinds(entries.filter((e) => e.kind === 'event')), ['pinch_hitting', 'stolen_base_2b', 'mound_visit'])
  assert.deepEqual(leadIns(entries), [[], ['pinch_hitting']])
})

test('a pitching change after a between-pitches note is in the window already, so it is not repeated', () => {
  const entries = computeHalfInningFeed(judgeFeed([STEAL, PITCHING_CHANGE]), 3, 'top', 'away')
  assert.deepEqual(leadIns(entries), [[], []])
  // The lead-in is the one source of a repeat: no card carries a second one.
  for (const e of entries) assert.equal(e.reliefPitcherId, undefined)
})

test('a pitching change with no arm on record still repeats, for the plain note to show', () => {
  const feed = judgeFeed([{ ...PITCHING_CHANGE, player: undefined }])
  const entries = computeHalfInningFeed(feed, 3, 'top', 'away')
  const wins = focusWindows(entries, entries.length)
  const repeat = windowLeadIn(entries, wins, 1).find((e) => e.eventType === 'pitching_substitution')
  assert.ok(repeat, 'the change is in the lead-in')
  assert.equal(pitchingChangePitcher(feed, repeat.playerId), null, 'no card to draw, so PlayByPlay falls back to EventNote')
})

test('a window repeats only notes under the reveal cap, at every cap', () => {
  const entries = computeHalfInningFeed(judgeFeed([MOUND_VISIT]), 3, 'top', 'away')
  assert.deepEqual(kinds(entries.filter((e) => e.kind === 'event')), ['mound_visit', 'pinch_hitting'])
  for (let cap = 0; cap <= entries.length; cap++) {
    const wins = focusWindows(entries, cap)
    const leads = wins.map((_, i) => windowLeadIn(entries, wins, i))
    for (const e of leads.flat()) assert.ok(entries.indexOf(e) < cap, `cap ${cap}: a repeat past the cap`)
    // Judge's window, the only one with a lead-in, exists only once his at-bat is revealed.
    assert.deepEqual(kinds(leads.at(-1) ?? []), cap === entries.length ? ['mound_visit', 'pinch_hitting'] : [])
  }
})

test('a stacked half (no window picked) repeats nothing', () => {
  const entries = computeHalfInningFeed(buildFeed(), 3, 'top', 'away')
  assert.deepEqual(windowLeadIn(entries, focusWindows(entries, entries.length), null), [])
})

// Only the managers' notices repeat (ADR-0016): a standalone play between
// batters (a pickoff, a caught stealing or a balk with no pitch, pushed with
// midAtBat false) is a scored play, and drawing it twice invites logging the
// out twice.
test('a standalone play between batters is not repeated; the managers’ notices are', () => {
  const ev = (eventType) => ({ kind: 'event', eventType, midAtBat: false })
  const entries = [
    { kind: 'atbat' },
    ev('pickoff_caught_stealing_2b'), ev('mound_visit'), ev('balk'), ev('pitching_substitution'),
    ev('pinch_hitting'), ev('pinch_running'), ev('defensive_substitution'), ev('defensive_switch'),
    ev('ejection'), ev('game_advisory'),
    { kind: 'atbat' },
  ]
  const wins = focusWindows(entries, entries.length)
  assert.deepEqual(kinds(windowLeadIn(entries, wins, 1)), [
    'mound_visit', 'pitching_substitution', 'pinch_hitting', 'pinch_running',
    'defensive_substitution', 'defensive_switch', 'ejection', 'game_advisory',
  ])
})

// The render half, read off the source the way button-placement.test.js does
// (the suite runs no JSX): a repeat never carries the departing arm's line, a
// repeated change is the short card, and the repeat wrapper is the only one.
test('PlayByPlay draws a repeat as the short card, with no handoff line and one wrapper', () => {
  const src = (rel) => readFileSync(new URL(`../src/components/playbyplay/${rel}`, import.meta.url), 'utf8')
  const pbp = src('PlayByPlay.jsx')
  assert.match(pbp, /const finals =\s+repeat \|\| entry\.atBatIndex == null/)
  // When it happened, never "Earlier": a repeat may be a note the reader never saw.
  assert.match(pbp, /\{repeat && <span className="pbp__repeat-tag">Before this at-bat<\/span>\}/)
  const shortAt = pbp.indexOf("} else if (repeat && entry.eventType === 'pitching_substitution') {")
  const fullAt = pbp.indexOf("} else if (entry.eventType === 'pitching_substitution') {")
  assert.ok(shortAt > 0 && shortAt < fullAt, 'the repeat branch comes before the full card')
  assert.match(pbp.slice(shortAt, fullAt), /<ReliefRepeat\b/)
  assert.doesNotMatch(pbp.slice(shortAt, fullAt), /PitcherCard|DepartureLineCard/)
  const relief = src('PitcherNotice.jsx').split('export function ReliefRepeat')[1].split('\nexport ')[0]
  assert.doesNotMatch(relief, /pbp__entry/, 'PlayByPlay owns the wrapper; no nested .pbp__entry')
})

// The spoiler invariant, on the captured game it is pinned to (see
// invariant-real-game.test.js). At every cap of every half, every note a window
// repeats sits under the cap, before that window, after the previous at-bat,
// and never between pitches — so a repeat shows only what a tap already showed.
test('on the captured game, a lead-in never repeats past the cap or into its own window', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'))
  let repeated = 0
  for (let inning = 1; inning <= feed.liveData.linescore.innings.length; inning++) {
    for (const half of ['top', 'bottom']) {
      const all = computeHalfInningFeed(feed, inning, half, half === 'top' ? 'away' : 'home')
      for (let cap = 0; cap <= all.length; cap++) {
        const entries = computeHalfInningFeed(feed, inning, half, half === 'top' ? 'away' : 'home', cap)
        const wins = focusWindows(entries, cap)
        for (let i = 0; i < wins.length; i++) {
          for (const e of windowLeadIn(entries, wins, i)) {
            const at = entries.indexOf(e)
            assert.ok(at < cap && at < wins[i].start, `${half} ${inning} cap ${cap}: a repeat past the cap or inside its window`)
            assert.equal(e.kind, 'event')
            assert.ok(!e.midAtBat, 'a between-pitches note leads its own window, never repeats')
            assert.ok(entries.slice(at, wins[i].start).every((x) => x.kind !== 'atbat'), 'a repeat from before the previous at-bat')
            if (cap === all.length) repeated += 1
          }
        }
      }
    }
  }
  assert.ok(repeated > 5, `expected the game to repeat some notes, saw ${repeated}`)
})
