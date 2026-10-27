// Moves on the Gameday page that several specs share.
//
// There is no "Rest of half" (#2568): a half opens one step at a time, so revealing a whole half
// is tapping the advance until it stops reading as a step. In at-bat mode that is one tap per
// plate appearance; the last one commits the half's reveal mark and the bar then names the next
// half, "Close the book" or "Box score" (or "Caught up" at a live edge). For a SEALED half: the
// steps through an already revealed half move no stored cursor.
//
// Each tap waits for the cursor (or the mark) to move, so the next read of the label is the
// label that tap left, never a stale one that would tap past the half. A tap while the stage still
// plays skips the play instead of stepping (#2573), so a tap that moves nothing is let go.
const revealState = (page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bbsbh:reveal')).map((k) => `${k}=${localStorage.getItem(k)}`).sort().join('|'))

export async function revealHalf(page) {
  const advance = page.locator('.gdnext__advance')
  for (let taps = 0; taps < 120; taps++) {
    const label = ((await advance.textContent()) ?? '').trim()
    if (!/^Next (play|pitch)/.test(label)) return
    const before = await revealState(page)
    await advance.click()
    await page
      .waitForFunction(
        (b) => Object.keys(localStorage).filter((k) => k.startsWith('bbsbh:reveal')).map((k) => `${k}=${localStorage.getItem(k)}`).sort().join('|') !== b,
        before,
        { timeout: 3000 },
      )
      .catch(() => {})
  }
  throw new Error('the half did not close in 120 taps')
}

// A half's run cell in Gameday's line score ("Top 1, sealed", "Top 1, 2 runs"). The line score folds
// into the Menu on the phone tier only (lib/gameday/ladder.js), so the tier on `.gdnext` decides,
// not the cell's visibility: at T and L the cell may not be drawn yet when this runs, and opening
// the Menu there would lay its scrim over the cell. The Menu opens once; the cell is waited for.
export async function halfCell(page, name) {
  const tier = await page.locator('.gdnext[data-tier]').getAttribute('data-tier')
  if (tier === 'P' && !(await page.getByRole('dialog').count())) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
  }
  const cell = page.getByRole('button', { name: new RegExp(`^${name},`) })
  await cell.waitFor({ state: 'visible' })
  return cell
}
