// The live scorecard's data layer (src/api/scorecardGame.js), pinned on the
// captured real game (gamePk 823035, 2026-07-07 MIL@STL g2, final 10–2 —
// the same fixture invariant-real-game.test.js reads).
//
// Three promises are pinned, in order of importance:
//
//   1. THE CLAMP — nothing from a half-inning past `through` reaches the
//      grid, the P/TP/LOB row, or the scoreboard; the FINAL block and the
//      decisions wait for a fully revealed Final game. This is the ADR-0009
//      pattern the module's manifest class (reveal-gated) names.
//   2. AGREEMENT — the sheet's numbers are the SAME numbers the innings
//      viewer's own readers produce (revealInning / revealTotals /
//      computeDerivedByInning), never a second walk that can drift; and the
//      sheet's visible-innings walk matches revealProgressCore's
//      unlockedInnings exactly (extras never spoil, ADR-0008), since the two
//      are deliberately parallel implementations.
//   3. THE MARKS — the end-of-inning slash lands on the box of the plate
//      appearance that CLOSED the half, the leadoff box names the next-due
//      batter's UNUSED cell, and a skipped final bottom half reads 'X' on
//      the finished scoreboard.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  scorecardPlays,
  scorecardScoreboard,
  scorecardPitchers,
  scorecardStep,
} from '../src/api/scorecardGame.js'
import { revealInning, revealTotals } from '../src/api/linescore.js'
import { computeDerivedByInning, revealDerived } from '../src/api/derive.js'
import { computePitcherLines } from '../src/api/pitchers.js'
import { computeHalfInningFeed, nextStepBoundary } from '../src/api/playbyplay.js'
import { halfIndex, selectInningCount, selectRegulationInnings } from '../src/api/select.js'
import { unlockedInnings } from '../src/hooks/revealProgressCore.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

// Every card actually placed on a grid, with the inning its column belongs to.
function placedCards(grid) {
  const out = []
  for (const slot of grid.slots) {
    for (const [ci, card] of Object.entries(slot.cells)) {
      out.push({ card, inning: grid.columns[Number(ci)].inning, slot: slot.slot })
    }
  }
  return out
}

test('nothing on the sheet before the first reveal', () => {
  const grid = scorecardPlays(FEED, 'top', { through: -1 })
  assert.equal(placedCards(grid).length, 0)
  assert.equal(grid.innings.length, selectRegulationInnings(FEED)) // 9 blank columns
  for (let n = 1; n <= 9; n++) assert.equal(grid.perInning[n], null)
  assert.deepEqual(grid.totals, { ab: 0, h: 0, r: 0, rbi: 0 })
  assert.equal(grid.leadoffMarks.length, 0)
  assert.deepEqual(scorecardPitchers(FEED, 'top', { through: -1 }), [])

  const sb = scorecardScoreboard(FEED, { through: -1 })
  assert.equal(sb.done, false)
  assert.equal(sb.away.final, null)
  assert.deepEqual(sb.decisions, { wp: '', lp: '', sv: '' })
  for (const i of sb.innings) {
    assert.equal(i.away, '')
    assert.equal(i.home, '')
  }
})

test('the clamp holds: no card, no P/TP/LOB line, no scoreboard cell past `through`', () => {
  const through = halfIndex(3, 'top') // top 3 revealed; bottom 3 still sealed
  for (const side of ['top', 'bottom']) {
    const grid = scorecardPlays(FEED, side, { through })
    const half = side === 'bottom' ? 'bottom' : 'top'
    for (const { inning } of placedCards(grid)) {
      assert.ok(
        halfIndex(inning, half) <= through,
        `${side} sheet placed a card from ${half} ${inning}, past the mark`,
      )
    }
    for (let n = 1; n <= 9; n++) {
      if (halfIndex(n, half) > through) assert.equal(grid.perInning[n], null)
    }
  }
  // The away sheet is three innings in; the home sheet two. Both partial.
  const away = scorecardPlays(FEED, 'top', { through })
  const awayFull = scorecardPlays(FEED, 'top')
  assert.ok(placedCards(away).length > 0)
  assert.ok(away.totals.ab < awayFull.totals.ab)

  const sb = scorecardScoreboard(FEED, { through })
  assert.notEqual(sb.innings[2].away, '') // top 3 is revealed…
  assert.equal(sb.innings[2].home, '') // …its bottom is not
  assert.equal(sb.innings[3].away, '') // top 4 is not
  assert.equal(sb.done, false)
  assert.equal(sb.away.final, null)
  assert.equal(sb.decisions.wp, '')
  // The pitcher table carries only arms that have appeared within the clamp,
  // with the exact lines computePitcherLines produces for the same mark.
  const arms = scorecardPitchers(FEED, 'top', { through })
  const lines = computePitcherLines(FEED, through).home
  assert.equal(arms.length, lines.length)
  assert.ok(arms.length >= 1)
  assert.equal(arms[0].ip, lines[0].ip)
})

