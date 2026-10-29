import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures.js'

// Captured real records, offline and signed out. No live API or minted scores
// in localStorage: only the original score-free collection contract is seeded.
const fixture = (name) => JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url)))
const gameFeed = fixture('game-823035.gameday.json')
const trimmed = fixture('game-823035.trimmed.json')
const feed = { ...gameFeed, liveData: { ...gameFeed.liveData, linescore: trimmed.liveData.linescore } }
const milb = fixture('game-815625.gameday.json')
const post = fixture('world-series/schedule-2022.json')
function scheduleRow(source) {
  const gd = source.gameData
  const result = source.liveData.plays.allPlays.at(-1).result
  return {
    gamePk: source.gamePk, officialDate: gd.datetime.officialDate,
    gameDate: gd.datetime.dateTime, gameType: gd.game.type,
    gameNumber: gd.game.gameNumber, doubleHeader: gd.game.doubleHeader,
    status: gd.status, venue: gd.venue,
    teams: { away: { team: gd.teams.away, score: result.awayScore }, home: { team: gd.teams.home, score: result.homeScore } },
    linescore: source.liveData.linescore,
  }
}
const game = scheduleRow(feed)
// The captured schedule contains a postponed row for the same gamePk as the
// played World Series Game 3. Keep only the played row, as fetchStampGames does.
const games = [game, scheduleRow(milb), scheduleRow(fixture('game-823036.gameday.json')),
  ...post.dates.flatMap((d) => d.games).filter((g) => g.status.detailedState !== 'Postponed')]

async function capturedApi(page) {
  await page.route('https://**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'statsapi.mlb.com') return route.abort()
    if (url.pathname.endsWith('/feed/live')) return route.fulfill({ json: feed })
    if (url.pathname.endsWith('/schedule')) return route.fulfill({ json: {
      dates: [{ date: game.officialDate, games: url.searchParams.has('gamePks') ? games : [game] }],
    } })
    if (url.pathname.endsWith('/winProbability')) return route.fulfill({ json: [] })
    return route.fulfill({ json: {} })
  })
  await page.clock.install({ time: new Date('2026-07-07T18:00:00Z') })
}

test('cold box score keeps the pass out of the DOM until reveal and preserves the statistical sheet', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await capturedApi(page)
  await page.goto('/07072026/milstl-2/boxscore')
  await expect(page.getByRole('button', { name: 'Tap to reveal the box score', exact: true })).toBeVisible()
  await expect(page.locator('.heritagepass')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tap to reveal the box score', exact: true }).click()
  await expect(page.locator('.heritagepass')).toHaveCount(1)
  await expect(page.locator('.bs__board')).toHaveCount(1)
  await expect(page.locator('.stampstrip')).toHaveCount(1)
  await expect(page.locator('.heritagepass__score')).toHaveText(['10', '2'])
  await expect(page.locator('.heritagepass__league-emblem img')).toHaveAttribute('src', '/data/logos/league/mlb.svg')
  expect(errors).toEqual([])
})

test('passport mode paginates nine real games without changing circular-stamp placements', async ({ page }) => {
  expect(new Set(games.map((g) => g.gamePk)).size).toBe(9)
  await capturedApi(page)
  await page.goto('/logbook')
  await page.evaluate((rows) => {
    const stamps = Object.fromEntries(rows.map((g, i) => [g.gamePk, {
      state: 'on', mode: 'watched', stampedAt: 1700000000000 + i, updatedAt: 1700000000000 + i,
      note: '', date: g.officialDate,
      placement: { bookId: 'default', page: Math.floor(i / 8) + 1, x: 0.25 + (i % 2) * 0.5, y: 0.125 + (Math.floor(i / 2) % 4) * 0.25, tilt: 0 },
    }]))
    localStorage.setItem('bbsbh:stamps', JSON.stringify(stamps))
  }, games)
  await page.reload()
  await expect(page.locator('.passportbook')).toHaveCount(1)
  const original = await page.evaluate(() => localStorage.getItem('bbsbh:stamps'))
  await page.getByRole('button', { name: 'Heritage Passes', exact: true }).click()
  await expect(page.locator('.heritagepasses .heritagepass')).toHaveCount(4)
  const nav = page.getByRole('navigation', { name: 'Heritage Pass pages' })
  await expect(nav).toContainText('Page 1 of 3')
  await nav.getByRole('button', { name: 'Next' }).click()
  await expect(nav).toContainText('Page 2 of 3')
  await expect(page.locator('.heritagepasses .heritagepass')).toHaveCount(4)
  await nav.getByRole('button', { name: 'Next' }).click()
  await expect(nav).toContainText('Page 3 of 3')
  await expect(page.locator('.heritagepasses .heritagepass')).toHaveCount(1)
  await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled()
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  await page.getByRole('button', { name: 'Circular stamps', exact: true }).click()
  await expect(page.locator('.passportbook')).toHaveCount(1)
  await expect(page.locator('.heritagepass')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('bbsbh:stamps'))).toBe(original)
})

test('preview keeps real league marks, optional-metadata fallback and failed artwork usable', async ({ page }) => {
  await capturedApi(page)
  await page.route('**/data/logos/mono/*.svg*', (route) => route.fulfill({ status: 404, body: '' }))
  await page.goto('/heritage-pass-preview')
  const regular = page.locator('.heritage-preview__case').filter({ has: page.getByRole('heading', { name: 'MLB · Regular season', exact: true }) })
  const minor = page.locator('.heritage-preview__case').filter({ has: page.getByRole('heading', { name: 'MiLB · Regular season', exact: true }) })
  const missing = page.locator('.heritage-preview__case').filter({ has: page.getByRole('heading', { name: 'Optional metadata omitted', exact: true }) })
  await expect(regular.locator('.heritagepass__league-emblem img')).toHaveAttribute('src', '/data/logos/league/mlb.svg')
  await expect(regular.locator('.heritagepass__team .teamlogo')).toHaveCount(2)
  await expect(minor.locator('.heritagepass__league-emblem img')).toHaveAttribute('src', '/data/logos/league/milb.svg')
  await expect(minor.locator('.heritagepass__occasion')).toHaveText('Triple-A')
  await expect(missing.locator('.heritagepass__league-emblem')).toHaveText('Baseball')
  await page.getByRole('button', { name: 'Test unavailable artwork' }).click()
  await expect(page.locator('.heritagepass__art')).toHaveCount(0)
  for (const width of [320, 390, 820, 1180, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
})
