import { test, expect, openStampCard } from './fixtures.js'

// The Game Log with more than one book on the shelf (ADR-0041) — the flow that
// starts at a revealed box score and ends with a stamp on a page of the book
// its owner chose.
//
// Every case here failed before this file existed, and none of them could be
// caught a layer down. test/logbook-nav.test.js pins which ADDRESS a book
// answers to and test/books.test.js pins the store, but the defects were in
// the seam between them and the screen: an address that resolved to the shelf
// you tapped from, and a store write React was entitled to throw away. Both
// look correct in isolation.
//
// THE COLLECTION IS SEEDED DIRECTLY in most cases, exactly as
// e2e/logbook-passport.spec.js does and for the same reason: nothing here is
// about how a stamp is EARNED (e2e/invariants/logbook-stamp.spec.js pins that
// gate), only about which book it ends up in. The one case that does mint for
// real is the reported bug, start to finish, and it earns the extra seconds.
//
// NOT under e2e/invariants/ — nothing here touches the spoiler rule, so it
// earns the ipad/desktop projects too. The shelf is a different grid at each
// breakpoint and the book is a two-page spread on the widest.

const GAME = '/07072026/milstl-2'
const NOW = 1_700_000_000_000

function book(id, title, createdAt) {
  return {
    id,
    state: 'on',
    title,
    subtitle: '',
    // A real club so the cover paints its board rather than falling back to the
    // house navy — the shelf is what is under test, and a cover that resolved
    // nothing would still pass every assertion below.
    coverTeamId: 158,
    coverMark: 'team',
    coverColor: null,
    createdAt,
    updatedAt: createdAt,
  }
}

// The book that was always there (`DEFAULT_BOOK_ID`) plus one the user made.
// Newest-created leads the shelf, so "Road trip" is cover 0 and the one this
// user's whole collection already sits in is cover 1 — which is exactly the
// one that could not be opened.
const TWO_BOOKS = {
  default: book('default', '', NOW),
  broadtrip: book('broadtrip', 'Road trip', NOW + 1000),
}

const ONE_UNPLACED_STAMP = {
  777877: {
    state: 'on',
    mode: 'watched',
    stampedAt: NOW,
    updatedAt: NOW,
    note: '',
    date: '2025-05-18',
    placement: null,
  },
}

// Written from a page that already has an origin, then reloaded onto it —
// deliberately not addInitScript, which would re-run on every navigation and
// restore the seed underneath the very writes these cases are measuring.
async function seed(page, { books = TWO_BOOKS, stamps = ONE_UNPLACED_STAMP } = {}) {
  await page.goto('/logbook')
  await page.evaluate(
    ([b, s]) => {
      window.localStorage.setItem('bbsbh:books', JSON.stringify(b))
      window.localStorage.setItem('bbsbh:stamps', JSON.stringify(s))
    },
    [books, stamps],
  )
}

const shelf = (page) => page.locator('.shelf')
const covers = (page) => page.locator('.passcover')
const openBook = (page) => page.locator('.passportbook')
const storedBooks = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.values(JSON.parse(window.localStorage.getItem('bbsbh:books') ?? '{}')).map((b) => [
        b.id,
        b.state,
      ]),
    ),
  )
const storedPlacement = (page, gamePk) =>
  page.evaluate(
    (pk) => JSON.parse(window.localStorage.getItem('bbsbh:stamps') ?? '{}')[pk]?.placement ?? null,
    gamePk,
  )

// ---------------------------------------------------------------------------
// The reported bug: a second book made the first one unopenable.
// ---------------------------------------------------------------------------
test('every cover on the shelf opens its own book, the oldest one included', async ({ page }) => {
  await seed(page)
  await page.goto('/logbook')
  await expect(shelf(page)).toBeVisible()
  await expect(covers(page)).toHaveCount(2)

  // The book the user made. This one always worked.
  await covers(page).nth(0).click()
  await expect(openBook(page)).toBeVisible()
  await expect(page.locator('h1')).toHaveText('Road trip')
  expect(page.url()).toContain('/logbook/book/broadtrip')

  // The book that was there from the start. Tapping this used to land back on
  // the shelf it was tapped from — `/logbook` is the shelf once a second book
  // exists, so folding the default book onto it made the book unreachable.
  await page.goto('/logbook')
  await covers(page).nth(1).click()
  await expect(openBook(page)).toBeVisible()
  await expect(shelf(page)).toHaveCount(0)
  expect(page.url()).toContain('/logbook/book/default')
})

