// The lens bar's plain words (#724, slice L2): src/lib/scorecard/words.js and
// src/lib/scorecard/situation.js, pinned on the captured real game (gamePk
// 823035, 2026-07-07 MIL@STL g2, final 10-2 — the fixture
// scorecard-game.test.js reads).
//
// The promise that matters most is the SPOILER INVARIANT at the bottom: the
// walk taps through every step of the game the way the scorecard page does,
// and at each step every name and atBatIndex any helper returns must already
// be on that step's clamped sheet. The helpers take only the view, so this
// holds by construction; the walk is what proves it stays that way.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { scorecardFull, scorecardStep } from '../src/api/scorecardGame.js'
import { halfIndex } from '../src/api/select.js'
import { movesText, playWords, runnerMoves } from '../src/lib/scorecard/words.js'
import {
  halfCards,
  halfTotals,
  situation,
  situationText,
  totalsText,
} from '../src/lib/scorecard/situation.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

const viewAt = (feed, side, through, step = null) => scorecardFull({ feed }, side, { through, step })

// Tap through the whole game the way ScorecardPage does: one step per tap,
// and the last step of a finished half commits it (revealTo). Each entry is
// the state right after one tap, on the page of the half that was tapped,
// with that same page as it was just before the tap.
function walk(feed = FEED) {
  const counts = {}
  const countFor = (inning, half) => counts[`${inning}${half}`] ?? 0
  const view = (side, through) => {
    const s = scorecardStep(feed, through, countFor)
    return viewAt(feed, side, through, s ? { halfIdx: through + 1, count: s.count } : null)
  }
  const out = []
  let through = -1
  for (;;) {
    const s = scorecardStep(feed, through, countFor)
    if (!s) return out
    const before = view(s.side, through)
    if (s.nextCount >= s.total && s.halfOver) through = halfIndex(s.inning, s.half)
    else counts[`${s.inning}${s.half}`] = s.nextCount
    out.push({ ...s, through, before, after: view(s.side, through) })
  }
}
const STEPS = walk()

// The step right after the tap that opened `name`'s box in `inning`/`half`.
function stepFor(inning, half, name) {
  const step = STEPS.find(
    (s) => s.inning === inning && s.half === half && halfCards(s.after, inning).at(-1)?.batter?.last === name,
  )
  assert.ok(step, `no step opens ${name}'s box in ${half} ${inning}`)
  return step
}

// ---------------------------------------------------------------------------
// playWords
// ---------------------------------------------------------------------------

test('playWords says each mapped result with the brief’s verb', () => {
  const full = [viewAt(FEED, 'top', Infinity), viewAt(FEED, 'bottom', Infinity)]
  const cards = full.flatMap((v) => v.grid.innings.flatMap((n) => halfCards(v, n)))
  const said = (eventType, outType) => {
    const card = cards.find((c) => c.eventType === eventType && (outType == null || c.outType === outType))
    assert.ok(card, `the fixture has no ${eventType} ${outType ?? ''}`)
    return playWords(card)
  }
  assert.equal(said('double').text, 'Turang doubled.')
  assert.equal(said('single').verb, 'singled')
  assert.equal(said('triple').text, 'Pratt tripled.')
  assert.equal(said('home_run').verb, 'homered')
  assert.equal(said('walk').verb, 'walked')
  assert.equal(said('hit_by_pitch').text, 'Crooks was hit by a pitch.')
  assert.equal(said('strikeout').verb, 'struck out')
  assert.equal(said('field_out', 'GO').text, 'Yelich grounded out.')
  assert.equal(said('field_out', 'FO').verb, 'flied out')
  assert.equal(said('field_out', 'LO').verb, 'lined out')
  assert.equal(said('field_out', 'PO').verb, 'popped out')
})

test('an unmapped event falls back to the feed’s own event words', () => {
  const step = stepFor(6, 'top', 'Pratt') // Pratt forces Bauers at second
  const words = playWords(halfCards(step.after, 6).at(-1))
  assert.equal(words.verb, 'force out')
  assert.equal(words.text, 'Pratt force out.')
})

