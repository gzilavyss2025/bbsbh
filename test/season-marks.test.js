import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seasonMark, seasonTile, seasonTheme, seasonMasthead, PERIOD_THEME } from '../src/lib/identity/seasonMarks.js'
import { headerThemeFor, headerThemeStyle, headerThemeClass } from '../src/lib/headerTheme.js'
import SEASON_MARKS from '../src/lib/data/season-marks.json' with { type: 'json' }

test('seasonMark: no id or a bad season means "draw the current mark"', () => {
  assert.equal(seasonMark(null, 1956), null)
  assert.equal(seasonMark(119, undefined), null)
  assert.equal(seasonMark(119, 'abc'), null)
})

test('seasonMark: a club or season outside the table is not covered', () => {
  assert.equal(seasonMark(999999, 1956), null)
})

test('seasonMark: a 1956 Dodgers game wears the Brooklyn mark, from a date or a year', () => {
  assert.equal(seasonMark(119, 1956).name, 'Brooklyn Dodgers')
  assert.equal(seasonMark(119, '1956-10-08').url, '/logos/historical/119-1945-1957.png')
})

test('seasonMark: a covered era with no art answers a null url, never today\'s mark', () => {
  const era = seasonMark(119, 1905)
  assert.equal(era.name, 'Brooklyn Dodgers')
  assert.equal(era.url, null)
})

test('seasonMark: the era ends where the franchise\'s present mark begins', () => {
  assert.equal(seasonMark(119, 1957).name, 'Brooklyn Dodgers')
  assert.equal(seasonMark(119, 1958), null)
  assert.equal(seasonMark(119, 2026), null)
})

// #1626: the 1949-57 Giants cap. Commons holds a public-domain file for it, so
// a 1956 Giants game draws that art, not the CC BY-SA PNG and not a fallback.
test('seasonMark: a 1956 Giants game draws the public-domain 1949-57 cap', () => {
  assert.equal(seasonMark(137, '1956-07-04').url, '/logos/historical/137-1949-1957.svg')
})

// #1626: an era with no art draws its own period abbreviation in a serif face,
// never today's mark and never a one-letter monogram. So every era carries the
// abbreviation the feed gives that club in that season.
test('seasonMark: every era carries its period abbreviation', () => {
  assert.equal(seasonMark(119, 1905).abbr, 'BRO')
  assert.equal(seasonMark(133, 1960).abbr, 'KCA')
  assert.equal(seasonMark(144, 1957).abbr, 'MIL')
  for (const [id, eras] of Object.entries(SEASON_MARKS.clubs)) {
    for (const era of eras) {
      assert.match(era.abbr ?? '', /^[A-Z]{2,4}$/, `${id} ${era.from}-${era.to} has no abbr`)
    }
  }
})

// #1626: the White Sox wore a bold "SOX" from 1976; today's Gothic mark came in
// September 1990 (Wikipedia, "Logos and uniforms of the Chicago White Sox").
// A 1979 game must not draw the 1991 mark. No public-domain art is known.
test('seasonMark: a 1979 White Sox game is covered, with no art', () => {
  const era = seasonMark(145, '1979-07-12')
  assert.equal(era.url, null)
  assert.equal(era.abbr, 'CWS')
  assert.equal(seasonMark(145, 1990), null)
})

// #1626: no era carries a cited period colour, so a covered era wears neutral
// chrome. Today's club colours on an old game would state something false.
test('seasonTheme: a season-covered era wears no club theme', () => {
  const today = headerThemeFor(145, 'main')
  assert.ok(today, 'today\'s White Sox bar is themed')
  assert.equal(seasonTheme(145, '2026-04-01', today), today, 'a 2026 game keeps it')
  assert.equal(seasonTheme(145, null, today), today)
  assert.equal(seasonTheme(145, '1979-07-12', today), PERIOD_THEME)
  assert.equal(seasonTheme(119, 1956, headerThemeFor(119, 'main')), PERIOD_THEME)
})

// The opposing club's cards sit inside the page's own themed shell, so the
// neutral theme must RESET the inherited colours, not just leave them unset.
test('headerThemeStyle: the period theme resets the inherited club colours', () => {
  assert.deepEqual(headerThemeStyle(PERIOD_THEME), {
    '--bar-fill': 'initial',
    '--bar-accent': 'initial',
    '--bar-text': 'initial',
    '--mark-filter': 'initial',
  })
  assert.equal(headerThemeClass(PERIOD_THEME), '')
})

test('seasonTile: a season-covered era drops today\'s tint, pinstripe and tuning', () => {
  const today = { logoVariant: 'main-recolor', tint: '#005A9C', pinstripeColor: '#000', pinstripeBg: '#fff', scale: 0.75, offsetX: 3, offsetY: 0 }
  assert.equal(seasonTile(119, 2026, today), today)
  assert.equal(seasonTile(119, null, today), today)
  const old = seasonTile(119, 1956, today)
  assert.equal(old.tint, null)
  assert.equal(old.pinstripeColor, null)
  assert.equal(old.scale, 1)
  assert.equal(old.offsetX, 0)
})

test('seasonMasthead: a season-covered era drops today\'s bar art and scale', () => {
  const today = { url: '/x.svg', scale: 1.2 }
  assert.deepEqual(seasonMasthead(119, 1956, today), { url: null, scale: null })
  assert.equal(seasonMasthead(119, 2026, today), today)
})
