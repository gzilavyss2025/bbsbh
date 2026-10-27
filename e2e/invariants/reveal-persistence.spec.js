import { test, expect } from '../fixtures.js'
import { halfCell, revealHalf } from '../lib/gameday.js'

// The `revealedThrough` high-water mark (InningViewer.jsx): persists per
// gamePk to localStorage so returning to a game re-reveals only up to where
// the user left off — never further. Also covers Gameday's line score and
// its checkpoint tally, which aren't behind the half's SealBox but are gated
// by this same mark; folded in here since the setup (reveal top of the 1st)
// is shared. (The old page's Pitchers table and RollingLine left with it;
// their gate is the same mark these read.) Viewport-independent — mobile only.
const GAME = '/07072026/milstl-2'

// The line score's cell for a half, by its spoken name. On a phone the line
// score folds into the Menu: halfCell opens it, and Escape closes it again.
async function cellName(page, half) {
  const cell = await halfCell(page, half)
  const name = await cell.getAttribute('aria-label')
  if (await page.getByRole('dialog').count()) {
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  }
  return name
}

test('reveal mark advances forward, gates the line score and the checkpoint, and survives reload without over-revealing', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Nothing revealed yet: the checkpoint (`.gdcp`, gated on the same mark) is
  // not in the DOM at all.
  await expect(page.locator('.gdcp')).toHaveCount(0)
  expect(await cellName(page, 'Bottom 1')).toBe('Bottom 1, sealed')

  await revealHalf(page)

  // Top of the 1st is in; bottom of the 1st must still read as sealed in the
  // line score — revealing one half must not leak its sibling.
  expect(await cellName(page, 'Top 1')).toMatch(/^Top 1, \d+ runs?$/)
  expect(await cellName(page, 'Bottom 1')).toBe('Bottom 1, sealed')

  // The checkpoint, with the half's tally, now shows the one revealed half.
  await expect(page.locator('.gdcp')).toHaveCount(1)
  expect(await page.evaluate(() => localStorage.getItem('bbsbh:reveal:823035'))).toBe('0')

  // Reload: top of the 1st should come back pre-revealed from localStorage —
  // no re-tap needed (it reopens on its first at-bat, so its seals render
  // revealed and the line score keeps its runs)...
  await page.reload()
  await page.locator('.gdnext__advance').waitFor()
  expect(await page.locator('.statgrid').count()).toBeGreaterThan(0)
  expect(await cellName(page, 'Top 1')).toMatch(/^Top 1, \d+ runs?$/)

  // ...but the persisted mark must not have crept past what was actually
  // revealed: bottom of the 1st is still sealed after the reload.
  await page.goto(`${GAME}/bottom1`)
  await expect(page.locator('.gdnext__advance')).toHaveText(/Next play/)
  await expect(page.locator('.gdcp')).toHaveCount(0)
  expect(await cellName(page, 'Bottom 1')).toBe('Bottom 1, sealed')
})
