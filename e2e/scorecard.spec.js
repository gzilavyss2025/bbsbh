// The live scorecard (`/{date}/{matchup}/scorecard`), pinned on the anchor
// game 823035 (2026-07-07 MIL@STL g2, final MIL 10–2) — the same game
// test/scorecard-game.test.js pins offline, so every number asserted here
// was verified there first. What this layer adds over the unit suite: the
// DOM truth of the clamp (a sealed half's marks literally absent), the
// override flow end to end, and the game's two doors onto this page (the
// tab bar, and the lineup page's door to the preview card that replaced it
// there — ADR-0047's second amendment).
import { test, expect } from './fixtures.js'
import { installMockApi } from './fixtures/mock-api.js'

// This spec is pinned on the anchor game (823035), which mock-api.js has a
// captured feed for — so it now runs on that offline snapshot instead of
// live network. `relay: true` (the default) still covers any statsapi call
// this page makes beyond feed/live, falling back to the same
// relay-through-Node technique this file used to hand-roll (some sandboxes'
// Chromium can't reach statsapi directly — CONNECTs reset by an egress
// proxy — while Node's fetch goes through fine).
test.beforeEach(async ({ page }) => {
  await installMockApi(page)
})

const ROUTE = '/07072026/milstl-2/scorecard'
const REVEAL_KEY = 'bbsbh:reveal:823035'
const NOTES_KEY = 'bbsbh:scorecard-notes:823035'

// halfIndex(3,'top') = 4; halfIndex(9,'bottom') = 17.
const THROUGH_TOP3 = '4'
const FULL = '17'

async function openWithMark(page, mark) {
  // Seed once per tab (the init script re-runs on every navigation, and an
  // unguarded clear() would wipe the override the persistence test reloads
  // to find).
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem('e2e-seeded')) return
      window.sessionStorage.setItem('e2e-seeded', '1')
      window.localStorage.clear()
      if (value != null) window.localStorage.setItem(key, value)
    },
    [REVEAL_KEY, mark],
  )
  await page.goto(ROUTE)
  await expect(page.locator('.scorecard')).toBeVisible({ timeout: 20000 })
}

test('sealed game: the sheet renders staged but inkless — nothing score-shaped in the DOM', async ({ page }) => {
  await openWithMark(page, null)
  // Header staging is fine (lineup names, crew) — but no at-bat marks, no
  // out circles, no P/TP/LOB values, no FINAL block, no decisions.
  await expect(page.locator('.sc-sheet')).toBeVisible()
  await expect(page.locator('.sc-ab__center')).toHaveCount(0)
  await expect(page.locator('.sc-ab--halfend')).toHaveCount(0)
  const outs = await page.locator('.sc-ab__out').allTextContents()
  expect(outs.join('')).toBe('')
  const types = await page.locator('.sc-ab__type').allTextContents()
  expect(types.join('')).toBe('')
  const ptl = await page.locator('.sc-sheet__totals .sc-sheet__totcell').allTextContents()
  expect(ptl.join('')).toBe('')
  // The decisions are the loudest spoiler: the winner's name must not exist.
  await expect(page.locator('body')).not.toContainText('Gasser')
  // Scoreboard cells all blank.
  const cells = await page.locator('.sc-scoreboard td:not(.sc-scoreboard__team)').allTextContents()
  expect(cells.join('')).toBe('')
})

test('partial reveal (through top 3): exactly that much ink, and no more', async ({ page }) => {
  await openWithMark(page, THROUGH_TOP3)
  // The away sheet shows innings 1–3's plate appearances…
  await expect(page.locator('.sc-ab__out').filter({ hasText: /\d/ }).first()).toBeVisible()
  // …and the P/WH/FO row carries exactly three filled inning columns.
  const filled = page.locator('.sc-sheet__totcell .sc-sheet__ptl')
  await expect(filled).toHaveCount(3)
  // Inning 1: 24 pitches seen, 1 swing and miss, 6 balls fouled off.
  await expect(filled.nth(0)).toHaveText('2416')
  // FINAL block still blank; winner still unnamed.
  await expect(page.locator('.sc-final td.sc-scoreboard__rhe').first()).toHaveText('')
  await expect(page.locator('body')).not.toContainText('Gasser')
  // Bottom sheet: the home club has only innings 1–2 revealed — switch and
  // count its P/TP/LOB columns.
  await page.getByRole('button', { name: 'Bottom', exact: true }).click()
  await expect(page.locator('.sc-sheet__totcell .sc-sheet__ptl')).toHaveCount(2)
})