test('the sheet agrees with the innings viewer’s own readers, inning by inning', () => {
  const derived = computeDerivedByInning(FEED)
  for (const [side, teamSide, half] of [
    ['top', 'away', 'top'],
    ['bottom', 'home', 'bottom'],
  ]) {
    const grid = scorecardPlays(FEED, side)
    let tp = 0
    for (let n = 1; n <= 9; n++) {
      const line = grid.perInning[n]
      const ref = revealInning(FEED, n, teamSide)
      const pitches = revealDerived(derived, n, half).pitches
      tp += pitches
      assert.ok(line, `${teamSide} inning ${n} has no P/TP/LOB line`)
      assert.equal(line.p, pitches, `${teamSide} inning ${n} pitches`)
      assert.equal(line.tp, tp, `${teamSide} inning ${n} running total`)
      assert.equal(line.lob, ref?.leftOnBase ?? 0, `${teamSide} inning ${n} LOB`)
      assert.equal(line.runs, ref?.runs ?? 0, `${teamSide} inning ${n} runs`)
    }
    // The grid's own tallies land on the official totals: the cards' runs and
    // hits sum to the linescore's R and H, and the per-inning runs row does
    // too. R here is the assertion that found a real bug: a pinch runner's
    // run used to vanish from the grid (see the test below).
    const totals = revealTotals(FEED, teamSide)
    assert.equal(grid.totals.r, totals.runs)
    assert.equal(grid.totals.h, totals.hits)
    const runSum = Object.values(grid.perInning).reduce((a, l) => a + (l?.runs ?? 0), 0)
    assert.equal(runSum, totals.runs)
  }
})

test('a pinch runner’s run fills the ORIGIN batter’s diamond, with the PR penciled in', () => {
  // Top 7: Jake Bauers walks, Garrett Mitchell pinch-runs and comes around to
  // score on Chourio's single. The scorebook convention — and the fixture
  // case that once read 9 of MIL's 10 runs off the grid: the substitution
  // playEvent's `position`/`replacedPlayer` fields are what let the feed
  // builder alias Mitchell's baserunning back onto Bauers' card, so a
  // re-trimmed fixture that drops them regresses this exact test.
  const grid = scorecardPlays(FEED, 'top')
  const bauers = Object.entries(grid.slots[4].cells) // slot 5
    .map(([ci, card]) => ({ card, inning: grid.columns[Number(ci)].inning }))
    .find(({ card, inning }) => inning === 7 && card.batter?.last === 'Bauers')
  assert.ok(bauers, 'Bauers has a 7th-inning card in slot 5')
  assert.equal(bauers.card.scored, true)
  assert.equal(bauers.card.reached, 4)
  assert.equal(bauers.card.pinchRunners?.[0]?.last, 'Mitchell')
})

test('the finished scoreboard fills the FINAL block from the linescore totals', () => {
  const sb = scorecardScoreboard(FEED)
  assert.equal(sb.done, true)
  const away = revealTotals(FEED, 'away')
  const home = revealTotals(FEED, 'home')
  assert.deepEqual(sb.away.final, {
    r: away.runs,
    h: away.hits,
    e: away.errors,
    lob: away.leftOnBase,
  })
  assert.equal(sb.away.final.r, 10) // the pinned final: MIL 10, STL 2
  assert.equal(sb.home.final.r, 2)
  assert.equal(home.runs, 2)
  // The real decisions, by name; a 10–2 final has no save, and the label
  // degrades blank rather than inventing one.
  assert.deepEqual(sb.decisions, { wp: 'Robert Gasser', lp: 'Hunter Dobbins', sv: '' })
})

