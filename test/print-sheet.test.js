// The printable pre-pitch scorecard (`/{date}/{matchup}/sheet`).
//
// Two things are pinned here, and the second matters more than the first.
//
//   1. THE MODEL — what the sheet prints, including the MiLB degradations
//      (no lineup, no crew, no weather, no probables) that must render as blank
//      write-in lines rather than a crash or a row of em dashes.
//   2. THE SPOILER BOUNDARY — that the whole `screens/sheet/` directory imports
//      nothing reveal-only and nothing from the mixed Scorecard Lab loader, and
//      that the sheet ships an EMPTY at-bat grid. That is the product decision
//      the feature exists to hold ("this app is not a scoring tool"), and prose
//      cannot hold it: `api/loadScorecard.js`'s own header claimed for months
//      to be spoiler-free while importing `revealInning` two lines below it.
//
// (2) overlaps `scripts/check-spoiler-manifest.mjs`, deliberately. That guard
// stops a reveal-only IMPORT; this one also stops the softer failure — reaching
// for `loadScorecard.js`'s spoiler-free half, which the manifest permits and
// which would drag the full-reveal half back into the production bundle.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFeed } from './fixtures/mini-game.js'
import { buildSheetModel, SHEET_INNINGS, SHEET_SLOTS } from '../src/screens/sheet/sheetModel.js'

// The shared mini feed carries a batting order, jerseys and positions but none
// of the STAGING fields this sheet is mostly made of (venue, crew, probables,
// the boxscore info rows). Layer those on rather than forking the fixture.
function stagedFeed(overrides = {}) {
  const feed = buildFeed()
  feed.gameData.venue = { name: 'American Family Field' }
  feed.gameData.datetime.time = '6:40'
  feed.gameData.datetime.ampm = 'PM'
  feed.gameData.weather = { temp: '74', condition: 'Clear', wind: '8 mph, Out To LF' }
  feed.gameData.probablePitchers = {
    away: { id: 300, fullName: 'Walt Whit' },
    home: { id: 200, fullName: 'Hank Starter' },
  }
  feed.liveData.boxscore.officials = [
    { officialType: 'Home Plate', official: { id: 901, fullName: 'Angel Hernandez' } },
    { officialType: 'First Base', official: { id: 902, fullName: 'Dan Iassogna' } },
  ]
  return Object.assign(feed, overrides)
}

const MANAGERS = {
  away: { personId: 5001, lastFirst: 'Murphy, Pat', interim: false },
  home: { personId: 5002, lastFirst: 'Lovullo, Torey', interim: true },
}

// --------------------------------------------------------------------------
// The model
// --------------------------------------------------------------------------

test('buildSheetModel returns null with no feed, rather than an empty sheet', () => {
  assert.equal(buildSheetModel(null), null)
  assert.equal(buildSheetModel(undefined), null)
})

test('the sheet carries the game facts a scorer fills in before first pitch', () => {
  const m = buildSheetModel(stagedFeed(), { managers: MANAGERS })
  assert.equal(m.officialDate, '2026-07-07')
  assert.match(m.date, /2026/) // scorebookDate is locale-formatted; pin the year only
  assert.equal(m.venue, 'American Family Field')
  assert.equal(m.firstPitch, '6:40 PM')
  assert.equal(m.clubs.map((c) => c.side).join(','), 'away,home')
  assert.equal(m.clubs[0].name, 'Away Club')
  assert.equal(m.clubs[0].abbr, 'AWY')
  assert.equal(m.clubs[0].label, 'Visitors')
  assert.equal(m.clubs[1].label, 'Home')
})

test('an interim manager is labelled as one, and an absent manager is a blank line', () => {
  const m = buildSheetModel(stagedFeed(), { managers: MANAGERS })
  assert.equal(m.clubs[0].manager, 'Murphy, Pat')
  assert.equal(m.clubs[1].manager, 'Lovullo, Torey (interim)')
  assert.equal(buildSheetModel(stagedFeed()).clubs[0].manager, '')
})

