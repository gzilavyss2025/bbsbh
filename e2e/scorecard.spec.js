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
  // The TOTALS plate is PREPRINTED — it is on the blank sheet too — but nothing
  // is totalled under it before the first batter. A scorer does not write 0 AB
  // under a column nobody has batted in.
  await expect(page.locator('.sc-sheet__totplate')).toBeVisible()
  const sums = await page.locator('.sc-sheet__totfigs > span').allTextContents()
  expect(sums.join('')).toBe('')
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
  // The totals are blank only while the sheet is: three revealed innings have
  // been batted, so the plate carries real figures now.
  const sums = await page.locator('.sc-sheet__totfigs > span').allTextContents()
  expect(sums.join('')).not.toBe('')
  // Bottom sheet: the home club has only innings 1–2 revealed — switch and
  // count its P/TP/LOB columns.
  await page.getByRole('button', { name: 'Bottom', exact: true }).click()
  await expect(page.locator('.sc-sheet__totcell .sc-sheet__ptl')).toHaveCount(2)
})

test('full reveal: the completed sheet, its totals, decisions, marks and PR case', async ({ page }) => {
  await openWithMark(page, FULL)
  // The away grid's summary foot: AB 38, H 11, R 10, RBI 10 (pinned), under the
  // kraft TOTALS bar that captions them.
  await expect(page.locator('.sc-sheet__totfigs > span')).toHaveText(['38', '11', '10', '10'])
  await expect(page.locator('.sc-sheet__totplate')).toHaveText('Totals')
  // FINAL: MIL 10, STL 2, with LOB 8/4; decisions named.
  await expect(page.locator('.sc-final tbody tr').first()).toContainText('10')
  // SURNAME AND FIGURE, the way a box score writes a pitcher of record: the
  // season record for the two starters of record, the save count for the man
  // who finished it. A first name is not what identifies him on a scorecard.
  await expect(page.locator('.sc-decisions')).toContainText('Gasser (2-3)')
  await expect(page.locator('.sc-decisions')).toContainText('Dobbins (1-1)')
  await expect(page.locator('.sc-decisions')).not.toContainText('Robert')
  // A 10–2 final earns nobody a save, so SV stays a blank line to write on —
  // never a bare name, and never an empty pair of brackets.
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
  // The two marks rule DIFFERENT EDGES, because they cut across different
  // things: the batting-order change stands down the LEFT of the box, closing
  // off the man before him along the row; the pitching change lies across the
  // TOP, cutting across the order rather than along it.
  const edges = await arriving.evaluate((box) => {
    const b = box.getBoundingClientRect()
    const r = box.querySelector('.sc-sub--batter .sc-sub__rule').getBoundingClientRect()
    return { tall: r.height > r.width, atLeft: Math.round(r.left - b.left), spans: Math.round(b.height - r.height) }
  })
  expect(edges.tall).toBe(true)
  expect(edges.atLeft).toBeLessThanOrEqual(1)
  expect(edges.spans).toBeLessThanOrEqual(1)
  // The number sits on the OUTGOING side of its rule — clear of the box
  // entirely, hanging left into the one the row is being taken over from, the
  // same side of its own line the pitching change's number takes.
  const num = await arriving.evaluate((box) => {
    const b = box.getBoundingClientRect()
    return Math.round(box.querySelector('.sc-sub__num--batter').getBoundingClientRect().right - b.left)
  })
  expect(num).toBeLessThanOrEqual(0)

  // And the pitching change takes the same mark on the sheet of the club that
  // has to face it: one per RELIEVER (the starter takes none), each on the box
  // of the first batter he faced. The Cardinals used four arms tonight.
  // Compared as a SET: the marks are laid out by batting-order row, and which
  // row a change lands on is whoever happened to be up, not the order the arms
  // entered. The pitcher table below the grid is what carries that order.
  const arms = await page.locator('.sc-sub__num--pitcher').allTextContents()
  expect(arms.sort()).toEqual(['39', '44', '68'])
  for (const n of arms) await expect(page.locator('.sc-pitchers')).toContainText(n)
  // Ruled ACROSS THE TOP of that box — the other edge from the batting-order
  // mark, so a double switch can set both without them colliding.
  const rule = await page
    .locator('.sc-ab', { has: page.locator('.sc-sub__num--pitcher') })
    .first()
    .evaluate((box) => {
      const b = box.getBoundingClientRect()
      const r = box.querySelector('.sc-sub--pitcher .sc-sub__rule').getBoundingClientRect()
      return { wide: r.width > r.height, atTop: Math.round(r.top - b.top), spans: Math.round(b.width - r.width) }
    })
  expect(rule.wide).toBe(true)
  expect(rule.atTop).toBeLessThanOrEqual(1)
  expect(rule.spans).toBeLessThanOrEqual(1)
})

