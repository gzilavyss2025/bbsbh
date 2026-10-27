import { test, expect } from './fixtures.js'

// Regression guard for the dialogs opened on the Gameday page.
//
// The bug: `.turnscene` (the page-turn scene) sets `isolation: isolate` so an
// in-flight turn can never paint over the bar — which also traps a `.scrim`
// dialog's z-index: 100 inside that box. A sheet then rendered UNDER the fixed
// chrome and the chrome swallowed taps meant for the sheet. Fixed by portalling
// dialogs to <body> (src/components/ui/ModalPortal.jsx).
//
// Gameday mounts the half page hidden as its engine, so the two dialogs this
// file used to open from inside it (the highlight sheet and the pitch-zone
// modal) cannot be reached from the screen any more. The dialog Gameday opens
// is its Menu sheet (GamedayMenu.jsx, on SheetFrame): it holds the folded
// blocks, the Scorecard and Box score doors and Refresh, and it opens over the
// stage, the hero and the bar. The same three checks run on it.
//
// Hit-testing is the assertion that actually catches it — `toBeVisible()`
// passes happily on a fully-covered element, and a z-index comparison alone
// wouldn't notice a new stacking context appearing above the scrim.
//
// Anchor game per docs/test-games.md: 2026-07-07 MIL@STL g2 (gamePk 823035).
const GAME = '/07072026/milstl-2'

async function openMenu(page) {
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.click()
  return menu
}

// Every element the browser would actually deliver a tap to, at a point.
async function hitPathAt(page, x, y) {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py)
      if (!el) return 'nothing'
      const names = []
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        names.push(`${n.tagName.toLowerCase()}${n.className ? `.${String(n.className).trim().split(/\s+/).join('.')}` : ''}`)
      }
      return names.join(' < ')
    },
    [x, y],
  )
}

// The sheet must sit above the page and the bar at its top edge, its middle and
// its bottom edge — the bottom is where the bar would bite, since both are
// anchored to the bottom of the viewport.
async function expectOnTop(page) {
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  // The sheet slides up; measure it where it rests, not mid-rise.
  await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))

  // The invariant itself: the dialog left `.turnscene`'s isolated stacking
  // context, so its z-index is measured against the fixed chrome's.
  await expect(page.locator('.turnscene .scrim')).toHaveCount(0)
  await expect(page.locator('body > .scrim')).toHaveCount(1)

  const box = await sheet.boundingBox()
  for (const [label, x, y] of [
    ['top edge', box.x + box.width / 2, box.y + 4],
    ['middle', box.x + box.width / 2, box.y + box.height / 2],
    ['bottom edge', box.x + box.width / 2, box.y + box.height - 4],
  ]) {
    const path = await hitPathAt(page, x, y)
    expect(path, `${label} of the sheet is covered by page chrome: ${path}`).toContain('scrim')
  }
}

test('the Menu sheet sits above the bar and the stage, not under them', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  await openMenu(page)
  await expectOnTop(page)
})

// A phone folds the most into the Menu (the line score, the trail, the pitches,
// the batting order and the reference tabs), so its sheet is the tallest: pin
// the phone viewport the old pitch-zone modal was pinned to.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the Menu sheet sits above the bar too', async ({ page }) => {
    await page.goto(`${GAME}/top1`)
    await openMenu(page)
    await expectOnTop(page)
    // The folded line score is in the sheet and answers taps there.
    const cell = page.getByRole('dialog').getByRole('button', { name: /^Bottom 1,/ })
    const c = await cell.boundingBox()
    const path = await hitPathAt(page, c.x + c.width / 2, c.y + c.height / 2)
    expect(path, `the folded line score is covered: ${path}`).toContain('scrim')
  })
})

test('closing a portalled dialog still hands focus back to its trigger', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const menu = await openMenu(page)

  // Backdrop tap — the scrim's own click handler, which has to keep working
  // across the portal boundary (React events travel the React tree, not the
  // DOM tree).
  await page.locator('.scrim').click({ position: { x: 10, y: 10 } })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(menu).toBeFocused()
})
