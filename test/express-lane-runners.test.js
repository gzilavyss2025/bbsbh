// Express Lane — the scoring deck's runner functions (src/api/expresslane/runners.js).
//
// Run against the captured real game (gamePk 823035), because the thing under
// test is a claim about unedited MLB output: that "reached a base, has not
// scored, was not put out" names exactly the men standing on base.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  runnersDeparted,
  runnersOnBase,
} from '../src/api/expresslane/runners.js'
import { battingSideOf } from '../src/api/gameday/stepCut.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { halfIndex } from '../src/api/select.js'
import { halfAt } from '../src/api/scorecard/alignment.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

// Every half in the captured game that has cards, as (inning, half) pairs.
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

// What a cursor sitting on the plate appearance at `index` of one half sees: the
// cards capped there (a terminal cursor includes its own card, any other stops
// short of it), and the runner functions read off them. Composed from the live
// pieces only, so the assertions below are about runnersOnBase/runnersDeparted.
function deckAt(inning, half, index, isTerminal = true) {
  const side = battingSideOf(half)
  const cap = isTerminal ? index + 1 : index
  const entries = computeHalfInningFeed(FEED, inning, half, side, cap).slice(0, cap)
  const last = cap > 0 ? entries[cap - 1] : null
  const batter = isTerminal && (last?.kind === 'atbat' || last?.kind === 'placed') ? last : null
  const exclude = batter?.atBatIndex ?? null
  const prev = cap > 1 ? computeHalfInningFeed(FEED, inning, half, side, cap - 1).slice(0, cap - 1) : []
  return {
    batter,
    entries,
    runners: runnersOnBase(entries, { excludeAtBatIndex: exclude }),
    departed: runnersDeparted(prev, entries, { excludeAtBatIndex: exclude }),
  }
}

// --- who is on base ---------------------------------------------------------

test('the bases fill correctly through a real rally', () => {
  // Top 5 of gamePk 823035: Sánchez walks, Frelick flies out, Pratt walks,
  // Ortiz singles. That is bases loaded, and each man is one base further on.
  const at = (i) => deckAt(5, 'top', i)

  const walk = at(0)
  assert.equal(walk.batter.batter.last, 'Sánchez')
  assert.deepEqual(walk.runners, [], "the batter's own box is the deck's main box")

  const flyOut = at(1)
  assert.equal(flyOut.batter.batter.last, 'Frelick')
  assert.deepEqual(
    flyOut.runners.map((r) => [r.card.batter.last, r.base]),
    [['Sánchez', 1]],
    'a fly out leaves the man on first exactly where he was',
  )

  const secondWalk = at(2)
  assert.deepEqual(
    secondWalk.runners.map((r) => [r.card.batter.last, r.base]),
    [['Sánchez', 2]],
    'the walk forces Sánchez to second',
  )

  const single = at(3)
  assert.equal(single.batter.batter.last, 'Ortiz')
  assert.deepEqual(
    single.runners.map((r) => [r.card.batter.last, r.base]),
    [
      ['Sánchez', 3],
      ['Pratt', 2],
    ],
    'ordered third then second — the order they will score in',
  )
})

test('a man erased on a fielder’s choice is not left standing on first', () => {
  // Bottom 2: Fermín singles, then Jordan reaches on a fielder's choice. The
  // naive read — "reached a base, has not scored" — puts both men on. `outAt`
  // is what tells the truth, and dropping it is the bug this pins.
  const deck = deckAt(2, 'bottom', 3)
  assert.equal(deck.batter.batter.last, 'Jordan')
  assert.equal(deck.batter.code, 'FC')
  assert.deepEqual(
    deck.runners.map((r) => r.card.batter.last),
    [],
    'Fermín was forced at second; only Jordan is on, and he is the batter',
  )
})

test('a runner’s diamond never shows a base he reaches later', () => {
  // THE POINT OF THE CAP. Sánchez walks in the top of the 5th and eventually
  // comes home. At his own plate appearance his diamond must show first base
  // and nothing more.
  const own = deckAt(5, 'top', 0)
  assert.equal(own.batter.reached, 1)
  assert.equal(own.batter.scored, false)

  // Read from the finished half instead, his card claims every base he ever
  // took. That is the value the cap exists to keep off the screen.
  const uncapped = computeHalfInningFeed(FEED, 5, 'top', 'away')
  const sanchez = uncapped.find((c) => c.batter?.last === 'Sánchez')
  assert.ok(
    sanchez.reached > 1 || sanchez.scored,
    'the uncapped feed does carry his eventual fate, so the cap is load-bearing',
  )
})