test('visible innings match unlockedInnings at every mark (the two walks never drift)', () => {
  const regulation = selectRegulationInnings(FEED)
  const actual = selectInningCount(FEED)
  for (const through of [-1, 0, 1, 3, 4, 8, 15, 16, 17, 999]) {
    const grid = scorecardPlays(FEED, 'top', { through })
    assert.equal(
      grid.innings.length,
      unlockedInnings(regulation, actual, through),
      `through=${through}`,
    )
    const sb = scorecardScoreboard(FEED, { through })
    assert.equal(sb.innings.length, unlockedInnings(regulation, actual, through))
  }
})

test('the leadoff box names the next-due batter’s unused cell', () => {
  const grid = scorecardPlays(FEED, 'top')
  assert.ok(
    grid.leadoffMarks.length >= 7,
    `only ${grid.leadoffMarks.length} leadoff boxes on a 9-inning sheet`,
  )
  for (const mark of grid.leadoffMarks) {
    const slot = grid.slots[mark.slot - 1]
    // Empty by definition — which is what lets the turn handoff sit there
    // without displacing a card or drawing any notation of its own.
    assert.equal(slot.cells[mark.colIndex], undefined, 'the leadoff box must be empty')
    // Valued by the inning that ended, never a bare `true` — the handoff
    // names ONE inning's box and leaves every older one blank.
    assert.equal(slot.leadoffCells[mark.colIndex], mark.inning)
    assert.equal(grid.columns[mark.colIndex].inning, mark.inning)
  }
  // Pin inning 1 exactly: the slot after the half's last plate appearance.
  const top1 = computeHalfInningFeed(FEED, 1, 'top', 'away').filter((c) => c.kind === 'atbat')
  const last = top1[top1.length - 1]
  const lastSlot = grid.slots.find((s) =>
    Object.values(s.cells).some((c) => c.atBatIndex === last.atBatIndex),
  )
  const expected = (lastSlot.slot % 9) + 1
  const inning1Mark = grid.leadoffMarks.find((m) => grid.columns[m.colIndex].inning === 1)
  assert.ok(inning1Mark, 'inning 1 has an end mark')
  assert.equal(inning1Mark.slot, expected)
})

// A minimal Final feed where the home club never needed its last at-bat: the
// linescore has no bottom-9 entry and the last play is in the top. The
// finished scoreboard writes the linescore's own 'X' there — but only once
// the game is done; mid-reveal it stays a plain blank like any sealed half.
function skippedBottomFeed() {
  // The real linescore shape for a skipped half: the last inning's entry has
  // NO `home` key at all (revealInning then reads null), not an empty object.
  const innings = Array.from({ length: 9 }, (_, i) => {
    const entry = { num: i + 1, away: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 } }
    if (i < 8) entry.home = { runs: i === 0 ? 2 : 0, hits: 0, errors: 0, leftOnBase: 0 }
    return entry
  })
  return {
    gamePk: 1,
    gameData: {
      status: { abstractGameState: 'Final' },
      teams: {
        away: { id: 1, name: 'Away Club', teamName: 'Aways', abbreviation: 'AWY' },
        home: { id: 2, name: 'Home Club', teamName: 'Homes', abbreviation: 'HOM' },
      },
    },
    liveData: {
      linescore: {
        scheduledInnings: 9,
        innings,
        teams: {
          away: { runs: 0, hits: 4, errors: 1, leftOnBase: 6 },
          home: { runs: 2, hits: 5, errors: 0, leftOnBase: 3 },
        },
      },
      boxscore: { teams: {} },
      plays: {
        allPlays: [{ about: { inning: 9, halfInning: 'top', atBatIndex: 65 }, result: {} }],
      },
      decisions: {
        winner: { id: 10, fullName: 'Winnie Winner' },
        loser: { id: 11, fullName: 'Louie Loser' },
      },
    },
  }
}

