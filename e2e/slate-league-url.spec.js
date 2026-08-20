import { test, expect } from './fixtures.js'

// The slate's league is a URL segment (ADR-0055), so that a link can name the
// exact page its sender was reading: `/aaa/08152026` is Triple-A on that
// Saturday, and the bare `/` is MLB today for everybody. `test/route.test.js`
// pins the parse and the builder; these are the wiring a unit test cannot see
// — the pills writing history entries, the day arrows carrying the league, and
// a cold load of each address landing on the right pill.
//
// The day arrows are used rather than the calendar, so every assertion stays
// relative to whatever "today" is when the suite runs.

const path = (page) => new URL(page.url()).pathname
const pill = (page, name) => page.getByRole('button', { name, exact: true })
const activePill = (page) => page.locator('.levelnav__btn.is-active')

test.describe('the slate league is in the URL', () => {
  test('a cold load of each address opens on that league', async ({ page }) => {
    for (const [url, label] of [
      ['/', 'MLB'],
      ['/aaa', 'AAA'],
      ['/aa', 'AA'],
      ['/higha', 'A+'],
      ['/a', 'A'],
      // The leader board's spelling of High-A. Accepted so a reader who learned
      // it from `/leaders/aplus` lands somewhere sensible; never emitted.
      ['/aplus', 'A+'],
    ]) {
      await page.goto(url)
      await expect(activePill(page), url).toHaveText(label)
    }
  })

  test('tapping a league rewrites the address, and MLB goes back to bare /', async ({ page }) => {
    await page.goto('/')
    await expect(activePill(page)).toHaveText('MLB')
    expect(path(page)).toBe('/')

    await pill(page, 'AAA').click()
    await expect(activePill(page)).toHaveText('AAA')
    expect(path(page)).toBe('/aaa')

    await pill(page, 'A+').click()
    expect(path(page)).toBe('/higha')

    // MLB is the ABSENCE of a segment — the whole reason a shared '/' means the
    // same slate for its sender and for its reader.
    await pill(page, 'MLB').click()
    await expect(activePill(page)).toHaveText('MLB')
    expect(path(page)).toBe('/')
  })

  test('the day arrows keep the league, and a league tap keeps the day', async ({ page }) => {
    await page.goto('/aa')
    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(activePill(page)).toHaveText('AA')
    expect(path(page)).toMatch(/^\/aa\/\d{8}$/)

    const day = path(page).split('/')[2]
    await pill(page, 'AAA').click()
    await expect(activePill(page)).toHaveText('AAA')
    expect(path(page)).toBe(`/aaa/${day}`)

    // Back to MLB on that same day drops only the league segment.
    await pill(page, 'MLB').click()
    expect(path(page)).toBe(`/${day}`)

    // "Today" drops only the date.
    await pill(page, 'AA').click()
    await page.getByRole('button', { name: 'Today' }).click()
    expect(path(page)).toBe('/aa')
  })

  test('back and forward retrace league moves like any other page', async ({ page }) => {
    await page.goto('/')
    await pill(page, 'AAA').click()
    await pill(page, 'AA').click()
    expect(path(page)).toBe('/aa')

    await page.goBack()
    await expect(activePill(page)).toHaveText('AAA')
    expect(path(page)).toBe('/aaa')

    await page.goForward()
    await expect(activePill(page)).toHaveText('AA')
    expect(path(page)).toBe('/aa')
  })
})
