import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE } from './fixtures/mock-api.js'

// THE WIRE DOCK — the phone's presentation of the league's roster moves
// (components/transactions/WireDock.jsx). The arithmetic behind the drag is
// unit-tested and pure (test/dock-physics.test.js); what is left needs a
// browser and is exactly what this spec covers:
//
//  1. **The split.** Below WIDE_QUERY the feed is the dock and the in-flow
//     .wirecard is absent; at and above it, the reverse. Two presentations of
//     one feed, and never both at once.
//  2. **The floor.** The slate pads its bottom by the rail's MEASURED height,
//     so nothing the reader needs — the last game card, the footer, and above
//     all the Reveal all results bar, which is a seal control on a scoring
//     surface — can end up underneath the dock. That is a claim about two
//     rendered boxes; no unit test can see it.
//  3. **The gesture.** A tap opens a step, a drag lands on a detent, the
//     ledger scrolls upward without moving the sheet, and a pull-down from
//     the top of the ledger closes it. All four are DOM-and-pointer facts.
//  4. **It stays a dock, not a modal.** The slate behind it is still there,
//     and a link inside the ledger still navigates.
//
// The wire is stubbed for the same reason the card's spec stubs it: this shows
// today and yesterday, so a captured response is one day stale the day after it
// was taken and empty every winter. Rows are real shapes with the ids, names
// and dates rewritten per run.

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 900, height: 844 }

const CLUBS = [
  [108, 'Los Angeles Angels'], [109, 'Arizona Diamondbacks'], [110, 'Baltimore Orioles'],
  [111, 'Boston Red Sox'], [112, 'Chicago Cubs'], [113, 'Cincinnati Reds'],
  [114, 'Cleveland Guardians'], [115, 'Colorado Rockies'], [116, 'Detroit Tigers'],
  [117, 'Houston Astros'], [118, 'Kansas City Royals'], [119, 'Los Angeles Dodgers'],
]
const POSITIONS = ['RHP', 'LHP', 'C', '1B', 'SS', 'CF']

// A day back from an ISO date, by the same manual y/m/d parse the app uses —
// a raw Date subtraction can drift across a DST edge.
function dayBefore(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d - 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function wireFor(dates) {
  const rows = []
  for (const [dayIndex, date] of dates.entries()) {
    for (const [clubIndex, [id, name]] of CLUBS.entries()) {
      const personId = 900_000 + dayIndex * 100 + clubIndex
      const pos = POSITIONS[clubIndex % POSITIONS.length]
      const player = `Test Player${personId}`
      rows.push({
        id: 900_000 + rows.length,
        person: { id: personId, fullName: player },
        fromTeam: { id: 8000 + clubIndex, name: `${name} Affiliate` },
        toTeam: { id, name },
        date,
        effectiveDate: date,
        typeCode: 'CU',
        typeDesc: 'Recalled',
        description: `${name} recalled ${pos} ${player} from ${name} Affiliate.`,
      })
    }
  }
  return rows
}

function peopleFor(ids) {
  return ids.map((id) => ({
    id: Number(id),
    primaryPosition: { abbreviation: POSITIONS[Number(id) % POSITIONS.length] },
    mlbDebutDate: '2024-04-01',
  }))
}

// Registered AFTER installMockApi so these win — Playwright runs the most
// recently added matching handler first.
async function stubWire(page) {
  await page.route('**/api/v1/transactions*', async (route) => {
    const end = new URL(route.request().url()).searchParams.get('endDate')
    await route.fulfill({ json: { transactions: wireFor([end, dayBefore(end)]) } })
  })
  await page.route('**/api/v1/people*', async (route) => {
    const ids = (new URL(route.request().url()).searchParams.get('personIds') ?? '').split(',')
    await route.fulfill({ json: { people: peopleFor(ids.filter(Boolean)) } })
  })
}

async function openSlate(page, path = '/', viewport = PHONE) {
  await page.setViewportSize(viewport)
  await installMockApi(page)
  await stubWire(page)
  await page.goto(path)
}

// The sheet's own translateY, which is the one number every detent claim is
// about. Read off the live transform rather than the inline style so an
// interrupted settle reads as where the sheet IS.
async function sheetOffset(page) {
  return await page.locator('.wiredock__sheet').evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return Math.round(m.m42)
  })
}

async function settle(page) {
  await page.waitForTimeout(700)
}

