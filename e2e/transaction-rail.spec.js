import { test, expect } from './fixtures.js'

// The Team Transactions deck's photo rail must stay inside the card it belongs
// to. The rail floats right (a magazine caption wrapping a floated photo), and
// a right float WIDER than its containing block overflows to the LEFT — so a
// big roster shuffle used to print its headshots, banners and surnames across
// the PREVIOUS card in the deck and over its sentence, with two cards' banners
// stacked on the same pixels. `display: flow-root` on .txstory contains a float
// vertically and does nothing about that.
//
// This is a geometry bug, so the unit suite structurally cannot catch it: the
// data layer emits the same correct 8-slot rail either way. Measuring the
// rendered boxes is the only honest check, which is what this does.
//
// Deliberately data-driven rather than pinned to one club and date. The static
// file is regenerated nightly (scripts/gen-team-transactions.mjs), so a
// hardcoded "the Mets on August 4" would quietly stop exercising a big rail the
// moment that day aged out of the newest cards. Instead it reads the same file
// the app reads, finds a club whose visible cards actually include a wide rail,
// and goes there.

// Mirrors TxStory.jsx. A rail past RAIL_FLOAT_MAX lays out as a
// full-measure strip instead of a float; at or below it the float is what the
// deck is designed around and must be left alone.
const RAIL_FLOAT_MAX = 3
// Mirrors INITIAL_CARDS — how many stories the deck renders before lazy-reveal.
const INITIAL_CARDS = 12

// Finds a team whose first INITIAL_CARDS stories include the widest rail on
// file, so the spec exercises the worst real case rather than a lucky one.
// The dataset is SHARDED — `{season}/index.json` naming the clubs, then one
// `{season}/{teamId}.json` each (#642). It used to be one `{season}.json`
// holding a `byTeamId` map, and this helper still asked for that: the request
// fell through to the SPA's index.html and the spec died on
// "Unexpected token '<'" rather than on anything about photo rails. e2e is a
// verification harness rather than a CI gate, so it stayed broken silently.
async function findWidestRailTeam(page) {
  return await page.evaluate(async (initialCards) => {
    const season = new Date().getUTCFullYear()
    const indexRes = await fetch(`/data/team-transactions/${season}/index.json`)
    if (!indexRes.ok) return null
    const { teamIds = [] } = await indexRes.json()
    let best = null
    for (const teamId of teamIds) {
      const res = await fetch(`/data/team-transactions/${season}/${teamId}.json`)
      if (!res.ok) continue
      const entry = await res.json()
      const visible = (entry.days ?? []).flatMap((d) => d.stories).slice(0, initialCards)
      for (const story of visible) {
        const n = story.rail?.length ?? 0
        if (!best || n > best.slots) best = { teamId: String(teamId), slots: n }
      }
    }
    return best
  }, INITIAL_CARDS)
}

test('a story\'s photo rail never escapes its own card', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  const target = await findWidestRailTeam(page)
  test.skip(!target, 'no team-transactions data file for the current season')
  test.skip(
    target.slots <= RAIL_FLOAT_MAX,
    `no club currently shows a rail past ${RAIL_FLOAT_MAX} headshots (widest is ${target.slots})`,
  )

  await page.goto(`/team/${target.teamId}/games`)
  await page.waitForSelector('.txstory', { timeout: 90_000 })
  await expect(page.locator('.photorail').first()).toBeVisible()

  const stories = await page.evaluate(() => {
    const out = []
    for (const story of document.querySelectorAll('.txstory')) {
      const card = story.getBoundingClientRect()
      const rail = story.querySelector('.photorail')
      if (!rail) continue
      // Measure the rail's own painted children, not just its box: the banner
      // and the surname caption can both sit wider than the headshot they
      // belong to, and those are what visibly collided across cards.
      let escapeLeft = 0
      let escapeRight = 0
      for (const el of story.querySelectorAll('.photorail__slot, .photorail__slot *')) {
        const b = el.getBoundingClientRect()
        if (b.width === 0) continue
        escapeLeft = Math.max(escapeLeft, card.left - b.left)
        escapeRight = Math.max(escapeRight, b.right - card.right)
      }
      // The day the card belongs to now sits on the DAY TAB before its run
      // (TxStory.jsx's DayTab) rather than on the card, so walk back to it —
      // this is only the label on a failure message, but a blank one is a
      // failure message that names no card.
      let tab = story.previousElementSibling
      while (tab && !tab.classList.contains('txday')) tab = tab.previousElementSibling
      out.push({
        date: (tab?.textContent ?? '').replace(/s+/g, ' ').trim(),
        slots: story.querySelectorAll('.photorail__slot').length,
        isStrip: rail.classList.contains('photorail--strip'),
        escapeLeft: Math.round(escapeLeft),
        escapeRight: Math.round(escapeRight),
      })
    }
    return out
  })

  expect(stories.length).toBeGreaterThan(0)
  expect(stories.some((s) => s.slots > RAIL_FLOAT_MAX)).toBe(true)

  for (const s of stories) {
    const where = `${s.date} (${s.slots} headshots)`
    // 1px of slack for sub-pixel rounding only — the real bug overflowed by 125px.
    expect(s.escapeLeft, `rail escapes the left edge of ${where}`).toBeLessThanOrEqual(1)
    expect(s.escapeRight, `rail escapes the right edge of ${where}`).toBeLessThanOrEqual(1)
    // The layout tier is what keeps the cutline readable beside the photos, so
    // pin it too — an escape-free rail that ate the whole measure would
    // otherwise pass the check above while still being unreadable.
    expect(s.isStrip, `rail layout tier is wrong for ${where}`).toBe(s.slots > RAIL_FLOAT_MAX)
  }
})
