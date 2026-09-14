// Express Lane — the held play (src/lib/expresslane/hold.js).
//
// The film gate stops the CURSOR until the clip is on the device. It never
// stopped the NOTATION landing in the same frame, so the outcome box was
// readable before the pitch was thrown on the screen. The hold is what closes
// that, and these are its three rules.
//
// The last group runs against the captured real game (gamePk 823035), because
// the claim being made is not about the flag — it is about what the DECK draws
// while the flag is set, over unedited MLB output.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { holdsForFilm, playStory, unwrittenRow } from '../src/lib/expresslane/hold.js'
import {
  consentToSkip,
  createJob,
  enqueueHalf,
  gateFor,
  GATE_REASONS,
  markEvicted,
  markStaged,
  markUnfilmed,
} from '../src/lib/expresslane/staging.js'
import { battingSideOf, expressDeck, reachedPlateAppearances } from '../src/api/expresslane/runners.js'
import { buildRail, resultModeRows } from '../src/api/expresslane/rail.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

// --- which rows hold ------------------------------------------------------

test('a row holds only when its film is on the screen', () => {
  assert.equal(holdsForFilm({ reason: 'ready' }), true)
  for (const reason of GATE_REASONS.filter((r) => r !== 'ready')) {
    assert.equal(holdsForFilm({ reason }), false, `${reason} has nothing to watch`)
  }
})

test('a missing gate never holds', () => {
  assert.equal(holdsForFilm(null), false)
  assert.equal(holdsForFilm(undefined), false)
  assert.equal(holdsForFilm({}), false)
})

// The four ways a row reaches the deck with an empty film pane. Each is asked
// of the real gate rather than of a hand-written reason string, so a rename in
// staging.js cannot leave this file agreeing with itself and nothing else.
test('the gate itself says which rows have a picture to hold back', () => {
  const pitch = { key: 'a', playId: 'a', halfIndex: 0 }
  const dud = { key: 'b', playId: 'b', halfIndex: 0 }
  const gone = { key: 'c', playId: 'c', halfIndex: 0 }
  const skipped = { key: 'd', playId: 'd', halfIndex: 0 }
  const visit = { key: 'e', playId: null, halfIndex: 0 }
  let job = enqueueHalf(createJob({ gamePk: 823035 }), [pitch, dud, gone, skipped, visit])
  job = markStaged(job, 'a', 1)
  job = markStaged(job, 'd', 1)
  job = markUnfilmed(job, 'b')
  job = markEvicted(job, 'c')
  job = consentToSkip(job, 'd')

  assert.equal(holdsForFilm(gateFor(job, pitch)), true, 'staged: the clip is playing')
  assert.equal(holdsForFilm(gateFor(job, dud)), false, 'no film was ever cut for it')
  assert.equal(holdsForFilm(gateFor(job, gone)), false, 'the bytes were let go behind the cursor')
  assert.equal(holdsForFilm(gateFor(job, skipped)), false, 'the scorer chose to score it blind')
  assert.equal(holdsForFilm(gateFor(job, visit)), false, 'paperwork has nothing to watch')
})

// --- the row the deck reads while the play is held -------------------------

test('a held row is the same row, not yet terminal', () => {
  const row = { key: 'k', playId: 'p', atBatIndex: 12, isTerminal: true, result: { event: 'Single' } }
  const held = unwrittenRow(row)
  assert.equal(held.isTerminal, false)
  assert.equal(held.key, 'k')
  assert.equal(held.atBatIndex, 12)
  assert.equal(row.isTerminal, true, 'the original row is not mutated')
})

test('no row, nothing to hold', () => {
  assert.equal(unwrittenRow(null), null)
  assert.equal(unwrittenRow(undefined), null)
})

// --- the play's own sentence ----------------------------------------------

test('a finished play tells its own story, runners and all', () => {
  const row = {
    isTerminal: true,
    description: 'In play, out(s)',
    result: { description: 'Ketel Marte grounds out, second baseman to first baseman.' },
  }
  assert.match(playStory(row), /grounds out/)
})

test('a pitch with no play of its own falls back to what the pitch was', () => {
  assert.equal(playStory({ description: 'Called Strike', result: null }), 'Called Strike')
  assert.equal(playStory({ description: 'Foul' }), 'Foul')
})

test('a row with nothing to say says nothing', () => {
  assert.equal(playStory(null), '')
  assert.equal(playStory({}), '')
  assert.equal(playStory({ description: '', result: { description: '' } }), '')
})

// --- over the captured game: what the deck draws while a play is held ------

// Every half of gamePk 823035 that had a man bat in it.
function playedHalves() {
  const out = []
  for (let inning = 1; inning <= 12; inning += 1) {
    for (const half of ['top', 'bottom']) {
      if (computeHalfInningFeed(FEED, inning, half, battingSideOf(half)).length) {
        out.push([inning, half])
      }
    }
  }
  return out
}

