// The lens's pitcher at the frontier (#724, slice L5): src/lib/scorecard/arm.js.
//
// WHEN A PITCHING CHANGE BECOMES VISIBLE is the spoiler-sensitive part (G9,
// G19, ADR-0016 "What one step contains"). Three cases, each pinned:
//   - LEADOFF: a change at the head of a half shows from the half's first
//     frame (selectPrePitchChanges at revealedThrough + 1). Real game 823035,
//     top 8.
//   - MID-HALF: the change trails the step that retires the batter before the
//     new arm, so it shows right after that tap. Real game 823035, top 6.
//   - BETWEEN PITCHES (midAtBat): the change leads the next step, so it shows
//     only after the next tap. No captured game has one; a minimal hand-built
//     feed in the shape of test/fixtures/mini-game.js stands in.
// The last test walks the whole real game and, at every step, checks that the
// arm named has already entered by the reader's gate.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { scorecardStep } from '../src/api/scorecardGame.js'
import { computeHalfInningFeed, nextStepBoundary } from '../src/api/playbyplay.js'
import { halfIndex, selectPrePitchChanges } from '../src/api/select.js'
import { armWords, enteringDefense, frontierArmChange } from '../src/lib/scorecard/arm.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

const at = (inning, half, count) => ({ inning, half, count })
const before = (inning, half) => halfIndex(inning, half) - 1
const entries = (feed, inning, half) =>
  computeHalfInningFeed(feed, inning, half, half === 'top' ? 'away' : 'home')

// ---------------------------------------------------------------------------
// The leadoff: a change between halves shows before the first tap
// ---------------------------------------------------------------------------

test('a change at the head of a half shows at its leadoff (823035 top 8: Torres)', () => {
  const arm = frontierArmChange(FEED, before(8, 'top'), at(8, 'top', 0))
  assert.equal(arm.pitcher.id, 663494)
  assert.equal(arm.pitcher.name, 'Torres, Bryan')
  assert.equal(arm.fresh, true)
  assert.equal(arm.relief, true)
  // After his first batter, he is the arm, not news.
  const after = frontierArmChange(FEED, before(8, 'top'), at(8, 'top', nextStepBoundary(entries(FEED, 8, 'top'), 0)))
  assert.equal(after.pitcher.id, 663494)
  assert.equal(after.fresh, false)
})

test('a leadoff with no change names the arm who closed his club’s last half, or the starter', () => {
  // Top 9: Torres finished top 8 and stays. Nothing is new.
  const arm = frontierArmChange(FEED, before(9, 'top'), at(9, 'top', 0))
  assert.equal(arm.pitcher.id, 663494)
  assert.equal(arm.fresh, false)
  // Top 1: the starter, off the boxscore's first arm, not a play. He takes
  // the mound, so he is news, as HalfInning.jsx's isFreshPitcher says.
  const first = frontierArmChange(FEED, -1, at(1, 'top', 0))
  assert.equal(first.pitcher.id, 690928)
  assert.equal(first.fresh, true)
  assert.equal(first.relief, false)
  assert.equal(first.team.id, FEED.gameData.teams.home.id)
  assert.ok(first.team.name)
})

// ---------------------------------------------------------------------------
// Mid-half: the change trails the step before the new arm's first batter
// ---------------------------------------------------------------------------

test('a mid-half change shows after the tap that retires the batter before him (823035 top 6)', () => {
  const list = entries(FEED, 6, 'top')
  // Before the tap: Vaughn is sealed and Dobbins (top 5's last arm) pitches.
  const sealed = frontierArmChange(FEED, before(6, 'top'), at(6, 'top', 0))
  assert.equal(sealed.pitcher.id, 690928)
  assert.equal(sealed.fresh, false)
  // The tap opens Vaughn's walk plus the notes that trail it: the visit and
  // the change. Shuster is announced before Bauers is opened.
  const one = nextStepBoundary(list, 0)
  assert.equal(list[one - 1].eventType, 'pitching_substitution', 'the change trails the first step')
  const now = frontierArmChange(FEED, before(6, 'top'), at(6, 'top', one))
  assert.equal(now.pitcher.id, 694363)
  assert.equal(now.fresh, true)
  assert.equal(now.relief, true)
  // His first batter opened: still the arm, no longer the notice.
  const two = nextStepBoundary(list, one)
  const next = frontierArmChange(FEED, before(6, 'top'), at(6, 'top', two))
  assert.equal(next.pitcher.id, 694363)
  assert.equal(next.fresh, false)
})

// ---------------------------------------------------------------------------
// Between pitches: a midAtBat change leads the NEXT step
// ---------------------------------------------------------------------------