// --- invariants over the whole game ----------------------------------------

test('over every cursor in the game, no base holds two men and none holds four', () => {
  let cursors = 0
  for (const [inning, half] of playedHalves()) {
    const cards = computeHalfInningFeed(FEED, inning, half, battingSideOf(half))
    for (let i = 0; i < cards.length; i += 1) {
      const { runners, batter } = deckAt(inning, half, i)
      cursors += 1
      const bases = runners.map((r) => r.base)
      assert.equal(new Set(bases).size, bases.length, `two men on one base at ${half}${inning} #${i}`)
      assert.ok(bases.length <= 3, `four men on base at ${half}${inning} #${i}`)
      for (const b of bases) assert.ok(b >= 1 && b <= 3, 'a runner is on a base that exists')
      if (batter) {
        assert.ok(
          !runners.some((r) => r.card.atBatIndex === batter.atBatIndex),
          'the batter is never also drawn as one of his own runners',
        )
      }
    }
  }
  assert.ok(cursors > 60, `the sweep really walked the game (${cursors} cursors)`)
})

// --- the man the play took off the bases ------------------------------------
//
// THE GAP THESE PIN. `runnersOnBase` answers "who is standing on a base", and
// on the play that scores a man or cuts him down the honest answer stops
// including him. His CARD left with the answer — and that card is the diamond
// the scorer has to write this very play on: the run he brought home, or the
// force that erased him. The box went away in the same frame the thing that
// has to be written on it happened.
//
// So the deck keeps him for ONE cursor position, the play that changed him,
// and lets him go when the cursor moves on. `departed` is its own list rather
// than more entries in `runners`, because "standing on second" and "scored a
// moment ago" are different answers and only the first has a base to be on.

test('a runner who scores on the cursor play keeps his box for that one cursor', () => {
  // Top of the 3rd: Pratt triples, Ortiz strikes out, then Yelich grounds out
  // 6-3 and Pratt scores from third. Card 2 is that groundout.
  const before = deckAt(3, 'top', 1)
  assert.deepEqual(
    before.runners.map((r) => r.base),
    [3],
    'Pratt is standing on third before the play',
  )
  assert.deepEqual(before.departed, [], 'and nobody has left yet')

  const on = deckAt(3, 'top', 2)
  assert.deepEqual(on.runners, [], 'he is not on a base any more, which is true')
  assert.equal(on.departed.length, 1, 'but his box is still on the deck')
  assert.equal(on.departed[0].fate, 'scored')
  assert.equal(on.departed[0].from, 3, 'drawn where he was standing when it happened')
  assert.equal(on.departed[0].card.batter.last, 'Pratt')
  assert.equal(on.departed[0].card.scored, true, 'and his diamond is filled, to be marked')

  const after = deckAt(3, 'top', 3)
  assert.deepEqual(after.departed, [], 'gone once the cursor moves to the next play')
})

test('a runner erased on a fielder choice keeps his box, with the base he was cut down at', () => {
  // Bottom of the 2nd: Fermín is on first, Jordan hits into a fielder's choice
  // and Fermín is forced at second, 6-4. Card 3 is that play.
  const on = deckAt(2, 'bottom', 3)
  assert.equal(on.departed.length, 1)
  assert.equal(on.departed[0].fate, 'out')
  assert.equal(on.departed[0].outAt, 2, 'the base he was put out at, for the label')
  assert.equal(on.departed[0].from, 1, 'the base he was standing on before the play')
  assert.equal(on.departed[0].card.batter.last, 'Fermín')
  // The batter reached on the same play and IS the deck's main box, so he is
  // never also drawn as one of the runners beside it.
  assert.equal(on.batter.batter.last, 'Jordan')
  assert.ok(!on.departed.some((r) => r.card.atBatIndex === on.batter.atBatIndex))
})

test('two men scoring on one play both keep their boxes', () => {
  // Top of the 5th: Lara singles with Sánchez and Pratt aboard, and both score.
  const on = deckAt(5, 'top', 5)
  assert.equal(on.departed.length, 2)
  assert.ok(on.departed.every((r) => r.fate === 'scored'))
  assert.deepEqual(
    on.departed.map((r) => r.from),
    [...on.departed.map((r) => r.from)].sort((a, b) => b - a),
    'ordered by the base they left, the way the men on base are ordered',
  )
})

