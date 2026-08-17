import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PAGE_GROUPS,
  REPORT_PAGES,
  GUIDES_GROUP,
  TOOLS_GROUP,
  MENU_GROUPS,
  isGuidePath,
} from '../src/lib/reportPages.js'

// reportPages.js grew groups; REPORT_PAGES is derived from them now. The
// interesting risk is not that a group renders wrong — it's that regrouping
// silently DROPS a page, or lists one twice under two headings, on a list
// every footer and the menu and /more all read. So this pins the set, and
// deliberately does not pin the order: reordering is exactly what grouping was
// allowed to do.

// The report pages as they stood before PAGE_GROUPS existed, plus
// /team-records, which landed on main (#742) while the regrouping was in
// flight. Typed out rather than derived, so this test fails if the flattening
// loses one — deriving the expectation from the thing under test would assert
// nothing.
const PATHS_BEFORE_GROUPING = [
  '/standings',
  '/leaders',
  '/team-records',
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

// The two menu-only groups must stay OUT of the flat array: ReportFooter
// appends its own About link, and a report page's footer listing "About" and
// "Logo Sheet" is what REPORT_PAGES existing separately is meant to prevent.
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
