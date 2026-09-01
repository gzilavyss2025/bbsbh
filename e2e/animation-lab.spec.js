import { test, expect } from './fixtures.js'

// THE ANIMATION LAB'S PLAY CONTROL (/animation-lab, screens/animlab/Entry.jsx).
//
// The page's whole job is to show an animation actually running, and for most
// of its entries it silently stopped doing that: fifteen demos mount at once,
// most of them are one-shots, and a CSS animation with no `forwards` fill is
// over — and REMOVED from the element — within about half a second of mounting.
// Every one-shot below the fold had played to nobody before a reviewer could
// scroll to it, and `getAnimations()` on those nodes returned an empty list.
//
// So each stage now rests paused on its first frame and plays only when asked.
// What is pinned below is that pair of facts, because either one alone is a
// page that lies: nothing may run unasked, and what is asked for must actually
// run — twice, since a reviewer's second question is always "again".

const RUNNING = (page, filter) =>
  page.evaluate(
    (f) =>
      [...document.querySelectorAll('.animlab__entry')]
        .filter((s) => !f || s.textContent.includes(f))
        .reduce(
          (n, s) =>
            n +
            s
              .querySelector('.animlab__live')
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === 'running').length,
          0,
        ),
    filter ?? null,
  )

test('nothing on the page runs until it is asked to', async ({ page }) => {
  await page.goto('/animation-lab')
  await expect(page.locator('.animlab__entry').first()).toBeVisible()
  // Well past the longest one-shot on the page, so anything that was going to
  // start on its own has had every chance to.
  await page.waitForTimeout(3000)

  expect(await RUNNING(page), 'the whole page is quiet').toBe(0)

  // And the animations are still THERE to be played. This is the assertion that
  // fails on the old page rather than the one above: an unasked one-shot did not
  // sit paused, it ran to the end and the browser dropped it, so the stage held
  // nothing a Play button could ever have started.
  const stages = await page.evaluate(() =>
    [...document.querySelectorAll('.animlab__entry')]
      .filter((s) => s.querySelector('.animlab__play'))
      .map((s) => ({
        title: s.querySelector('.animlab__title').textContent,
        total: s.querySelector('.animlab__live').getAnimations({ subtree: true }).length,
      })),
  )
  expect(stages.length, 'every playable entry has a button').toBeGreaterThan(8)
  for (const s of stages) expect(s.total, `${s.title} kept its animation`).toBeGreaterThan(0)
})

test('Play runs one entry, alone, and gives it back when it ends', async ({ page }) => {
  await page.goto('/animation-lab')
  const entry = page.locator('.animlab__entry').filter({ hasText: 'the card writes itself' })
  await expect(entry).toBeVisible()
  await page.waitForTimeout(1500)

  const btn = entry.locator('.animlab__play')
  await expect(btn).toHaveText('Play')
  await btn.click()

  await expect(btn).toHaveText('Stop')
  await expect(entry.locator('.animlab__live')).toHaveClass(/is-running/)
  expect(await RUNNING(page, 'the card writes itself'), 'it plays').toBeGreaterThan(0)

  // ...and the other fourteen stayed put. One animation is only readable when
  // the rest of the page is not moving, which is half of why the control exists.
  const elsewhere = await page.evaluate(() =>
    [...document.querySelectorAll('.animlab__entry')]
      .filter((s) => !s.textContent.includes('the card writes itself'))
      .reduce(
        (n, s) =>
          n +
          s
            .querySelector('.animlab__live')
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === 'running').length,
        0,
      ),
  )
  expect(elsewhere, 'nothing else woke up').toBe(0)

  // A one-shot hands the button back on its own; the label has to say so, or the
  // second press reads as "stop" when it means "again".
  await expect(btn).toHaveText('Play', { timeout: 5000 })

  // Again. A finished animation is gone from the element, so this only works
  // because Play REMOUNTS the stage rather than resuming it.
  await btn.click()
  await expect(btn).toHaveText('Stop')
  expect(await RUNNING(page, 'the card writes itself'), 'it replays').toBeGreaterThan(0)
})

test('Stop freezes a loop, and a hover entry is never paused', async ({ page }) => {
  await page.goto('/animation-lab')
  const breath = page.locator('.animlab__entry').filter({ hasText: 'the scorecard breath' })
  await expect(breath).toBeVisible()

  // A loop never ends, so it keeps its Stop until the reviewer presses it.
  await breath.locator('.animlab__play').click()
  await expect(breath.locator('.animlab__play')).toHaveText('Stop')
  await page.waitForTimeout(600)
  await expect(breath.locator('.animlab__play')).toHaveText('Stop')
  await breath.locator('.animlab__play').click()
  await expect(breath.locator('.animlab__play')).toHaveText('Play')
  expect(await RUNNING(page, 'the scorecard breath'), 'stopped').toBe(0)

  // The three hover entries have nothing to start — you start them with the
  // pointer — and their demo has to be SETTLED to be pointed at, so they are
  // left live rather than paused on a half-drawn first frame.
  const hover = page.locator('.animlab__entry').filter({ hasText: 'the straightedge' })
  await expect(hover.locator('.animlab__play')).toHaveCount(0)
  await expect(hover.locator('.animlab__live')).toHaveClass(/is-running/)
})
