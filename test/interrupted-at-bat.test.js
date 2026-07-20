// The interrupted at-bat: a top-level baserunning play (NON_PA_EVENT_TYPES)
// that ends the half mid-count carries the pitches thrown to whoever was up —
// they are NOT re-listed when his at-bat restarts from scratch next inning.
// Before the fix pinned here, computeHalfInningFeed dropped that play
// entirely: no card for the batter (his pitches showed in the half's PITCHES
// total but nowhere in the play-by-play) and no trace of the play's prose
// (which lives only in result.description for a top-level play — there is no
// nested playEvent note to collect).
//
// The fixture mirrors the REAL play this bug was found on, field for field:
// gamePk 823764 (2026-07-19 MIA@MIL), bottom 7 — Gary Sánchez singles, Cooper
// Pratt pinch-runs for him, and with Luis Lara 1-2 at the plate Pratt is
// caught stealing 2nd (catcher to shortstop, "CS 2-6") for out 3. Lara led
// off the bottom 8 with a fresh 0-0 count; his 4 bottom-7 pitches exist only
// on the caught_stealing_2b play.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed, nextStepBoundary } from '../src/api/playbyplay.js'
import { scorecardPlays } from '../src/api/loadScorecard.js'

// ---- fixture --------------------------------------------------------------

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const PLAYERS = {
  ID1: person(1, 'Sánchez', 'Gary'),
  ID2: person(2, 'Pratt', 'Cooper'),
  ID3: person(3, 'Lara', 'Luis'),
  ID4: { ...person(4, 'Gibson', 'Cade'), pitchHand: { code: 'L' } },
  ID8: person(8, 'Hicks', 'Liam'),
  ID9: person(9, 'Sanoja', 'Javier'),
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

// The pinch-runner substitution playEvent, exactly as the real feed nests it
// inside the caught_stealing_2b play (field paths per playbyplay.js's prAlias
// doc, verified against gamePk 776137/776141 and again on 823764).
function pinchRunEvent() {
  return {
    details: {
      eventType: 'offensive_substitution',
      description: 'Offensive Substitution: Pinch-runner Cooper Pratt replaces Gary Sánchez.',
    },
    position: { abbreviation: 'PR' },
    player: { id: 2 },
    replacedPlayer: { id: 1 },
    base: 1,
  }
}

// The half-ending play: Lara mid-count (C,S,F,B = 1-2) when Pratt is thrown
// out at 2nd. result.type is 'atBat' with the baserunning eventType, the
// prose lives ONLY in result.description, and the caught runner rides
// runners[] with the catcher-assist/shortstop-putout credits ("CS 2-6").
function csPlay() {
  return {
    about: { inning: 7, halfInning: 'bottom', atBatIndex: 51 },
    matchup: { batter: { id: 3, fullName: 'Luis Lara' }, pitcher: { id: 4 }, batSide: { code: 'L' } },
    result: {
      type: 'atBat',
      eventType: 'caught_stealing_2b',
      description: 'Cooper Pratt caught stealing 2nd base, catcher Liam Hicks to shortstop Javier Sanoja.',
      rbi: 0,
    },
    count: { balls: 1, strikes: 2, outs: 3 },
    playEvents: [pinchRunEvent(), pitch('C', 1), pitch('S', 2), pitch('F', 3), pitch('B', 4)],
    runners: [
      {
        details: { runner: { id: 2, fullName: 'Cooper Pratt' }, eventType: 'caught_stealing_2b' },
        movement: { start: '1B', end: null, isOut: true, outBase: '2B', outNumber: 3 },
        credits: [
          { position: { code: '2' }, credit: 'f_assist' },
          { position: { code: '6' }, credit: 'f_putout' },
        ],
      },
    ],
  }
}

function buildFeed(lastPlay = csPlay()) {
  return {
    gamePk: 823764,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 7, innings: [] },
      boxscore: {
        teams: {
          home: {
            players: {
              ID1: { person: { id: 1 }, battingOrder: '800', position: { abbreviation: 'C' }, allPositions: [{ abbreviation: 'C' }] },
              ID2: { person: { id: 2 }, battingOrder: '801', position: { abbreviation: 'PR' } },
              ID3: { person: { id: 3 }, battingOrder: '901', position: { abbreviation: 'PH' } },
            },
          },
          away: { players: {} },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 7, halfInning: 'bottom', atBatIndex: 50 },
            matchup: { batter: { id: 1, fullName: 'Gary Sánchez' }, pitcher: { id: 4 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'single',
              description: 'Gary Sánchez singles on a line drive to center fielder Jakob Marsee.',
              rbi: 0,
            },
            count: { balls: 1, strikes: 0, outs: 2 },
            playEvents: [pitch('B', 1), pitch('D', 2)],
            runners: [
              {
                details: { runner: { id: 1, fullName: 'Gary Sánchez' }, eventType: 'single' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
          lastPlay,
        ],
      },
    },
  }
}

// ---- the regression: the interrupted at-bat gets a card --------------------

test('an inning-ending caught stealing mid-count yields an interrupted at-bat card', () => {
  const entries = computeHalfInningFeed(buildFeed(), 7, 'bottom', 'home')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Sánchez', 'event:pinch_running', 'atbat:Lara'],
  )

  const lara = entries[2]
  assert.equal(lara.interrupted, true)
  // The pitches thrown to him — the only record of them in the half.
  assert.deepEqual(lara.pitches, ['C', 'S', 'F', 'B'])
  // No batting result: no scorebook code, no out badge, an empty diamond.
  assert.equal(lara.code, '')
  assert.equal(lara.codeKind, 'none')
  assert.equal(lara.outNumber, null)
  assert.equal(lara.reached, 0)
  assert.equal(lara.scored, false)
  // The card says why it has no result, count included (it carries over
  // nowhere — the batter restarts at 0-0 next inning).
  const desc = lara.descSegments.map((s) => s.text).join('')
  assert.match(desc, /not completed/i)
  assert.match(desc, /1-2/)
  // His interrupted trip must NOT claim the half's runner bookkeeping — the
  // pitcher he faced and his own identity still resolve for the zone panel.
  assert.equal(lara.batterId, 3)
  assert.equal(lara.pitcher.id, 4)
})

test("the play's prose survives as a baserunning note on the interrupted card", () => {
  const entries = computeHalfInningFeed(buildFeed(), 7, 'bottom', 'home')
  const lara = entries[2]
  assert.equal(lara.baserunningNotes.length, 1)
  const note = lara.baserunningNotes[0]
  assert.equal(note.eventType, 'caught_stealing_2b')
  assert.equal(note.runnerId, 2) // the caught runner, not the batter
  assert.match(note.segments.map((s) => s.text).join(''), /caught stealing 2nd base/)
})

test('a nested note with the same eventType is not doubled by result.description', () => {
  const play = csPlay()
  // Some feed variants DO nest the account as a playEvent — the top-level
  // description must not add a second copy of the same story.
  play.playEvents.push({
    details: { eventType: 'caught_stealing_2b', description: 'Cooper Pratt caught stealing 2nd base.' },
    player: { id: 2 },
  })
  const entries = computeHalfInningFeed(buildFeed(play), 7, 'bottom', 'home')
  const lara = entries.at(-1)
  assert.equal(lara.interrupted, true)
  assert.equal(lara.baserunningNotes.length, 1)
})

test("the caught runner's out still lands on his origin card, not the interrupted one", () => {
  const entries = computeHalfInningFeed(buildFeed(), 7, 'bottom', 'home')
  const sanchez = entries[0]
  // Pratt pinch-ran for Sánchez, so the out resolves through the PR alias to
  // Sánchez's card: out 3, cut down at 2nd, catcher-to-shortstop.
  assert.equal(sanchez.outNumber, 3)
  assert.equal(sanchez.outAt, 2)
  assert.equal(sanchez.outCode, 'CS 2-6')
  assert.deepEqual(sanchez.pinchRunners.map((p) => ({ id: p.id, base: p.base })), [{ id: 2, base: 1 }])
})

test('at-bat stepping treats the interrupted card as its own step', () => {
  const entries = computeHalfInningFeed(buildFeed(), 7, 'bottom', 'home')
  // From after Sánchez's card, one tap bundles the pinch-run note with Lara's
  // interrupted card — the half's true final step, not a stranded note.
  assert.equal(nextStepBoundary(entries, 1), 3)
  assert.equal(nextStepBoundary(entries, 3), entries.length)
})

test('a pitch-less baserunning play still falls back to a standalone event note', () => {
  // A pickoff before any pitch to the new batter: nothing to card, so the
  // prose gets its own note entry (the pre-fix path, still correct).
  const entries = computeHalfInningFeed(
    buildFeed({
      about: { inning: 7, halfInning: 'bottom', atBatIndex: 51 },
      matchup: { batter: { id: 3, fullName: 'Luis Lara' }, pitcher: { id: 4 } },
      result: {
        type: 'atBat',
        eventType: 'pickoff_1b',
        description: 'Gary Sánchez picked off 1st base, pitcher Cade Gibson to first baseman.',
        rbi: 0,
      },
      count: { balls: 0, strikes: 0, outs: 3 },
      playEvents: [],
      runners: [
        {
          details: { runner: { id: 1, fullName: 'Gary Sánchez' }, eventType: 'pickoff_1b' },
          movement: { start: '1B', end: null, isOut: true, outBase: '1B', outNumber: 3 },
          credits: [
            { position: { code: '1' }, credit: 'f_assist' },
            { position: { code: '3' }, credit: 'f_putout' },
          ],
        },
      ],
    }),
    7,
    'bottom',
    'home',
  )
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Sánchez', 'event:pickoff_1b'],
  )
  assert.equal(entries[1].playerId, 1) // the picked-off runner
  assert.match(entries[1].segments.map((s) => s.text).join(''), /picked off 1st base/)
  assert.equal(entries[0].outNumber, 3)
  assert.equal(entries[0].outCode, 'PK 1-3')
})

