// Unit coverage for the contract identity workbench's pure layer
// (src/lib/admin/contractGroups.js + nameDiff.js).
//
// The bulk rule is what earns these tests. A bulk action writes up to a dozen
// historical rows from one click, so the two places it must NOT fire, and the
// one place it must fire even though the inputs look inconsistent, are pinned
// here rather than left to a reviewer noticing:
//
//   - confirm mode with rows carrying DIFFERENT ids must offer no bulk at all;
//   - choose mode with shortlists that differ row to row must still offer it,
//     because each row was matched against its own season's roster and a
//     missing candidate means "not on that roster", not "a different person";
//   - cold mode's only bulk is "no match exists".
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MODE_CHOOSE,
  MODE_COLD,
  MODE_CONFIRM,
  buildGroups,
  bulkPlan,
  candidatePatch,
  confirmPatch,
  dismissPatch,
  groupKeyFor,
  isGroupResolved,
  modeForRow,
  openRows,
  tierCounts,
  undoPatch,
  unionCandidates,
} from '../src/lib/admin/contractGroups.js'
import { diffNames } from '../src/lib/admin/nameDiff.js'

function row(over = {}) {
  return {
    rowKey: 'extensions#1',
    sourceFile: 'extensions',
    season: 2010,
    matchedSeason: 2010,
    rawName: 'Belliard, Ron',
    rawTeamCode: 120,
    mlbId: null,
    confidence: 'unresolved',
    matchScore: 0.9,
    matchedVia: 'no-plausible-name',
    candidates: [],
    ...over,
  }
}

function cand(id, name, score, reasons = []) {
  return { id, lastFirstName: name, score, reasons }
}

test('modeForRow routes on what the row holds, not on the tier alone', () => {
  assert.equal(modeForRow(row({ confidence: 'fuzzy', mlbId: 110351 })), MODE_CONFIRM)
  // A fuzzy row keeps its confirm mode even with an empty candidate list —
  // that emptiness is the point: the matcher already picked somebody.
  assert.equal(modeForRow(row({ confidence: 'fuzzy', mlbId: 110351, candidates: [] })), MODE_CONFIRM)
  assert.equal(modeForRow(row({ candidates: [cand(1, 'A, B', 0.9)] })), MODE_CHOOSE)
  assert.equal(modeForRow(row({ confidence: 'ambiguous', candidates: [cand(1, 'A, B', 0.9)] })), MODE_CHOOSE)
  assert.equal(modeForRow(row({ matchedVia: 'empty-pool' })), MODE_COLD)
})

test('the group key carries confidence, so one name cannot straddle two tiers', () => {
  const a = row({ confidence: 'fuzzy' })
  const b = row({ confidence: 'unresolved' })
  assert.notEqual(groupKeyFor(a), groupKeyFor(b))
  assert.equal(groupKeyFor(a), 'extensions|fuzzy|Belliard, Ron')
  // Same name in a different source file is a different group too.
  assert.notEqual(groupKeyFor(a), groupKeyFor(row({ confidence: 'fuzzy', sourceFile: 'salaries' })))
})

test('groups sort by row count descending, then by name', () => {
  const rows = [
    row({ rowKey: 'a#1', rawName: 'Zeta, Z', confidence: 'fuzzy', mlbId: 1 }),
    row({ rowKey: 'a#2', rawName: 'Alpha, A', confidence: 'fuzzy', mlbId: 2 }),
    row({ rowKey: 'a#3', rawName: 'Alpha, A', confidence: 'fuzzy', mlbId: 2 }),
    row({ rowKey: 'a#4', rawName: 'Mid, M', confidence: 'fuzzy', mlbId: 3 }),
  ]
  const groups = buildGroups(rows)
  assert.deepEqual(
    groups.map((g) => [g.rawName, g.count]),
    [
      ['Alpha, A', 2],
      ['Mid, M', 1],
      ['Zeta, Z', 1],
    ],
  )
  assert.equal(groups[0].firstSeason, 2010)
})