test('full reveal: the completed sheet, its totals, decisions, marks and PR case', async ({ page }) => {
  await openWithMark(page, FULL)
  // The away grid's summary foot: AB 38, H 11, R 10, RBI 10 (pinned).
  await expect(page.locator('.sc-sheet__totbar')).toHaveText(['38', '11', '10', '10'])
  // FINAL: MIL 10, STL 2, with LOB 8/4; decisions named.
  await expect(page.locator('.sc-final tbody tr').first()).toContainText('10')
  await expect(page.locator('.sc-decisions')).toContainText('Robert Gasser')
  await expect(page.locator('.sc-decisions')).toContainText('Hunter Dobbins')
  // Each pitcher of record reads with his figure in parentheses — his season
  // record, or the save count for the man who finished it. This fixture is
  // trimmed of boxscore seasonStats, so the figures degrade away; what must
  // never appear is the bracket without one.
  await expect(page.locator('.sc-decisions')).not.toContainText('()')
  // The end-of-inning slash closes each half's own last box: nine halves,
  // nine slashed boxes, on a fully revealed 9-inning sheet. It is the sheet's
  // ONLY end-of-half mark — the leadoff boxes stay blank.
  await expect(page.locator('.sc-ab--halfend')).toHaveCount(9)
  // Nothing left to step, so no leadoff box is a door.
  await expect(page.locator('.sc-ab__flip')).toHaveCount(0)
  // The pinch-runner case: Bauers' 7th-inning diamond is filled (his run came
  // around under Mitchell's legs) with the red PR mark penciled by the base.
  await expect(page.locator('.sc-sheet').getByText('Bauers, Jake')).toBeVisible()
  await expect(page.locator('.pbp__pr').first()).toBeVisible()
  // The pitcher table lists the Cardinals arms that faced this order,
  // surname-first with the uniform number pinned to the column's right edge.
  await expect(page.locator('.sc-pitchers')).toContainText('Dobbins, Hunter')
  await expect(page.locator('.sc-pitchers__jersey').first()).toHaveText('40')
})

test('a slot is one row: the sub takes a written line, not a band of empty boxes', async ({ page }) => {
  await openWithMark(page, FULL)
  // Bauers is lifted for Mitchell in the 5 slot. Both names are in the rail…
  const slotRow = page.locator('tr', { has: page.getByText('Bauers, Jake') }).first()
  await expect(slotRow.locator('.sc-sheet__line')).toHaveCount(2)
  await expect(slotRow.locator('.sc-sheet__line').nth(1)).toContainText('Mitchell, Garrett')
  // …on ONE row, so both men's positions and both lines of figures stack in it.
  await expect(slotRow.locator('.sc-sheet__posline')).toHaveCount(2)
  await expect(slotRow.locator('.sc-sheet__sum').first().locator('.sc-sheet__sumline')).toHaveCount(2)
  // Nine batting-order slots, nine rows — never one per man who batted.
  await expect(page.locator('.sc-sheet__row--slot')).toHaveCount(9)

  // The handover is drawn instead: a rule on the box the new man arrives on,
  // his number in red beside it. Mitchell's number is 5, and the box under his
  // mark is HIS plate appearance, not an empty cell left on a retired row.
  const arriving = slotRow.locator('.sc-ab', { has: page.locator('.sc-sub__num--batter') })
  await expect(arriving).toHaveCount(1)
  await expect(arriving.locator('.sc-sub__num--batter')).toHaveText('5')
  await expect(arriving.locator('.sc-ab__type')).not.toHaveText('')

  // And the pitching change takes the same mark on the sheet of the club that
  // has to face it: one per RELIEVER (the starter takes none), each on the box
  // of the first batter he faced. The Cardinals used four arms tonight.
  // Compared as a SET: the marks are laid out by batting-order row, and which
  // row a change lands on is whoever happened to be up, not the order the arms
  // entered. The pitcher table below the grid is what carries that order.
  const arms = await page.locator('.sc-sub__num--pitcher').allTextContents()
  expect(arms.sort()).toEqual(['39', '44', '68'])
  for (const n of arms) await expect(page.locator('.sc-pitchers')).toContainText(n)
})

test('the sticky rail stays opaque for the whole row height', async ({ page }) => {
  await openWithMark(page, FULL)
  // A flexed <td> shrank to one line of text and let the inning columns show
  // THROUGH the rail as you panned right. The cell must be as tall as its row.
  const measured = await page.evaluate(() => {
    const td = document.querySelector('tbody .sc-sheet__row--slot .sc-sheet__name')
    return {
      cell: Math.round(td.getBoundingClientRect().height),
      row: Math.round(td.closest('tr').getBoundingClientRect().height),
      opaque: getComputedStyle(td).backgroundColor,
    }
  })
  expect(measured.cell).toBe(measured.row)
  expect(measured.opaque).not.toBe('rgba(0, 0, 0, 0)')
})