test('the header band and footer trio stop where the columns stop', async ({ page }) => {
  await openWithMark(page, FULL)
  await expect(page.locator('.sc-sheet')).toBeVisible()
  const w = await page.evaluate(() => {
    const width = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width)
    return {
      table: width('.sc-sheet'),
      header: width('.sc-header'),
      footer: width('.sc-footer'),
      pane: width('.sc-sheet__scroll'),
    }
  })
  // Neither band ever runs past the reading column it is in — this is the half
  // that keeps the phone, where the grid is far wider than the screen, from
  // gaining a page-wide horizontal scroll.
  expect(w.header).toBeLessThanOrEqual(w.pane)
  expect(w.footer).toBeLessThanOrEqual(w.pane)
  // And where the whole sheet fits (the wide breakpoint's full-bleed), the
  // bands hold to the grid's own drawn width rather than the window's, so the
  // header's heavy rule ends at the RBI column.
  if (w.table <= w.pane) {
    expect(w.header).toBe(w.table)
    expect(w.footer).toBe(w.table)
    expect(w.table).toBeLessThan(w.pane)
    // And the spare room falls equally either side — a page on a desk, not a
    // column pinned to the left of one.
    const gaps = await page.evaluate(() => {
      const card = document.querySelector('.scorecard').getBoundingClientRect()
      const band = document.querySelector('.sc-header').getBoundingClientRect()
      return { left: Math.round(band.left - card.left), right: Math.round(card.right - band.right) }
    })
    expect(Math.abs(gaps.left - gaps.right)).toBeLessThanOrEqual(1)
    expect(gaps.left).toBeGreaterThan(0)
  }
})

test('a called third strike reads SO in the box and a backwards K in the diamond', async ({ page }) => {
  await openWithMark(page, FULL)
  // The backwards K is a CENTRE mark — it belongs where the fielding chain
  // goes, which is where a swinging K's own mark sits. It used to take the
  // outcome box instead, which left the sheet's column of out categories with a
  // hole in it and put the strikeout's own notation nowhere.
  const looking = page.locator('.sc-ab__center--looking')
  await expect(looking.first()).toBeVisible()
  const called = page.locator('.sc-ab', { has: looking })
  for (const t of await called.locator('.sc-ab__type').allTextContents()) expect(t).toBe('SO')

  // A REAL "K", MIRRORED IN CSS — never the ꓘ character (U+A4D8). JetBrains
  // Mono has no glyph there, so the character fell back to whatever system face
  // did and set one mark on a sheet of mono notation in a different font. This
  // is the assertion that keeps it from creeping back.
  await expect(looking.first()).toHaveText('K')
  expect(await page.locator('.sc-sheet').innerText()).not.toContain('ꓘ')
  const flip = await looking.first().evaluate((el) => getComputedStyle(el).transform)
  expect(flip).toBe('matrix(-1, 0, 0, 1, 0, 0)')

  // A swinging strikeout reads the same SO over the same K, unmirrored — the
  // two are told apart by the flip alone, exactly as on paper.
  const swinging = page
    .locator('.sc-ab__center--out', { hasText: /^K$/ })
    .and(page.locator(':not(.sc-ab__center--looking)'))
  await expect(swinging.first()).toBeVisible()
  expect(await swinging.first().evaluate((el) => getComputedStyle(el).transform)).toBe('none')
})

