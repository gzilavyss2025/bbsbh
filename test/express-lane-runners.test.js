// Express Lane — the scoring deck (src/api/expresslane/runners.js).
//
// Run against the captured real game (gamePk 823035), because the thing under
// test is a claim about unedited MLB output: that "reached a base, has not
// scored, was not put out" names exactly the men standing on base.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  battingSideOf,
  expressDeck,
  railRevealCap,
  railStepCap,
  reachedPlateAppearances,
  runnersOnBase,
} from '../src/api/expresslane/runners.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { buildRail, resultModeRows } from '../src/api/expresslane/rail.js'
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

// A rail-shaped row for the plate appearance at `index` of one half.
function rowAt(inning, half, index) {
  const cards = computeHalfInningFeed(FEED, inning, half, battingSideOf(half))
  const card = cards[index]
  return card ? { atBatIndex: card.atBatIndex, halfIndex: 0, isTerminal: true } : null
}

test('the batting side follows the half, the way the rest of the app reads it', () => {
  assert.equal(battingSideOf('top'), 'away')
  assert.equal(battingSideOf('bottom'), 'home')
  assert.equal(battingSideOf(undefined), 'away')
})

// --- the join ---------------------------------------------------------------

test('a rail row joins its card on the feed plate-appearance number, not a position', () => {
  const cards = computeHalfInningFeed(FEED, 5, 'top', 'away')
  assert.equal(railStepCap(cards, { atBatIndex: cards[0].atBatIndex, isTerminal: true }), 1)
  assert.equal(railStepCap(cards, { atBatIndex: cards[3].atBatIndex, isTerminal: true }), 4)
})

test('a row from another half joins nothing rather than falling back', () => {
  const cards = computeHalfInningFeed(FEED, 5, 'top', 'away')
  assert.equal(railStepCap(cards, { atBatIndex: 9999, isTerminal: true }), null)
  assert.equal(railStepCap(cards, null), null)
  assert.equal(railStepCap(cards, {}), null)
})

// --- who is on base ---------------------------------------------------------

