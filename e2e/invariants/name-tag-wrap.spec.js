import { test, expect } from '../fixtures.js'

// Regression guard for issue #766 (real report: "Pete Crow-Armstrong" / "JACKSON
// MERRILL" on Foul Tracker's "Most fouls per game" board). A name+team-tag row
// built as `align-items: center` centers on the ROW's height, not the name's
// first line. A short name never grows the row, so the bug is invisible until a
// long enough name wraps to two lines — at which point the tag floats with a
// stray gap above it instead of riding the name's top line.
//
// Two real instances of this shape were found and fixed (`.standings .team`,
// `.gamehigh-who`, both now immune — see 29-team-transactions.css:887-897 and
// 43-foul-tracker.css). The issue's open half asked for an audit of every other
// screen with a name+tag row; that audit (issue #766, comment 2026-08-20) swept
// ten routes with the DOM probe below and found nothing else broken. This spec
// makes that one-time audit a standing check instead of a claim that ages.
//
// Runs at 360px — narrower than the iPhone 13 viewport this project otherwise
// tests at (`playwright.config.js`) — because that is the width the original
// report needed to force a real name onto two lines. The bug is layout-shaped,
// not spoiler-shaped, but it lives in `e2e/invariants/` anyway: like the specs
// beside it, it is a structural claim about markup/CSS that has to hold on
// every route that uses the pattern, not a one-page feature check.
const VIEWPORT = { width: 360, height: 844 }

// Every screen the original audit named, by its real route (a couple of the
// issue's screen names collapsed onto one route — FoulTrackerPage.jsx renders
// both "Most fouls per game" and Single-Game Highs at `/fouls`, and there is no
// separate "top games" page).
const ROUTES = [
  '/leaders',
  '/postseason-leaders',
  '/awards',
  '/all-star-rosters',
  '/milestones',
  '/standings',
  '/fouls',
  '/salaries',
  '/postseason-race',
]

// Shapes the raw probe flags that the audit screenshotted as deliberate design,
// not the reported bug: `.tlead__teamtag` and `.playercard__shotwrap` are a
// logo/headshot block meant to center against a taller text block (not a bare
// text tag), and `.dirhd__label` sits beside an inline SVG (`.dirglyph`) whose
// multiple client rects the probe reads as "wrapped text" — it never wraps.
const ALLOWLISTED_SIBLING_CLASSES = ['tlead__teamtag', 'playercard__shotwrap', 'dirhd__label']

test.describe('a short sibling never floats off a wrapped name in a centered flex row', () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT)
      await page.goto(route)
      await expect(page.locator('.loader')).toHaveCount(0, { timeout: 15_000 })

      const violations = await page.evaluate((allowlist) => {
        function label(el) {
          const cls = typeof el.className === 'string' ? el.className.trim() : ''
          return el.tagName.toLowerCase() + (cls ? '.' + cls.split(/\s+/).join('.') : '')
        }
        // A Range over an element's contents reports one rect per same-line
        // box too — a flex child's own flex children, or a glyph rendered in
        // a fallback font (e.g. "×") — not just one per wrapped text line.
        // The only trustworthy signal for an actual second line is rects
        // whose `top` genuinely differs; same-line boxes share one `top`.
        function wrapInfo(el) {
          const range = document.createRange()
          range.selectNodeContents(el)
          const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
          if (rects.length === 0) return { wrapped: false, firstLineTop: null }
          const tops = rects.map((r) => r.top)
          const firstLineTop = Math.min(...tops)
          const wrapped = tops.some((t) => t > firstLineTop + 2)
          return { wrapped, firstLineTop }
        }

        const found = []
        for (const row of document.querySelectorAll('body *')) {
          const style = getComputedStyle(row)
          if (!style.display.includes('flex') || style.flexDirection.includes('column')) continue
          if (style.alignItems !== 'center') continue
          // The bug needs the ROW to stay a single flex line — a name's own
          // text overflowing onto a second line inside one flex item. A row
          // with `flex-wrap: wrap` is a different shape entirely (e.g.
          // .souvenir-row): items reflow onto a second FLEX line, and
          // `align-items: center` there centers each item within its own
          // line, not against the row's total height, so it never produces
          // this bug and reads as a false positive if included.
          if (style.flexWrap !== 'nowrap') continue

          const children = Array.from(row.children)
          if (children.length < 2) continue

          const wrapped = children
            // A child that is itself a flex/grid container (e.g. a
            // logo+label pair, or a vertically-stacked out-dot indicator)
            // reports multiple, differently-positioned boxes for reasons
            // that have nothing to do with text wrapping — Range rects are
            // only a meaningful "did this line break" signal for a child
            // whose own layout is normal inline/block text flow.
            .filter((child) => {
              const childDisplay = getComputedStyle(child).display
              return !childDisplay.includes('flex') && !childDisplay.includes('grid')
            })
            .map((child) => ({ child, ...wrapInfo(child) }))
            .filter((c) => c.wrapped)
          if (wrapped.length === 0) continue

          for (const sibling of children) {
            if (wrapped.some(({ child }) => child === sibling)) continue
            const text = (sibling.textContent || '').trim()
            if (!text || text.length > 6) continue
            if (allowlist.some((cls) => sibling.classList.contains(cls))) continue

            const siblingAlignSelf = getComputedStyle(sibling).alignSelf
            if (siblingAlignSelf !== 'auto' && siblingAlignSelf !== 'center') continue

            const siblingTop = sibling.getBoundingClientRect().top
            for (const { child, firstLineTop } of wrapped) {
              if (siblingTop > firstLineTop + 2) {
                found.push({
                  row: label(row),
                  wrappedChild: label(child),
                  sibling: label(sibling),
                  siblingText: text,
                  driftPx: Math.round(siblingTop - firstLineTop),
                })
              }
            }
          }
        }
        return found
      }, ALLOWLISTED_SIBLING_CLASSES)

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
    })
  }
})
