import assert from 'node:assert/strict'
import test from 'node:test'
import { buildArsenalNote } from '../src/api/matchup/arsenal.js'
import { arsenalRatesFor, arsenalFor, arsenalLeagueFor, arsenalZScore } from '../src/api/matchup/savant.js'
import { SHORT_MAX } from '../src/api/matchup/voice.js'

// Representative per-pitch-type league baselines — not a live probe (this
// family's real numbers are re-probed at generation time per the issue's own
// "Savant renames columns without notice" rule); these exist only to exercise
// the gating/quadrant/voice mechanics against a stable, documented spread.
const ARSENAL_LEAGUE = {
  bat: { CU: { m: 31.5, sd: 8.0 }, FF: { m: 21.6, sd: 6.0 } },
  pit: { CU: { m: 31.5, sd: 5.0 }, FF: { m: 21.6, sd: 4.0 } },
}
const data = (bRow, pRow, extra = {}) => ({
  season: 2026,
  league: { arsenal: ARSENAL_LEAGUE },
  arsenal: { bat: { 1: { CU: bRow } }, pit: { 2: { CU: pRow } } },
  ...extra,
})
const BATTER = { id: 1, first: 'Garrett', last: 'Caissie' }
const PITCHER = { id: 2, first: 'Aaron', last: 'Nola' }
// build(bRow, pRow, index) — bRow is the BATTER's row against the pitch type,
// pRow is the PITCHER's row for it. Matches data()'s own argument order.
const build = (bRow, pRow, index = 0) =>
  buildArsenalNote({ data: data(bRow, pRow), batter: BATTER, pitcher: PITCHER, index })

// A mismatch collision — pitcher's curveball is a real out-pitch (high whiff),
// and this batter is demonstrably vulnerable to the pitch type (high whiff too).
const MISMATCH = [{ whiff: 57, ba: 0.243, pa: 120 }, { usage: 33, whiff: 43 }]
// Standoff — same pitcher strength, but this batter does NOT miss it.
const STANDOFF = [{ whiff: 12, ba: 0.29, pa: 90 }, { usage: 33, whiff: 43 }]
// Weak but printable — pitcher's curveball is not a real bat-misser, but the
// batter is still vulnerable to the pitch type generally.
const WEAK = [{ whiff: 57, ba: 0.22, pa: 60 }, { usage: 20, whiff: 18 }]
// Ambiguous — both sides below their own baseline. Dropped.
const NEITHER = [{ whiff: 10, ba: 0.2, pa: 80 }, { usage: 20, whiff: 24 }]
// A smaller mismatch than MISMATCH — both sides just clear T, for the scoring test.
const MILD_MISMATCH = [{ whiff: 41, ba: 0.25, pa: 100 }, { usage: 20, whiff: 37.5 }]

// --- the readers -------------------------------------------------------------

test('arsenal readers degrade to null rather than zero', () => {
  const d = data(...MISMATCH)
  assert.equal(arsenalRatesFor(d, 999, 'CU', 'batting'), null)
  assert.equal(arsenalRatesFor(d, 1, 'ST', 'batting'), null) // player exists, pitch type doesn't
  assert.equal(arsenalFor(d, 999, 'batting'), null)
  assert.equal(arsenalFor(null, 1, 'batting'), null)
  assert.equal(arsenalLeagueFor(d, 'FS', 'batting'), null)
  assert.equal(arsenalLeagueFor({ league: { arsenal: { bat: { CU: { m: 5, sd: 0 } } } } }, 'CU', 'batting'), null)
  assert.equal(arsenalZScore(d, 'FS', 'batting', 40), null)
})

test('each role is scored against its OWN pitch-type spread', () => {
  const d = data(...MISMATCH)
  // The same raw whiff value scores differently per board, because the two
  // boards' spreads for one pitch type differ — same rule the season-axis
  // families' zScore already applies, with a pitch-type key added.
  assert.ok(Math.abs(arsenalZScore(d, 'CU', 'pitching', 43) - 2.3) < 0.01)
  assert.ok(Math.abs(arsenalZScore(d, 'CU', 'batting', 43) - 1.4375) < 0.01)
})

// --- gating and the four quadrants -------------------------------------------

test('no note when neither side clears the threshold', () => {
  assert.deepEqual(build(...NEITHER), [])
})

test('no note without data for either player, or a shared pitch type', () => {
  assert.deepEqual(buildArsenalNote({ data: data(...MISMATCH), batter: { id: 77 }, pitcher: PITCHER }), [])
  assert.deepEqual(buildArsenalNote({ data: null, batter: BATTER, pitcher: PITCHER }), [])
  const noOverlap = data(...MISMATCH)
  noOverlap.arsenal.bat[1] = { FF: { whiff: 20, ba: 0.2, pa: 60 } } // batter has no CU row at all
  assert.deepEqual(buildArsenalNote({ data: noOverlap, batter: BATTER, pitcher: PITCHER }), [])
})

