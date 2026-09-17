// BOX LINES — the fold behind a LIST door (src/api/boxlines/fold.js, #1048,
// ADR-0069). A door that would otherwise be nine doors (the batting order) or
// thirty-six (#998's ballparks) opens a list instead: the groups, each with his
// line at that group, each opening its own rows.
//
// THE FIGURES COME FROM THE ROWS, not from MLB. That is the whole reason this
// module exists rather than nine more registry entries: MLB's `b1`…`b9` count
// games with a PLATE APPEARANCE in a slot, and the lineups count who STARTED
// there, so a door reading "Batting ninth: 18 G" would open an EMPTY sheet
// (ADR-0069's 2026-09-15 note has the measurements). Folding the gated rows is
// what makes the list and the sheet behind it agree by construction.
//
// So the arithmetic is what this file pins, and two things about it are easy to
// get wrong in silence:
//   • a RATE cannot be averaged — an average of per-game averages is not a
//     batting average;
//   • INNINGS ARE THIRDS — "5.1" plus "1.2" is 7.0, and Number('5.1') +
//     Number('1.2') is 6.3, which is a real-looking number and a wrong one.
import assert from 'node:assert/strict'
import test from 'node:test'
import { foldGroups, foldLine, LIST_COLUMNS } from '../src/api/boxlines/fold.js'

// A gated row as boxLineRows builds it, trimmed to what a fold reads.
function hit(over = {}) {
  return { gamePk: 1, date: '2024-07-04', lineupSpot: 3, counts: { atBats: 4, hits: 1 }, ...over }
}
function arm(over = {}) {
  return { gamePk: 1, date: '2024-07-04', counts: { outs: 21, earnedRuns: 2 }, ...over }
}

// The batting-order list, as cardFacets.js declares it.
const BY_SPOT = {
  groupBy: (row) => row.lineupSpot,
  name: (spot) => `Batting ${spot}`,
  order: 'key',
  facet: (spot) => ({ kind: 'lineupSpot', spot }),
  title: (surname, name) => `${surname}, ${name}`,
}

test('a batting average is hits over at-bats, not an average of averages', () => {
  // 1 for 4 and 3 for 4 is 4 for 8 — .500. The average of .250 and .750 is
  // also .500, so the case that tells them apart needs unequal at-bats: 1 for
  // 4 and 2 for 2 is 3 for 6, .500, where the average of .250 and 1.000 is
  // .625.
  const line = foldLine([hit({ counts: { atBats: 4, hits: 1 } }), hit({ counts: { atBats: 2, hits: 2 } })], 'hitting')
  assert.equal(line.games, 2)
  assert.equal(line.rate, '.500')
})

test('an average is printed to three places with no leading zero', () => {
  // The app's convention, the same one careerSplits.js's rate3 keeps.
  assert.equal(foldLine([hit({ counts: { atBats: 3, hits: 1 } })], 'hitting').rate, '.333')
  assert.equal(foldLine([hit({ counts: { atBats: 2, hits: 2 } })], 'hitting').rate, '1.000')
  assert.equal(foldLine([hit({ counts: { atBats: 4, hits: 0 } })], 'hitting').rate, '.000')
})

test('a group with no at-bats prints no average rather than .000', () => {
  // A pinch runner's group, or a pitcher listed at a park he never batted in.
  // ".000" would say he came up and failed; null says there is nothing to
  // print, which is what the card's quiet mark is for.
  const line = foldLine([hit({ counts: { atBats: 0, hits: 0 } })], 'hitting')
  assert.equal(line.games, 1)
  assert.equal(line.rate, null)
})

test('INNINGS ARE THIRDS: 5.1 plus 1.2 is 7.0 innings, not 6.3', () => {
  // The row carries MLB's own out count for exactly this reason (rows.js), so
  // the fold adds integers: 16 outs and 5 outs are 21, which is seven innings.
  // Three earned runs over seven innings is 3.86, where the same three over a
  // bogus 6.3 "innings" would read 4.29.
  const line = foldLine([arm({ counts: { outs: 16, earnedRuns: 2 } }), arm({ counts: { outs: 5, earnedRuns: 1 } })], 'pitching')
  assert.equal(line.games, 2)
  assert.equal(line.rate, '3.86')
})

test('an ERA is earned runs times nine over the innings, to two places', () => {
  // 9 innings, 27 outs, 3 earned: 3.00 exactly. A shutout is 0.00 and not a
  // missing figure.
  assert.equal(foldLine([arm({ counts: { outs: 27, earnedRuns: 3 } })], 'pitching').rate, '3.00')
  assert.equal(foldLine([arm({ counts: { outs: 27, earnedRuns: 0 } })], 'pitching').rate, '0.00')
})

test('a group that recorded no outs prints no ERA rather than dividing by zero', () => {
  const line = foldLine([arm({ counts: { outs: 0, earnedRuns: 1 } })], 'pitching')
  assert.equal(line.games, 1)
  assert.equal(line.rate, null)
})

