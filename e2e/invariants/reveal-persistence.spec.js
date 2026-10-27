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

// How many line-score cells read sealed and how many show runs: exact counts, so a half that
// leaked (or a mark that crept) changes them.
async function cellCounts(page) {
  await halfCell(page, 'Top 1')
  const names = await page.locator('.gdp__run').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  if (await page.getByRole('dialog').count()) {
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  }
  return { sealed: names.filter((n) => /, sealed$/.test(n)).length, runs: names.filter((n) => /, \d+ runs?$/.test(n)).length }
}

test('reveal mark advances forward, gates the line score and the checkpoint, and survives reload without over-revealing', async ({
  page,
}) => {
  // Revealing the top of the 1st is a tap per plate appearance. With motion on, every play the
  // stage starts makes the next tap a skip (#2573); reduced motion rests the stage, so each tap is a
  // step. The mark under test does not read motion. The longer timeout covers a cold dev server.
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${GAME}/top1`)

  // Nothing revealed yet: the checkpoint (`.gdcp`, gated on the same mark) is
  // not in the DOM at all.
  await expect(page.locator('.gdcp')).toHaveCount(0)
  // The hero's revealed box (the batter's name and his code) is not there either.
  await expect(page.locator('.gdhero__who')).toHaveCount(0)
  await expect(page.locator('.gdhero__code')).toHaveCount(0)
  expect(await cellName(page, 'Bottom 1')).toBe('Bottom 1, sealed')
  expect(await cellCounts(page)).toEqual({ sealed: 18, runs: 0 })

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
  // Exactly one revealed box in the hero (the half's first at-bat), and exactly one half's runs
  // in the line score: the other 17 halves still read sealed.
  await expect(page.locator('.gdhero__who')).toHaveCount(1)
  await expect(page.locator('.gdhero__code')).toHaveCount(1)
  expect(await cellName(page, 'Top 1')).toMatch(/^Top 1, \d+ runs?$/)
  expect(await cellCounts(page)).toEqual({ sealed: 17, runs: 1 })

  // ...but the persisted mark must not have crept past what was actually
  // revealed: bottom of the 1st is still sealed after the reload.
  await page.goto(`${GAME}/bottom1`)
  await expect(page.locator('.gdnext__advance')).toHaveText(/Next play/)
  await expect(page.locator('.gdcp')).toHaveCount(0)
  await expect(page.locator('.gdhero__who')).toHaveCount(0)
  expect(await cellName(page, 'Bottom 1')).toBe('Bottom 1, sealed')
  expect(await cellCounts(page)).toEqual({ sealed: 17, runs: 1 })
})