test('a game advisory still produces no card and no note', () => {
  const entries = computeHalfInningFeed(
    buildFeed({
      about: { inning: 7, halfInning: 'bottom', atBatIndex: 51 },
      matchup: { batter: { id: 3, fullName: 'Luis Lara' }, pitcher: { id: 4 } },
      result: { type: 'atBat', eventType: 'game_advisory', description: 'Status Change - In Progress.' },
      count: { balls: 0, strikes: 0, outs: 2 },
      playEvents: [],
      runners: [],
    }),
    7,
    'bottom',
    'home',
  )
  assert.deepEqual(entries.map((e) => e.kind), ['atbat'])
})

// ---- Scorecard Lab: the cell shows, the tallies don't move ------------------

test('the scorecard grid shows the interrupted cell but charges no at-bat', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom')
  const sanchezSlot = grid.slots[7] // slot 8
  const laraSlot = grid.slots[8] // slot 9
  assert.equal(sanchezSlot.ab, 1) // the single is a real AB
  assert.equal(sanchezSlot.h, 1)
  const inning7Col = grid.columns.findIndex((c) => c.inning === 7)
  const cell = laraSlot.cells[inning7Col]
  assert.equal(cell.interrupted, true)
  assert.equal(cell.ladder.length, 4) // the pitches still ink the strip
  assert.equal(laraSlot.ab, 0) // …but no official at-bat is charged
})