test('playWords names the fielder on an error, and says a double play', () => {
  assert.equal(
    playWords({ kind: 'atbat', eventType: 'field_error', code: 'E6', batter: { last: 'Okafor' } }).text,
    'Okafor reached on an error by the shortstop.',
  )
  assert.equal(
    playWords({ kind: 'atbat', eventType: 'field_error', code: 'E', batter: { last: 'Okafor' } }).verb,
    'reached on an error',
  )
  assert.equal(
    playWords({ kind: 'atbat', eventType: 'grounded_into_double_play', batter: { last: 'Okafor' } }).verb,
    'grounded into a double play',
  )
  assert.equal(
    playWords({ kind: 'atbat', eventType: 'fielders_choice_out', batter: { last: 'Okafor' } }).verb,
    'reached on a fielder’s choice',
  )
})

test('playWords says nothing for a box that holds no result of the batter’s own', () => {
  assert.equal(playWords(null), null)
  assert.equal(playWords({ kind: 'placed', runner: { last: 'Okafor' } }), null)
  assert.equal(
    playWords({ kind: 'atbat', interrupted: true, eventType: 'caught_stealing_2b', batter: { last: 'Okafor' } }),
    null,
  )
  assert.equal(playWords({ kind: 'atbat', eventType: null, batter: { last: 'Okafor' } }), null)
})

// ---------------------------------------------------------------------------
// runnerMoves
// ---------------------------------------------------------------------------

test('a hit moves the runners up, lead runner first', () => {
  const step = stepFor(5, 'top', 'Ortiz') // bases go 1st+2nd -> loaded on Ortiz's single
  const moves = runnerMoves(halfCards(step.before, 5), halfCards(step.after, 5))
  assert.deepEqual(
    moves.map((m) => [m.name, m.kind, m.base]),
    [
      ['Sánchez', 'to', 3],
      ['Pratt', 'to', 2],
    ],
  )
  assert.equal(movesText(moves), 'Sánchez to 3rd. Pratt to 2nd.')
  assert.equal(playWords(halfCards(step.after, 5).at(-1)).text, 'Ortiz singled.')
})

test('a run that scores reads "scores"', () => {
  const step = stepFor(5, 'top', 'Lara') // Lara's single scores two
  const moves = runnerMoves(halfCards(step.before, 5), halfCards(step.after, 5))
  assert.equal(movesText(moves), 'Sánchez scores. Pratt scores. Ortiz to 3rd.')
  assert.equal(moves[0].base, 4)
})

test('an out on the bases names the base', () => {
  const step = stepFor(6, 'top', 'Pratt')
  const moves = runnerMoves(halfCards(step.before, 6), halfCards(step.after, 6))
  assert.deepEqual(
    moves.map((m) => [m.name, m.kind, m.base]),
    [['Bauers', 'out', 2]],
  )
  assert.equal(movesText(moves), 'Bauers out at 2nd.')
})

test('a double play: the runner out at second, two outs on the half', () => {
  const runner = { kind: 'atbat', atBatIndex: 10, batter: { last: 'Quistorff' }, reached: 1, scored: false }
  const before = [runner]
  const after = [
    { ...runner, outAt: 2, outNumber: 1 },
    { kind: 'atbat', atBatIndex: 11, batter: { last: 'Okafor' }, eventType: 'grounded_into_double_play', reached: 0, outNumber: 2 },
  ]
  assert.equal(movesText(runnerMoves(before, after)), 'Quistorff out at 2nd.')
  assert.equal(playWords(after[1]).text, 'Okafor grounded into a double play.')
  const view = { grid: { columns: [{ inning: 1 }, { inning: 1 }], slots: [{ cells: { 0: after[0] } }, { cells: { 1: after[1] } }] } }
  assert.equal(situationText(situation(view, 1, 'top')), 'Top 1 · 2 outs · bases empty')
})

