import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures.js'

const baseFeed = JSON.parse(
  readFileSync(new URL('../test/fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

function pregameFeed() {
  const feed = structuredClone(baseFeed)
  feed.gamePk = 823754
  feed.gameData.datetime = {
    ...feed.gameData.datetime,
    dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    originalDate: '2026-08-06',
    officialDate: '2026-08-06',
    time: '1:10',
    ampm: 'PM',
  }
  feed.gameData.status = {
    abstractGameState: 'Live',
    codedGameState: 'W',
    detailedState: 'Warmup',
    statusCode: 'PW',
    startTimeTBD: false,
    abstractGameCode: 'L',
  }
  feed.gameData.teams = {
    away: { id: 134, name: 'Pittsburgh Pirates', teamName: 'Pirates', abbreviation: 'PIT' },
    home: { id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers', abbreviation: 'MIL' },
  }
  feed.gameData.venue = {
    id: 32,
    name: 'American Family Field',
    timeZone: { id: 'America/Chicago', tz: 'CDT' },
  }
  feed.liveData.plays.allPlays = []
  return feed
}

test('pregame Innings route renders and advances the manual countdown board', async ({ page }) => {
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.route('**/api/v1/schedule?*', async (route) => {
    await route.fulfill({
      json: {
        dates: [{
          games: [{
            gamePk: 823754,
            gameDate: '2026-08-06T18:10:00Z',
            officialDate: '2026-08-06',
            gameNumber: 1,
            doubleHeader: 'N',
            status: { abstractGameState: 'Live', detailedState: 'Warmup', statusCode: 'PW' },
            teams: {
              away: { team: { id: 134, name: 'Pittsburgh Pirates', teamName: 'Pirates' } },
              home: { team: { id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers' } },
            },
            venue: { id: 32, name: 'American Family Field', timeZone: { id: 'America/Chicago', tz: 'CDT' } },
          }],
        }],
      },
    })
  })
  await page.route('**/api/v1.1/game/*/feed/live*', async (route) => {
    await route.fulfill({ json: pregameFeed() })
  })

  await page.goto('/08062026/pitmil/top1')

  const board = page.locator('.pregameboard')
  await expect(board).toBeVisible()
  await expect(board).toContainText('First pitch in')
  // While the clock is RUNNING the board deliberately shows neither the
  // matchup line nor the "Warmups underway" tag — `pregameboard__teams`
  // renders only under `!showClock`, so the countdown has the board to itself
  // (see PregameScoreboard.jsx). This spec asserted both for months and simply
  // went unrun: e2e is a verification harness, not a CI gate, so a stale
  // expectation here fails nothing until someone looks. The warmup state is
  // still asserted — through the accessible line, which is where it survives
  // in this state.
  await expect(board).toContainText('Warmups are underway.')
  await expect(board).toContainText('Top 1st is on deck')
  await expect(board).toContainText('American Family Field')
  await expect(page.getByText('This game hasn’t started yet.')).toHaveCount(0)

  const countdown = board.locator('.pregameboard__countdown')
  const before = await countdown.innerText()
  await page.waitForTimeout(1100)
  await expect.poll(() => countdown.innerText()).not.toBe(before)

  await expect(page.locator('.vite-error-overlay')).toHaveCount(0)
  const sections = page.getByRole('navigation', { name: 'Game sections' })
  await expect(sections.getByRole('button', { name: 'PIT', exact: true })).toBeVisible()
  await expect(sections.getByRole('button', { name: 'MIL', exact: true })).toBeVisible()
  await expect(sections.getByRole('button', { name: 'Box', exact: true })).toBeVisible()
  expect(consoleErrors).toEqual([])
})