test('a skipped final bottom reads X once the game is done — and not before', () => {
  const feed = skippedBottomFeed()
  const done = scorecardScoreboard(feed)
  assert.equal(done.done, true)
  assert.equal(done.innings[8].home, 'X')
  assert.equal(done.innings[8].away, 0)
  assert.deepEqual(done.decisions, { wp: 'Winnie Winner', lp: 'Louie Loser', sv: '' })
  assert.deepEqual(done.home.final, { r: 2, h: 5, e: 0, lob: 3 })

  // Revealed only through the 8th: the top 9 cell AND the skipped bottom stay
  // blank, and nothing FINAL-shaped fills.
  const partial = scorecardScoreboard(feed, { through: halfIndex(8, 'bottom') })
  assert.equal(partial.done, false)
  assert.equal(partial.innings[8].away, '')
  assert.equal(partial.innings[8].home, '')
  assert.equal(partial.away.final, null)
  assert.equal(partial.decisions.wp, '')
})

test('extra innings unlock scoreboard columns one at a time (ADR-0008)', () => {
  const feed = skippedBottomFeed()
  feed.liveData.linescore.innings.push({
    num: 10,
    away: { runs: 1, hits: 1, errors: 0, leftOnBase: 0 },
    home: {},
  })
  feed.gameData.status.abstractGameState = 'Live'
  // Through the bottom of the 9th: the 10th's column exists (its predecessor
  // is fully revealed) — one inning past regulation, no further.
  assert.equal(
    scorecardScoreboard(feed, { through: halfIndex(9, 'bottom') }).innings.length,
    10,
  )
  // One half earlier, the sheet still shows only regulation.
  assert.equal(
    scorecardScoreboard(feed, { through: halfIndex(9, 'top') }).innings.length,
    9,
  )
})

test('the end-of-inning slash marks the box the half actually ENDED on', () => {
  const grid = scorecardPlays(FEED, 'top')
  const marked = placedCards(grid).filter(({ card }) => card.endsHalf)
  // One per played half of a 9-inning sheet.
  assert.equal(marked.length, 9)
  for (let n = 1; n <= 9; n++) {
    const forInning = marked.filter((m) => m.inning === n)
    assert.equal(forInning.length, 1, `inning ${n} has exactly one end-of-inning slash`)
    // It is the LAST plate appearance of that half, by feed order — NOT the
    // cell that recorded the third out, which can belong to an earlier
    // runner cut down during a later batter's trip.
    const half = computeHalfInningFeed(FEED, n, 'top', 'away').filter((c) => c.kind === 'atbat')
    assert.equal(forInning[0].card.atBatIndex, half[half.length - 1].atBatIndex)
  }
  // The slash and the leadoff box are never the same cell: the slash closes
  // the half's own last box, which is a card; the leadoff box is empty.
  for (const mark of grid.leadoffMarks) {
    assert.equal(grid.slots[mark.slot - 1].cells[mark.colIndex], undefined)
  }
})

test('the end-of-inning slash is a whole-half fact: it inks on commit, never mid-step', () => {
  // Walk top 1 to its last cursor. The half is not committed at any of them,
  // so no card may carry the rule — same hold as the P/TP/LOB line.
  let count = 0
  for (;;) {
    const s = scorecardStep(FEED, -1, () => count)
    const grid = scorecardPlays(FEED, 'top', { through: -1, step: { halfIdx: 0, count } })
    for (const { card } of placedCards(grid)) {
      assert.ok(!card.endsHalf, `cursor ${count} slashed a box before the half committed`)
    }
    if (s.nextCount >= s.total) break
    count = s.nextCount
  }
  // Committed: now it inks.
  const done = scorecardPlays(FEED, 'top', { through: halfIndex(1, 'top') })
  assert.equal(placedCards(done).filter(({ card }) => card.endsHalf).length, 1)
  // And a half the game has REACHED but not finished takes neither mark: the
  // top of 9 is revealed here, but nothing past it has been played yet.
  const live = { ...FEED, gameData: { ...FEED.gameData, status: { abstractGameState: 'Live' } } }
  const open = scorecardPlays(live, 'bottom', { through: halfIndex(9, 'bottom') })
  assert.equal(placedCards(open).filter(({ card }) => card.endsHalf).length, 8)
  assert.ok(!open.leadoffMarks.some((m) => m.inning === 9))
})

// ---------------------------------------------------------------------------
// The play-in-place layer (scorecardStep + scorecardPlays' `step`): the live
// sheet's face-down frontier card. What must hold, in order of importance:
// the step can never leak past its own cursor; whole-half facts (P/TP/LOB,
// scoreboard cells, the end-of-inning slash) never ink mid-step; and the
// frontier always names a real, empty cell — including the bat-around case,
// where its column doesn't exist until the frontier widens it.
// ---------------------------------------------------------------------------