test('one book still opens straight from the bare route, with no shelf in the way', async ({
  page,
}) => {
  await seed(page, { books: { default: book('default', '', NOW) } })
  await page.goto('/logbook')
  await expect(openBook(page)).toBeVisible()
  await expect(shelf(page)).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// Start to finish, on a real game: reveal, mint, choose a book, place it.
// ---------------------------------------------------------------------------
test('a minted stamp can be filed into the book that was there first', async ({ page }) => {
  await seed(page, { stamps: {} })

  await page.goto(`${GAME}/boxscore`)
  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()
  await page.getByRole('button', { name: 'Stamp this game' }).click()
  await page.getByRole('button', { name: 'Place it in your book' }).click()

  // Two books, so the shelf asks which one — and says which keepsake it is
  // asking about, rather than "this stamp" at a shelf you may have reached
  // several taps later.
  await expect(shelf(page)).toBeVisible()
  await expect(page.locator('.shelf__intro')).toContainText('Choose a book for')
  // The covers say what the tap does now, and name their own book to a screen
  // reader instead of four identical "Open your Game Log" controls.
  await expect(covers(page).nth(1)).toHaveAttribute('aria-label', 'Choose Game Log')

  await covers(page).nth(1).click()
  await expect(page.locator('.logbook__placinglede')).toBeVisible()

  const target = page.locator('.passportpage__target').first()
  const box = await target.boundingBox()
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3)
  await page.getByRole('button', { name: 'Stamp it here' }).click()

  await expect(page.locator('.passportbook__spread .passportpage__stamp')).toHaveCount(1)
  // Filed in the book that was chosen — not merely drawn on a page. This is
  // the record the user's other devices will see.
  const placements = await page.evaluate(() =>
    Object.values(JSON.parse(window.localStorage.getItem('bbsbh:stamps') ?? '{}')).map(
      (s) => s.placement?.bookId ?? null,
    ),
  )
  expect(placements).toEqual(['default'])
})

// ---------------------------------------------------------------------------
// The stamp stays in hand wherever picking a book takes you.
// ---------------------------------------------------------------------------
test('the shelf is still the book picker when you go back to it mid-placement', async ({
  page,
}) => {
  await seed(page)
  await page.goto('/logbook/book/broadtrip?place=777877')
  await expect(page.locator('.logbook__placinglede')).toBeVisible()

  // Wrong book is the ordinary mistake, and this used to be the only way out
  // of it — except it dropped the stamp, leaving the box score as the only
  // route back into the flow.
  await page.getByRole('button', { name: 'Shelf' }).click()
  await expect(shelf(page)).toBeVisible()
  await expect(page.locator('.shelf__intro')).toContainText('Choose a book for')

  await covers(page).nth(1).click()
  await expect(page.locator('.logbook__placinglede')).toBeVisible()
  expect(page.url()).toContain('place=777877')
})

test('a book started while placing opens ready for the stamp', async ({ page }) => {
  await seed(page)
  await page.goto('/logbook?place=777877')
  await expect(shelf(page)).toBeVisible()

  // Offered while placing now. It used to be withheld here, because a book you
  // could not put anything into was a dead end — the create flow carries the
  // stamp, so "none of these" is a real answer.
  await page.getByRole('button', { name: 'New book' }).click()
  expect(page.url()).toContain('/logbook/new?place=777877')

  await page.getByRole('button', { name: 'Start this book' }).click()
  await expect(openBook(page)).toBeVisible()
  await expect(page.locator('.logbook__placinglede')).toBeVisible()
})

// ---------------------------------------------------------------------------
// Settings, from inside the book they belong to.
// ---------------------------------------------------------------------------
test('removing a book from inside it actually removes it', async ({ page }) => {
  await seed(page, {
    stamps: {
      777877: {
        state: 'on',
        mode: 'watched',
        stampedAt: NOW,
        updatedAt: NOW,
        note: '',
        date: '2025-05-18',
        placement: { bookId: 'broadtrip', page: 1, x: 0.4, y: 0.4, tilt: 1 },
      },
    },
  })
  await page.goto('/logbook/book/broadtrip')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Remove this book' }).click()
  await page.getByRole('button', { name: 'Remove book' }).click()

  // The removal has to reach localStorage. It did not: the same handler
  // un-placed the stamps, removed the book and navigated, and React discarded
  // the removal's own state updater — where the write lived — when the
  // navigation unmounted the page. The book came back on the next load, empty.
  await expect.poll(() => storedBooks(page)).toEqual({ default: 'on', broadtrip: 'off' })
  // Its stamp went back to the tray rather than being deleted with it.
  expect(await storedPlacement(page, 777877)).toBe(null)

  // One book left, so there is no shelf to land on any more.
  await expect(openBook(page)).toBeVisible()
  await expect(shelf(page)).toHaveCount(0)
  await page.reload()
  await expect(openBook(page)).toBeVisible()
  await expect(page.locator('.logbook__tray')).toBeVisible()
})

// ---------------------------------------------------------------------------
// A stamp can outlive the book it was filed in. It must not become invisible.
// ---------------------------------------------------------------------------
test('a stamp whose book is gone waits in the tray instead of vanishing', async ({ page }) => {
  await seed(page, {
    books: { default: book('default', '', NOW) },
    stamps: {
      777877: {
        state: 'on',
        mode: 'watched',
        stampedAt: NOW,
        updatedAt: NOW,
        note: '',
        date: '2025-05-18',
        // A book removed on ANOTHER device: the tombstone travels, and the
        // un-placements it went with may not have landed yet.
        placement: { bookId: 'bghost', page: 2, x: 0.4, y: 0.4, tilt: 1 },
      },
    },
  })
  await page.goto('/logbook')

  await expect(page.locator('.logbook__tray')).toBeVisible()
  await expect(page.locator('.passportbook__spread .passportpage__stamp')).toHaveCount(0)
  // And the season grid stops offering a page number for a page no book has.
  await openStampCard(page)
  await expect(page.locator('.logbook__cell .logbook__unplaced')).toHaveCount(1)
})

// ---------------------------------------------------------------------------
// A book's own retrospective, and the way back from it.
// ---------------------------------------------------------------------------
test("each book's Stats opens that book's own retrospective, and comes back to it", async ({
  page,
}) => {
  await seed(page)
  await page.goto('/logbook/book/default')
  await page.getByRole('button', { name: 'Stats' }).click()

  // The whole-collection retrospective lives at /logbook/stats and is a
  // different page: from inside one book, "what it adds up to" means THIS
  // book. The default book used to be handed the collection-wide one.
  expect(page.url()).toContain('/logbook/book/default/stats')
  // The topbar's own back control, not the site header's Game Log button —
  // that one goes to the resolver, which is the shelf here.
  await page.locator('.topbar__back').first().click()
  expect(page.url()).toContain('/logbook/book/default')
  await expect(openBook(page)).toBeVisible()
})