test('a walk with nobody on moves nobody', () => {
  const step = stepFor(3, 'bottom', 'Herrera')
  assert.equal(playWords(halfCards(step.after, 3).at(-1)).verb, 'walked')
  assert.deepEqual(runnerMoves(halfCards(step.before, 3), halfCards(step.after, 3)), [])
})

// ---------------------------------------------------------------------------
// situation
// ---------------------------------------------------------------------------

test('situation reads outs and bases after the last opened step', () => {
  const step = stepFor(5, 'top', 'Ortiz')
  const s = situation(step.after, 5, 'top')
  assert.equal(s.outs, 1)
  assert.deepEqual(s.bases, [1, 2, 3])
  assert.deepEqual(s.runners.map((r) => r.name), ['Ortiz', 'Pratt', 'Sánchez'])
  assert.equal(situationText(s), 'Top 5 · 1 out · on 1st, 2nd, 3rd')

  // Before the first tap of a half: nothing on the sheet for it yet.
  const fresh = situation(viewAt(FEED, 'top', -1, { halfIdx: 0, count: 0 }), 1, 'top')
  assert.equal(situationText(fresh), 'Top 1 · no outs · bases empty')
})

test('situation never counts more than three outs or a base twice, at any step', () => {
  for (const step of STEPS) {
    const s = situation(step.after, step.inning, step.half)
    assert.ok(s.outs >= 0 && s.outs <= 3, `${step.half} ${step.inning}: ${s.outs} outs`)
    assert.equal(new Set(s.bases).size, s.bases.length)
  }
})

// ---------------------------------------------------------------------------
// halfTotals
// ---------------------------------------------------------------------------

test('halfTotals is null until the half commits, then reads the committed line', () => {
  const mid = stepFor(5, 'top', 'Lara')
  assert.equal(mid.through, halfIndex(4, 'bottom'), 'top 5 is still being stepped')
  assert.equal(halfTotals(mid.after, 5, 'top'), null)

  const done = STEPS.find((s) => s.inning === 5 && s.half === 'top' && s.through === halfIndex(5, 'top'))
  const t = halfTotals(done.after, 5, 'top')
  assert.deepEqual(t, { inning: 5, half: 'top', r: 2, h: 2, e: 0, lob: 2 })
  assert.equal(totalsText(t), 'Top 5 · 2 R · 2 H · 0 E · 2 LOB')
})

test('E is the fielding club’s errors, and a sealed half’s errors never show (ADR-0006)', () => {
  // The fixture has no errors, so put one on each side of inning 1: the home
  // club erred in the top (it was in the field), the away club in the bottom.
  const feed = structuredClone(FEED)
  feed.liveData.linescore.innings[0].home.errors = 1
  feed.liveData.linescore.innings[0].away.errors = 2
  const topDone = viewAt(feed, 'top', halfIndex(1, 'top'))
  assert.equal(halfTotals(topDone, 1, 'top').e, 1)
  const bottomDone = viewAt(feed, 'bottom', halfIndex(1, 'bottom'))
  assert.equal(halfTotals(bottomDone, 1, 'bottom').e, 2)
})

test('every committed half’s totals agree with the linescore', () => {
  const innings = FEED.liveData.linescore.innings
  for (const [side, bat, field] of [
    ['top', 'away', 'home'],
    ['bottom', 'home', 'away'],
  ]) {
    const v = viewAt(FEED, side, Infinity)
    for (const i of innings) {
      const t = halfTotals(v, i.num, side)
      assert.deepEqual(
        [t.r, t.h, t.e, t.lob],
        [i[bat].runs, i[bat].hits, i[field].errors, i[bat].leftOnBase],
        `${side} ${i.num}`,
      )
    }
  }
})

// ---------------------------------------------------------------------------
// The spoiler invariant
// ---------------------------------------------------------------------------