test('scorecardStep walks the frontier half on the shared cursor', () => {
  const s0 = scorecardStep(FEED, -1, () => 0)
  assert.equal(s0.inning, 1)
  assert.equal(s0.half, 'top')
  assert.equal(s0.side, 'top')
  assert.equal(s0.count, 0)
  assert.ok(s0.nextCount >= 1)
  assert.ok(s0.nextCount < s0.total)
  assert.equal(s0.halfOver, true) // the captured game is Final
  // A fully caught-up sheet has nothing to step.
  assert.equal(scorecardStep(FEED, halfIndex(9, 'bottom'), () => 0), null)
})

test('a stepped half shows exactly the cursor’s cards and nothing whole-half', () => {
  const s0 = scorecardStep(FEED, -1, () => 0)
  const grid = scorecardPlays(FEED, 'top', {
    through: -1,
    step: { halfIdx: 0, count: s0.nextCount },
  })
  const placed = []
  for (const slot of grid.slots) placed.push(...Object.values(slot.cells))
  assert.equal(placed.length, 1, 'one tap reveals one plate appearance')
  // Whole-half facts stay blank mid-step: no P/TP/LOB, no end-of-inning slash.
  assert.equal(grid.perInning[1], null)
  assert.equal(grid.leadoffMarks.length, 0)
  // The frontier moved to the NEXT batter's empty box in inning 1.
  assert.ok(grid.frontier)
  assert.equal(grid.columns[grid.frontier.colIndex].inning, 1)
  const slot = grid.slots[grid.frontier.slot - 1]
  assert.equal(slot.cells[grid.frontier.colIndex], undefined)
})

test('the frontier never renders on the other club’s sheet', () => {
  const grid = scorecardPlays(FEED, 'bottom', {
    through: -1,
    step: { halfIdx: 0, count: 5 },
  })
  assert.equal(grid.frontier, null)
  const placed = []
  for (const slot of grid.slots) placed.push(...Object.values(slot.cells))
  assert.equal(placed.length, 0)
})

test('stepping a whole half never over-reveals, and commit is what inks the half', () => {
  // Walk top 1 boundary by boundary, checking the clamp at every cursor.
  let count = 0
  let steps = 0
  for (;;) {
    const s = scorecardStep(FEED, -1, () => count)
    assert.ok(s, 'the frontier half exists until committed')
    const grid = scorecardPlays(FEED, 'top', { through: -1, step: { halfIdx: 0, count } })
    const placed = []
    for (const slot of grid.slots) placed.push(...Object.values(slot.cells))
    assert.ok(placed.length <= steps, `cursor ${count}: ${placed.length} cards after ${steps} steps`)
    if (grid.frontier != null) {
      assert.ok(grid.frontier.colIndex >= 0)
    }
    if (s.nextCount >= s.total) break
    count = s.nextCount
    steps += 1
  }
  // Committed (revealTo's collapse): the half's whole-half facts ink now.
  const done = scorecardPlays(FEED, 'top', { through: halfIndex(1, 'top') })
  assert.ok(done.perInning[1])
  assert.ok(done.leadoffMarks.some((m) => done.columns[m.colIndex].inning === 1))
})

// The advancement fields a later play writes BACK onto an earlier card — the
// ones computeHalfInningFeed gates behind its own `stepCap` (see
// entriesView.js's "THE TRAP EVERY READER HERE MUST CLEAR"). Read off an
// uncapped feed they describe plays the cursor has not reached.
const FOLDED_BACK = ['outNumber', 'outAt', 'outCode', 'scored', 'reached']

