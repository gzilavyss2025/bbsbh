// Coverage + behavior for src/lib/contracts/positions.js -- the position
// normalizer for the historical contracts CSVs. The coverage test at the
// bottom reads salaries.csv AND executives.csv directly (not a hardcoded
// snapshot of their strings), so it fails the moment a future export adds a
// position string this module hasn't classified.
//
// salaries.csv is never edited by this split -- it stays byte-identical to
// origin/main (rowKey in public/data/contracts-history/*/*.json is a
// POSITIONAL index into this file; deleting a row would silently re-point
// every rowKey after it). executives.csv is a VIEW: the 23 rows it lists are
// also present, unchanged, in salaries.csv.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parseCsv } from '../scripts/lib/csv.mjs'
import { POSITIONS, normalizePosition, resolveRole } from '../src/lib/contracts/positions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'scripts', 'data', 'contracts')
const SEASON_PLAYERS_DIR = join(__dirname, '..', 'public', 'data', 'contracts-history', 'season-players')

function loadCsv(name) {
  return parseCsv(readFileSync(join(DATA_DIR, name), 'utf8'))
}

// executives.csv opens with a `#`-prefixed header comment (its own line,
// above the real CSV header) explaining what the file is and why it exists.
// parseCsv() has no concept of a comment line, so this file's own reader
// drops it before handing the rest to parseCsv -- the shared csv.mjs stays
// untouched for every sibling file that has no such comment. Line endings
// are normalized FIRST (same as parseCsv's own \r\n handling): a bare
// `/^#.*\n/` strip would no-op on a CRLF working tree, since `.` does not
// match `\r`, and the leading comment would fall through to parseCsv as
// though it were the real header row.
function loadExecutivesCsv() {
  const raw = readFileSync(join(DATA_DIR, 'executives.csv'), 'utf8')
  const normalized = raw.replace(/\r\n/g, '\n')
  const withoutComment = normalized.replace(/^#.*\n/, '')
  return parseCsv(withoutComment)
}

function seasonPlayerNames(year) {
  const list = JSON.parse(readFileSync(join(SEASON_PLAYERS_DIR, `${year}.json`), 'utf8'))
  return new Set(list.map((p) => p.lastFirstName))
}

// --------------------------------------------------------- whitespace twins
test('a trailing space is the same position as the trimmed form', () => {
  const bare = normalizePosition('1b')
  const padded = normalizePosition('1b ')
  assert.equal(padded.primary, bare.primary)
  assert.equal(padded.primary, '1B')
  assert.equal(padded.isPlayer, true)
  assert.equal(padded.role, 'player')
  // raw keeps the untouched source string, whitespace and all -- this is
  // where the twin becomes visible again for anyone auditing the source.
  assert.equal(padded.raw, '1b ')
  assert.equal(bare.raw, '1b')
})

// -------------------------------------------------------------- a compound
test('a three-way compound splits into a primary and the rest as secondary', () => {
  const r = normalizePosition('3b-of-c')
  assert.equal(r.primary, '3B')
  assert.deepEqual(r.secondary, ['OF', 'C'])
  assert.equal(r.isPlayer, true)
  assert.equal(r.role, 'player')
})

test('a slash-separated compound splits the same way as a dash', () => {
  const r = normalizePosition('of/1b')
  assert.equal(r.primary, 'OF')
  assert.deepEqual(r.secondary, ['1B'])
})

test('the pitcher role suffix (starter/closer) is a role, not a fielding position', () => {
  // Confirmed against real rows, not guessed: every "rhp-c"/"lhp-c" row
  // sampled was a known closer (Hader, Iglesias, Chapman, Diaz, ...), and
  // every "rhp-s"/"lhp-s" row sampled was a known starter (Wheeler, deGrom,
  // Cole, Skubal, ...).
  assert.deepEqual(normalizePosition('rhp-s'), {
    primary: 'RHP',
    secondary: ['SP'],
    isPlayer: true,
    role: 'player',
    raw: 'rhp-s',
  })
  assert.deepEqual(normalizePosition('lhp-c'), {
    primary: 'LHP',
    secondary: ['RP'],
    isPlayer: true,
    role: 'player',
    raw: 'lhp-c',
  })
})

test('a pitcher tagged with a second fielding position keeps it as secondary', () => {
  // "rhp-of" is a two-way player, not a starter/closer suffix -- 'of' only
  // becomes SP/RP when it is literally 's' or 'c' right after rhp/lhp.
  const r = normalizePosition('rhp-of')
  assert.equal(r.primary, 'RHP')
  assert.deepEqual(r.secondary, ['OF'])
})

test('a parenthetical aside is dropped, not folded into the position', () => {
  const r = normalizePosition('rhp (prev ss)')
  assert.equal(r.primary, 'RHP')
  assert.deepEqual(r.secondary, [])
})

// ------------------------------------------------------------- the leaked id
test('a leaked numeric id: the cell asserts nothing, but role stays player', () => {
  // salaries#4035, Tyler O'Neill, 2023, mls 4.059, salary $4,950,000. The cell
  // cannot be trusted to name a position (isPlayer: false), but it is not a
  // front-office title either -- role stays 'player', which is what keeps
  // this $4.95M Cardinals payroll row out of executives.csv. Confirmed a real
  // outfielder three independent ways: the identity crosswalk (exact match to
  // mlbId 641933), the roster-age cache, and his own service time -- a real
  // number no front-office row in this file ever carries.
  const r = normalizePosition('72000017')
  assert.equal(r.primary, 'unknown')
  assert.equal(r.isPlayer, false)
  assert.equal(r.role, 'player')
  assert.equal(r.raw, '72000017')
})

// --------------------------------------------------- the transaction cell
test('the 275-character transaction narrative lands as unknown role, not player', () => {
  const narrative =
    "re-signed 3/20, 1 yr/$571,000 (20). recalled 9/1/19 opt'd AAA 8/16/19 recalled 8/4/19 " +
    "opt'd AAA 7/25/19 recalled 7/24/19 opt'd AAA 7/8/19 recalled 7/7/19 opt'd AAA 6/7/19 " +
    "(2019 OY1). k selected 5/28/19 trade-LAN 7/31/18. $497,500 sb ($331,100) San Jacinto JC, " +
    "Texas '16 5-161"
  const r = normalizePosition(narrative)
  // The cell just cannot be trusted to name a position OR confirmed against
  // a known title -- primary stays unknown (never truncated into something
  // that looks like a position), and role flags 'unknown' rather than
  // guessing 'player'. isPlayer stays true: Rich Hill's name and salary are
  // intact on this row, a fact known from outside this cell, not from it.
  assert.equal(r.primary, 'unknown')
  assert.equal(r.isPlayer, true)
  assert.equal(r.role, 'unknown')
  assert.equal(r.raw, narrative)
})

// ---------------------------------------- an unrecognized front-office title
test('a title outside the known six does not fall through to role: player', () => {
  // The regression this guards: NON_PLAYER_TITLES is a fixed six-string set.
  // Before this fix, anything that failed to tokenize as a position --
  // including a title nobody added to that set yet -- defaulted to
  // role: 'player' and would have been silently priced as payroll. Now a
  // cell that is neither a recognized position nor a known title lands in
  // role: 'unknown' instead, the same loud-failure shape parseMoney uses for
  // 'unparsed'.
  for (const title of ['pitching coach', 'President, Baseball Ops', 'asst GM']) {
    const r = normalizePosition(title)
    assert.equal(r.primary, 'unknown', title)
    assert.equal(r.role, 'unknown', title)
    // Not lumped in with the six confirmed titles either -- an 'unknown'
    // role is a flag for a human to read, not an automatic exclusion.
    assert.notEqual(r.role, 'front-office', title)
  }
})

// ------------------------------------------------------ front-office titles
test('a blank cell is a real player row with no position recorded', () => {
  const r = normalizePosition('')
  assert.equal(r.primary, 'unknown')
  assert.equal(r.isPlayer, true)
  assert.equal(r.role, 'player')
})

for (const title of ['GM', 'SVP, GM', 'VP, AGM', "spec ass't to GM", 'Manager', 'mgr']) {
  test(`"${title}" is a front-office title, not a player`, () => {
    const r = normalizePosition(title)
    assert.equal(r.primary, 'unknown')
    assert.equal(r.secondary.length, 0)
    assert.equal(r.isPlayer, false)
    // role is the STRING-only signal: "this cell reads as a job title."
    // Whether the row actually belongs in executives.csv is a further
    // question resolveRole() answers by also checking whether the named
    // person played that season -- see the Ventura/La Russa tests below.
    assert.equal(r.role, 'front-office')
  })
}

// case-fold: an oddly-cased title still resolves the same way
test('a front-office title case-folds', () => {
  assert.equal(normalizePosition('MGR').isPlayer, false)
  assert.equal(normalizePosition('gm').isPlayer, false)
})

// ------------------------------------------------------------- null/undefined
test('null and undefined behave like a blank cell', () => {
  assert.equal(normalizePosition(null).primary, 'unknown')
  assert.equal(normalizePosition(undefined).primary, 'unknown')
  assert.equal(normalizePosition(null).isPlayer, true)
  assert.equal(normalizePosition(null).role, 'player')
})

// ---------------------------------------------------- TOKEN_MAP is prototype-safe
test('a cell reading a plain-object property name does not resolve to that method', () => {
  // TOKEN_MAP used to be a {} object literal, so TOKEN_MAP['constructor']
  // returned Object.prototype.constructor (a function) instead of undefined,
  // and 'constructor' would have resolved as a real `primary`.
  const r = normalizePosition('constructor')
  assert.equal(typeof r.primary, 'string')
  assert.equal(r.primary, 'unknown')
  assert.equal(r.role, 'unknown')
})

// --------------------------------------------------------------- live-data
// The whole point of 'unknown': every distinct string in the real export
// must resolve into POSITIONS or 'unknown' -- never crash, never a value
// outside the closed set. A future CSV refresh that adds a new form fails
// HERE, with the exact strings that need a look, instead of silently
// reading as a made-up position somewhere downstream.
test("executives.csv's header comment explains what the file is", () => {
  const text = readFileSync(join(DATA_DIR, 'executives.csv'), 'utf8')
  const firstLine = text.split('\n', 1)[0]
  assert.ok(firstLine.startsWith('#'), 'executives.csv should open with a # comment line')
  assert.match(firstLine, /front-office/i)
  assert.match(firstLine, /view/i) // it is a view over salaries.csv, not a removal from it
})

test('every position cell in the real CSVs resolves inside the closed set', () => {
  const outOfSet = []
  let cellCount = 0
  const files = [
    ['salaries.csv', loadCsv('salaries.csv')],
    ['executives.csv', loadExecutivesCsv()],
  ]
  for (const [file, rows] of files) {
    for (const row of rows) {
      cellCount++
      const r = normalizePosition(row.position)
      const codes = [r.primary, ...r.secondary]
      for (const code of codes) {
        if (code !== 'unknown' && !POSITIONS.includes(code)) {
          outOfSet.push(`${file}: "${row.position}" -> ${code}`)
        }
      }
    }
  }
  assert.ok(cellCount > 20000, `expected tens of thousands of position cells, saw ${cellCount}`)
  assert.deepEqual(outOfSet, [], `position(s) outside the closed set: ${outOfSet.join(', ')}`)
})

// --------------------------------- executives.csv reconciles with salaries.csv
// W0.6's finding: nothing asserted that executives.csv's rows are actually a
// SUBSET of salaries.csv, and nothing asserted every listed row is a genuine
// title. Both are load-bearing now that executives.csv is a view rather than
// a removal -- a stray or stale row here would silently misclassify a real
// salaries.csv row.
test('every row in executives.csv is present in salaries.csv, and is a front-office title', () => {
  const players = loadCsv('salaries.csv')
  const exec = loadExecutivesCsv()
  assert.ok(exec.length > 0, 'executives.csv should not be empty')
  for (const row of exec) {
    assert.equal(normalizePosition(row.position).role, 'front-office', `not a title: ${JSON.stringify(row)}`)
    const present = players.some(
      (p) =>
        p.year === row.year && p.player === row.player && p.position === row.position && p.salary === row.salary,
    )
    assert.ok(present, `executives.csv row missing from salaries.csv: ${JSON.stringify(row)}`)
  }
})

// ----------------------------------------- role is NOT decided by isPlayer
// The regression this guards: an earlier version of this split moved every
// isPlayer:false row OUT of salaries.csv. That is wrong whenever a person's
// LATER front-office title was recorded on an EARLIER season he was still
// playing -- his position cell reads "mgr", isPlayer is false, but he is a
// player that season. The two cases below sit on either side of the real
// line: same "mgr" string, same 2001 salaries.csv, opposite outcome, decided
// by whether the man appears in that season's player pool
// (public/data/contracts-history/season-players/2001.json) via resolveRole()
// -- never by isPlayer and never by mls (mls is blank on every 2000-2009
// salaries.csv row, players and executives alike, so it cannot discriminate
// either). Rows are never deleted from salaries.csv either way.
test('Robin Ventura, 2001: still playing, resolves to role player, and is not listed in executives.csv', () => {
  const rows = loadCsv('salaries.csv')
  const row = rows.find((r) => r.year === '2001' && r.player === 'Ventura, Robin')
  assert.ok(row, 'Ventura, Robin 2001 must be present in salaries.csv')
  assert.equal(row.salary, '8500000')
  // the cell itself still reads as a front-office title...
  assert.equal(normalizePosition(row.position).role, 'front-office')
  // ...but resolveRole, given 2001's season-players pool, corrects it: he was
  // actively playing third base for the Mets that season (id 123697) -- his
  // LATER Chicago White Sox managerial title landed on this row instead of
  // his 2001 position.
  assert.equal(resolveRole(row, seasonPlayerNames(2001)), 'player')
  const exec = loadExecutivesCsv()
  assert.equal(
    exec.some((er) => er.year === '2001' && er.player === 'Ventura, Robin'),
    false,
    'Ventura, Robin 2001 should not be listed in executives.csv',
  )
})

test('Tony La Russa, 2001: not playing, resolves to role front-office, listed AND still in salaries.csv', () => {
  // Retired as a player in 1977, managing the Cardinals in 2001 -- does not
  // appear in the 2001 season-players pool at all.
  const players = loadCsv('salaries.csv')
  const playerRow = players.find((r) => r.year === '2001' && r.player === 'La Russa, Tony')
  assert.ok(playerRow, 'La Russa, Tony 2001 must still be present in salaries.csv -- rows are never deleted')
  assert.equal(playerRow.salary, '1900000')
  assert.equal(resolveRole(playerRow, seasonPlayerNames(2001)), 'front-office')

  const exec = loadExecutivesCsv()
  const execRow = exec.find((r) => r.year === '2001' && r.player === 'La Russa, Tony')
  assert.ok(execRow, 'La Russa, Tony 2001 should be listed in executives.csv')
  assert.equal(execRow.salary, '1900000')
})

test('resolveRole with no season-players set falls back to the cell-only role', () => {
  const row = { position: 'mgr', player: 'Anybody, Somebody' }
  assert.equal(resolveRole(row), 'front-office')
  assert.equal(resolveRole(row, new Set()), 'front-office')
  assert.equal(resolveRole({ position: '3b', player: 'Anybody, Somebody' }), 'player')
})