test('no helper returns a name or an at-bat from past the clamp, at any step', () => {
  assert.equal(STEPS.at(-1).through, halfIndex(9, 'bottom'), 'the walk covers the whole game')
  for (const step of STEPS) {
    const { inning, half, after, before } = step
    const where = `${half} ${inning}, through ${step.through}`
    const onSheet = new Set()
    const names = new Set()
    for (const slot of after.grid.slots) {
      for (const card of Object.values(slot.cells)) {
        onSheet.add(card.atBatIndex ?? null)
        names.add(card.batter?.last ?? '')
        names.add(card.runner?.last ?? '')
        for (const pr of card.pinchRunners ?? []) names.add(pr.last ?? '')
      }
    }
    const cards = halfCards(after, inning)
    const returned = [
      playWords(cards.at(-1)),
      ...runnerMoves(halfCards(before, inning), cards),
      ...situation(after, inning, half).runners,
    ].filter(Boolean)
    for (const r of returned) {
      assert.ok(names.has(r.name), `${where}: "${r.name}" is not on the sheet`)
      assert.ok(onSheet.has(r.atBatIndex), `${where}: at-bat ${r.atBatIndex} is not on the sheet`)
    }
    // Totals only for a half at or under the mark.
    for (const n of after.grid.innings) {
      if (halfIndex(n, half) > step.through) assert.equal(halfTotals(after, n, half), null, where)
    }
  }
})

test('a runner is named as the sheet names him: the placed runner, and a pinch runner', () => {
  // The extra-innings placed runner has no batter; his name is on `runner`.
  const placed = { kind: 'placed', runnerId: 7, runner: { last: 'Contreras' }, reached: 2 }
  const moves = runnerMoves([placed], [{ ...placed, reached: 3 }])
  assert.equal(movesText(moves), 'Contreras to 3rd.')

  // A pinch runner replaced the man who batted; the man on base is the last
  // one in the chain (halfInningFeed adds him only once his notice is opened).
  const hit = {
    kind: 'atbat',
    atBatIndex: 4,
    batter: { last: 'Quillen' },
    reached: 1,
    pinchRunners: [{ id: 9, last: 'Smith', base: 1 }],
  }
  assert.equal(movesText(runnerMoves([hit], [{ ...hit, reached: 3 }])), 'Smith to 3rd.')
  assert.equal(movesText(runnerMoves([hit], [{ ...hit, scored: true, reached: 4 }])), 'Smith scores.')
  const view = { grid: { columns: { 0: { inning: 10 } }, slots: [{ cells: { 0: hit } }, { cells: { 0: placed } }] } }
  assert.deepEqual(
    situation(view, 10, 'top').runners.map((r) => `${r.name} ${r.base}`),
    ['Smith 1', 'Contreras 2'],
  )
})

// ---------------------------------------------------------------------------
// Minor-league shape: names and whole views missing
// ---------------------------------------------------------------------------

test('missing names and missing views fall back and never throw', () => {
  const nameless = { kind: 'atbat', atBatIndex: 3, eventType: 'walk', batter: {} }
  const w = playWords(nameless)
  assert.equal(w.name, '')
  assert.equal(w.text, 'The batter walked.')

  const runner = { kind: 'atbat', atBatIndex: 2, batter: {}, reached: 1 }
  const moves = runnerMoves([runner], [{ ...runner, reached: 2 }, { ...nameless, reached: 1 }])
  assert.equal(moves[0].name, '')
  assert.equal(movesText(moves), 'The runner to 2nd.')

  for (const view of [null, undefined, {}, { grid: null }]) {
    assert.deepEqual(halfCards(view, 1), [])
    assert.equal(halfTotals(view, 1, 'top'), null)
    assert.equal(situationText(situation(view, 1, 'top')), 'Top 1 · no outs · bases empty')
  }
  assert.deepEqual(runnerMoves(undefined, undefined), [])
  assert.equal(movesText([]), '')
  assert.equal(situationText(null), '')
  assert.equal(totalsText(null), '')
})