test('a held play has nobody departed, because nothing has been written yet', () => {
  // `unwrittenRow`'s shape: the cursor is standing on the play with its film
  // running, and the deck is still the pre-pitch one. The man who is about to
  // score is still shown standing on third, which is what the paper says at
  // that moment — and no box is marked as having left.
  const held = deckAt(3, 'top', 2, false)
  assert.deepEqual(
    held.runners.map((r) => r.base),
    [3],
  )
  assert.deepEqual(held.departed, [])
})

test('over the whole game, a departed man is never also standing on a base', () => {
  let departures = 0
  for (const [inning, half] of playedHalves()) {
    const cards = computeHalfInningFeed(FEED, inning, half, battingSideOf(half))
    for (let i = 0; i < cards.length; i += 1) {
      const { runners, departed, batter } = deckAt(inning, half, i)
      departures += departed.length
      for (const d of departed) {
        // Every departure is one of the two the deck claims to draw, and the
        // card says so itself rather than being taken on trust.
        assert.ok(d.fate === 'scored' || d.fate === 'out', `a departure with no fate at ${half}${inning} #${i}`)
        if (d.fate === 'scored') assert.equal(d.card.scored, true)
        else assert.ok(d.card.outAt != null)
        assert.ok(d.from >= 1 && d.from <= 3, 'he left a base that exists')
        assert.ok(
          !runners.some((r) => r.card === d.card),
          `a man both gone and standing at ${half}${inning} #${i}`,
        )
        if (batter) assert.notEqual(d.card.atBatIndex, batter.atBatIndex)
      }
      // One man can only leave a given base once on one play.
      const froms = departed.map((d) => d.from)
      assert.equal(new Set(froms).size, froms.length, `two men left one base at ${half}${inning} #${i}`)
    }
  }
  assert.ok(departures > 8, `the sweep really found departures (${departures})`)
})

test('a non-terminal row shows the base state as it was BEFORE its plate appearance', () => {
  // A batter timeout inside Vaughn's at-bat; Turang has doubled by
  // then, so the deck must show Turang on second and nothing of Vaughn's.
  const cards = computeHalfInningFeed(FEED, 1, 'top', 'away')
  const vaughn = cards.findIndex((c) => c.batter?.last === 'Vaughn')
  assert.ok(vaughn >= 0)
  const deck = deckAt(1, 'top', vaughn, false)
  assert.deepEqual(
    deck.runners.map((r) => [r.card.batter.last, r.base]),
    [['Turang', 2]],
  )
  assert.equal(deck.batter, null)
})

test('no entries yield no runners rather than throwing', () => {
  assert.deepEqual(runnersOnBase(null), [])
  assert.deepEqual(runnersDeparted(null, null), [])
})

// --- naming the half, rather than numbering it -----------------------------
//
// The other half of the same mistake. `revealTo(inning, half)` and
// `revealAtBat(inning, half, count)` take the pair, and Express Lane works in
// half-INDEXES — so the hook converts before it calls, through `halfAt`, the
// same function `alignment.js` uses. These two tests pin why the conversion
// cannot be skipped: the index is a valid inning number, so passing one lands
// silently on a real and WRONG half rather than throwing.

test('a half-index round-trips through the pair the reveal mark is named by', () => {
  for (let idx = 0; idx < 24; idx += 1) {
    const { inning, half } = halfAt(idx)
    assert.equal(halfIndex(inning, half), idx, `half-index ${idx}`)
  }
})

test('a half-index handed over in the inning slot names a different half', () => {
  // Top of the 1st. The mark goes negative, the ratchet discards it, and the
  // half can never be committed — so the surface can never leave it.
  assert.equal(halfIndex(0, undefined), -1)
  assert.notEqual(halfIndex(0, undefined), 0)
  // Top of the 2nd, whose index is 2. Read as an inning it gives half-index 3,
  // which is the BOTTOM of the 2nd: a half the scorer has not watched, unsealed
  // on this page, in the innings viewer and on every synced device.
  assert.equal(halfIndex(2, undefined), 3)
  assert.deepEqual(halfAt(3), { inning: 2, half: 'bottom', side: 'bottom' })
})