// Two plays of a top 1, in the shape of test/fixtures/mini-game.js: the home
// starter #200 retires #1; then, two pitches into #2's at-bat, reliever #201
// takes over and finishes it. Built here so mini-game.js stays as the other
// suites pin it. `leadoff` drops #1, so the change lands in the half's first
// at-bat.
function midAtBatFeed({ leadoff = false } = {}) {
  const person = (id, last, first, num, hand) => ({
    id,
    fullName: `${first} ${last}`,
    lastName: last,
    firstName: first,
    useName: first,
    lastFirstName: `${last}, ${first}`,
    primaryNumber: String(num),
    ...(hand ? { pitchHand: { code: hand } } : {}),
  })
  const pitch = (code, n) => ({ isPitch: true, pitchNumber: n, details: { call: { code } } })
  const feed = {
    gamePk: 1,
    gameData: {
      status: { abstractGameState: 'Live' },
      players: {
        ID1: person(1, 'Ashby', 'Aaron', 1),
        ID2: person(2, 'Bell', 'Ben', 2),
        ID3: person(3, 'Cruz', 'Carl', 3),
        ID200: person(200, 'Starter', 'Hank', 40, 'R'),
        ID201: person(201, 'Reliever', 'Rob', 41, 'L'),
      },
    },
    liveData: {
      boxscore: { teams: { home: { pitchers: [200, 201], players: {} }, away: { pitchers: [], players: {} } } },
      linescore: { innings: [] },
      plays: {
        allPlays: [
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 0, isComplete: true },
            matchup: { pitcher: { id: 200 }, batter: { id: 1 } },
            result: { type: 'atBat', eventType: 'strikeout' },
            count: { outs: 1 },
            playEvents: [pitch('C', 1), pitch('S', 2), pitch('S', 3)],
          },
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 1, isComplete: true },
            matchup: { pitcher: { id: 201 }, batter: { id: 2 } },
            result: { type: 'atBat', eventType: 'field_out' },
            count: { outs: 2 },
            playEvents: [
              pitch('B', 1),
              pitch('B', 2),
              {
                details: { eventType: 'pitching_substitution', description: 'Pitching Change: Rob Reliever replaces Hank Starter.' },
                position: { abbreviation: 'P' },
                player: { id: 201 },
              },
              pitch('X', 3),
            ],
          },
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 2, isComplete: true },
            matchup: { pitcher: { id: 201 }, batter: { id: 3 } },
            result: { type: 'atBat', eventType: 'field_out' },
            count: { outs: 3 },
            playEvents: [pitch('X', 1)],
          },
        ],
      },
    },
  }
  if (leadoff) feed.liveData.plays.allPlays.shift()
  return feed
}

test('a change between pitches shows only after the next tap, and is never a notice', () => {
  const feed = midAtBatFeed()
  const list = entries(feed, 1, 'top')
  const note = list.findIndex((e) => e.eventType === 'pitching_substitution')
  assert.ok(note > 0 && list[note].midAtBat, 'the hand-built change is a midAtBat note')

  // After the first tap: Ashby is opened, and the change waits with Bell.
  const one = nextStepBoundary(list, 0)
  assert.ok(one <= note, 'the first step stops before the midAtBat change')
  const sealed = frontierArmChange(feed, -1, at(1, 'top', one))
  assert.equal(sealed.pitcher.id, 200, 'the starter still pitches to the sealed Bell')
  assert.equal(sealed.fresh, false)

  // The next tap opens the change and Bell's at-bat together. The reliever
  // is now the arm, but his first batter is already open: no notice.
  const two = nextStepBoundary(list, one)
  const after = frontierArmChange(feed, -1, at(1, 'top', two))
  assert.equal(after.pitcher.id, 201)
  assert.equal(after.fresh, false)
  assert.equal(after.relief, true)
})

test('a change between pitches of the leadoff at-bat does not show at the leadoff', () => {
  // The half's first play names the reliever as its pitcher: he finished the
  // at-bat. Reading it before the tap would announce him a tap early.
  const feed = midAtBatFeed({ leadoff: true })
  const sealed = frontierArmChange(feed, -1, at(1, 'top', 0))
  assert.equal(sealed.pitcher.id, 200, 'the starter, not the play’s own pitcher')
  assert.equal(sealed.fresh, true, 'the starter takes the mound: his notice, not the reliever’s')
  const after = frontierArmChange(feed, -1, at(1, 'top', nextStepBoundary(entries(feed, 1, 'top'), 0)))
  assert.equal(after.pitcher.id, 201)
  assert.equal(after.fresh, false)
})