test('confirm mode: bulk is offered only when every row carries the same id', () => {
  const agree = buildGroups([
    row({ rowKey: 'x#1', confidence: 'fuzzy', mlbId: 110351 }),
    row({ rowKey: 'x#2', confidence: 'fuzzy', mlbId: 110351, season: 2011 }),
  ])[0]
  assert.equal(agree.mode, MODE_CONFIRM)
  assert.equal(agree.bulk.offered, true)
  assert.equal(agree.bulk.action, 'confirm')
  assert.deepEqual(agree.bulk.conflictIds, [])
})

test('confirm mode: differing ids name the conflict and withhold bulk entirely', () => {
  const clash = buildGroups([
    row({ rowKey: 'x#1', confidence: 'fuzzy', mlbId: 110351 }),
    row({ rowKey: 'x#2', confidence: 'fuzzy', mlbId: 425532 }),
    row({ rowKey: 'x#3', confidence: 'fuzzy', mlbId: 110351 }),
  ])[0]
  assert.equal(clash.bulk.offered, false)
  assert.equal(clash.bulk.action, null)
  // Sorted and deduped, so the banner reads the same however the rows arrived.
  assert.deepEqual(clash.bulk.conflictIds, [110351, 425532])
})

test('choose mode: bulk is offered even when the shortlists differ row to row', () => {
  const group = buildGroups([
    row({ rowKey: 'y#1', candidates: [cand(1, 'Belliard, Ronnie', 0.91, ['position match'])] }),
    row({
      rowKey: 'y#2',
      season: 2008,
      candidates: [cand(2, 'Williams, Jerome', 0.45), cand(1, 'Belliard, Ronnie', 0.88)],
    }),
  ])[0]
  assert.equal(group.mode, MODE_CHOOSE)
  assert.equal(group.bulk.offered, true)
  assert.equal(group.bulk.action, 'candidate')
})

test('the union of candidates dedupes by id, keeps the best score, and counts rows', () => {
  const merged = unionCandidates([
    row({ candidates: [cand(1, 'Belliard, Ronnie', 0.7, ['position match'])] }),
    row({ candidates: [cand(1, 'Belliard, Ronnie', 0.91, ['service-time plausible']), cand(2, 'Other, Guy', 0.4)] }),
    row({ candidates: [cand(2, 'Other, Guy', 0.4)] }),
  ])
  assert.deepEqual(
    merged.map((c) => [c.id, c.score, c.inRows, c.ofRows]),
    [
      [1, 0.91, 2, 3],
      [2, 0.4, 2, 3],
    ],
  )
  // Reasons union rather than overwrite — each row saw its own evidence.
  assert.deepEqual(merged[0].reasons, ['position match', 'service-time plausible'])
})

test('cold mode: the only bulk on offer is "no match exists"', () => {
  const group = buildGroups([
    row({ rowKey: 'z#1', matchedVia: 'empty-pool', candidates: [] }),
    row({ rowKey: 'z#2', matchedVia: 'empty-pool', candidates: [], season: 1992 }),
  ])[0]
  assert.equal(group.mode, MODE_COLD)
  assert.deepEqual(group.bulk, { offered: true, action: 'dismiss', conflictIds: [], candidates: [] })
})

test('a group whose rows disagree about having a shortlist still shows one', () => {
  const group = buildGroups([
    row({ rowKey: 'm#1', matchedVia: 'empty-pool', candidates: [] }),
    row({ rowKey: 'm#2', candidates: [cand(9, 'Someone, Else', 0.8)] }),
  ])[0]
  assert.equal(group.mode, MODE_CHOOSE)
  assert.equal(group.bulk.candidates.length, 1)
})

test('bulkPlan reads the same on a hand-built group as inside buildGroups', () => {
  const group = { mode: MODE_CONFIRM, rows: [row({ mlbId: 5 }), row({ mlbId: 5 })] }
  assert.equal(bulkPlan(group).offered, true)
})

test('resolution helpers read the server-truth override map', () => {
  const group = buildGroups([row({ rowKey: 'r#1' }), row({ rowKey: 'r#2' })])[0]
  assert.equal(isGroupResolved(group, {}), false)
  assert.equal(openRows(group, { 'r#1': { mlbId: 1 } }).length, 1)
  assert.equal(isGroupResolved(group, { 'r#1': { mlbId: 1 }, 'r#2': { dismissed: true } }), true)
})

