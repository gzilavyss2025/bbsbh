import { test, expect } from './fixtures.js'

// The Box Lines sheet (ADR-0069): the lineup page's "Career vs MIL" line is a
// door; behind it are the game-by-game rows, each dated strictly BEFORE the
// game being scored, each carrying a final score and a box-score link.
//
// Anchor game: 2026-06-27 CHC @ MIL (gamePk 823770), David Peterson's start
// against the Brewers. lineup2 is the Brewers' page, whose Starting pitcher
// card shows the CUBS' arm — him. Opening it for THAT game is the
// spoiler case the unit suite pins in the pure module: the June 27 row is the
// game being scored and must not exist, while the six earlier meetings show.
// Peterson's line only renders while he is on an MLB active roster (the
// nightly vs-team-splits file's scope), so the door assertion is skipped
// rather than failed when the line is absent — the row-date invariant is what
// this spec exists to hold, and it holds vacuously with no door.
const GAME = '/06272026/chcmil/lineup2'
const CUTOFF = '2026-06-27'

test('the career line opens Box Lines, and no row is dated on or after the scored game', async ({ page }) => {
  await page.goto(GAME)
  const door = page.getByRole('button', { name: /Career vs MIL/ })
  // The line rides the deferred enrichment tier (useGameData), so give it a
  // real chance to land before deciding it is absent.
  await door.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await door.count()) === 0) {
    test.skip(true, 'the opposing starter has no career line on file today')
    return
  }
  await door.click()

  const sheet = page.getByRole('dialog', { name: /vs the Brewers/ })
  await expect(sheet).toBeVisible()
  // The headline is the door's own text, verbatim.
  await expect(sheet.locator('.boxlines__headline')).toHaveText(await door.locator('span').first().textContent())

  // Rows land (or the sheet says why not); either way every row that exists
  // is dated before the cutoff and links to a box score.
  const rows = sheet.locator('.boxline:not(.boxline--skel)')
  // Wait for the fetch to FINISH, which is the skeletons going away — not for
  // any .boxlines__hint, which is also the class on the "Pulling his game
  // lines…" LOADING hint. Polling on the hint exits the wait while the sheet
  // is still loading: a pitcher's 3 requests beat it, a hitter's 30 do not,
  // so this read as a pass on the lineup page and a 0-row failure here.
  await expect
    .poll(async () => (await sheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const n = await rows.count()
  for (let i = 0; i < n; i++) {
    const href = await rows.nth(i).locator('a').getAttribute('href')
    expect(href).toMatch(/^\/(\d{8})\/[a-z]+(-\d)?\/boxscore$/)
    // MMDDYYYY in the path → YYYY-MM-DD, compared as strings.
    const [, mmddyyyy] = href.match(/^\/(\d{8})\//)
    const iso = `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`
    expect(iso < CUTOFF, `row ${i} is dated ${iso}, not before ${CUTOFF}`).toBe(true)
    // The score cell names both clubs, his first.
    await expect(rows.nth(i).locator('.boxline__score')).toHaveText(/^[A-Z]{2,3} \d+, [A-Z]{2,3} \d+$/)
  }

  // Escape closes it and focus returns to the door.
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(door).toBeFocused()
})

// The SECOND DOOR (issue #1007): the player page's Splits vs team card. Same
// sheet, same rows, a hitter this time — and an OPEN surface, so the career
// aggregate above the door is whole while the rows below it still stop where
// the page's own `?d=` says (ADR-0034: an open surface gains no seal; the
// cutoff it is handed is the only thing that trims it).
//
// Anchor: Christian Yelich vs the Cubs. His card is built from the nightly
// vs-team-splits file, which only carries players on an MLB active roster, so
// an absent card skips rather than fails — the same rule the lineup test uses.
const YELICH = '/player/christian-yelich-592885/stats'
const PLAYER_CUTOFF = '2026-06-27'

test('the player page opens the same sheet, and the page cutoff trims its rows', async ({ page }) => {
  await page.goto(`${YELICH}?d=${PLAYER_CUTOFF}`)
  const card = page.locator('.vsteam')
  await card.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await card.count()) === 0) {
    test.skip(true, 'this player has no vs-team card on file today')
    return
  }

  // Pick the Cubs rather than trusting the card's pre-selection, which follows
  // his club's next opponent and moves with the schedule.
  const cubs = card.locator('.vsteam__team[title="Chicago Cubs"]')
  await cubs.click()
  const door = page.locator('.vsteam__door')
  await expect(door).toBeVisible()
  const label = (await door.locator('span').first().textContent()).trim()
  expect(label).toMatch(/^Career vs CHC: \d+ G, /)
  await door.click()

  const sheet = page.getByRole('dialog', { name: /vs the Cubs/ })
  await expect(sheet).toBeVisible()
  // The headline is the door's own line, verbatim — the whole reason one
  // helper words both doors (api/vsTeamSplits.js `vsTeamDoorLabel`).
  await expect(sheet.locator('.boxlines__headline')).toHaveText(label)

  const rows = sheet.locator('.boxline:not(.boxline--skel)')
  // Wait for the fetch to FINISH, which is the skeletons going away — not for
  // any .boxlines__hint, which is also the class on the "Pulling his game
  // lines…" LOADING hint. Polling on the hint exits the wait while the sheet
  // is still loading: a pitcher's 3 requests beat it, a hitter's 30 do not,
  // so this read as a pass on the lineup page and a 0-row failure here.
  await expect
    .poll(async () => (await sheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    const href = await rows.nth(i).locator('a').getAttribute('href')
    expect(href).toMatch(/^\/(\d{8})\/[a-z]+(-\d)?\/boxscore$/)
    const [, mmddyyyy] = href.match(/^\/(\d{8})\//)
    const iso = `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`
    expect(iso < PLAYER_CUTOFF, `row ${i} is dated ${iso}, not before ${PLAYER_CUTOFF}`).toBe(true)
    await expect(rows.nth(i).locator('.boxline__score')).toHaveText(/^[A-Z]{2,3} \d+, [A-Z]{2,3} \d+$/)
  }

  // Close, then pick another club he has faced: the door is keyed on the club,
  // so it comes back closed and wearing the new club's line. (The strip is
  // behind the scrim while the sheet is open — closing first is the only way a
  // reader can reach it, and the key is what makes the two agree afterwards.)
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(door).toBeFocused()
  await card.locator('.vsteam__team:not(.is-active):not(.is-empty)').first().click()
  await expect(door).not.toHaveText(label)
  await expect(page.locator('.boxlines')).toHaveCount(0)
})

// THE GAME LINES CARD and its twenty-odd doors (#1000, #1003, #1004, #1005,
// #1006, and #999/#1001/#1002 for the calendar and the bench). #997 shipped the
// card empty; every door since is one registry entry.
//
// It is the same sheet, gated the same way, but a facet is a PREDICATE over
// finished rows rather than a club filter on the log, so what this pins is that
// the predicate actually discriminates: every row behind the Home door says
// "vs", never "@". A facet whose kind were misspelled keeps nothing and shows
// an empty ledger in silence, which is why a row count is asserted every time.
//
// Doors are found by their LABEL, never by index: they are grouped under four
// headings now, so an index says nothing about which door it is and a new door
// in an earlier section would silently move every assertion below it.
const PETERSON = '/player/david-peterson-656849/stats'

test('the Game lines card opens a facet sheet, and the facet actually narrows', async ({ page }) => {
  await page.goto(`${PETERSON}?d=${PLAYER_CUTOFF}`)
  const card = page.locator('.gamelines')
  await card.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await card.count()) === 0) {
    test.skip(true, 'this player has no MLB situational splits on file today')
    return
  }
  // The four headings, in the card's own order. A heading with no door under it
  // does not render, so their presence also says every section has doors.
  await expect(card.locator('.gamelines__heading')).toHaveText([
    'Where',
    'When',
    'How he got in',
    'When it counted',
  ])

  // A pitcher who has reached October and pitched in every month gets seventeen
  // ledger doors — Home, Road, On grass, On turf, Day, Night, eight months,
  // Started, In relief, Postseason — plus seven weekday CHIPS, which are a
  // separate class because they are a comparison rather than a stack of lines.
  // MiLB service returns no rows for these codes and a door with no career row
  // drops out on its own, so this also says he is being read as a major
  // leaguer. He gets no lineup pair: a pitcher is never on the batting card.
  const doors = card.locator('.gamelines__door')
  await expect(doors).toHaveCount(17)
  await expect(card.locator('.gamelines__chip')).toHaveCount(7)

  const home = card.getByRole('button', { name: /^Home: / })
  const label = (await home.locator('span').first().textContent()).trim()
  expect(label).toMatch(/^Home: \d+ G, /)
  await home.click()

  const sheet = page.getByRole('dialog', { name: /at home/ })
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('.boxlines__kicker')).toHaveText('Game lines · at home')
  await expect(sheet.locator('.boxlines__headline')).toHaveText(label)

  await expect
    .poll(async () => (await sheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const rows = sheet.locator('.boxline:not(.boxline--skel)')
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    // THE FACET. Home rows say "vs"; a road row would say "@". The door's
    // figure and this count come from two different MLB pipelines and differ
    // by a handful of relocated games (ADR-0069), so the COUNT is not asserted
    // against the label — what every row is, is.
    await expect(rows.nth(i).locator('.boxline__where')).toHaveText(/^vs /)
    const href = await rows.nth(i).locator('a').getAttribute('href')
    const [, mmddyyyy] = href.match(/^\/(\d{8})\//)
    const iso = `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`
    expect(iso < PLAYER_CUTOFF, `row ${i} is dated ${iso}, not before ${PLAYER_CUTOFF}`).toBe(true)
  }

  // The internal name never reaches the reader — not on the card, not in the
  // sheet it opened. (Rendered text, not page HTML: the dev server serves
  // boxlines.css with its own comments, and that file opens "BOX LINES".)
  expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('box line')

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(home).toBeFocused()

  // The sibling door asks the opposite question of the SAME memoized join, so
  // it costs no request and must come back with the other half of the games.
  const road = card.getByRole('button', { name: /^Road: / })
  await road.click()
  const roadSheet = page.getByRole('dialog', { name: /on the road/ })
  await expect(roadSheet).toBeVisible()
  await expect
    .poll(async () => (await roadSheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const roadRows = roadSheet.locator('.boxline:not(.boxline--skel)')
  await expect(roadRows.first().locator('.boxline__where')).toHaveText(/^@ /)
  expect(await roadRows.count()).toBeGreaterThan(0)

  await page.keyboard.press('Escape')

  // THE POSTSEASON DOOR (#1006) is the one that does not share that join: its
  // rows are not the regular season, so it asks statsapi a question of its own.
  // What this pins is the half a unit test cannot reach — that the live call
  // comes back with rounds rather than the umbrella 'P'. Asked the wrong way a
  // PITCHING log labels every row 'P', the type filter drops all of them, and
  // this door opens on an empty ledger while the six beside it stay full.
  const postseason = card.getByRole('button', { name: /^Postseason: / })
  expect((await postseason.locator('span').first().textContent()).trim()).toMatch(/^Postseason: \d+ G, /)
  await postseason.click()
  const postSheet = page.getByRole('dialog', { name: /in the postseason/ })
  await expect(postSheet).toBeVisible()
  await expect(postSheet.locator('.boxlines__kicker')).toHaveText('Game lines · postseason')
  await expect
    .poll(async () => (await postSheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const postRows = postSheet.locator('.boxline:not(.boxline--skel)')
  const postN = await postRows.count()
  expect(postN).toBeGreaterThan(0)
  for (let i = 0; i < postN; i++) {
    // Every row wears its round, and only the four real ones exist.
    await expect(postRows.nth(i).locator('.boxline__series')).toHaveText(/^(WC|DS|LCS|WS)$/)
  }
})


// THE CALENDAR DOORS (#999, #1001). A month and a weekday are the only facets
// whose door figure and row count agree EXACTLY — a relocated home game moves a
// park, it does not move a Tuesday — but what this pins is the half a unit test
// cannot reach: that the predicate lands on the same date the LABEL claims. A
// month door whose sitCode and facet drifted apart (asks MLB about August,
// filters rows for September) still renders a plausible-looking sheet, and only
// a live row's date says otherwise.
test('a month door and a weekday chip each keep only their own dates', async ({ page }) => {
  await page.goto(`${PETERSON}?d=${PLAYER_CUTOFF}`)
  const card = page.locator('.gamelines')
  await card.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await card.count()) === 0) {
    test.skip(true, 'this player has no MLB situational splits on file today')
    return
  }

  // JULY. Every row behind it is dated in month 07, whatever the year.
  const july = card.getByRole('button', { name: /^July: / })
  await july.click()
  const julySheet = page.getByRole('dialog', { name: /in July/ })
  await expect(julySheet.locator('.boxlines__kicker')).toHaveText('Game lines · in July')
  await expect
    .poll(async () => (await julySheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const julyRows = julySheet.locator('.boxline:not(.boxline--skel)')
  const julyN = await julyRows.count()
  expect(julyN).toBeGreaterThan(0)
  for (let i = 0; i < julyN; i++) {
    const href = await julyRows.nth(i).locator('a').getAttribute('href')
    expect(href.slice(1, 3), `row ${i} is not a July game`).toBe('07')
  }
  await page.keyboard.press('Escape')

  // SUNDAY, as a chip. Its visible text is short; its accessible name is the
  // whole career line, which is also the sheet's headline — the chip and the
  // sheet read one stat object two ways and cannot disagree about the career.
  const sunday = card.getByRole('button', { name: /^Sundays: / })
  await expect(sunday).toHaveClass(/gamelines__chip/)
  await expect(sunday.locator('.boxlines-door__chipname')).toHaveText(/^Sun/)
  const sundayLabel = await sunday.getAttribute('aria-label')
  await sunday.click()
  const sundaySheet = page.getByRole('dialog', { name: /on Sundays/ })
  await expect(sundaySheet.locator('.boxlines__kicker')).toHaveText('Game lines · on Sundays')
  await expect(sundaySheet.locator('.boxlines__headline')).toHaveText(sundayLabel)
  await expect
    .poll(async () => (await sundaySheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const sundayRows = sundaySheet.locator('.boxline:not(.boxline--skel)')
  const sundayN = await sundayRows.count()
  expect(sundayN).toBeGreaterThan(0)
  for (let i = 0; i < sundayN; i++) {
    const href = await sundayRows.nth(i).locator('a').getAttribute('href')
    // MMDDYYYY in the path. Parsed at midday UTC, the same construction the
    // facet uses, so no timezone can move a game a day in either place.
    const [, mm, dd, yyyy] = href.match(/^\/(\d{2})(\d{2})(\d{4})\//)
    const day = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12)).getUTCDay()
    expect(day, `row ${i} (${yyyy}-${mm}-${dd}) is not a Sunday`).toBe(0)
  }
})

// THE PINCH-HIT DOOR (#1002). A hitter only, and the one door on the card whose
// rows MLB publishes no per-game list for: the label is MLB's `pH` career
// aggregate, the rows are the hitting game log's own `positionsPlayed`. The
// issue costed this at one boxscore per candidate game behind a 40-row cap;
// it costs neither, so what this pins is that the free path really does answer
// — a door that opened on an empty ledger would be the silent failure.
test('a hitter gets a pinch-hitting door, and a pitcher does not', async ({ page }) => {
  await page.goto(`${YELICH}?d=${PLAYER_CUTOFF}`)
  const card = page.locator('.gamelines')
  await card.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await card.count()) === 0) {
    test.skip(true, 'this player has no MLB situational splits on file today')
    return
  }
  // No RELIEF door for a hitter: `rp` is a pitching situation. He does get a
  // Started door, but it is the lineup one (#1003) and it prints a games-only
  // line, which the lineup test below pins.
  await expect(card.getByRole('button', { name: /^In relief: / })).toHaveCount(0)

  const pinch = card.getByRole('button', { name: /^Pinch hitting: / })
  const label = (await pinch.locator('span').first().textContent()).trim()
  expect(label).toMatch(/^Pinch hitting: \d+ G, /)
  await pinch.click()

  const sheet = page.getByRole('dialog', { name: /as a pinch hitter/ })
  await expect(sheet.locator('.boxlines__kicker')).toHaveText('Game lines · pinch hitting')
  await expect(sheet.locator('.boxlines__headline')).toHaveText(label)
  await expect
    .poll(async () => (await sheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  const rows = sheet.locator('.boxline:not(.boxline--skel)')
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  // The foot says what a row here is, because this facet's rule is not obvious
  // from the rows themselves.
  await expect(sheet.locator('.boxlines__foot')).toContainText('pinch hitter')
  for (let i = 0; i < n; i++) {
    const href = await rows.nth(i).locator('a').getAttribute('href')
    const [, mmddyyyy] = href.match(/^\/(\d{8})\//)
    const iso = `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`
    expect(iso < PLAYER_CUTOFF, `row ${i} is dated ${iso}, not before ${PLAYER_CUTOFF}`).toBe(true)
  }

  // A pinch-hit sheet is a SUBSET of his games, and a facet that quietly kept
  // everything would be invisible otherwise: his Home door alone holds more.
  await page.keyboard.press('Escape')
  const home = card.getByRole('button', { name: /^Home: / })
  await home.click()
  const homeSheet = page.getByRole('dialog', { name: /at home/ })
  await expect
    .poll(async () => (await homeSheet.locator('.boxline--skel').count()) === 0, { timeout: 30_000 })
    .toBe(true)
  expect(await homeSheet.locator('.boxline:not(.boxline--skel)').count()).toBeGreaterThan(n)
})

// THE LINEUP DOORS (#1003's hitter half). The issue sat open on the belief that
// MLB publishes no started/substitute split for a hitter. That is true of all
// 602 SITUATION codes and not true of the fielding career, whose rows carry
// `gamesStarted` — so these two doors print a game count and nothing else,
// which is the one thing on this card that does not look like every other door.
// Their rows come from the schedule's own lineups, fetched by a second pass
// that only these two doors trigger.
test('a hitter gets lineup doors that count games, and a pitcher gets none', async ({ page }) => {
  await page.goto(`${YELICH}?d=${PLAYER_CUTOFF}`)
  const card = page.locator('.gamelines')
  await card.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await card.count()) === 0) {
    test.skip(true, 'this player has no MLB situational splits on file today')
    return
  }

  // A GAMES-ONLY LINE. The fielding career carries no batting average, so these
  // two read "1,672 G" where every neighbour reads five figures. A door that
  // printed the usual line here would be printing four `undefined`s.
  const started = card.getByRole('button', { name: /^Started: / })
  const cameIn = card.getByRole('button', { name: /^Came in: / })
  const startedLabel = (await started.locator('span').first().textContent()).trim()
  const cameInLabel = (await cameIn.locator('span').first().textContent()).trim()
  expect(startedLabel).toMatch(/^Started: \d+ G$/)
  expect(cameInLabel).toMatch(/^Came in: \d+ G$/)

  await cameIn.click()
  const sheet = page.getByRole('dialog', { name: /off the bench/ })
  await expect(sheet.locator('.boxlines__kicker')).toHaveText('Game lines · off the bench')
  await expect(sheet.locator('.boxlines__headline')).toHaveText(cameInLabel)
  await expect
    .poll(async () => (await sheet.locator('.boxline--skel').count()) === 0, { timeout: 60_000 })
    .toBe(true)
  const benchRows = sheet.locator('.boxline:not(.boxline--skel)')
  const bench = await benchRows.count()
  expect(bench).toBeGreaterThan(0)
  await expect(sheet.locator('.boxlines__foot')).toContainText('after the first pitch')
  for (let i = 0; i < bench; i++) {
    const href = await benchRows.nth(i).locator('a').getAttribute('href')
    const [, mmddyyyy] = href.match(/^\/(\d{8})\//)
    const iso = `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`
    expect(iso < PLAYER_CUTOFF, `row ${i} is dated ${iso}, not before ${PLAYER_CUTOFF}`).toBe(true)
  }

  // The two doors partition his career, so a regular's bench sheet is the small
  // one. A facet that kept everything, or nothing, fails here rather than
  // rendering a plausible-looking ledger.
  await page.keyboard.press('Escape')
  await started.click()
  const startSheet = page.getByRole('dialog', { name: /in the starting lineup/ })
  await expect
    .poll(async () => (await startSheet.locator('.boxline--skel').count()) === 0, { timeout: 60_000 })
    .toBe(true)
  expect(await startSheet.locator('.boxline:not(.boxline--skel)').count()).toBeGreaterThan(bench)

  // A pitcher is never on the batting card, so he is offered neither door.
  await page.goto(`${PETERSON}?d=${PLAYER_CUTOFF}`)
  const pitcherCard = page.locator('.gamelines')
  await pitcherCard.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await pitcherCard.count()) > 0) {
    await expect(pitcherCard.getByRole('button', { name: /^Came in: / })).toHaveCount(0)
    // His Started door is the PITCHING one, and it carries a full line.
    const pitcherStarted = pitcherCard.getByRole('button', { name: /^Started: / })
    if ((await pitcherStarted.count()) > 0) {
      expect((await pitcherStarted.locator('span').first().textContent()).trim()).toMatch(
        /^Started: \d+ G, .*IP/,
      )
    }
  }
})

// THE SURFACE DOORS. The park as it was THAT SEASON, off the schedule record's
// own fieldInfo — a table of today's parks would put every pre-2019 game at
// Chase Field on the wrong side. Both groups, and the door and the rows agree
// to the game, so this pins the rows against the door's own figure.
test('the surface doors split a career, and the rows never exceed the door', async ({ page }) => {
  for (const who of [YELICH, PETERSON]) {
    await page.goto(`${who}?d=${PLAYER_CUTOFF}`)
    const card = page.locator('.gamelines')
    await card.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    if ((await card.count()) === 0) continue

    const turf = card.getByRole('button', { name: /^On turf: / })
    const grass = card.getByRole('button', { name: /^On grass: / })
    if ((await turf.count()) === 0 || (await grass.count()) === 0) continue
    const turfLabel = (await turf.locator('span').first().textContent()).trim()
    const doorGames = Number(turfLabel.match(/^On turf: (\d+) G/)[1])

    await turf.click()
    const sheet = page.getByRole('dialog', { name: /on turf/ })
    await expect(sheet.locator('.boxlines__kicker')).toHaveText('Game lines · on turf')
    await expect
      .poll(async () => (await sheet.locator('.boxline--skel').count()) === 0, { timeout: 60_000 })
      .toBe(true)
    const turfRows = await sheet.locator('.boxline:not(.boxline--skel)').count()
    expect(turfRows).toBeGreaterThan(0)
    // The gate can drop a row the career aggregate counted (a played game whose
    // schedule row is stuck on Postponed), so the rows may come in under the
    // door. They may never come in OVER it: that would mean the facet kept a
    // game MLB does not count as turf.
    expect(turfRows, `${who}: ${turfRows} turf rows against a door of ${doorGames}`).toBeLessThanOrEqual(doorGames)

    // And turf is the small half of a career spent mostly on grass.
    await page.keyboard.press('Escape')
    await grass.click()
    const grassSheet = page.getByRole('dialog', { name: /on grass/ })
    await expect
      .poll(async () => (await grassSheet.locator('.boxline--skel').count()) === 0, { timeout: 60_000 })
      .toBe(true)
    expect(await grassSheet.locator('.boxline:not(.boxline--skel)').count()).toBeGreaterThan(turfRows)
    await page.keyboard.press('Escape')
  }
})
