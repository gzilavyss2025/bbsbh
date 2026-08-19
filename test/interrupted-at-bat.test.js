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
import { computeHalfInningFeed, nextStepBoundary, interruptedCode } from '../src/api/playbyplay.js'
import { scorecardPlays } from '../src/api/scorecardGame.js'

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
  // No batting result — the mark is the scorer's carry-over notation (the
  // event that ended the half plus the arrow toward next inning's column),
  // penciled as a note, with no out badge and an empty diamond.
  assert.equal(lara.code, 'CS →')
  assert.equal(lara.codeKind, 'interrupted')
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
  // The pinch-run note was announced after Sánchez singled and before a pitch
  // was thrown to Lara, so it closes SÁNCHEZ's step — you learn who ran for
  // him the moment you finish charting his single, not a tap later alongside
  // the play that ended the half.
  assert.equal(nextStepBoundary(entries, 0), 2)
  // Lara's interrupted card is then its own final step, not a stranded note.
  assert.equal(nextStepBoundary(entries, 2), 3)
  assert.equal(nextStepBoundary(entries, 3), entries.length)
})

test('the pinch runner is penciled onto the origin card as soon as his notice shows', () => {
  // Stepped to exactly Sánchez's single + the pinch-run notice (cap 2, the
  // boundary above): the notice is on the page, so the strike-through-and-
  // pencil-in it describes has to be on Sánchez's card too. That annotation
  // rides the visibility gate, and this step deliberately ends MID-play —
  // after the caught-stealing play's leading notes, before its own card — so
  // the gate has to key on the notice's own position, not the whole play's.
  const entries = computeHalfInningFeed(buildFeed(), 7, 'bottom', 'home', 2)
  const sanchez = entries[0]
  assert.deepEqual(
    sanchez.pinchRunners?.map((p) => ({ id: p.id, base: p.base })),
    [{ id: 2, base: 1 }],
  )
  // …while the play that notice leads stays sealed: its out has not landed.
  // (Fully revealed, this same card reads outNumber 3 / outCode "CS 2-6".)
  assert.equal(sanchez.outNumber, null)
  assert.equal(sanchez.outCode, undefined)
  assert.equal(sanchez.outAt, undefined)
})

