// The ink a Logbook stamp is pressed in (src/lib/stampInk.js, ADR-0036's
// addendum): the WINNING club's darkest brand colour, deepened if that colour
// still doesn't read on the page's cream paper.
//
// Three things here are worth a test rather than an eye check. "Darkest" is a
// luminance question and the hex digits answer it wrong (a club's gold sorts
// ahead of its navy on a naive read). The contrast floor is invisible until the
// one affiliate it exists for renders. And the paper hex this module mirrors
// lives in a CSS token file that nothing else would notice drifting.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  MIN_INK_CONTRAST,
  STAMP_PAPER,
  darkestInk,
  deepenToContrast,
  inkCandidates,
  stampInkFor,
  stampWinnerId,
} from '../src/lib/stampInk.js'
import { contrastRatio, relativeLuminance } from '../src/lib/contrast.js'
import { MILB_COLORS, MLB_TEAM_COLORS } from '../src/lib/brandColors.js'

const BREWERS = 158 // primary #12284B navy, secondary #FFC52F gold
const CUBS = 112 // primary #0E3386 royal, secondary #CC3433 red
const UNKNOWN = 9999 // in neither colour table: no MLB entry, no researched pair, no parent org

const game = (over = {}) => ({
  gamePk: 776543,
  away: { id: BREWERS, abbreviation: 'MIL', runs: 5 },
  home: { id: CUBS, abbreviation: 'CHC', runs: 3 },
  winnerId: BREWERS,
  ...over,
})

// ---------------------------------------------------------------------------
// Who won — the only game state this module reads
// ---------------------------------------------------------------------------

test('stampWinnerId reads the field both producers already carry', () => {
  assert.equal(stampWinnerId(game()), BREWERS)
  // The stored winner wins over the runs, so a game the feed called (a forfeit,
  // a suspended game resumed elsewhere) is not second-guessed here.
  assert.equal(stampWinnerId(game({ winnerId: CUBS })), CUBS)
})

test('stampWinnerId falls back to the runs for a record without one', () => {
  const noField = game({ winnerId: null })
  assert.equal(stampWinnerId(noField), BREWERS)
  assert.equal(
    stampWinnerId({ ...noField, away: { id: BREWERS, runs: 2 }, home: { id: CUBS, runs: 9 } }),
    CUBS,
  )
})

test('a game with no winner has no ink to be pressed in', () => {
  // A tie, a side whose runs never resolved, a record that is barely a game at
  // all. Each answers null rather than guessing — and the stamp keeps the
  // book's own navy.
  const tie = game({ winnerId: null, away: { id: BREWERS, runs: 4 }, home: { id: CUBS, runs: 4 } })
  assert.equal(stampWinnerId(tie), null)
  assert.equal(stampInkFor(tie), null)

  const unresolved = game({ winnerId: null, home: { id: CUBS, runs: null } })
  assert.equal(stampWinnerId(unresolved), null)
  assert.equal(stampInkFor(unresolved), null)

  assert.equal(stampWinnerId(null), null)
  assert.equal(stampInkFor(null), null)
  assert.equal(stampInkFor({}), null)
})

// ---------------------------------------------------------------------------
// Which colours a club owns, and which of them is the darkest
// ---------------------------------------------------------------------------

test('inkCandidates reads an MLB club’s whole palette, deduped', () => {
  const brewers = inkCandidates(BREWERS)
  assert.ok(brewers.includes('#12284B'))
  assert.ok(brewers.includes('#FFC52F'))
  // The accent restates the pair for 27 of 30 clubs, so the same hex must not
  // come back twice however many roles name it.
  assert.equal(new Set(brewers.map((h) => h.toUpperCase())).size, brewers.length)
  // A string id is the same club — ids arrive from URLs and JSON alike.
  assert.deepEqual(inkCandidates('158'), brewers)
})

test('inkCandidates goes through the MiLB chain, and stays empty for an unknown club', () => {
  // 546 Portland Sea Dogs: a researched affiliate, so its OWN pair.
  const portland = inkCandidates(546)
  assert.deepEqual(portland.slice(0, 2), MILB_COLORS['546'].pair)
  // 482 Corpus Christi: research found nothing, so its parent org's pair (step
  // 2 of brandColors.js's chain) rather than an invented colour.
  assert.deepEqual(inkCandidates(482), inkCandidates(117))
  // A club in neither table gets NOTHING — deliberately not the neutral
  // graphite placeholder, which would read as a design choice about that game.
  assert.deepEqual(inkCandidates(UNKNOWN), [])
  assert.deepEqual(inkCandidates(null), [])
})

test('darkestInk sorts by luminance, not by the hex digits', () => {
  // #FFC52F sorts after #12284B on a naive digit read and is far lighter to
  // the eye; the green channel carries three quarters of the weight.
  assert.equal(darkestInk(['#FFC52F', '#12284B']), '#12284B')
  assert.equal(darkestInk(['#12284B', '#FFC52F']), '#12284B')
  assert.equal(darkestInk(['#FFFFFF', '#00FF00', '#0000FF']), '#0000FF')
  // Junk in the list is skipped rather than crashing the stamp it draws.
  assert.equal(darkestInk(['not a colour', null, '#0C2340']), '#0C2340')
  assert.equal(darkestInk([]), null)
  assert.equal(darkestInk(null), null)
})