test('a stepped half never folds a LATER play back onto an already-revealed card', () => {
  // The bug this pins: the grid built its stepped half with no `stepCap`, so
  // the half's whole advancement bookkeeping landed on cards the cursor had
  // already inked. On a real sheet that read as the next batter's play,
  // penciled a tap early — a runner erased on a double play he hadn't seen
  // yet, and (22 times in this one fixture) a run scored before the at-bat
  // that drove it in.
  let leaks = 0
  for (let inning = 1; inning <= 9; inning++) {
    for (const [side, half, battingSide] of [
      ['top', 'top', 'away'],
      ['bottom', 'bottom', 'home'],
    ]) {
      const idx = halfIndex(inning, half)
      const through = idx - 1
      const full = computeHalfInningFeed(FEED, inning, half, battingSide)
      let count = 0
      for (;;) {
        const next = nextStepBoundary(full, count)
        if (next <= count) break
        const grid = scorecardPlays(FEED, side, { through, step: { halfIdx: idx, count: next } })
        // What the innings viewer shows for the SAME cursor — the one shared
        // mark (ADR-0016), so the two surfaces can never disagree about what
        // this tap has revealed.
        const capped = computeHalfInningFeed(FEED, inning, half, battingSide, next)
        const byAtBat = new Map()
        for (let i = 0; i < next; i++) {
          if (capped[i].atBatIndex != null) byAtBat.set(capped[i].atBatIndex, capped[i])
        }
        for (const slot of grid.slots) {
          for (const card of Object.values(slot.cells)) {
            const ref = byAtBat.get(card.atBatIndex)
            if (!ref) continue
            for (const f of FOLDED_BACK) {
              if (JSON.stringify(card[f]) !== JSON.stringify(ref[f])) leaks += 1
              assert.deepEqual(
                card[f] ?? null,
                ref[f] ?? null,
                `${half} ${inning} cursor ${next}: ${card.batter?.last}'s card leaked ${f}`,
              )
            }
          }
        }
        count = next
      }
    }
  }
  assert.equal(leaks, 0)
})

test('the pinned leaks: an out on the bases, and a run, one tap early', () => {
  // Bottom 2 of the captured game: Fermín reaches, and the NEXT batter's
  // fielder's choice cuts him down at second (out 3, "FC 6-4") — exactly the
  // shape reported on LAD's sheet as a double play penciled on Hernández.
  // With the cursor at 3 entries his card must still read a clean reach.
  const b2 = scorecardPlays(FEED, 'bottom', {
    through: halfIndex(2, 'top'),
    step: { halfIdx: halfIndex(2, 'bottom'), count: 3 },
  })
  const fermin = b2.slots
    .flatMap((s) => Object.values(s.cells))
    .find((c) => c.batter?.last === 'Fermín')
  assert.ok(fermin, 'Fermín has a bottom-2 card at this cursor')
  assert.equal(fermin.outNumber ?? null, null)
  assert.equal(fermin.outAt ?? null, null)
  assert.equal(fermin.outCode ?? '', '')

  // Top 3: Pratt leads off and comes around to score later in the half. One
  // tap in, his diamond must be unfilled — a scored run is the plainest
  // spoiler the sheet can carry.
  const t3 = scorecardPlays(FEED, 'top', {
    through: halfIndex(2, 'bottom'),
    step: { halfIdx: halfIndex(3, 'top'), count: 1 },
  })
  const pratt = t3.slots
    .flatMap((s) => Object.values(s.cells))
    .find((c) => c.batter?.last === 'Pratt')
  assert.ok(pratt, 'Pratt has a top-3 card at this cursor')
  assert.equal(pratt.scored, false)
  assert.ok(pratt.reached < 4, `Pratt reached ${pratt.reached} one tap in`)
})

test('a bat-around frontier widens its inning by the column its card needs', () => {
  // Top 7 (halfIdx 12) is the bat-around: walk its boundaries; at every
  // cursor the frontier must name a real, EMPTY cell — which past the ninth
  // batter requires the inning to have widened for the face-down card.
  const through = halfIndex(6, 'bottom')
  let count = 0
  let sawSecondColumn = false
  for (;;) {
    const s = scorecardStep(FEED, through, () => count)
    const grid = scorecardPlays(FEED, 'top', { through, step: { halfIdx: 12, count } })
    if (grid.frontier) {
      const col = grid.columns[grid.frontier.colIndex]
      assert.equal(col.inning, 7)
      if (col.sub > 0) sawSecondColumn = true
      assert.equal(grid.slots[grid.frontier.slot - 1].cells[grid.frontier.colIndex], undefined)
    }
    if (s.nextCount >= s.total) break
    count = s.nextCount
  }
  assert.ok(sawSecondColumn, 'the 7th batted around, so a frontier card must have opened its second column')
})
