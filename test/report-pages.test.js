import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PAGE_GROUPS,
  REPORT_PAGES,
  GUIDES_GROUP,
  TOOLS_GROUP,
  MENU_GROUPS,
  FOOTER_TRAIL,
  isGuidePath,
} from '../src/lib/reportPages.js'

// reportPages.js grew groups; REPORT_PAGES is derived from them now. The
// interesting risk is not that a group renders wrong — it's that regrouping
// silently DROPS a page, or lists one twice under two headings, on a list
// every footer and the menu and /more all read. So this pins the set, and
// deliberately does not pin the order: reordering is exactly what grouping was
// allowed to do.

// The report pages as they stood before PAGE_GROUPS existed, plus
// /situational-records, which landed on main (#742) while the regrouping was in
// flight, the five broadcast reports that came with src/screens/around-the-game/,
// and /salaries, the league money board that came with the Contracts tab.
// Typed out rather than derived, so this test fails if the flattening loses
// one — deriving the expectation from the thing under test would assert
// nothing.
const PATHS_BEFORE_GROUPING = [
  '/attendance',
  '/farm-system-rankings',
  '/bullpen-availability',
  '/pace-of-play',
  '/doubleheaders',
  '/standings',
  '/leaders',
  '/situational-records',
  '/salaries',
  '/fouls',
  '/prospects',
  '/rehab',
  '/milestones',
  '/umpires',
  '/awards',
  '/postseason-history',
  '/postseason-leaders',
  '/trade-deadline',
  '/all-star-rosters',
  '/all-star-legacy',
  '/profile',
  '/logbook',
  '/first-scorebook',
  '/photos',
]

test('grouping kept every report page — nothing lost, nothing invented', () => {
  const now = REPORT_PAGES.map((p) => p.path).sort()
  assert.deepEqual(now, [...PATHS_BEFORE_GROUPING].sort())
})

test('no page is listed under two groups', () => {
  const paths = MENU_GROUPS.flatMap((g) => g.pages).map((p) => p.path)
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i)
  assert.deepEqual(dupes, [], `a page appears in more than one group: ${dupes.join(', ')}`)
})

test('every page has a non-empty label and a rooted path', () => {
  for (const group of MENU_GROUPS) {
    for (const page of group.pages) {
      assert.ok(page.label && page.label.trim(), `${page.path} has no label`)
      assert.ok(page.path.startsWith('/'), `${page.label} path is not rooted: ${page.path}`)
    }
  }
})

test('every group has a stable id and a label, and holds at least one page', () => {
  const ids = MENU_GROUPS.map((g) => g.id)
  assert.deepEqual(ids, [...new Set(ids)], 'group ids must be unique — they key React lists')
  for (const group of MENU_GROUPS) {
    assert.ok(group.label && group.label.trim(), `group ${group.id} has no label`)
    assert.ok(group.pages.length > 0, `group ${group.id} is empty`)
  }
})

// The two menu-only groups must stay OUT of the flat array. The footers render
// PAGE_GROUPS as columns and finish with FOOTER_TRAIL, so a page that leaked
// into the report groups would be listed twice on every page of the site.
test('guides and tools are menu-only — never report pages', () => {
  const reportPaths = new Set(REPORT_PAGES.map((p) => p.path))
  for (const page of [...GUIDES_GROUP.pages, ...TOOLS_GROUP.pages]) {
    assert.equal(
      reportPaths.has(page.path),
      false,
      `${page.path} leaked into REPORT_PAGES; every report page's footer would list it`
    )
  }
})

test('MENU_GROUPS is the report groups plus guides and tools, in that order', () => {
  assert.deepEqual(
    MENU_GROUPS.map((g) => g.id),
    [...PAGE_GROUPS.map((g) => g.id), 'guides', 'tools']
  )
})

// Both footers end on FOOTER_TRAIL. It is derived from the two menu-only
// groups by lookup rather than by index alone, so it fails here — not silently
// on every page of the site — if either group is reordered or renamed. The
// About literal it replaced was hand-written in two component files.
test('FOOTER_TRAIL is the guides hub and About, in that order, both resolved', () => {
  assert.equal(FOOTER_TRAIL.length, 2)
  for (const page of FOOTER_TRAIL) {
    assert.ok(page, 'a footer trail entry did not resolve — check the group it is read from')
    assert.ok(page.label && page.label.trim(), `${page.path} has no label`)
  }
  assert.equal(FOOTER_TRAIL[0].path, '/learn')
  assert.equal(FOOTER_TRAIL[1].path, '/about')
  assert.deepEqual(
    FOOTER_TRAIL.map((page) => page.group?.id),
    ['guides', 'tools'],
    'footer trail entries need their directory glyph groups',
  )
})

// The footers list PAGE_GROUPS, so anything in FOOTER_TRAIL must NOT also be a
// report page — otherwise the trail repeats a link the columns above it hold.
test('nothing in FOOTER_TRAIL is also a report page', () => {
  const reportPaths = new Set(REPORT_PAGES.map((p) => p.path))
  for (const page of FOOTER_TRAIL) {
    assert.equal(reportPaths.has(page.path), false, `${page.path} is listed twice in the footer`)
  }
})

// Guides are server-rendered documents outside the React app (ADR-0048).
// Rendering one through the client router would paint the SPA over a document
// the server already sent, so callers key off this rather than off a hardcoded
// prefix check scattered per component.
test('isGuidePath identifies /learn URLs and nothing else', () => {
  for (const page of GUIDES_GROUP.pages) {
    assert.equal(isGuidePath(page.path), true, `${page.path} should be a guide path`)
  }
  for (const page of REPORT_PAGES) {
    assert.equal(isGuidePath(page.path), false, `${page.path} should not be a guide path`)
  }
})