// ---------------------------------------------------------------------------
// The gate (G9): a half past revealedThrough + 1 says nothing
// ---------------------------------------------------------------------------

test('frontierArmChange answers only for the half at revealedThrough + 1', () => {
  assert.equal(frontierArmChange(FEED, before(6, 'top') - 1, at(6, 'top', 0)), null, 'a half too far out')
  assert.equal(frontierArmChange(FEED, before(6, 'top') + 1, at(6, 'top', 0)), null, 'a half already committed')
  assert.equal(frontierArmChange(null, -1, at(1, 'top', 0)), null)
})

// ---------------------------------------------------------------------------
// The spoiler walk: at every step, no arm from past the gate
// ---------------------------------------------------------------------------

// Where each pitcher first shows to a reader: [halfIdx, entry index], with -1
// for a change announced before the half's first pitch and for a starter.
function firstSeen(feed) {
  const seen = new Map()
  const mark = (id, h, i) => {
    if (id == null) return
    const was = seen.get(id)
    if (!was || h < was[0] || (h === was[0] && i < was[1])) seen.set(id, [h, i])
  }
  for (const side of ['home', 'away']) {
    const starter = feed.liveData.boxscore.teams[side].pitchers[0]
    mark(starter, side === 'home' ? 0 : 1, -1)
  }
  for (let h = 0; h < 18; h++) {
    const inning = Math.floor(h / 2) + 1
    const half = h % 2 ? 'bottom' : 'top'
    for (const c of selectPrePitchChanges(feed, inning, half)) mark(c.pitcher?.id, h, -1)
    entries(feed, inning, half).forEach((e, i) => {
      if (e.kind === 'atbat') mark(e.pitcher?.id, h, i)
      if (e.eventType === 'pitching_substitution') mark(e.playerId, h, i)
    })
  }
  return seen
}

test('at every step of 823035, the arm named has already entered by the gate', () => {
  const seen = firstSeen(FEED)
  const counts = {}
  const countFor = (inning, half) => counts[`${inning}${half}`] ?? 0
  let through = -1
  let steps = 0
  for (;;) {
    const info = scorecardStep(FEED, through, countFor)
    if (!info) break
    const arm = frontierArmChange(FEED, through, info)
    assert.ok(arm, `an arm at ${info.half} ${info.inning}, count ${info.count}`)
    const [h, i] = seen.get(arm.pitcher.id)
    const here = through + 1
    assert.ok(
      h < here || (h === here && i < info.count) || (h === here && i === -1),
      `${arm.pitcher.name} at ${info.half} ${info.inning}, count ${info.count}: entered at [${h}, ${i}]`,
    )
    steps++
    if (info.nextCount >= info.total && info.halfOver) through++
    else counts[`${info.inning}${info.half}`] = info.nextCount
  }
  assert.ok(steps > 70, `walked the game (${steps} steps)`)
})

// ---------------------------------------------------------------------------
// The Entering card's defense line
// ---------------------------------------------------------------------------

test('enteringDefense lists the fielders new or moved before the half’s first pitch', () => {
  // Bottom 7 opens with two switches; a half with none says so.
  assert.match(enteringDefense(FEED, before(7, 'bottom'), 7, 'bottom'), /now plays/)
  assert.equal(enteringDefense(FEED, before(2, 'top'), 2, 'top'), 'No defensive changes.')
  // Gated as the selector is: a half past the reader's next one says nothing.
  assert.equal(enteringDefense(FEED, before(7, 'bottom') - 1, 7, 'bottom'), 'No defensive changes.')
})

// ---------------------------------------------------------------------------
// The words: the Entering card's pitcher line and the bar's pitcher button
// ---------------------------------------------------------------------------

test('armWords names the arm, and degrades to blanks with no name or club', () => {
  const arm = { pitcher: { name: 'Torres, Bryan', jersey: '62' }, team: { name: 'Cardinals' } }
  assert.deepEqual(armWords(arm), {
    surname: 'Torres',
    line: 'Pitching for the Cardinals: #62 Torres.',
  })
  // Minor league: no number, no club name.
  assert.deepEqual(armWords({ pitcher: { name: 'Vey, Sam', jersey: '' }, team: { name: '' } }), {
    surname: 'Vey',
    line: 'Pitching: Vey.',
  })
  // No name at all: nothing to say.
  assert.deepEqual(armWords({ pitcher: { name: '', jersey: '51' }, team: { name: 'Gulls' } }), { surname: '', line: '' })
  assert.deepEqual(armWords(null), { surname: '', line: '' })
})