// The dock measures itself against the viewport, so a reading taken before the
// slate below it has finished laying out is a reading of a different page. Wait
// for the rail to hold still before treating its rest position as a fact.
async function dockReady(page) {
  await expect(page.locator('.wiredock')).toBeVisible()
  await expect(page.locator('.gamecard').first()).toBeVisible()
  // The published floor covers the rail — ceiled, so it may exceed the rendered
  // height by up to a pixel but never fall short of it. Short is the error that
  // hides a control.
  await page.waitForFunction(() => {
    const rail = document.querySelector('.wiredock__rail')
    if (!rail) return false
    const measured = parseInt(document.documentElement.style.getPropertyValue('--wire-rail-h'), 10)
    const height = rail.getBoundingClientRect().height
    return measured > 0 && measured >= Math.floor(height) && measured <= Math.ceil(height)
  })
  // At rest the rail's bottom edge IS the bottom of the screen. Assert the
  // geometry rather than remembering a pixel number, which a later relayout can
  // legitimately change. Compared against document.documentElement.clientHeight
  // — the layout viewport a `position: fixed` element settles on — and allowed
  // a pixel of slack, because the band's real height is fractional and the
  // device presets differ in how they round it.
  await expect
    .poll(async () => await page.evaluate(() => {
      const rail = document.querySelector('.wiredock__rail').getBoundingClientRect()
      return Math.abs(rail.bottom - document.documentElement.clientHeight)
    }))
    .toBeLessThanOrEqual(1)
}

