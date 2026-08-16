import { test, expect } from '../fixtures.js'

// The seal's tear, pinned where it touches the spoiler rule (ADR-0002).
//
// The tear is decoration, and the whole reason it is ALLOWED to be decoration is
// that it animates the cover — which holds no data — rather than the panel. That
// argument is invisible in a screenshot and easy to undo in a refactor: a
// cross-fade would look better on the way in and would require the sealed panel
// to be in the tree while the box is still sealed. So this file pins the
// structure, not the look:
//
//   1. Nothing tears, or exists, before the tap.
//   2. What DOES fly off carries no score — only the cover's own constant face.
//   3. It leaves, rather than lingering over the panel it uncovered.
//   4. The same seal tears identically across reloads (lib/sealTear.js).
//   5. Reduced motion gets no tear and no delayed panel.
//
// The tear lasts --dur-tear (320ms), which is too short to poll for reliably, so
// the specs below record it through a MutationObserver installed before the tap
// instead of racing it.
const GAME = '/07072026/milstl-2'
const SEAL = { name: 'Tap to reveal the box score' }

// Records every `.sealtear` that reaches the document, with the text and clip
// paths it carried, so the assertions can run after it has already gone.
async function watchForTear(page) {
  await page.evaluate(() => {
    window.__tears = []
    const record = (el) => {
      window.__tears.push({
        text: el.textContent,
        clips: [...el.querySelectorAll('.sealtear__half')].map(
          (h) => h.style.clipPath || getComputedStyle(h).clipPath,
        ),
      })
    }
    new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains('sealtear')) record(node)
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
}

test('nothing tears, and no padlock emoji is printed, before the tap', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  // Generous, because this is the first navigation of the run: on a cold dev
  // server the box score's own fetch lands behind Vite's first transform of the
  // route, which is slower than the default expect timeout. Every later spec
  // here reaches the same button warm and needs no such allowance.
  await expect(page.getByRole('button', SEAL)).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.sealtear')).toHaveCount(0)
  await expect(page.locator('.statgrid--tearing')).toHaveCount(0)

  // The mark is drawn, not typed. A system emoji renders as a different
  // typeface on every device, which is what this replaced.
  await expect(page.locator('.cover__mark')).toHaveCount(1)
  expect(await page.content()).not.toContain('🔒')
})

test('the halves that fly off carry the cover, and no score', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)
  await watchForTear(page)
  await page.getByRole('button', SEAL).click()

  await expect.poll(() => page.evaluate(() => window.__tears.length)).toBe(1)
  const [tear] = await page.evaluate(() => window.__tears)

  // Two halves, each clipped by a polygon of its own — this is the load-bearing
  // assertion of the file. A torn half is a COPY of the cover's constant face:
  // the same words the sealed button showed, and not one digit of the sheet it
  // was covering.
  expect(tear.clips).toHaveLength(2)
  for (const clip of tear.clips) expect(clip).toContain('polygon(')
  expect(tear.clips[0]).not.toBe(tear.clips[1])
  expect(tear.text.replace(/Tap to reveal/g, '')).not.toMatch(/\d/)
})

test('the tear leaves, and the panel it uncovered stays', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)
  await page.getByRole('button', SEAL).click()

  // The panel mounts on the same frame it always did — the tear delays the
  // fade, never the mount.
  await expect(page.locator('.statgrid')).toHaveCount(1)
  await expect(page.locator('.statgrid--tearing')).toHaveCount(1)

  // ...and the halves clear themselves off it rather than sitting there inert.
  await expect(page.locator('.sealtear')).toHaveCount(0, { timeout: 5_000 })
})

test('the same seal tears the same way on a fresh load', async ({ page }) => {
  const tearOnce = async () => {
    await page.goto(`${GAME}/boxscore`)
    // A box score keeps itself open once opened (ADR-0049), so the seed question
    // has to be asked in the state it is actually asked in: a reader who has not
    // opened this one. Clearing that one bit is what makes the second load
    // genuinely fresh — the same condition this spec always ran under, now
    // stated rather than assumed.
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('bbsbh:boxreveal:')) localStorage.removeItem(k)
      }
    })
    await page.reload()
    await watchForTear(page)
    await page.getByRole('button', SEAL).click()
    await expect.poll(() => page.evaluate(() => window.__tears.length)).toBe(1)
    return (await page.evaluate(() => window.__tears))[0].clips
  }

  // A seal that re-rolled its own tear on every visit would still animate;
  // it just would not be the same seal. This is the promise sealTearSeed makes,
  // measured end to end rather than at the unit boundary.
  expect(await tearOnce()).toEqual(await tearOnce())
})

test('reduced motion cuts straight to the panel, with no tear and no hold', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${GAME}/boxscore`)
  await watchForTear(page)
  await page.getByRole('button', SEAL).click()

  await expect(page.locator('.statgrid')).toHaveCount(1)
  // Not "torn quickly" — not torn at all. The panel must also carry no delayed
  // fade, since 01-base.css's blanket reduced-motion kill shortens durations
  // and not delays (see SealBox.jsx's wantsReducedMotion).
  await expect(page.locator('.statgrid--tearing')).toHaveCount(0)
  expect(await page.evaluate(() => window.__tears.length)).toBe(0)
})