test('each club bats against the OTHER club’s probable starter', () => {
  const m = buildSheetModel(stagedFeed())
  // The visitors bat against the home starter, and vice versa — the pairing a
  // paper scorecard prints at the head of each pitching line.
  assert.equal(m.clubs[0].facing.name, 'Starter, Hank')
  assert.equal(m.clubs[0].facing.hand, 'R')
  assert.equal(m.clubs[1].facing.name, 'Whit, Walt')
  assert.equal(m.clubs[0].starter.name, 'Whit, Walt')
})

test('the batting order prints nine rows with jersey and STARTING position', () => {
  const m = buildSheetModel(stagedFeed())
  const away = m.clubs[0].lineup
  assert.equal(away.length, SHEET_SLOTS)
  assert.deepEqual(away[0], { order: 1, jersey: '1', position: 'CF', name: 'Ashby, Aaron' })
  assert.deepEqual(away[8], { order: 9, jersey: '9', position: '2B', name: 'Ivey, Ike' })
  // Slot 4's pinch-hitter (battingOrder 401 in the fixture) must NOT appear:
  // the sheet stages the STARTING nine, and selectLineup reads each player's own
  // battingOrder for exactly that reason.
  assert.equal(
    away.some((r) => r.name.startsWith('Judge')),
    false,
  )
})

test('the crew always draws four lines, filled where the feed has them', () => {
  const m = buildSheetModel(stagedFeed())
  assert.deepEqual(
    m.crew.map((u) => u.role),
    ['HP', '1B', '2B', '3B'],
  )
  assert.equal(m.crew[0].name, 'Angel Hernandez')
  // Unposted bases are blank lines to write on, not missing rows — a MiLB game
  // worked by two umpires still needs somewhere to write the other two names.
  assert.equal(m.crew[2].name, '')
  assert.equal(m.crew[3].name, '')
})

test('a six-man crew appends Left and Right Field after the standard four', () => {
  const feed = stagedFeed()
  feed.liveData.boxscore.officials.push(
    { officialType: 'Left Field', official: { id: 903, fullName: 'Lance Barksdale' } },
    { officialType: 'Right Field', official: { id: 904, fullName: 'Mark Carlson' } },
  )
  const m = buildSheetModel(feed)
  assert.deepEqual(
    m.crew.map((u) => u.role),
    ['HP', '1B', '2B', '3B', 'LF', 'RF'],
  )
  assert.equal(m.crew[4].name, 'Lance Barksdale')
})

test('first pitch falls back to the scheduled start until the real time posts', () => {
  const scheduled = buildSheetModel(stagedFeed())
  assert.equal(scheduled.firstPitch, '6:40 PM')

  const started = stagedFeed()
  started.liveData.boxscore.info = [{ label: 'First pitch', value: '6:47 PM.' }]
  assert.equal(buildSheetModel(started).firstPitch, '6:47 PM')
})

test('weather prefers the outdoor reading and falls back to the box score’s', () => {
  const feed = stagedFeed()
  assert.equal(
    buildSheetModel(feed, { weather: { text: '74°F, wind 8 mph out to left' } }).weather,
    '74°F, wind 8 mph out to left',
  )
  // No outdoor reading (a MiLB park with no lat/lon on file) falls back to the
  // feed's own — which is the closed-roof INTERIOR, hence second choice.
  assert.equal(buildSheetModel(feed).weather, '74°, Clear · 8 mph, Out To LF')
  assert.equal(buildSheetModel(feed, { weather: { text: '' } }).weather, '74°, Clear · 8 mph, Out To LF')
})

// --------------------------------------------------------------------------
// MiLB: everything degrades to a blank line, nothing crashes
// --------------------------------------------------------------------------

