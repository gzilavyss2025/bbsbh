import { test, expect } from '../fixtures.js'

// Two rules that only a rendered page can check, swept across the report
// pages — the ones built out of club marks and headshots, where both failures
// actually happened.
//
// 1. EVERY CONTROL HAS A NAME. `TeamLogo` and `Headshot` are `aria-hidden`
//    with an empty `alt` on purpose: they are decoration beside a name, and
//    announcing the same club twice is worse than announcing it once. That
//    makes a link whose only child is one of them a control with NO
//    accessible name — announced as a bare "button". Both link components
//    take an `ariaLabel` for exactly this, and six callers had simply never
//    passed it (awards, prospects, All-Star rosters, the player hero, and two
//    on the rehab card). Nothing failed; the pages just went quiet for anyone
//    listening to them.
//
// 2. THE PAGE DOES NOT SCROLL SIDEWAYS. This app is phone-first, so a card
//    that hangs past the right edge is a real defect and an easy one to ship
//    blind: `grid-template-columns: 1fr 1fr` is minmax(AUTO, 1fr), which
//    refuses to shrink below its content, and fifteen cards on /awards hung
//    20px out because of it.
//
// Deliberately a browser check rather than a lint guard: a name can be
// supplied by a child's text, an `aria-label`, an `alt`, or a `title`, and
// which one a component ends up with is a question about the DOM it renders,
// not about the source it renders from.

const ROUTES = [
  '/awards',
  '/prospects',
  '/rehab',
  '/all-star-rosters',
  '/milestones',
  '/postseason-leaders',
  '/standings',
  '/umpires',
  '/team/158',
  '/player/677594',
]

// The accessible name, computed the way a screen reader would for the shapes
// this app renders: an explicit label wins, then the control's own text, then
// a non-hidden descendant image's alt, then the title attribute.
function nameOf(el) {
  const label = el.getAttribute('aria-label')
  if (label && label.trim()) return label.trim()
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
    if (text) return text
  }
  if ((el.textContent ?? '').trim()) return el.textContent.trim()
  for (const img of el.querySelectorAll('img')) {
    if (img.closest('[aria-hidden="true"]')) continue
    const alt = (img.getAttribute('alt') ?? '').trim()
    if (alt) return alt
  }
  return (el.getAttribute('title') ?? '').trim()
}

for (const route of ROUTES) {
  test(`${route} names every control and stays inside the viewport`, async ({ page }) => {
    await page.goto(route)
    // These pages all read one static file; give it time to land and render
    // before concluding the DOM is what it will be.
    await page.waitForTimeout(3500)

    const report = await page.evaluate((nameOfSource) => {
      const name = eval(`(${nameOfSource})`)
      const unnamed = []
      for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
        if (el.closest('[aria-hidden="true"]') || el.hidden) continue
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        if (!name(el)) {
          const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).join('.') : ''
          unnamed.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`)
        }
      }
      const de = document.documentElement
      return {
        unnamed: [...new Set(unnamed)],
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
      }
    }, nameOf.toString())

    expect(
      report.unnamed,
      `controls with no accessible name on ${route}: ${report.unnamed.join(', ')}`,
    ).toEqual([])

    expect(
      report.scrollWidth,
      `${route} scrolls sideways: ${report.scrollWidth}px of content in a ${report.clientWidth}px viewport`,
    ).toBeLessThanOrEqual(report.clientWidth + 1)
  })
}
