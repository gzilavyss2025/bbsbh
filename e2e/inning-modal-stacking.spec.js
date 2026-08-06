import { test, expect } from './fixtures.js'

// Regression guard for the dialogs opened from INSIDE a half-inning page.
//
// The bug: `.turnscene` (the page-turn scene) sets `isolation: isolate` so an
// in-flight turn can never paint over the floating bar — which also traps a
// `.scrim` dialog's z-index: 100 inside that box. The highlight sheet then
// rendered UNDER the fixed chrome: the Refresh pill sat in the middle of the
// video, the reveal bar covered the caption, and the bottom of the clip (its
// own scrubber included) swallowed taps meant for the player. Fixed by
// portalling these dialogs to <body> (src/components/ModalPortal.jsx).
//
// Hit-testing is the assertion that actually catches it — `toBeVisible()`
// passes happily on a fully-covered element, and a z-index comparison alone
// wouldn't notice a new stacking context appearing above the scrim.
//
// Anchor game per docs/test-games.md: 2026-07-07 MIL@STL g2 (gamePk 823035).
// Its top of the 1st carries two MLB.com highlight clips.
const GAME = '/07072026/milstl-2'

// The "Rest of half" button sits in the floating bar's bottom-right corner,
// which the scorebug dock parks over — and keeps, always-visible — on any
// viewport >= 740px (z-index 21, above `.pagenav`'s 20, by design; see the
// dock comment in `e2e/reveal-hit-area.spec.js`). A plain Playwright
// `.click()` targets the element's centre, which the dock covers there, so
// it retries into a 30s timeout instead of ever landing. Aim at the button's
// inner-left edge instead — same technique that spec's `lastX` uses.
async function clickRestOfHalf(page) {
  const btn = page.getByRole('button', { name: /Reveal the rest of half/ })
  const box = await btn.boundingBox()
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2)
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

test('the highlight sheet sits above the floating bar, not under it', async ({ page }) => {
  await page.goto(`${GAME}/top1`)

  await clickRestOfHalf(page)
  const watch = page.locator('.pbp__hlbtn').first()
  await expect(watch).toBeVisible()
  await watch.click()

  const video = page.locator('.hlsheet__video')
  await expect(video).toBeVisible()

  // The invariant itself: the dialog left `.turnscene`'s isolated stacking
  // context, so its z-index is measured against the fixed chrome's.
  await expect(page.locator('.turnscene .scrim')).toHaveCount(0)
  await expect(page.locator('body > .scrim')).toHaveCount(1)

  const box = await video.boundingBox()

  // Probe the corners and the bottom edge — the bottom is where the fixed
  // chrome used to bite, since both are anchored to the bottom of the
  // viewport.
  for (const [label, x, y] of [
    ['top edge', box.x + box.width / 2, box.y + 4],
    ['middle', box.x + box.width / 2, box.y + box.height / 2],
    ['bottom edge', box.x + box.width / 2, box.y + box.height - 4],
  ]) {
    const path = await hitPathAt(page, x, y)
    expect(path, `${label} of the clip is covered by page chrome: ${path}`).toContain('scrim')
  }

  // The sheet's caption row must not be washed over by the floating bar's
  // fade-to-canvas gradient either.
  const desc = page.locator('.hlsheet__desc')
  if (await desc.count()) {
    const d = await desc.boundingBox()
    const path = await hitPathAt(page, d.x + d.width / 2, d.y + d.height / 2)
    expect(path, `the clip caption is covered by page chrome: ${path}`).toContain('scrim')
  }
})

// .pbp__zonebtn only exists below the app's shared 740px breakpoint — from
// 740px up, the card and its strike-zone pane sit side by side inline instead
// (index.css's min-width:740px block sets `.pbp__zonebtn { display: none }`),
// so there's no modal to open there. Pin a phone-sized viewport rather than
// inheriting the project's, same reasoning as "pitch-color key" below (which
// pins the opposite way, since ITS trigger is hidden below 740px).
test.describe('pitch-zone modal', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('sits above the floating bar too', async ({ page }) => {
    await page.goto(`${GAME}/top1`)

    await clickRestOfHalf(page)
    const zone = page.locator('.pbp__zonebtn').first()
    await expect(zone).toBeVisible()
    await zone.click()

    const modal = page.locator('.szmodal')
    await expect(modal).toBeVisible()
    await expect(page.locator('.turnscene .scrim')).toHaveCount(0)
    await expect(page.locator('body > .scrim')).toHaveCount(1)

    const box = await modal.boundingBox()
    const path = await hitPathAt(page, box.x + box.width / 2, box.y + box.height - 4)
    expect(path, `the pitch-zone modal is covered by page chrome: ${path}`).toContain('scrim')
  })
})

// The third dialog declared inside a half-inning page. Its trigger — the
// "Pitch colors" key at the foot of the card — is hidden below the 740px
// breakpoint (index.css), so this one pins a wide viewport rather than
// inheriting the project's; `.pagenav` stays fixed at every width, so the
// collision it guards against is the same one.
test.describe('pitch-color key', () => {
  test.use({ viewport: { width: 900, height: 800 } })

  test('sits above the floating bar too', async ({ page }) => {
    await page.goto(`${GAME}/top1`)

    await clickRestOfHalf(page)
    await page.getByRole('button', { name: 'Show the pitch-color key' }).first().click()

    await expect(page.locator('.pcmodal')).toBeVisible()
    await expect(page.locator('.turnscene .scrim')).toHaveCount(0)
    await expect(page.locator('body > .scrim')).toHaveCount(1)
  })
})

test('closing a portalled dialog still hands focus back to its trigger', async ({ page }) => {
  await page.goto(`${GAME}/top1`)

  await clickRestOfHalf(page)
  const watch = page.locator('.pbp__hlbtn').first()
  await watch.click()

  // Backdrop tap — the scrim's own click handler, which has to keep working
  // across the portal boundary (React events travel the React tree, not the
  // DOM tree).
  await page.locator('.scrim').click({ position: { x: 10, y: 10 } })
  await expect(page.locator('.hlsheet')).toHaveCount(0)
  await expect(watch).toBeFocused()
})