test('mismatch fires: pitcher HIGH whiff + batter HIGH whiff', () => {
  const notes = build(...MISMATCH)
  assert.equal(notes.length, 1)
  assert.equal(notes[0].kind, 'matchupArsenal')
})

test('standoff fires: pitcher HIGH whiff + batter LOW whiff', () => {
  const notes = build(...STANDOFF)
  assert.equal(notes.length, 1)
})

test('weak-but-printable fires: pitcher LOW whiff + batter HIGH whiff', () => {
  const notes = build(...WEAK)
  assert.equal(notes.length, 1)
})

test('the fourth quadrant (pitcher LOW + batter LOW) is dropped, not "hitter edge"', () => {
  // Both sides below their own baseline — still ambiguous by this family's
  // rule, unlike the other families' strength/weakness framing.
  assert.deepEqual(build(...NEITHER), [])
})

test('the pitch usage/thrown gate lives in the generator, not here — an absent row means no note', () => {
  // arsenal.js trusts gen-savant-matchup.mjs's own gates: a pitch type not
  // present in a pitcher's or batter's map is exactly how "didn't clear the
  // floor" reaches this module — see gen-savant-matchup.mjs's PITCH_USAGE_MIN/
  // PITCH_THROWN_MIN/BATTER_PA_MIN.
  const d = data(...MISMATCH)
  delete d.arsenal.pit[2].CU
  assert.deepEqual(buildArsenalNote({ data: d, batter: BATTER, pitcher: PITCHER }), [])
})

test('the strongest shared pitch type wins when more than one qualifies', () => {
  const d = data(...MISMATCH)
  // A weaker FF collision — both sides clear T, but by less than the CU pair.
  d.arsenal.bat[1].FF = { whiff: 29, ba: 0.25, pa: 80 }
  d.arsenal.pit[2].FF = { usage: 40, whiff: 27 }
  const notes = buildArsenalNote({ data: d, batter: BATTER, pitcher: PITCHER })
  assert.equal(notes.length, 1)
  assert.match(notes[0].dedupeKey, /^matchup-arsenal-CU-/, 'the CU collision is the stronger of the two')
})

// --- the voice rules ----------------------------------------------------------

test('rates round — no decimals anywhere in a note', () => {
  for (const n of build(...MISMATCH)) {
    assert.doesNotMatch(n.text, /\d\.\d\s*%/, `decimal in short form: ${n.text}`)
    assert.doesNotMatch(n.prose, /\d\.\d\s*%/, `decimal in prose: ${n.prose}`)
  }
})

test('"chase" never appears as a synonym for swing', () => {
  for (const n of [...build(...MISMATCH), ...build(...STANDOFF), ...build(...WEAK)]) {
    assert.doesNotMatch(n.text, /chase/i, n.text)
    assert.doesNotMatch(n.prose, /chase/i, n.prose)
    assert.match(n.prose, /swing/i)
  }
})

test('short forms stay under the strip ceiling, even with long names', () => {
  const long = { id: 1, first: 'Vladimir', last: 'Guerrero Jr.' }
  const longP = { id: 2, first: 'Yoshinobu', last: 'Yamamoto' }
  for (let index = 0; index < 3; index++) {
    const notes = buildArsenalNote({
      data: data(...MISMATCH), batter: long, pitcher: longP, index,
    })
    for (const n of notes) assert.ok(n.text.length <= SHORT_MAX, `${n.text.length} chars: ${n.text}`)
  }
})

test('at most one em dash per note, and never a dash plus "but"', () => {
  for (let index = 0; index < 3; index++) {
    for (const n of build(...MISMATCH, index)) {
      assert.ok((n.text.match(/—/g) ?? []).length <= 1, `two dashes: ${n.text}`)
      assert.doesNotMatch(n.text, /—[^.]*\bbut\b/)
    }
  }
})

test('the sentence SHAPE rotates so consecutive notes do not share one', () => {
  const shapes = new Set()
  for (let index = 0; index < 3; index++) {
    const [note] = build(...MISMATCH, index)
    shapes.add(note.text.includes('—') ? 'dash' : note.text.includes(';') ? 'semicolon' : 'turn')
  }
  assert.equal(shapes.size, 3, 'three indices must yield three distinct shapes')
})