test('the two pages carry different header material, as the #22 does', async ({ page }) => {
  await openWithMark(page, FULL)
  const labels = () => page.locator('.sc-header .sc-field__label').allTextContents()

  // The visitors' page, where the sheet starts, carries the crew — printed
  // once, as on paper.
  // The visitors' page, where the sheet starts, carries the crew — printed
  // once, as on paper — and the two declarations you make at the top of a game
  // and never again: how you are watching it, and when it began.
  const top = await labels()
  expect(top).toContain('Visiting team')
  expect(top).toEqual(
    expect.arrayContaining([
      'HP ump',
      '1B ump',
      '2B ump',
      '3B ump',
      'Keeping score by',
      'First pitch',
    ]),
  )
  expect(top).not.toContain('Ballpark')
  expect(top).not.toContain('Final out')

  await page.getByRole('button', { name: /^Bottom$/i }).first().click()
  await expect(page.locator('.sc-header')).toContainText('Home team')

  // The home club's page takes the game's own particulars instead: where it was
  // played, in front of how many, in what weather, and when the final out
  // was recorded.
  const bottom = await labels()
  expect(bottom).toEqual(
    expect.arrayContaining(['Home team', 'Ballpark', 'Weather', 'Attendance', 'Final out']),
  )
  // Nothing printed once may appear twice: not the crew, and not the two
  // write-in surfaces the first page already asked for. FIRST PITCH's opposite
  // number, FINAL OUT, is the only one of that pair here — together they
  // bracket the sheet rather than crowding one band.
  const printedOnce = ['HP ump', '1B ump', '2B ump', '3B ump', 'Keeping score by', 'First pitch']
  for (const label of printedOnce) expect(bottom).not.toContain(label)

  // What both pages DO keep: the club it belongs to, its manager, its uniform.
  // Each page is one club's, so the band still reads as one form on either.
  for (const shared of ['Logo', 'Manager', 'Uniforms']) {
    expect(top).toContain(shared)
    expect(bottom).toContain(shared)
  }

  // FINAL OUT is a write-in TIME, the same field FIRST PITCH is — rings and all
  // — with its AM/PM pair stacked so it sits beside its own line instead of
  // pushing the block wider.
  const rings = page.locator('.sc-firstpitch__ampm--stacked')
  await expect(rings).toHaveCount(1)
  await expect(rings.locator('.sc-scoreby__ring')).toHaveCount(2)
  const stacked = await rings.evaluate((el) => {
    const [am, pm] = [...el.querySelectorAll('.sc-firstpitch__opt')].map((o) => o.getBoundingClientRect())
    return { belowNotBeside: pm.top >= am.bottom - 1, sameLeft: Math.abs(pm.left - am.left) <= 1 }
  })
  expect(stacked.belowNotBeside).toBe(true)
  expect(stacked.sameLeft).toBe(true)
})