test('tier counts split by mode and subtract what is already reviewed', () => {
  const groups = buildGroups([
    row({ rowKey: 'c#1', confidence: 'fuzzy', mlbId: 1, rawName: 'A, A' }),
    row({ rowKey: 'c#2', confidence: 'fuzzy', mlbId: 1, rawName: 'A, A' }),
    row({ rowKey: 'h#1', rawName: 'B, B', candidates: [cand(4, 'B, Bee', 0.6)] }),
    row({ rowKey: 'k#1', rawName: 'C, C', matchedVia: 'empty-pool' }),
  ])
  const counts = tierCounts(groups, { 'c#1': { mlbId: 1 } })
  assert.deepEqual(counts[MODE_CONFIRM], { groups: 1, rows: 2, open: 1, openGroups: 1 })
  assert.deepEqual(counts[MODE_CHOOSE], { groups: 1, rows: 1, open: 1, openGroups: 1 })
  assert.deepEqual(counts[MODE_COLD], { groups: 1, rows: 1, open: 1, openGroups: 1 })
})

test('each action writes one patch naming every row it touches', () => {
  const rows = [
    row({ rowKey: 'p#1', confidence: 'fuzzy', mlbId: 110351 }),
    row({ rowKey: 'p#2', confidence: 'fuzzy', mlbId: 110351 }),
  ]
  assert.deepEqual(confirmPatch(rows), {
    'p#1': { mlbId: 110351, confidence: 'exact', originalConfidence: 'fuzzy' },
    'p#2': { mlbId: 110351, confidence: 'exact', originalConfidence: 'fuzzy' },
  })
  // A chosen candidate keeps the tier the pipeline had assigned, whatever it was.
  assert.deepEqual(candidatePatch([row({ rowKey: 'q#1', confidence: 'ambiguous' })], 42), {
    'q#1': { mlbId: 42, confidence: 'exact', originalConfidence: 'ambiguous' },
  })
  assert.deepEqual(dismissPatch([row({ rowKey: 'q#1' })]), { 'q#1': { dismissed: true } })
  assert.deepEqual(undoPatch([row({ rowKey: 'q#1' })]), { 'q#1': null })
})

test('confirm skips a row with no id rather than writing mlbId null', () => {
  assert.deepEqual(confirmPatch([row({ rowKey: 'n#1', confidence: 'fuzzy', mlbId: null })]), {})
})

test('nameDiff marks only the word that actually differs', () => {
  const { raw, candidate } = diffNames('Belliard, Ron', 'Belliard, Ronnie')
  assert.deepEqual(
    raw.filter((s) => s.differs).map((s) => s.text),
    ['Ron'],
  )
  assert.deepEqual(
    candidate.filter((s) => s.differs).map((s) => s.text),
    ['Ronnie'],
  )
  // Segments concatenate back to the original string, punctuation included.
  assert.equal(candidate.map((s) => s.text).join(''), 'Belliard, Ronnie')
})

test('nameDiff folds case, accents, and the punctuation two sources spell differently', () => {
  assert.equal(diffNames("O'Neill, Paul", 'ONeill, Paul').raw.some((s) => s.differs), false)
  assert.equal(diffNames('Peña, Tony', 'Pena, Tony').raw.some((s) => s.differs), false)
  assert.equal(diffNames('Jones, A.J.', 'Jones, AJ').raw.some((s) => s.differs), false)
})

test('nameDiff treats a repeated word as a multiset, not a set', () => {
  const { candidate } = diffNames('Griffey, Ken', 'Griffey, Ken Ken')
  assert.deepEqual(
    candidate.filter((s) => s.differs).map((s) => s.text),
    ['Ken'],
  )
})

test('nameDiff marks every word when the two names share nothing', () => {
  const { raw } = diffNames('Batista, Tony', 'Williams, Jerome')
  assert.deepEqual(
    raw.filter((s) => s.differs).map((s) => s.text),
    ['Batista', 'Tony'],
  )
})