test('"just" lands only on a number that is LOW for its own league mean', () => {
  // Standoff: the batter's low whiff earns "just" (McGonigle's own "misses on
  // only 12% of four-seamers" wording, "just" being this app's word for it).
  const [note] = build(...STANDOFF)
  assert.match(note.text, /misses just \d+% of/)
  assert.doesNotMatch(note.text, /missing just \d+%/, 'the pitcher side is not the low one here')
})

test('batting average prints only as color, never as the trigger, and stays scoped to the season', () => {
  const [note] = build(...MISMATCH)
  assert.match(note.prose, /hitting \.\d{3} against it this season/)
})

test('a thin sample prints its count alongside the average', () => {
  const [note] = build({ whiff: 57, ba: 0.243, pa: 45 }, { usage: 33, whiff: 43 })
  assert.match(note.prose, /\(45 PA\)/)
})

test('a robust sample drops the parenthetical PA count', () => {
  const notes = build({ whiff: 57, ba: 0.243, pa: 150 }, { usage: 33, whiff: 43 })
  assert.equal(notes.length, 1)
  assert.doesNotMatch(notes[0].prose, /\(\d+ PA\)/)
})

test('the earned gloss fires only in the mismatch quadrant with real usage', () => {
  const [mismatch] = build(...MISMATCH)
  assert.match(mismatch.prose, /He is going to see a lot of them\.$/)
  const [standoff] = build(...STANDOFF)
  assert.doesNotMatch(standoff.prose, /going to see a lot of them/)
  const [lowUsage] = build({ whiff: 57, ba: 0.243, pa: 120 }, { usage: 16, whiff: 43 })
  assert.doesNotMatch(lowUsage.prose, /going to see a lot of them/)
})

test('every note is scoped to the season, carries both renderings, and dedupes on the pitch type', () => {
  for (const n of [...build(...MISMATCH), ...build(...STANDOFF), ...build(...WEAK)]) {
    assert.match(n.text, /this season/)
    assert.ok(n.prose.length > n.text.length, 'prose must say more than the strip')
    assert.ok(n.score > 0 && n.score <= 100)
    assert.equal(n.dedupeKey, `matchup-arsenal-CU-${BATTER.id}-${PITCHER.id}`)
  }
})

test('prose uses full names on first reference, short form uses surnames', () => {
  const [note] = build(...MISMATCH)
  assert.doesNotMatch(note.text, /Garrett|Aaron/)
  assert.match(note.prose, /Aaron Nola/)
  assert.match(note.prose, /Garrett Caissie/)
})

test('a bigger collision outscores a smaller one', () => {
  const [mild] = build(...MILD_MISMATCH)
  const [huge] = build(...MISMATCH)
  assert.ok(huge.score > mild.score, `${huge.score} !> ${mild.score}`)
})

// --- the spoiler invariant --------------------------------------------------

test('a note never contains tonight-derived material', () => {
  // The builder is handed no feed at all — it cannot read a score, an inning,
  // or a live line. This test pins that the signature stays that way.
  assert.equal(buildArsenalNote.length, 1, 'builder takes one options object and no feed')
  assert.ok(build(...MISMATCH).length > 0)
})

// --- resolving the two players for a half -----------------------------------

test('a half resolves the due-up hitter AND the arm, and both families fire', async () => {
  const { matchupNotesForHalf } = await import('../src/api/matchup/forHalf.js')
  const { buildFeed } = await import('./fixtures/mini-game.js')
  const feed = buildFeed()

  const d = {
    season: 2026,
    league: { arsenal: ARSENAL_LEAGUE },
    bat: {}, pit: {},
    arsenal: { bat: { 1: { CU: MISMATCH[0] } }, pit: { 200: { CU: MISMATCH[1] } } },
  }
  const notes = matchupNotesForHalf({ feed, data: d, inning: 1, half: 'top', revealedThrough: -1 })
  const arsenalNotes = notes.filter((n) => n.kind === 'matchupArsenal')
  assert.equal(arsenalNotes.length, 1, 'the leadoff hitter and the starter must produce an arsenal note')
  assert.match(arsenalNotes[0].dedupeKey, /^matchup-arsenal-CU-1-200$/)
})

test('a half further out than the reader has reached resolves nobody, arsenal included', async () => {
  const { matchupNotesForHalf } = await import('../src/api/matchup/forHalf.js')
  const { buildFeed } = await import('./fixtures/mini-game.js')
  const feed = buildFeed()
  const d = {
    season: 2026,
    league: { arsenal: ARSENAL_LEAGUE },
    bat: {}, pit: {},
    arsenal: { bat: { 1: { CU: MISMATCH[0] } }, pit: { 200: { CU: MISMATCH[1] } } },
  }
  assert.deepEqual(
    matchupNotesForHalf({ feed, data: d, inning: 6, half: 'top', revealedThrough: -1 }),
    [],
  )
})