test('every player name on the sheet opens his hover card', async ({ page }) => {
  await openWithMark(page, FULL)
  // The rail (a line per man who batted, subs included), the pitcher table, and
  // the three decisions. Each is a real PlayerLink, so each is also a door to
  // his page — the card is what a mouse gets on the way.
  await expect(page.locator('.sc-sheet__who.plink')).toHaveCount(
    await page.locator('.sc-sheet__line').count(),
  )
  await expect(page.locator('.sc-pitchers__name.plink').first()).toBeVisible()
  await expect(page.locator('.sc-decisions .plink')).toHaveCount(2) // no save in a 10–2

  // The card itself, off the first name in the order — DESKTOP ONLY, which is
  // the app's own rule for it (HOVER_CARD_QUERY: a real mouse at the wide
  // breakpoint). On a touch screen the same name is still a link to his page,
  // which is what a tap should do there.
  const hoverCapable = await page.evaluate(
    () => window.matchMedia('(min-width: 740px) and (hover: hover) and (pointer: fine)').matches,
  )
  await page.locator('.sc-sheet__who.plink').first().hover()
  if (!hoverCapable) {
    await expect(page.locator('.phcard')).toHaveCount(0)
    return
  }
  await expect(page.locator('.phcard')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.phcard')).toContainText('Yelich')
})

test('the whole batting order fits without scrolling inside it', async ({ page }) => {
  await openWithMark(page, FULL)
  await expect(page.locator('.sc-sheet__row--slot')).toHaveCount(9)
  // The pane's vertical bound is the LARGER of the room the window has and the
  // height nine slots need, so a scorer never pans inside the lineup to reach
  // the 8 and 9 hitters. At the default zoom the sheet is exactly its content.
  const pane = await page.evaluate(() => {
    const p = document.querySelector('.sc-sheet__scroll')
    return { client: Math.round(p.clientHeight), scroll: Math.round(p.scrollHeight) }
  })
  expect(pane.scroll).toBeLessThanOrEqual(pane.client + 1)
})

test('the foot row names its readings and stays pinned to the pane', async ({ page }) => {
  await openWithMark(page, FULL)
  await expect(page.locator('.sc-sheet__footlabel')).toHaveText('Pitches · Whiffs · Fouls')

  // It PINS. As the last <tr> of the tbody it never did: a sticky table CELL is
  // clamped by its own ROW, so `bottom: 0` had nowhere to move it and the line
  // scrolled away with the grid. It is a <tfoot> now.
  await expect(page.locator('.sc-sheet tfoot.sc-sheet__totals')).toHaveCount(1)
  const pinned = await page.evaluate(async () => {
    const pane = document.querySelector('.sc-sheet__scroll')
    if (pane.scrollHeight <= pane.clientHeight + 1) return null // nothing to scroll past
    pane.scrollTop = Math.min(300, pane.scrollHeight - pane.clientHeight)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const foot = document.querySelector('.sc-sheet__totals td').getBoundingClientRect()
    return Math.round(pane.getBoundingClientRect().bottom - foot.bottom)
  })
  if (pinned != null) expect(Math.abs(pinned)).toBeLessThanOrEqual(2)
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

test('the results block: one line per decision, and a defense that shows who came out', async ({
  page,
}) => {
  await openWithMark(page, FULL)

  // WP/LP/SV READ ACROSS. The label and the name share a line — the label sits
  // to the LEFT of the rule the name is written on, not stacked above it — and
  // the figure follows the name with a real space between them.
  const wp = page.locator('.sc-decision').first()
  await expect(wp.locator('.sc-decision__label')).toHaveText('WP')
  await expect(wp).toContainText('Gasser (2-3)')
  const across = await wp.evaluate((el) => {
    const label = el.querySelector('.sc-decision__label').getBoundingClientRect()
    const line = el.querySelector('.sc-decision__line').getBoundingClientRect()
    return { beside: line.left >= label.right - 1, sameLine: Math.abs(line.bottom - label.bottom) < 12 }
  })
  expect(across.beside).toBe(true)
  expect(across.sameLine).toBe(true)

  // THE FINAL GRID AND THE DECISIONS ARE ONE BAND, side by side, the way the
  // printed sheet lays them out — not the decisions wrapped underneath.
  const band = await page.locator('.sc-finalblock').evaluate((el) => {
    const grid = el.querySelector('.sc-final').getBoundingClientRect()
    const decisions = el.querySelector('.sc-decisions').getBoundingClientRect()
    return decisions.left >= grid.right - 1
  })
  expect(band).toBe(true)

  // THE DEFENSE DIAMOND RECORDS THE CHANGES. On a fully revealed game the
  // Cardinals' 1B turned over twice: Burleson, then Jordan in the 8th, then
  // Pagés in the 9th. The two men who came off are struck through; the standing
  // man is not, and each entrant carries the inning he took the field.
  const struck = page.locator('.sc-footer__defense .defdiamond__name--out')
  expect(await struck.count()).toBeGreaterThan(0)
  await expect(page.locator('.sc-footer__defense')).toContainText('(8th)')
  // The strike is drawn in the scorer's second pencil here — seam red, the same
  // ink the replacement's own name and inning tag are written in. Since #981 the
  // strike is a drawn BAR rather than `text-decoration` (styles/motion/strike.css),
  // so the sheet recolours that bar; the fact asserted is unchanged, only what
  // carries the colour.
  const strikeInk = await struck.first().evaluate((el) => {
    const seam = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-negative')
      .trim()
    const probe = document.createElement('span')
    probe.style.color = seam
    document.body.append(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    const bar = getComputedStyle(el, '::after')
    return { got: bar.backgroundColor, want: resolved, drawn: bar.content !== 'none' }
  })
  expect(strikeInk.drawn).toBe(true)
  expect(strikeInk.got).toBe(strikeInk.want)
})

test('a sealed sheet keeps the defensive changes sealed too', async ({ page }) => {
  // Substitution TIMING is spoiler-adjacent (ADR-0003/0010) — a flurry of
  // pre-half replacements telegraphs a sealed blowout — so a sheet nobody has
  // opened shows the alignment it showed before first pitch: no strike-throughs,
  // no inning tags, nine standing fielders.
  await openWithMark(page, null)
  await expect(page.locator('.sc-footer__defense .defdiamond__name')).not.toHaveCount(0)
  await expect(page.locator('.sc-footer__defense .defdiamond__name--out')).toHaveCount(0)
  await expect(page.locator('.sc-footer__defense .defdiamond__enter')).toHaveCount(0)
})

test("a substitute's line is written like the starter's", async ({ page }) => {
  await openWithMark(page, FULL)
  // Slot 5 (Bauers, then Mitchell) is the pinned two-man row. Both names start
  // at the same left edge, in the same size, weight and ink — one man's line
  // under another's, not a heading and its footnote.
  const rail = page.locator('.sc-sheet__row--slot').nth(4).locator('.sc-sheet__name')
  await expect(rail.locator('.sc-sheet__line')).toHaveCount(2)
  const lines = await rail.evaluate((cell) => {
    const [a, b] = [...cell.querySelectorAll('.sc-sheet__who')]
    const box = (el) => el.getBoundingClientRect()
    const type = (el) => {
      const cs = getComputedStyle(el)
      return `${cs.fontSize}|${cs.fontWeight}|${cs.color}`
    }
    return {
      sameLeft: Math.abs(box(a).left - box(b).left) <= 1,
      sameType: type(a) === type(b),
    }
  })
  expect(lines.sameLeft).toBe(true)
  expect(lines.sameType).toBe(true)
})
