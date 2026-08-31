// The key that names one row of the four historical contract CSVs
// (scripts/data/contracts/*.csv).
//
// A row's key is derived from the row's OWN CONTENT. It is not the row's
// address in the file. That distinction is the whole point of this module, and
// it replaced a positional `${sourceFile}#${index}` key that read as an
// identity and behaved as an address: delete one row and every later row in
// that file silently inherited the previous occupant's resolved mlbId, its
// dollar terms, its place in a player's shard, and any correction a human had
// already confirmed against it. Nothing threw. Nothing warned.
//
//   salaries#3f0c7a1e58d4b269
//
// The hash covers three things, joined by a unit separator so no cell value can
// forge the boundary between two of them:
//
//   1. THE SOURCE FILE. The same man appears in all four files, and his salary
//      row and his extension row are different facts about different deals.
//      Scoping the hash per file keeps his four rows four keys.
//   2. THE ROW'S KEY CELLS -- see KEY_COLUMNS below.
//   3. AN OCCURRENCE ORDINAL, counting how many rows with an identical
//      key-cell tuple came earlier in the same file. See "Why an ordinal".
//
// WHY A SUBSET OF COLUMNS, NOT ALL OF THEM. A key over every cell would be
// maximally distinguishing and maximally brittle: a correction to any cell at
// all -- a mistyped salary, an agent name the export left blank -- would change
// the row's key and orphan the ADR-0067 override a human saved against it. The
// key columns are the ones that answer WHO and WHICH DEAL. A repair to a cell
// outside that set leaves the row's identity alone, which is what a reviewer's
// saved correction needs.
//
// `mls` is deliberately absent from the salaries key. It is blank on all 7,970
// rows from 2000 to 2009, and docs/contracts-data-caveats.md records a pair of
// 2016 rows -- two different men both named Matt Duffy -- whose service-time
// cell is a copied value. Including it separates exactly one further row, which
// the occurrence ordinal already separates, and it would make every
// service-time repair an override-orphaning event.
import { createHash } from 'node:crypto'

export const KEY_COLUMNS = {
  extensions: ['player', 'club', 'signed_date', 'first_year'],
  arbitration: ['season', 'player', 'club'],
  free_agency: ['year', 'player', 'old_club', 'new_club'],
  salaries: ['year', 'player', 'position', 'salary'],
}

export const CONTRACT_SOURCES = Object.keys(KEY_COLUMNS)

// WHY AN ORDINAL. Two rows of a source file can be genuinely identical.
// salaries.csv holds 27 such pairs -- one worksheet row duplicated by the
// original export, repeated in every consecutive season the player appears
// (docs/contracts-data-caveats.md, anomaly 1). Content alone cannot tell those
// two rows apart, because there is no difference to find. The ordinal is the
// smallest thing that can: it says "the second identical row". It changes only
// when a row identical to this one is added before it or removed. Every other
// edit anywhere in the file leaves it alone.
//
// The 88 duplicate (year, player) pairs split three ways under these columns,
// exactly as that document classifies them. The 35 pairs that are two different
// men sharing a name differ in position or salary, so content alone gives them
// two keys; so do the 26 obligation rows, which carry no position. The 27
// verbatim repeats fall to the ordinal.

// ASCII unit separator: a byte no cell of these exports contains, so a value
// ending in a comma or a hash can never forge a field boundary inside the hash.
const UNIT = String.fromCharCode(31)

// Sixteen hex characters. The collision odds over a 36,366-row corpus are
// vanishingly small, but the guarantee this module offers is not a probability:
// test/contract-row-key.test.js asserts distinctness over the real CSVs, so a
// collision is a failing test and never a silently merged pair of rows.
const ROW_KEY_HASH_LENGTH = 16

// A legacy positional key is `${sourceFile}#${index}`, at most five digits
// today. A content key is sixteen hex characters. The two shapes can never be
// read as one another, which is what lets api/contract-identity.js accept both
// while an un-migrated override still sits in Redis.
export const CONTENT_ROW_KEY_RE = /^([a-z_]+)#([0-9a-f]{16})$/
export const LEGACY_ROW_KEY_RE = /^([a-z_]+)#(\d{1,7})$/

function keyCells(sourceFile, row) {
  const columns = KEY_COLUMNS[sourceFile]
  if (!columns) throw new Error(`Unknown contract source "${sourceFile}"`)
  return columns.map((column) => String(row[column] ?? '').trim()).join(UNIT)
}

// Keys for a WHOLE source file at once, in file order. The ordinal is only
// knowable in file order, so there is deliberately no single-row entry point --
// one would let a caller mint a key without the ordinal and get a duplicate.
export function contractRowKeys(sourceFile, rows) {
  const seen = new Map()
  return rows.map((row) => {
    const cells = keyCells(sourceFile, row)
    const occurrence = seen.get(cells) ?? 0
    seen.set(cells, occurrence + 1)
    const digest = createHash('sha256')
      .update(`${sourceFile}${UNIT}${cells}${UNIT}${occurrence}`, 'utf8')
      .digest('hex')
    return `${sourceFile}#${digest.slice(0, ROW_KEY_HASH_LENGTH)}`
  })
}

// WHICH ROW COMES FIRST when a player holds two rows of the same source in the
// same season -- 110 such groups across the dataset, 220 rows.
//
// The old key carried this ordering for free, because a numeric index IS an
// order. A content hash carries none, so the order has to come from the row's
// own content or it does not exist. Worse than not existing: `Number()` of a
// hash is NaN, the language coerces a NaN comparator result to "equal", and the
// sort would quietly fall back to whatever order the join happened to yield --
// no error, no failing test.
//
// Bigger sorts first, on the column that states the deal's own prominence: the
// newer signing, the larger figure. A blank or non-numeric cell sorts last
// rather than counting as zero. "Not stated" is not "nothing", which is the
// same rule gen-contracts-shards.mjs applies to a terms cell.
const SORT_COLUMN = {
  extensions: 'signed_date',
  arbitration: 'settled_salary',
  free_agency: 'guarantee',
  salaries: 'salary',
}

export function rowSortValue(sourceFile, row) {
  const raw = String(row?.[SORT_COLUMN[sourceFile]] ?? '').trim()
  if (!raw) return -Infinity
  if (sourceFile === 'extensions') {
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? ms : -Infinity
  }
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : -Infinity
}