// Result mode's rows for one half — the terminal row of each plate appearance,
// plus the paperwork that rides along with it.
function terminalRows(inning, half) {
  return resultModeRows(buildRail(FEED, inning, half)).filter((row) => row.isTerminal)
}

test('a held play has no box, no chip and no diamond of its own', () => {
  let checked = 0
  for (const [inning, half] of playedHalves()) {
    let previous = null
    for (const row of terminalRows(inning, half)) {
      const held = expressDeck(FEED, inning, half, unwrittenRow(row))
      const written = expressDeck(FEED, inning, half, row)
      const where = `${inning} ${half} #${row.atBatIndex}`

      // THE BOX. Held, the deck's main box is AtBatBox's empty template — the
      // box as the paper has it before the play is written down.
      assert.equal(held.batter, null, `${where}: box drawn while held`)
      assert.ok(written.batter, `${where}: box missing once written`)

      // THE CAP. One card short of the written deck, every time: the play the
      // cursor is on is not in `entries` at all, so nothing downstream of it
      // can draw the play and then cover it.
      assert.equal(held.cap, written.cap - 1, `${where}: held cap`)
      assert.equal(held.entries.length, held.cap, `${where}: held entries`)
      for (const card of held.entries) {
        assert.notEqual(card.atBatIndex, row.atBatIndex, `${where}: this play is in the entries`)
      }

      // THE HELD DECK IS THE DECK ONE PLAY AGO, card for card. This is the
      // assertion with teeth, and it is stronger than "the entries are a prefix
      // of the written ones" — which is FALSE, because a play writes back onto
      // the cards above it. The force out that erases the man on first adds an
      // `outAt` to HIS card, three rows up the sheet. Slicing the written deck
      // would carry that write-back into the held state and show the runner
      // rubbed out while the scorer was still watching the throw.
      if (previous && previous.cap === held.cap) {
        assert.deepEqual(held.entries, previous.entries, `${where}: held state moved early`)
      }

      // THE CHIP. The foot strip is built off those same entries, so the play
      // being watched has no chip — and a chip carries its plate appearance's
      // outcome code, which is the whole play in two characters.
      const heldChips = reachedPlateAppearances(held.entries)
      assert.ok(
        !heldChips.some((chip) => chip.atBatIndex === row.atBatIndex),
        `${where}: chip drawn while held`,
      )

      // THE MEN ON BASE stand where they stood before the pitch. Anything this
      // play moved is not on the held deck to be read off.
      for (const { card } of held.runners) {
        assert.notEqual(card.atBatIndex, row.atBatIndex, `${where}: this play's runner is on base`)
      }

      // And the batter is still NAMED, because who is at the plate is pre-pitch
      // fact the due-up console already shows. A held deck is not a blank one.
      assert.ok(held.pending?.last, `${where}: nobody at the plate`)
      previous = written
      checked += 1
    }
  }
  // The captured game is a real one; if the walk above ever stops finding plate
  // appearances, the assertions inside it stop meaning anything.
  assert.ok(checked > 50, `only ${checked} plate appearances walked`)
})

// The write-back trap, named. In the bottom of the 2nd of the captured game
// José Fermín singles (plate appearance 13) and Blaze Jordan forces him at
// second on the next one (14). Jordan's play is what puts `outAt: 2` and the
// "FC 6-4" chain onto FERMIN's box — a card three rows up the sheet. Held, that
// box has to still read as a clean single, or the scorer learns the runner was
// erased before he has watched the throw that erased him.
test('a held play has not yet rubbed out the runner it erases', () => {
  const row = terminalRows(2, 'bottom').find((r) => r.atBatIndex === 14)
  assert.ok(row, 'the force out is in the captured game')

  const fermin = (deck) => deck.entries.find((card) => card.atBatIndex === 13)
  const held = fermin(expressDeck(FEED, 2, 'bottom', unwrittenRow(row)))
  const written = fermin(expressDeck(FEED, 2, 'bottom', row))

  assert.equal(held.code, '1B')
  assert.equal(held.outAt, undefined, 'held: the runner is still standing on first')
  assert.equal(held.outCode, undefined)
  assert.equal(written.outAt, 2, 'written: the force out is on his box')
  assert.equal(written.outCode, 'FC 6-4')
})

test('every finished plate appearance in the captured game has a sentence to show', () => {
  for (const [inning, half] of playedHalves()) {
    for (const row of terminalRows(inning, half)) {
      assert.ok(
        playStory(row).length > 0,
        `${inning} ${half} #${row.atBatIndex} has no play-by-play line`,
      )
    }
  }
})
