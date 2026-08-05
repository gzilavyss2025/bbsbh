import { test, expect } from './fixtures.js'

// Arranging the passport book (ADR-0036), and specifically the two things no
// other suite can reach: that a placement REPAINTS the book it was made in,
// and that a stamp already on a page can be picked up and put somewhere else.
//
// The repaint half is the one that earns this file. test/passport-layout.test.js
// pins every coordinate the book is drawn with and test/stamps.test.js pins the
// store — so a placement can be arithmetically perfect, correctly persisted,
// and still never appear, because the bug lives in the seam between the store
// and React (useStamps.js's same-tab echo). That seam has no unit test and,
// before this spec, no coverage at all: placing a stamp wrote the placement to
// localStorage and left the book looking untouched until a reload.
//
// THE COLLECTION IS SEEDED DIRECTLY, which no other Logbook spec does. That is
// deliberate and it is not a hole: minting is gated on the server and on the
// box score's seal, and e2e/invariants/logbook-stamp.spec.js is what pins that
// gate. Nothing here is about how a stamp is EARNED — this file starts from a
// collection the user already has and only exercises what they can do with it,
// so it has no business driving a real game to get one. It also means the book
// is testable with no MLB feed at all: an unresolved stamp still holds its
// exact spot on the page (that is its contract), which is all this measures.
//
// NOT under e2e/invariants/ on purpose — nothing here touches the spoiler rule,
// so it earns the ipad/desktop projects too: the two-page spread is a genuinely
// different layout and the placement flow has to work on it.

// One stamp, unplaced, in the shape src/lib/stamps.js validates. `stampedAt`
// and `updatedAt` are the only clocks the record carries and both must be
// positive integers or normalizeStamp drops the entry.
const SEEDED = {
  777877: {
    state: 'on',
    mode: 'watched',
    stampedAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    note: '',
    date: '2025-05-18',
    placement: null,
  },
}

// Written ONCE, from a page that has an origin — deliberately not an
// addInitScript, which would re-run on every navigation and quietly restore the
// unplaced record underneath the reload this file ends on.
async function openBookWithOneStamp(page) {
  await page.goto('/logbook')
  await page.evaluate(
    (stamps) => window.localStorage.setItem('bbsbh:stamps', JSON.stringify(stamps)),
    SEEDED,
  )
  await page.reload()
}

// The stamps on the OPEN spread. Scoped past `.passportbook__spread` because a
// turning leaf carries its own copy of the pages it is flying between, so a
// bare `.passportpage__stamp` double-counts for the length of the animation —
// which on the two-page desktop spread is exactly when this file looks.
function stampsOnBook(page) {
  return page.locator('.passportbook__spread .passportpage__stamp')
}

// Where each of those sits, as the inline percentages PassportPage writes from
// the placement's own fractions — the identity of a spot, in the only units the
// book stores.
function spots(page) {
  return stampsOnBook(page).evaluateAll((els) =>
    els.map((el) => `${el.style.left},${el.style.top}`),
  )
}

// Tap the open page at a fraction of its own box, the way a finger does.
async function tapPage(page, xf, yf) {
  const box = await page.locator('.passportpage__target').first().boundingBox()
  await page.mouse.click(box.x + box.width * xf, box.y + box.height * yf)
}

test('a stamp lands on the page when you place it, and moves when you move it', async ({ page }) => {
  await openBookWithOneStamp(page)

  // Minted but unplaced: it waits in the tray, and the book is empty.
  await expect(page.locator('.logbook__traystamp')).toHaveCount(1)
  await page.locator('.passcover').click()
  await expect(stampsOnBook(page)).toHaveCount(0)

  // Place it. NO RELOAD between the confirm and the assertion — that is the
  // whole point of this test.
  await page.locator('.logbook__traystamp').first().click()
  await tapPage(page, 0.35, 0.3)
  await page.getByRole('button', { name: 'Stamp it here' }).click()

  await expect(stampsOnBook(page)).toHaveCount(1)
  await expect(page.locator('.logbook__traystamp')).toHaveCount(0)
  const [placed] = await spots(page)

  // Now move it. Tapping a placed stamp opens its options rather than opening
  // its game — that is the entry point to every edit a placement allows.
  await stampsOnBook(page).click()
  await expect(page.locator('.logbook__selected')).toBeVisible()
  await page.getByRole('button', { name: 'Move it' }).click()

  // Still on the page while you choose: a move is not an un-place, so
  // abandoning one has to leave the keepsake exactly where it was.
  await expect(page.locator('.passportbook__spread .passportpage__stamp--moving')).toHaveCount(1)

  await tapPage(page, 0.62, 0.72)
  await page.getByRole('button', { name: 'Move it here' }).click()

  await expect(stampsOnBook(page)).toHaveCount(1)
  await expect(page.locator('.logbook__traystamp')).toHaveCount(0)
  const [moved] = await spots(page)
  expect(moved).not.toBe(placed)

  // And it survives the round trip through localStorage, which is what makes
  // the arrangement an artifact rather than something this render happened to
  // draw.
  await page.reload()
  await page.locator('.passcover').click()
  expect(await spots(page)).toEqual([moved])
})

test('a placed stamp can be sent back to the tray', async ({ page }) => {
  await openBookWithOneStamp(page)
  await page.locator('.passcover').click()
  await page.locator('.logbook__traystamp').first().click()
  await tapPage(page, 0.5, 0.5)
  await page.getByRole('button', { name: 'Stamp it here' }).click()
  await expect(stampsOnBook(page)).toHaveCount(1)

  await stampsOnBook(page).click()
  await page.getByRole('button', { name: 'Back to the tray' }).click()

  // Off the page, still in the collection — the keepsake outranks its spot.
  await expect(stampsOnBook(page)).toHaveCount(0)
  await expect(page.locator('.logbook__traystamp')).toHaveCount(1)
  await expect(page.locator('.logbook__cell')).toHaveCount(1)
})
