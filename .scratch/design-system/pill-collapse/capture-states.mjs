// The control states for capture.mjs (#1131 slice 4), ported from
// ../button-collapse/capture.mjs. A tag has no states and keeps its one crop
// at rest; a CONTROL target lists `states`, and each state is one tight 2x
// crop, named `<name>--<state>.png`:
//
//   rest      as it loads
//   hover     the pointer on it
//   focus     focus-visible, reached by the Tab key: focus the control, step
//             back one stop with Shift+Tab, then Tab forward onto it again
//   pressed   the mouse button held down on it (released off the control, so
//             no click fires)
//   selected  its pressed or current state. A toggle that is off is clicked
//             once, cropped, and clicked again to put the page back. A target
//             whose control is already selected is cropped as it is.
//
// The crop keeps 8px round the control, so the 2px focus ring and its 2px gap
// are inside it.
import { join } from 'node:path'

const PAD = 8

async function crop(page, el, path) {
  const b = await el.boundingBox()
  if (!b) return false
  const vp = page.viewportSize()
  const x = Math.max(0, b.x - PAD)
  const y = Math.max(0, b.y - PAD)
  const w = Math.min(vp.width - x, b.width + PAD * 2)
  const h = Math.min(vp.height - y, b.height + PAD * 2)
  await page.screenshot({ path, clip: { x, y, width: w, height: h } })
  return true
}

const isSelected = (el) =>
  el.evaluate((n) => n.getAttribute('aria-pressed') === 'true' || n.getAttribute('aria-current') === 'page')

export async function shootStates(page, el, t, out) {
  const shots = []
  const facts = {}
  for (const s of t.states) {
    const file = `${t.name}--${s}.png`
    let undo = false
    if (s === 'hover') await el.hover()
    if (s === 'pressed') {
      await el.hover()
      await page.mouse.down()
      await page.waitForTimeout(180)
    }
    if (s === 'focus') {
      await page.mouse.move(0, 0)
      await el.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      facts.tabReached = await el.evaluate((n) => document.activeElement === n && n.matches(':focus-visible'))
    }
    if (s === 'selected' && !(await isSelected(el))) {
      await el.click()
      await page.waitForTimeout(400)
      undo = true
      await page.mouse.move(0, 0)
      // A toggle can open a panel below it and move the page: bring it back.
      await el.scrollIntoViewIfNeeded()
    }
    if (s === 'selected') {
      facts.selected = await el.evaluate((n) => {
        const cs = getComputedStyle(n)
        const tick = getComputedStyle(n, '::before').content
        return {
          ariaPressed: n.getAttribute('aria-pressed'),
          ariaCurrent: n.getAttribute('aria-current'),
          fill: cs.backgroundColor,
          ink: cs.color,
          edge: cs.borderTopColor,
          tick,
          h: Math.round(n.getBoundingClientRect().height * 10) / 10,
        }
      })
    }
    await page.waitForTimeout(160)
    if (await crop(page, el, join(out, file))) shots.push(file)
    if (s === 'pressed') {
      await page.mouse.move(0, 0)
      await page.mouse.up()
    }
    if (s === 'hover') await page.mouse.move(0, 0)
    if (s === 'focus') await el.evaluate((n) => n.blur())
    if (undo) {
      await el.click()
      await page.waitForTimeout(400)
      await page.mouse.move(0, 0)
      await el.evaluate((n) => n.blur())
    }
  }
  return { shots, facts }
}