test('the list groups the rows, names each group, and counts its games', () => {
  const groups = foldGroups(
    [
      hit({ gamePk: 1, lineupSpot: 3, counts: { atBats: 4, hits: 2 } }),
      hit({ gamePk: 2, lineupSpot: 1, counts: { atBats: 5, hits: 1 } }),
      hit({ gamePk: 3, lineupSpot: 3, counts: { atBats: 4, hits: 2 } }),
    ],
    BY_SPOT,
    'hitting',
  )
  assert.deepEqual(
    groups.map((g) => ({ key: g.key, name: g.name, games: g.games, rate: g.line.rate })),
    [
      { key: 1, name: 'Batting 1', games: 1, rate: '.200' },
      { key: 3, name: 'Batting 3', games: 2, rate: '.500' },
    ],
  )
})

test('a null group key drops the row: a bench game is under no slot', () => {
  // The rows a list is handed are ALL of his gated games. The ones the list
  // cannot describe leave it, rather than collecting under a tenth heading.
  const groups = foldGroups(
    [hit({ gamePk: 1, lineupSpot: null }), hit({ gamePk: 2, lineupSpot: 2 })],
    BY_SPOT,
    'hitting',
  )
  assert.deepEqual(groups.map((g) => g.key), [2])
})

test('a group he never had does not render as a zero', () => {
  // A player who has never batted ninth gets eight entries, not a ninth
  // reading "0 G, .000". The list is built FROM the rows, so an empty group
  // has no way to exist — this pins that it stays that way.
  const groups = foldGroups([hit({ lineupSpot: 1 })], BY_SPOT, 'hitting')
  assert.equal(groups.length, 1)
  assert.equal(groups.some((g) => g.games === 0), false)
})

test('order "key" is the sequence, and order "games" is the biggest first', () => {
  // A batting order is a sequence and reads 1 through 9. #998's thirty-six
  // ballparks are not a sequence, and the park he has played at most is the
  // one a reader wants at the top — so the two orders must actually differ.
  const rows = [
    hit({ gamePk: 1, lineupSpot: 9 }),
    hit({ gamePk: 2, lineupSpot: 9 }),
    hit({ gamePk: 3, lineupSpot: 9 }),
    hit({ gamePk: 4, lineupSpot: 5 }),
    hit({ gamePk: 5, lineupSpot: 5 }),
    hit({ gamePk: 6, lineupSpot: 2 }),
  ]
  assert.deepEqual(foldGroups(rows, BY_SPOT, 'hitting').map((g) => g.key), [2, 5, 9])
  assert.deepEqual(
    foldGroups(rows, { ...BY_SPOT, order: 'games' }, 'hitting').map((g) => g.key),
    [9, 5, 2],
  )
})

test('two groups of the same size fall back on the name, never on the row order', () => {
  // Otherwise a list re-orders itself when one game lands, which on #998's
  // thirty-six parks is most of the list moving for no reason a reader can see.
  const rows = [hit({ gamePk: 1, lineupSpot: 7 }), hit({ gamePk: 2, lineupSpot: 2 })]
  const forward = foldGroups(rows, { ...BY_SPOT, order: 'games' }, 'hitting')
  const backward = foldGroups([...rows].reverse(), { ...BY_SPOT, order: 'games' }, 'hitting')
  assert.deepEqual(forward.map((g) => g.key), [2, 7])
  assert.deepEqual(backward.map((g) => g.key), [2, 7])
})

test('a group names its own facet, and the facet narrows to that group', () => {
  // The round trip the sheet makes when a reader taps an entry: the list hands
  // back the facet, the sheet asks the same join for it, and the rows that come
  // back are the ones the entry counted.
  const groups = foldGroups([hit({ lineupSpot: 4 })], BY_SPOT, 'hitting')
  assert.deepEqual(groups[0].facet, { kind: 'lineupSpot', spot: 4 })
})

test('the list names two columns per group, and they are the ones it folds', () => {
  // The card's five columns are a career's; a folded line has two figures and
  // says so — the same two `chipLine` prints, so an entry and the sheet it
  // opens cannot disagree about more than they have room to say.
  assert.deepEqual(LIST_COLUMNS.hitting, ['G', 'AVG'])
  assert.deepEqual(LIST_COLUMNS.pitching, ['G', 'ERA'])
})

test('nothing to fold is an empty list, not a crash', () => {
  assert.deepEqual(foldGroups([], BY_SPOT, 'hitting'), [])
  assert.deepEqual(foldGroups(null, BY_SPOT, 'hitting'), [])
  assert.deepEqual(foldGroups([hit()], null, 'hitting'), [])
  assert.equal(foldLine([], 'hitting').games, 0)
})

test('a row with no counts on it folds to games alone', () => {
  // Defensive, and it is the MiLB-degrades-gracefully rule in miniature: a
  // split that came back without the stat still counts as a game he played.
  const line = foldLine([{ gamePk: 1 }, hit({ counts: { atBats: 2, hits: 1 } })], 'hitting')
  assert.equal(line.games, 2)
  assert.equal(line.rate, '.500')
})