test('the winner’s darkest colour is what the stamp is pressed in', () => {
  assert.equal(stampInkFor(game()), '#12284B') // Brewers navy, not the gold
  assert.equal(stampInkFor(game({ winnerId: CUBS })), '#0E3386') // Cubs royal, not the red
  // A club with no colour on file leaves the stamp in the book's own ink.
  assert.equal(stampInkFor(game({ winnerId: UNKNOWN })), null)
})

// ---------------------------------------------------------------------------
// A club's own override (src/lib/stampInkTuning.js) — same floor, different pick
// ---------------------------------------------------------------------------

test('a valid override wins over the automatic darkest-brand-colour pick', () => {
  // Not the Brewers' navy, not their gold — a club's own choice, once given one.
  assert.equal(stampInkFor(game(), { overrideHex: '#663399' }), '#663399')
})

test('an override still walks through the same contrast floor as the automatic pick', () => {
  const pale = '#3378C2' // Rocket City's own under-floor colour, reused as a stand-in pick
  assert.ok(contrastRatio(pale, STAMP_PAPER) < MIN_INK_CONTRAST)
  const ink = stampInkFor(game(), { overrideHex: pale })
  assert.ok(contrastRatio(ink, STAMP_PAPER) >= MIN_INK_CONTRAST)
  assert.equal(ink, deepenToContrast(pale, STAMP_PAPER))
})

test('a malformed or absent override falls through to automatic, same as no option at all', () => {
  assert.equal(stampInkFor(game(), { overrideHex: 'not a colour' }), stampInkFor(game()))
  assert.equal(stampInkFor(game(), { overrideHex: '' }), stampInkFor(game()))
  assert.equal(stampInkFor(game(), { overrideHex: undefined }), stampInkFor(game()))
})

test('an override for a game with no winner still leaves the stamp in the book’s own ink', () => {
  // Nobody won, so there is no club whose override could even apply.
  const tie = game({ winnerId: null, away: { id: BREWERS, runs: 4 }, home: { id: CUBS, runs: 4 } })
  assert.equal(stampInkFor(tie, { overrideHex: '#663399' }), null)
})

// ---------------------------------------------------------------------------
// The floor: ink that actually reads on cream paper
// ---------------------------------------------------------------------------

test('deepenToContrast walks a colour down until it reads, keeping its hue', () => {
  // Rocket City's #3378c2 is the one club in either league whose darkest brand
  // colour misses the floor (4.22 against the paper).
  const pale = '#3378C2'
  assert.ok(contrastRatio(pale, STAMP_PAPER) < MIN_INK_CONTRAST)
  const deepened = deepenToContrast(pale)
  assert.ok(contrastRatio(deepened, STAMP_PAPER) >= MIN_INK_CONTRAST)
  assert.ok(relativeLuminance(deepened) < relativeLuminance(pale))
  // Still recognisably that blue: blue stays the largest channel, red the
  // smallest, in the same order the club painted them.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(deepened.slice(i, i + 2), 16))
  assert.ok(b > g && g > r)

  // It stops at the first pass that clears the floor rather than driving
  // everything to the same near-black: white lands on a mid grey that reads,
  // not on ink.
  assert.ok(contrastRatio(deepenToContrast('#FFFFFF'), STAMP_PAPER) >= MIN_INK_CONTRAST)
  // A colour that already reads is handed back untouched.
  assert.equal(deepenToContrast('#12284B'), '#12284B')
  // And it always terminates: no colour can be 30:1 against cream paper (the
  // ceiling there is about 19), so this is the give-up rung.
  assert.equal(deepenToContrast('#FFFFFF', STAMP_PAPER, 30), '#000000')
  assert.equal(deepenToContrast('nope'), null)
})

test('every MLB club’s ink clears the floor against the paper', () => {
  for (const id of Object.keys(MLB_TEAM_COLORS)) {
    const ink = stampInkFor(game({ winnerId: Number(id) }))
    assert.ok(ink, `club ${id} resolved no ink at all`)
    assert.ok(
      contrastRatio(ink, STAMP_PAPER) >= MIN_INK_CONTRAST,
      `club ${id}: ${ink} is ${contrastRatio(ink, STAMP_PAPER).toFixed(2)}:1 on the paper`,
    )
  }
})

test('every researched affiliate’s ink clears it too', () => {
  for (const [id, entry] of Object.entries(MILB_COLORS)) {
    const ink = stampInkFor(game({ winnerId: Number(id) }))
    if (!entry.pair && !ink) continue // no pair, no parent org — book's own ink
    assert.ok(ink, `affiliate ${id} resolved no ink at all`)
    assert.ok(
      contrastRatio(ink, STAMP_PAPER) >= MIN_INK_CONTRAST,
      `affiliate ${id}: ${ink} is ${contrastRatio(ink, STAMP_PAPER).toFixed(2)}:1 on the paper`,
    )
  }
})

// The one number in this module that lives somewhere else too. It is the stock
// both surfaces a stamp renders on are drawn in, and contrast math needs the
// literal — so if the token moves and this doesn't, every ink is measured
// against paper the app no longer uses.
test('STAMP_PAPER still matches the --paper-2 token it mirrors', () => {
  const tokens = readFileSync(new URL('../src/tokens/colors.css', import.meta.url), 'utf8')
  const declared = /--paper-2:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1]
  assert.ok(declared, 'could not find --paper-2 in src/tokens/colors.css')
  assert.equal(declared.toUpperCase(), STAMP_PAPER.toUpperCase())
})