test('a tapped box takes a penciled override, persists it, and gives it back', async ({ page }) => {
  await openWithMark(page, FULL)
  const firstBox = page.locator('.sc-ab__edit').first()
  await firstBox.click()
  const editor = page.locator('.sc-editsheet')
  await expect(editor).toBeVisible()
  await editor.getByLabel('Outcome').fill('E6')
  await editor.getByRole('button', { name: 'Pencil it in' }).click()
  await expect(editor).toHaveCount(0)
  // The box shows the override and wears the edited-corner flag.
  await expect(page.locator('.sc-ab--noted').first()).toBeVisible()
  await expect(page.locator('.sc-ab--noted .sc-ab__type').first()).toHaveText('E6')
  // Persisted: reload keeps it.
  await page.reload()
  await expect(page.locator('.sc-ab--noted .sc-ab__type').first()).toHaveText('E6', { timeout: 20000 })
  // And "Use the feed's call" clears it.
  await page.locator('.sc-ab--noted .sc-ab__edit').first().click()
  await editor.getByRole('button', { name: 'Use the feed’s call' }).click()
  await expect(page.locator('.sc-ab--noted')).toHaveCount(0)
  const stored = await page.evaluate((k) => window.localStorage.getItem(k), NOTES_KEY)
  expect(stored).toBeNull()
})

test('the game tab bar carries the door to the live scorecard', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/07072026/milstl-2/lineup1')
  const tab = page.getByRole('button', { name: 'Scorecard', exact: true })
  await expect(tab).toBeVisible({ timeout: 20000 })
  await tab.click()
  await expect(page).toHaveURL(/\/scorecard/)
  await expect(page.locator('.scorecard')).toBeVisible({ timeout: 20000 })
})

test('the lineup page carries the door to the preview card, not the scorecard', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/07072026/milstl-2/lineup1')
  // The preview card's door moved here once the tab bar's "Card" stop became
  // "Scorecard" — see ADR-0047's second amendment.
  const door = page.getByRole('button', { name: /view preview card/i })
  await expect(door).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('button', { name: /open the live scorecard/i })).toHaveCount(0)
  await door.click()
  await expect(page).toHaveURL(/\/preview/)
  await expect(page.locator('.posterstudio')).toBeVisible({ timeout: 20000 })
})

test('the sheet plays: flip box, frontier seal, one PA per tap, commit inks the half', async ({ page }) => {
  await openWithMark(page, THROUGH_TOP3) // frontier = bottom 3, the other sheet
  // The turn handoff sits in the sheet's own leadoff box — the one for the
  // half that just ended (top 3) — not a banner over the page. Exactly one:
  // innings 1 and 2 have leadoff boxes too, and they stay blank.
  await expect(page.locator('.scflip')).toHaveCount(0)
  const chip = page.locator('.sc-ab__flip')
  await expect(chip).toHaveCount(1)
  await expect(chip).toContainText(/bottom 3/i)
  await chip.click()
  // The face-down frontier card sits on the sheet; tapping reveals ONE plate
  // appearance, and nothing whole-half inks mid-step.
  const seal = page.locator('.sc-ab__seal')
  await expect(seal).toHaveCount(1)
  await seal.click()
  await expect(page.locator('.sc-ab--fresh')).toHaveCount(1)
  const bottom3Cell = page.locator('.sc-scoreboard tbody tr').nth(1).locator('td').nth(3)
  await expect(bottom3Cell).toHaveText('')
  // The cursor is the innings viewer's own persisted at-bat mark (ADR-0016).
  const mark = await page.evaluate(() => window.localStorage.getItem('bbsbh:reveal-atbat:823035'))
  expect(mark).toMatch(/^5:/)
  // Tap through the rest of the half: the last step collapses into a commit,
  // the scoreboard cell inks, and the turn hands back to the top sheet.
  for (let i = 0; i < 12 && (await seal.count()) > 0; i++) await seal.click()
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem('bbsbh:reveal:823035')))
    .toBe('5')
  await expect(bottom3Cell).toHaveText('0')
  // The turn hands back to the top sheet, in the bottom sheet's own newest
  // leadoff box — and the half it just closed now wears the end-of-inning
  // slash on its last box.
  await expect(page.locator('.sc-ab__flip')).toContainText(/top 4/i)
  expect(await page.locator('.sc-ab--halfend').count()).toBe(3)
})
