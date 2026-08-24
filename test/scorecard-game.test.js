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
  scorecardDefense,
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
  assert.deepEqual(sb.decisions, {
    wp: '', wpId: null, wpNote: '',
    lp: '', lpId: null, lpNote: '',
    sv: '', svId: null, svNote: '',
  })
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
  const awayFull = scorecardPlays(FEED, 'top', { through: Infinity })
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
    const grid = scorecardPlays(FEED, side, { through: Infinity })
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
  const grid = scorecardPlays(FEED, 'top', { through: Infinity })
  const bauers = Object.entries(grid.slots[4].cells) // slot 5
    .map(([ci, card]) => ({ card, inning: grid.columns[Number(ci)].inning }))
    .find(({ card, inning }) => inning === 7 && card.batter?.last === 'Bauers')
  assert.ok(bauers, 'Bauers has a 7th-inning card in slot 5')
  assert.equal(bauers.card.scored, true)
  assert.equal(bauers.card.reached, 4)
  assert.equal(bauers.card.pinchRunners?.[0]?.last, 'Mitchell')
})

test('the finished scoreboard fills the FINAL block from the linescore totals', () => {
  const sb = scorecardScoreboard(FEED, { through: Infinity })
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
  // SURNAME ONLY, the way a scorer writes a pitcher onto this sheet and the way
  // the pitcher table above it already does.
  assert.deepEqual(sb.decisions, {
    wp: 'Gasser',
    wpId: 688107,
    // The trimmed fixture keeps no boxscore seasonStats, so the parenthetical
    // degrades to nothing rather than inventing a record. The synthetic feed
    // below is what pins the figure itself.
    wpNote: '',
    lp: 'Dobbins',
    lpId: 690928,
    lpNote: '',
    sv: '',
    svId: null,
    svNote: '',
  })
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

// ONE ROW PER SLOT, with a written line per man who batted in it, and the
// handover ruled off the box the new man arrives on. Pinned on the anchor
// game, whose top sheet has both kinds of change: Bauers gives way to Mitchell
// in the slot, and three relievers follow Dobbins to the mound.
test('a slot keeps one row of boxes however many men bat in it', () => {
  const grid = scorecardPlays(FEED, 'top', { through: Infinity })
  const slot5 = grid.slots[4]
  assert.deepEqual(
    slot5.lines.map((l) => `${l.name} ${l.jersey} ${l.pos}`),
    ['Bauers, Jake 9 LF', 'Mitchell, Garrett 5 CF'],
  )
  // Two men, ONE set of cells: every card in the slot hangs off the slot, so
  // there is no second row of empty boxes under the starter.
  const cols = Object.keys(slot5.cells).map(Number).sort((a, b) => a - b)
  assert.ok(cols.length >= 4, `slot 5 should have batted more than ${cols.length} times`)
  // Each man's own line of figures rides his own written line, and the slot's
  // totals are still the sum of them.
  assert.equal(
    slot5.lines.reduce((n, l) => n + l.ab, 0),
    slot5.ab,
  )

  // The substitution mark: the incoming batter's number, on the FIRST box he
  // bats in — not on a row of the man he replaced, who no longer has one.
  assert.deepEqual(slot5.subMarks, { 8: '5' })
  assert.equal(slot5.cells[8].batter.jersey, '5')
  // …and the box before it — the last trip the starter took — is his, unmarked.
  const before = cols.filter((c) => c < 8).pop()
  assert.equal(slot5.cells[before].batter.jersey, '9')
  assert.equal(slot5.subMarks[before], undefined)

  // A slot nobody was lifted from carries one line and no mark at all.
  const slot8 = grid.slots[7]
  assert.equal(slot8.lines.length, 1)
  assert.deepEqual(slot8.subMarks, {})
})

test('a pitching change rules off the box of the first batter the new arm faces', () => {
  for (const [side, expected] of [
    // The starter takes no mark; every reliever after him takes one, in the
    // order the pitcher table lists them.
    ['top', ['68', '44', '39']],
    ['bottom', ['48']],
  ]) {
    const grid = scorecardPlays(FEED, side, { through: Infinity })
    const marks = grid.slots
      .flatMap((s) => Object.entries(s.pitcherMarks ?? {}).map(([ci, j]) => ({ ci: Number(ci), j, slot: s.slot })))
      .sort((a, b) => a.ci - b.ci)
    const relievers = scorecardPitchers(FEED, side, { through: Infinity })
      .slice(1)
      .map((p) => p.jersey)
    assert.deepEqual(marks.map((m) => m.j), expected, side)
    assert.deepEqual(marks.map((m) => m.j), relievers, `${side}: one mark per reliever`)
    // Every mark lands on a real card — the box the new man's first batter
    // filled — never on an empty cell.
    for (const m of marks) {
      assert.ok(grid.slots[m.slot - 1].cells[m.ci], `${side}: mark at col ${m.ci} has no card`)
    }
  }
})

test('the handover marks are clamped like everything else on the sheet', () => {
  // Sealed: no cards, so no marks of either kind can exist in the DOM.
  const sealed = scorecardPlays(FEED, 'top', { through: -1 })
  for (const s of sealed.slots) {
    assert.deepEqual(s.subMarks, {})
    assert.equal(s.pitcherMarks, null)
  }
  // Through the top of the 3rd, before any change on this sheet: still none.
  const early = scorecardPlays(FEED, 'top', { through: halfIndex(3, 'top') })
  assert.equal(
    early.slots.reduce((n, s) => n + Object.keys(s.pitcherMarks ?? {}).length, 0),
    0,
    'no reliever has entered by the top of the 3rd',
  )
  // And a mark never outruns the reveal it belongs to: every marked column is
  // inside the clamp because it is a column that has a card.
  const mid = scorecardPlays(FEED, 'top', { through: halfIndex(6, 'top') })
  for (const s of mid.slots) {
    for (const ci of Object.keys(s.pitcherMarks ?? {})) {
      assert.ok(s.cells[ci], 'a mark with no card under it')
    }
  }
})

test('the leadoff box names the next-due batter’s unused cell', () => {
  const grid = scorecardPlays(FEED, 'top', { through: Infinity })
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
  const done = scorecardScoreboard(feed, { through: Infinity })
  assert.equal(done.done, true)
  assert.equal(done.innings[8].home, 'X')
  assert.equal(done.innings[8].away, 0)
  // A feed with no player records still gets a surname, split off the full
  // name — the fallback that keeps a lean MiLB decision from printing blank.
  assert.deepEqual(done.decisions, {
    wp: 'Winner',
    wpId: 10,
    wpNote: '',
    lp: 'Loser',
    lpId: 11,
    lpNote: '',
    sv: '',
    svId: null,
    svNote: '',
  })
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

// The figure a box score prints after each pitcher of record: the season
// record for the two starters of record, the count of saves for the man who
// finished it. Shape verified against gamePk 823747 (2026-08-20 SEA@MIL) —
// decisions.winner 694477 carries seasonStats.pitching { wins: 7, losses: 4 },
// decisions.save 656730 carries { saves: 23 } — and reproduced here so the
// reader never has to have the network to run this.
test('the decisions carry the record and the save count, from seasonStats', () => {
  const feed = skippedBottomFeed()
  feed.liveData.decisions.save = { id: 12, fullName: 'Sal Savior' }
  // The feed's own name parts win over splitting the full name, so a two-part
  // surname or a "Jr." survives.
  feed.gameData.players = { ID12: { lastName: 'Savior' } }
  feed.liveData.boxscore.teams = {
    away: {
      players: {
        ID11: { seasonStats: { pitching: { wins: 8, losses: 10, saves: 0 } } },
      },
    },
    home: {
      players: {
        ID10: { seasonStats: { pitching: { wins: 7, losses: 4, saves: 5 } } },
        ID12: { seasonStats: { pitching: { wins: 2, losses: 2, saves: 23 } } },
      },
    },
  }
  const done = scorecardScoreboard(feed, { through: Infinity })
  assert.equal(done.decisions.wpNote, '7-4')
  assert.equal(done.decisions.lpNote, '8-10')
  // The saver's own W-L is beside the point; his line reads the save count.
  assert.equal(done.decisions.svNote, '23')

  // A 0-0 record is a real record, not a missing one — the guard is on the
  // fields existing, never on them being truthy.
  feed.liveData.boxscore.teams.home.players.ID10.seasonStats.pitching = { wins: 0, losses: 0 }
  assert.equal(scorecardScoreboard(feed, { through: Infinity }).decisions.wpNote, '0-0')

  // And a pitcher the boxscore has no line for degrades to a bare name, never
  // to an empty pair of brackets (the screen builds the parentheses only when
  // there is a figure — see Scorecard.jsx's `decision`).
  delete feed.liveData.boxscore.teams.home.players.ID10
  const bare = scorecardScoreboard(feed, { through: Infinity })
  assert.equal(bare.decisions.wp, 'Winner')
  assert.equal(bare.decisions.wpNote, '')
  // The id rides along whatever the figure does — it is what hangs the man's
  // hover card off his name on the sheet.
  assert.equal(bare.decisions.wpId, 10)

  // Nothing here outruns the FINAL block it sits under: a game still sealed
  // short of its end has no decisions at all, notes included.
  const partial = scorecardScoreboard(feed, { through: halfIndex(8, 'bottom') })
  assert.equal(partial.decisions.wpNote, '')
  assert.equal(partial.decisions.svNote, '')
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
  const grid = scorecardPlays(FEED, 'top', { through: Infinity })
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

// THE DEFAULT FAILS CLOSED (ADR-0047).
//
// These four builders used to default `through` to Infinity, so a caller that
// forgot the option inked a finished game end to end. ADR-0047 already asserted
// the Scorecard Lab "passes through: Infinity explicitly" — it did not, it rode
// the default, which is precisely why a permissive default could not be trusted
// to stay unused. A forgotten option must now draw a blank card, not a spoiler.
// Every fielder standing at a spot, flattened to "POS:Last(inning)" so a whole
// diamond is one readable list. A starter has no inning; a man who was later
// replaced is starred.
function alignment(defense) {
  return (defense ?? []).flatMap((spot) =>
    spot.entries.map(
      (e) => `${spot.position}:${e.last}${e.inning == null ? '' : `(${e.inning})`}${e.replaced ? '*' : ''}`,
    ),
  )
}

test('the defense diamond crosses fielders out only as far as the reveal reaches', () => {
  // Nothing revealed: the starting nine, no strike-throughs, no inning tags.
  // Substitution TIMING is the spoiler-adjacent part (ADR-0003/0010) — a flurry
  // of pre-half replacements telegraphs a sealed blowout — so a sheet nobody has
  // opened shows the alignment it showed before first pitch.
  const cold = scorecardDefense(FEED, 'top', { through: -1 })
  assert.equal(cold.length, 9)
  assert.ok(cold.every((spot) => spot.entries.length === 1))
  assert.ok(cold.every((spot) => spot.entries[0].inning == null))
  assert.ok(cold.every((spot) => !spot.entries[0].replaced))

  // This club made its first defensive changes before the top of the 8th, so
  // they belong to the half at index halfIndex(8, 'top') = 14 and appear for a
  // reader who has revealed through 13 — the half before, which is the furthest
  // out safeToShowEntering answers for. One half earlier they do not exist.
  const before = alignment(scorecardDefense(FEED, 'top', { through: halfIndex(7, 'top') }))
  assert.deepEqual(before.filter((line) => /\(\d+\)/.test(line)), [])

  const eighth = alignment(scorecardDefense(FEED, 'top', { through: halfIndex(7, 'bottom') }))
  assert.deepEqual(eighth.filter((line) => /\(\d+\)/.test(line)).sort(), [
    '1B:Jordan(8)',
    '3B:Fermín(8)',
    'C:Crooks(8)',
    'LF:Velázquez(8)',
  ])
  // Nobody who came on in the 8th is crossed out yet — each is the standing man
  // at his spot. The STARTERS he replaced are, which is the pair of marks the
  // diamond draws: the new name above, the old one struck through below.
  assert.ok(!eighth.some((line) => /\(\d+\)\*$/.test(line)))
  assert.ok(eighth.some((line) => line.endsWith('*')))

  // A spot can turn over twice. By the 9th, Jordan has moved off 1B and the man
  // he replaced there is struck through under him, with Pagés written above —
  // the stack the diamond draws top-down (see DefenseDiamond).
  const ninth = alignment(scorecardDefense(FEED, 'top', { through: halfIndex(8, 'bottom') }))
  assert.deepEqual(
    ninth.filter((line) => line.startsWith('1B:')),
    ['1B:Burleson*', '1B:Jordan(8)*', '1B:Pagés(9)'],
  )

  // THE CLAMP, said as one rule: nothing on the diamond can have happened later
  // than the half the reader is due to turn over next.
  for (const through of [-1, 3, 8, 13, 15, 17]) {
    for (const spot of scorecardDefense(FEED, 'top', { through }) ?? []) {
      for (const e of spot.entries) {
        if (e.inning == null) continue
        assert.ok(
          halfIndex(e.inning, 'top') <= through + 1,
          `${spot.position}:${e.last} entered in the ${e.inning}th, past a clamp of ${through}`,
        )
      }
    }
  }
})

test('the diamond belongs to the club in the FIELD, not the one batting', () => {
  // 'top' is the visitors batting, so the diamond is the HOME club's — the same
  // side the pitcher table beside it lists. Read them off the same fixture: the
  // two sheets must name two different nines.
  const away = alignment(scorecardDefense(FEED, 'top', { through: Infinity }))
  const home = alignment(scorecardDefense(FEED, 'bottom', { through: Infinity }))
  assert.notDeepEqual(away, home)
  const names = (lines) => new Set(lines.map((l) => l.split(':')[1].replace(/[(*].*$/, '')))
  assert.equal([...names(away)].some((n) => names(home).has(n)), false)
})

test('a caller that forgets `through` gets nothing revealed, not everything', () => {
  const grid = scorecardPlays(FEED, 'top')
  assert.equal(placedCards(grid).length, 0, 'no at-bat may ink without a stated clamp')
  assert.deepEqual(grid.totals, { ab: 0, h: 0, r: 0, rbi: 0 })
  assert.equal(grid.leadoffMarks.length, 0)
  for (let n = 1; n <= 9; n++) assert.equal(grid.perInning[n], null)

  // The blank columns still draw — a sealed card is a card to write on.
  assert.equal(grid.innings.length, selectRegulationInnings(FEED))

  const sb = scorecardScoreboard(FEED)
  assert.equal(sb.innings.every((cell) => cell?.runs == null), true, 'no scoreboard cell inks')
  assert.deepEqual(scorecardPitchers(FEED, 'top'), [])
})

// ---- The two pages' headers ----
// The #22 does not reprint the umpire crew on its second page; it prints where
// the game was played and what it was played in. scorecardView carries those
// three for the screen to choose between (see Scorecard.jsx's ScorecardHeader).
test('the view carries the bottom page’s own header block, and not the game’s length', async () => {
  const { scorecardView } = await import('../src/api/loadScorecard.js')
  const feed = JSON.parse(JSON.stringify(FEED))
  feed.gameData.venue = { name: 'American Family Field' }
  feed.gameData.weather = { temp: '78', condition: 'Sunny', wind: '7 mph, In From CF' }
  feed.liveData.boxscore.info = [
    { label: 'Weather', value: 'ignored — gameData.weather wins' },
    { label: 'Att', value: '35,909' },
    { label: 'T', value: '2:41' },
    { label: 'First pitch', value: '1:10' },
  ]
  const view = scorecardView({ feed }, 'bottom')
  assert.equal(view.venue, 'American Family Field')
  assert.equal(view.weather, '78°, Sunny · 7 mph, In From CF')
  assert.equal(view.attendance, '35,909')

  // THE FINAL OUT'S TIME IS NOT ON THIS VIEW, and must never be. It is the one
  // line in the family with a tell — against first pitch it gives the game's
  // length, and a long one says extra innings (ADR-0008) — so it rides the
  // reveal-gated scoreboard instead. Nothing spoiler-free may carry it, nor the
  // duration it is derived from, under any name.
  assert.equal(JSON.stringify(view).includes('2:41'), false)
  assert.equal(JSON.stringify(view).includes('finalOut'), false)

  // Both pages read the same block off the feed; which of them the header
  // PRINTS is the screen's call, so the top page must carry it too rather than
  // the api half guessing.
  const top = scorecardView({ feed }, 'top')
  assert.equal(top.venue, 'American Family Field')
  assert.equal(top.attendance, '35,909')

  // MiLB degrades to blanks, never to a crash or a stray "undefined".
  const bare = scorecardView({ feed: { ...feed, gameData: { ...feed.gameData, venue: undefined, weather: undefined }, liveData: { ...feed.liveData, boxscore: { ...feed.liveData.boxscore, info: [] } } } }, 'bottom')
  assert.equal(bare.venue, '')
  assert.equal(bare.weather, '')
  assert.equal(bare.attendance, '')
})

// The final out's time is a WHOLE-GAME fact with a tell in it: read against
// first pitch it gives the game's length, and a long one says extra innings. So
// it waits for exactly what the FINAL line waits for.
test('the final out’s time fills only once the whole game is revealed', async () => {
  const { finalOutClock } = await import('../src/api/scorecard/finalout.js')
  const feed = JSON.parse(JSON.stringify(FEED))
  feed.gameData.venue = { ...feed.gameData.venue, timeZone: { id: 'America/Chicago' } }

  // The last play IS the final out, and its own timestamp already carries every
  // delay and every extra inning rather than needing them added back.
  feed.liveData.plays.allPlays.at(-1).about.endTime = '2026-07-07T21:09:00.000Z'
  assert.equal(finalOutClock(feed, true), '4:09 PM')

  // THE GATE. Not done, not a word — this is the assertion that matters.
  assert.equal(finalOutClock(feed, false), '')

  // Through the scoreboard, which owns `done`: sealed and part-revealed games
  // leave the line blank, and it fills alongside the FINAL block, never before.
  const sealed = scorecardScoreboard(feed, { through: -1 })
  assert.equal(sealed.finalOut, '')
  assert.equal(sealed.done, false)
  const partial = scorecardScoreboard(feed, { through: halfIndex(5, 'top') })
  assert.equal(partial.finalOut, '')
  const done = scorecardScoreboard(feed, { through: Infinity })
  assert.equal(done.done, true)
  assert.equal(done.finalOut, '4:09 PM')

  // A lean feed with no play timestamps falls back to first pitch + playing
  // time + delay, which is the same instant by another route.
  const lean = JSON.parse(JSON.stringify(feed))
  delete lean.liveData.plays.allPlays.at(-1).about.endTime
  lean.gameData.gameInfo = {
    firstPitch: '2026-07-07T18:10:00.000Z',
    gameDurationMinutes: 149,
    delayDurationMinutes: 30,
  }
  assert.equal(finalOutClock(lean, true), '4:09 PM')

  // And a MiLB feed with neither degrades to a blank writing line, never a
  // crash and never "Invalid Date".
  const bare = JSON.parse(JSON.stringify(lean))
  delete bare.gameData.gameInfo
  delete bare.gameData.venue
  assert.equal(finalOutClock(bare, true), '')
})