test('a sparse MiLB feed still builds a full, blank sheet', () => {
  const thin = {
    gameData: {
      datetime: { officialDate: '2026-07-07' },
      teams: { away: { id: 5015, name: 'Biloxi Shuckers' }, home: { id: 556, name: 'Pensacola' } },
    },
    liveData: { boxscore: { teams: { away: {}, home: {} } } },
  }
  const m = buildSheetModel(thin)
  assert.equal(m.venue, '')
  assert.equal(m.firstPitch, '')
  assert.equal(m.weather, '')
  assert.equal(m.crew.length, 4)
  assert.deepEqual(new Set(m.crew.map((u) => u.name)), new Set(['']))
  for (const club of m.clubs) {
    assert.equal(club.manager, '')
    assert.equal(club.starter, null)
    assert.equal(club.facing, null)
    assert.equal(club.lineup.length, SHEET_SLOTS)
    // Every slot is a write-in line: numbered, and otherwise empty.
    assert.deepEqual(club.lineup[0], { order: 1, jersey: '', position: '', name: '' })
    assert.deepEqual(club.lineup[8], { order: 9, jersey: '', position: '', name: '' })
  }
})

test('the emptiest feeds a level ever serves never throw', () => {
  for (const feed of [{}, { gameData: {} }, { liveData: {} }, { liveData: { boxscore: {} } }]) {
    assert.doesNotThrow(() => buildSheetModel(feed, { managers: null, weather: null }))
  }
})

// --------------------------------------------------------------------------
// The spoiler boundary — see this file's header
// --------------------------------------------------------------------------

// fileURLToPath, not URL.pathname — the latter yields '/C:/…' on Windows and
// every readFileSync below then resolves against the wrong root.
const SHEET_DIR = fileURLToPath(new URL('../src/screens/sheet/', import.meta.url))
const SHEET_FILES = readdirSync(SHEET_DIR).filter((f) => /\.jsx?$/.test(f))

// A module this sheet may never reach for, and why in one line.
const FORBIDDEN = [
  ['linescore.js', 'reveal-only: per-inning runs and the R/H/E line'],
  ['derive.js', 'reveal-only: per-inning pitch/whiff derivations'],
  ['pitchers.js', 'reveal-gated: a pitcher’s IP/ER line'],
  ['boxscore.js', 'the finished box score'],
  [
    'loadScorecard.js',
    'mixed — its spoiler-free half sits two lines above an import of revealInning, ' +
      'and importing any of it drags the DEV-only full-reveal grid into the production bundle',
  ],
]

test('nothing under screens/sheet/ imports a reveal-only or mixed data module', () => {
  assert.ok(SHEET_FILES.length >= 3, 'expected the sheet screen, its model and its sheet component')
  for (const file of SHEET_FILES) {
    const src = readFileSync(join(SHEET_DIR, file), 'utf8')
    // Import statements only — the file headers name these modules on purpose,
    // to say why they are off limits, and must not trip their own guard.
    const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1])
    for (const [mod, why] of FORBIDDEN) {
      assert.equal(
        imports.some((spec) => spec.endsWith(`/${mod}`)),
        false,
        `src/screens/sheet/${file} imports ${mod} — ${why}`,
      )
    }
  }
})

test('the sheet’s only data-layer import is the spoiler-free selector module', () => {
  const src = readFileSync(join(SHEET_DIR, 'sheetModel.js'), 'utf8')
  const apiImports = [...src.matchAll(/^\s*import\s[^;]*?from\s+'([^']*\/api\/[^']+)'/gm)].map(
    (m) => m[1],
  )
  assert.deepEqual(apiImports, ['../../api/select.js'])
})

test('the printed at-bat grid is empty — the sheet component fills no cell', () => {
  const src = readFileSync(join(SHEET_DIR, 'ScoreSheet.jsx'), 'utf8')
  // Every at-bat box is `<td className="ps-cell">` holding only the drawn
  // diamond. If a future edit ever puts a value in one, this is the assertion
  // that has to be deliberately deleted — which is the point.
  const cells = [...src.matchAll(/<td [^>]*className="ps-cell">([\s\S]*?)<\/td>/g)]
  assert.equal(cells.length, 1, 'expected exactly one at-bat cell template')
  const body = cells[0][1].replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim()
  assert.equal(body, '<span className="ps-cell__diamond" aria-hidden="true" />')
  assert.equal(SHEET_INNINGS, 11)
})