test('a phone gets the dock and never the in-flow card', async ({ page }) => {
  await openSlate(page)
  await dockReady(page)
  await expect(page.locator('.wirecard')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveAttribute('data-state', 'rail')

  // At rest it is one move and a count — not a ledger, and not nothing.
  await expect(page.locator('.wiredock__cut')).not.toBeEmpty()
  const count = Number(await page.locator('.wiredock__count').innerText())
  expect(count).toBeGreaterThan(1)
  expect(await page.locator('.wiredock__list .wire__row').count()).toBe(count)
})

test('a desktop gets the in-flow card and never the dock', async ({ page }) => {
  await openSlate(page, '/', DESKTOP)
  await expect(page.locator('.wirecard')).toBeVisible()
  await expect(page.locator('.wiredock')).toHaveCount(0)
  // And the slate is not left padding a floor that is not there.
  await expect(page.locator('.screen--slate')).not.toHaveClass(/screen--wiredock/)
})

// The one that protects a scoring surface. The dock is fixed over the slate,
// so if the slate did not pad itself the rail would sit on top of whatever the
// page ends with — including the Reveal all results bar.
test('the slate keeps its floor clear of the dock', async ({ page }) => {
  await openSlate(page)
  await dockReady(page)

  const railHeight = await page.evaluate(
    () => document.documentElement.style.getPropertyValue('--wire-rail-h'),
  )
  expect(parseInt(railHeight, 10)).toBeGreaterThan(0)

  const rail = await page.locator('.wiredock__rail').boundingBox()
  expect(Math.round(rail.height)).toBe(parseInt(railHeight, 10))

  // Scroll to the very end of the slate. Whatever the page ends with has to
  // finish above the rail's top edge.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect
    .poll(async () => await page.evaluate(
      () => Math.round(window.scrollY + window.innerHeight - document.body.scrollHeight),
    ))
    .toBeGreaterThanOrEqual(-1)
  const pageEnd = await page.evaluate(() => {
    const screen = document.querySelector('.screen--slate')
    const last = screen.querySelector('.sitefooter, footer')
    return last ? Math.round(last.getBoundingClientRect().bottom) : null
  })
  expect(pageEnd).not.toBeNull()
  expect(pageEnd).toBeLessThanOrEqual(Math.round(rail.y))
})

test('a tap opens the dock a step at a time, and the chevron closes it', async ({ page }) => {
  await openSlate(page)
  await dockReady(page)
  const dock = page.locator('.wiredock')
  const atRail = await sheetOffset(page)

  await page.locator('.wiredock__latest').click()
  await settle(page)
  await expect(dock).toHaveAttribute('data-state', 'half')
  const atHalf = await sheetOffset(page)
  expect(atHalf).toBeLessThan(atRail)

  // A second tap on the same strip — now carrying the section head — goes on
  // to full. The dock never skips a detent on a tap or a flick.
  await page.locator('.wiredock__rail').click({ position: { x: 40, y: 8 } })
  await settle(page)
  await expect(dock).toHaveAttribute('data-state', 'full')
  expect(await sheetOffset(page)).toBeLessThan(atHalf)

  // The chevron is the way out, from any height, in one press.
  await page.locator('.wiredock__close').click()
  await settle(page)
  await expect(dock).toHaveAttribute('data-state', 'rail')
  expect(await sheetOffset(page)).toBe(atRail)
})

test('Escape steps the dock back down', async ({ page }) => {
  await openSlate(page)
  await dockReady(page)
  await page.locator('.wiredock__latest').click()
  await settle(page)
  await expect(page.locator('.wiredock')).toHaveAttribute('data-state', 'half')

  await page.keyboard.press('Escape')
  await settle(page)
  await expect(page.locator('.wiredock')).toHaveAttribute('data-state', 'rail')
})

test('a drag on the handle tracks the pointer and lands on a detent', async ({ page }) => {
  await openSlate(page)
  await dockReady(page)
  const dock = page.locator('.wiredock')
  const rail = await page.locator('.wiredock__rail').boundingBox()
  const start = await sheetOffset(page)

  await page.mouse.move(rail.x + rail.width / 2, rail.y + 10)
  await page.mouse.down()
  await page.mouse.move(rail.x + rail.width / 2, rail.y + 10 - 120)
  await page.waitForTimeout(30)

  // Mid-drag the sheet is glued to the pointer — 1:1, no snapping yet.
  const dragged = await sheetOffset(page)
  expect(dragged).toBeLessThan(start - 100)
  expect(dragged).toBeGreaterThan(start - 140)
  await expect(dock).toHaveAttribute('data-state', 'rail')

  await page.mouse.move(rail.x + rail.width / 2, rail.y + 10 - 260)
  await page.mouse.up()
  await settle(page)
  await expect(dock).toHaveAttribute('data-state', 'half')
})

test('the ledger scrolls on its own, and a pull from its top closes the dock', async ({ page }) => {
  await openSlate(page)
  await dockReady(page)
  await page.locator('.wiredock__latest').click()
  await settle(page)
  const openAt = await sheetOffset(page)

  // Upward always belongs to the list. The sheet must not move for it.
  await page.locator('.wiredock__list').evaluate((el) => el.scrollBy(0, 320))
  await page.waitForTimeout(250)
  expect(await page.locator('.wiredock__list').evaluate((el) => el.scrollTop)).toBeGreaterThan(200)
  expect(await sheetOffset(page)).toBe(openAt)
  await expect(page.locator('.wiredock')).toHaveAttribute('data-state', 'half')

  // Back at the top of the ledger, a downward pull IS the sheet's — there is
  // no native scrolling left for it to compete with.
  await page.locator('.wiredock__list').evaluate((el) => { el.scrollTop = 0 })
  await page.waitForTimeout(200)
  const list = await page.locator('.wiredock__list').boundingBox()
  await page.mouse.move(list.x + list.width / 2, list.y + 40)
  await page.mouse.down()
  for (let i = 1; i <= 10; i += 1) {
    await page.mouse.move(list.x + list.width / 2, list.y + 40 + i * 22)
    await page.waitForTimeout(10)
  }
  await page.mouse.up()
  await settle(page)
  await expect(page.locator('.wiredock')).toHaveAttribute('data-state', 'rail')
})

test('the dock is a dock, not a modal', async ({ page }) => {
  await openSlate(page)
  // At rest the slate is completely live behind it — the scrim takes nothing.
  await dockReady(page)

  await page.locator('.wiredock__latest').click()
  await settle(page)
  // At the working height there is still no dimming: the sheet sits beside the
  // page rather than over it.
  expect(await page.locator('.wiredock__scrim').evaluate((el) => Number(el.style.opacity))).toBe(0)

  // And a name in the ledger is still a link out.
  const link = page.locator('.wiredock__list .wire__namelink').first()
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(/\/player\//)
})

test('a browsed-to past day and a Triple-A slate get no dock', async ({ page }) => {
  const [y, m, d] = ANCHOR_DATE.split('-')
  await openSlate(page, `/${m}${d}${y}`)
  await expect(page.locator('.gamecard').first()).toBeVisible()
  await expect(page.locator('.wiredock')).toHaveCount(0)

  await page.goto('/aaa')
  await expect(page.locator('.datenav')).toBeVisible()
  await expect(page.locator('.wiredock')).toHaveCount(0)
})