test('a pinch-run notice beyond the step window leaves the origin card alone', () => {
  // Cap 1 — Sánchez's single only. The notice hasn't been reached, so neither
  // has the pencil-in.
  const entries = computeHalfInningFeed(buildFeed(), 7, 'bottom', 'home', 1)
  assert.equal(entries[0].pinchRunners, undefined)
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

test('the carry-over mark tags mirror the runner-out notation', () => {
  assert.equal(interruptedCode('caught_stealing_2b'), 'CS →')
  assert.equal(interruptedCode('caught_stealing_home'), 'CS →')
  assert.equal(interruptedCode('pickoff_1b'), 'PK →')
  assert.equal(interruptedCode('pickoff_caught_stealing_2b'), 'PK →')
  assert.equal(interruptedCode('stolen_base_home'), 'SB →')
  assert.equal(interruptedCode('wild_pitch'), 'WP →')
  assert.equal(interruptedCode('passed_ball'), 'PB →')
  assert.equal(interruptedCode('balk'), 'BK →')
  // Never fabricate a tag for an unknown event — the bare arrow still says
  // "carried over" on its own.
  assert.equal(interruptedCode('something_new'), '→')
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

// ---- a plain stolen base can never end a half on its own -------------------

test('a mid-count stolen base transiently surfacing as its own play is NOT carded as interrupted', () => {
  // The live feed's own transient artifact (same class already documented for
  // mound visits/pitching changes at the top of playbyplay.js): mid-poll, a
  // stolen base mid-count shows up as its own top-level play — carrying the
  // pitches thrown SO FAR to the batter still up — before the feed folds it
  // into that still-in-progress plate appearance. No runner is out and the
  // game is still Live, so this play can never be the one that ends the half;
  // it must fall through to a plain "stole 2nd base" event note, not the
  // "at-bat not completed" interrupted card (which incorrectly implied the
  // inning had ended on the bases while Lara was still batting).
  const sbPlay = {
    about: { inning: 7, halfInning: 'bottom', atBatIndex: 51 },
    matchup: { batter: { id: 3, fullName: 'Luis Lara' }, pitcher: { id: 4 }, batSide: { code: 'L' } },
    result: {
      type: 'atBat',
      eventType: 'stolen_base_2b',
      description: 'Cooper Pratt steals 2nd base.',
      rbi: 0,
    },
    count: { balls: 1, strikes: 2, outs: 2 },
    playEvents: [pitch('C', 1), pitch('S', 2), pitch('F', 3), pitch('B', 4)],
    runners: [
      {
        details: { runner: { id: 2, fullName: 'Cooper Pratt' }, eventType: 'stolen_base_2b' },
        movement: { start: '1B', end: '2B', isOut: false },
      },
    ],
  }
  const feed = buildFeed(sbPlay)
  feed.gameData.status = { abstractGameState: 'Live' }
  const entries = computeHalfInningFeed(feed, 7, 'bottom', 'home')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Sánchez', 'event:stolen_base_2b'],
  )
  const note = entries[1]
  assert.notEqual(note.kind, 'atbat')
  assert.equal(note.playerId, 2) // the runner who stole, not the batter
  assert.match(note.segments.map((s) => s.text).join(''), /steals 2nd base/)
})

test('a caught stealing for only the 1st or 2nd out is NOT carded as interrupted', () => {
  // Same top-level-play shape as the genuine inning-ending caught stealing
  // (csPlay above), but count.outs is 2, not 3 — this out did NOT end the
  // half, so the batter is still up and the "at-bat not completed, the
  // inning ended on the bases" card would be a lie. Must fall through to the
  // plain caught-stealing event note instead, same as the SB case.
  const play = csPlay()
  play.count = { balls: 1, strikes: 2, outs: 2 }
  play.runners[0].movement.outNumber = 2
  const feed = buildFeed(play)
  feed.gameData.status = { abstractGameState: 'Live' }
  const entries = computeHalfInningFeed(feed, 7, 'bottom', 'home')
  assert.deepEqual(
    entries.map((e) => (e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`)),
    ['atbat:Sánchez', 'event:pinch_running', 'event:caught_stealing_2b'],
  )
  const note = entries.at(-1)
  assert.notEqual(note.kind, 'atbat')
})

test('a walk-off steal (game Final) still gets the interrupted at-bat card', () => {
  // The one legitimate case a plain steal DOES end the half: it also ends the
  // GAME (a walk-off steal of home). Distinguished from the transient case
  // above by the game's own status, not by the eventType.
  const sbPlay = {
    about: { inning: 9, halfInning: 'bottom', atBatIndex: 51 },
    matchup: { batter: { id: 3, fullName: 'Luis Lara' }, pitcher: { id: 4 }, batSide: { code: 'L' } },
    result: {
      type: 'atBat',
      eventType: 'stolen_base_home',
      description: 'Cooper Pratt steals home.',
      rbi: 0,
    },
    count: { balls: 1, strikes: 2, outs: 1 },
    playEvents: [pitch('C', 1), pitch('S', 2), pitch('F', 3), pitch('B', 4)],
    runners: [
      {
        details: { runner: { id: 2, fullName: 'Cooper Pratt' }, eventType: 'stolen_base_home' },
        movement: { start: '3B', end: 'score', isOut: false },
      },
    ],
  }
  const feed = buildFeed(sbPlay)
  feed.gameData.status = { abstractGameState: 'Final' }
  const entries = computeHalfInningFeed(feed, 9, 'bottom', 'home')
  const lara = entries.at(-1)
  assert.equal(lara.kind, 'atbat')
  assert.equal(lara.interrupted, true)
  assert.equal(lara.code, 'SB →')
})

// ---- Scorecard Lab: the cell shows, the tallies don't move ------------------

test('the scorecard grid shows the interrupted cell but charges no at-bat', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom', { through: Infinity })
  const sanchezSlot = grid.slots[7] // slot 8
  const laraSlot = grid.slots[8] // slot 9
  assert.equal(sanchezSlot.ab, 1) // the single is a real AB
  assert.equal(sanchezSlot.h, 1)
  const inning7Col = grid.columns.findIndex((c) => c.inning === 7)
  const cell = laraSlot.cells[inning7Col]
  assert.equal(cell.interrupted, true)
  assert.equal(cell.code, 'CS →') // the outcome box shows the carry-over mark
  assert.equal(cell.outType, '') // …not an out classification
  assert.equal(cell.ladder.length, 4) // the pitches still ink the strip
  assert.equal(laraSlot.ab, 0) // …but no official at-bat is charged
})