test('the bases fill correctly through a real rally', () => {
  // Top 5 of gamePk 823035: Sánchez walks, Frelick flies out, Pratt walks,
  // Ortiz singles. That is bases loaded, and each man is one base further on.
  const at = (i) => expressDeck(FEED, 5, 'top', rowAt(5, 'top', i))

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
  const deck = expressDeck(FEED, 2, 'bottom', rowAt(2, 'bottom', 3))
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
  const own = expressDeck(FEED, 5, 'top', rowAt(5, 'top', 0))
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
      const row = rowAt(inning, half, i)
      if (!row) continue
      const { runners, batter } = expressDeck(FEED, inning, half, row)
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

// --- the foot strip ---------------------------------------------------------

test('a row INSIDE a plate appearance does not reveal that plate appearance', () => {
  // THE LEAK THIS PINS, found on the real surface. Result mode keeps every
  // `action` row, and an action row inside a plate appearance carries that
  // plate appearance's own atBatIndex — a batter timeout, a mound visit. Top
  // of the 1st in this game has one at row 1, inside Lara's at-bat.
  //
  // Joined on atBatIndex alone, the cursor landing on that timeout capped the
  // feed one card too far and drew Lara's finished box: the scorer read "6-3"
  // before watching the pitch that made it. The film gate was intact; the deck
  // walked around it.
  const rail = resultModeRows(buildRail(FEED, 1, 'top'))
  const timeout = rail[1]
  assert.equal(timeout.kind, 'action')
  assert.equal(timeout.isTerminal, false, 'the row this test is about')

  const deck = expressDeck(FEED, 1, 'top', timeout)
  assert.equal(deck.batter, null, 'the plate appearance in progress has no finished box')
  assert.equal(deck.pending?.last, 'Lara', 'but the man at the plate is named — identity, not result')
  assert.equal(
    deck.entries.some((card) => card.atBatIndex === timeout.atBatIndex),
    false,
    'and his card is not in the capped list at all, so nothing can read its code',
  )

  // His own terminal row, one tap later, is where the outcome arrives.
  const after = expressDeck(FEED, 1, 'top', rail[2])
  assert.equal(after.batter.batter.last, 'Lara')
  assert.equal(after.batter.code, '6-3')
})

test('a non-terminal row shows the base state as it was BEFORE its plate appearance', () => {
  const rail = resultModeRows(buildRail(FEED, 1, 'top'))
  // Row 4 is a batter timeout inside Vaughn's at-bat; Turang has doubled by
  // then, so the deck must show Turang on second and nothing of Vaughn's.
  const timeout = rail[4]
  assert.equal(timeout.isTerminal, false)
  const deck = expressDeck(FEED, 1, 'top', timeout)
  assert.deepEqual(
    deck.runners.map((r) => [r.card.batter.last, r.base]),
    [['Turang', 2]],
  )
  assert.equal(deck.batter, null)
})

test('the chips name only the plate appearances already reached', () => {
  const deck = expressDeck(FEED, 5, 'top', rowAt(5, 'top', 2))
  const chips = reachedPlateAppearances(deck.entries)
  assert.deepEqual(
    chips.map((c) => c.last),
    ['Sánchez', 'Frelick', 'Pratt'],
    'nothing ahead of the cursor, so the strip never says how many are left to bat',
  )
  assert.equal(chips.at(-1).code, 'BB')
})

test('every card arrives with the three marks AtBatBox draws but does not compute', () => {
  // One plate appearance has to draw the SAME box here and on the #22 sheet,
  // or a scorer copying from the screen onto paper meets two marks for one
  // play. So these come off the sheet's own two modules, not a second spelling.
  const deck = expressDeck(FEED, 5, 'top', rowAt(5, 'top', 1))
  const flyOut = deck.batter
  assert.equal(flyOut.batter.last, 'Frelick')
  assert.equal(flyOut.outType, 'FO', 'a fly out reads FO in the outcome box')
  assert.equal(flyOut.centerCode, 'F8', 'and the fielding chain is penciled mid-diamond')
  assert.ok(Array.isArray(flyOut.ladder), 'the pitch ladder is split into its columns')

  const walk = deck.entries[0]
  assert.equal(walk.outType, '', 'a walk is not an out, so it takes no out category')
  assert.equal(walk.centerCode, 'BB')
})

test('a half that was never played has an empty rail, which is how a game ENDS', () => {
  // THE SIGNAL THE SURFACE KEYS ON, and the bug it was found by. Express Lane
  // opens on `revealedThrough + 1` — the first half not yet scored — so a game
  // scored to its last out opens on a half that never happened. It rendered
  // the ordinary deck over nothing: a dead button under a film pane promising
  // film that was never coming, on a screen headed "Top 10th".
  //
  // Reading this half is the sanctioned lookahead (ADR-0003/0010) and it leaks
  // nothing — an empty rail says only "you have reached the end of what has
  // been played", which the scorer who reached it already knows. It is
  // deliberately NOT a check against the game's inning count: that number
  // states whether the game went to extras (ADR-0008).
  //
  // gamePk 823035 went nine innings, so the top of the 10th is that half.
  assert.deepEqual(resultModeRows(buildRail(FEED, 10, 'top')), [])
  assert.deepEqual(buildRail(FEED, 10, 'top'), [])
  // And the half before it is not empty, so the signal really distinguishes.
  assert.ok(resultModeRows(buildRail(FEED, 9, 'bottom')).length > 0)
})

test('an empty half yields an empty deck rather than throwing', () => {
  const deck = expressDeck(FEED, 11, 'top', { atBatIndex: 1 })
  assert.deepEqual(deck, { batter: null, runners: [], entries: [], cap: null })
  assert.deepEqual(runnersOnBase(null), [])
  assert.deepEqual(reachedPlateAppearances(undefined), [])
})

// --- the at-bat reveal mark ------------------------------------------------
//
// Express Lane drives the app's OWN reveal mark, so the number it writes has
// to be the number the innings viewer and the scorecard write: a count of
// `computeHalfInningFeed` entries (ADR-0016). A count of RAIL rows is a
// different unit — the rail carries a row per EVENT and the feed a card per
// PLAY — and the two disagree over most of a real game.

test('the reveal cap is the deck’s own cap, at every cursor in the game', () => {
  for (const [inning, half] of playedHalves()) {
    for (const row of resultModeRows(buildRail(FEED, inning, half))) {
      assert.equal(
        railRevealCap(FEED, inning, half, row),
        expressDeck(FEED, inning, half, row).cap,
        `${half} ${inning}, row ${row.key}`,
      )
    }
  }
})

test('a rail row’s position is NOT that count, and writing it would over-reveal', () => {
  let over = 0
  let agree = 0
  for (const [inning, half] of playedHalves()) {
    const rows = resultModeRows(buildRail(FEED, inning, half))
    rows.forEach((row, i) => {
      const cap = railRevealCap(FEED, inning, half, row)
      const ordinal = i + 1
      if (ordinal === cap) agree += 1
      else if (ordinal > cap) over += 1
    })
  }
  // The two units are not interchangeable, and the majority of the difference
  // runs the DANGEROUS way: a rail position larger than the feed cap opens
  // entries in the innings viewer that Express Lane never showed.
  assert.ok(over > 0, 'the rail position overstates the feed cap on real plays')
  assert.ok(over > agree, 'they disagree more often than they agree')
})

test('a row with no plate appearance of its own has no cap to write', () => {
  assert.equal(railRevealCap(FEED, 1, 'top', { atBatIndex: null, isTerminal: true }), null)
  assert.equal(railRevealCap(FEED, 1, 'top', null), null)
  assert.equal(railRevealCap(null, 1, 'top', { atBatIndex: 0, isTerminal: true }), null)
})

// --- the automatic runner’s chip -------------------------------------------
//
// `computeHalfInningFeed`'s `placed` card carries no `atBatIndex` — he took no
// plate appearance, so there is no number for him to carry. A chip strip that
// keyed on that number gave him `undefined`: an undefined React key shared with
// every other placement, a tap that matched no rail row, and an `is-on`
// comparison of `undefined === undefined` that lit him up on every cursor
// position where the deck had no batter.

const placedCard = {
  kind: 'placed',
  runnerId: 592885,
  runner: { last: 'Yelich', first: 'Christian' },
  base: 2,
  code: 'AR',
  reached: 2,
  scored: false,
}

test('the automatic runner gets a chip with an identity of its own', () => {
  const chips = reachedPlateAppearances([
    placedCard,
    { kind: 'atbat', atBatIndex: 7, batter: { last: 'Adames' }, code: '6-3' },
  ])
  assert.equal(chips.length, 2)
  assert.ok(
    chips.every((chip) => chip.id != null && chip.id !== ''),
    'every chip can be keyed',
  )
  assert.notEqual(chips[0].id, chips[1].id, 'and no two chips share that key')
})

test('the automatic runner’s chip is not a way back to a play, and says so', () => {
  const [chip] = reachedPlateAppearances([placedCard])
  assert.equal(chip.kind, 'placed')
  assert.equal(chip.atBatIndex, null, 'null rather than undefined — there is no number')
  assert.equal(chip.last, 'Yelich')
  assert.equal(chip.code, 'AR')
})

test('two placements in one game never collide on a key', () => {
  const chips = reachedPlateAppearances([placedCard, { ...placedCard, runnerId: 668930 }])
  assert.notEqual(chips[0].id, chips[1].id)
})

test('an ordinary plate appearance keeps its own number', () => {
  const [chip] = reachedPlateAppearances([
    { kind: 'atbat', atBatIndex: 12, batter: { last: 'Turang' }, code: 'K' },
  ])
  assert.equal(chip.atBatIndex, 12)
  assert.equal(chip.kind, 'atbat')
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
