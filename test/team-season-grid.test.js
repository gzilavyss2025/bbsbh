import test from 'node:test'
import assert from 'node:assert/strict'

// The Games band's season grid (games/seasonGrid.js): the schedule as weeks of seven days.
const { buildSeasonGrid, filterOptions, gameState, matchesFilter, GRID_DAYS } = await import(
  '../src/screens/team/next/games/seasonGrid.js'
)

let pk = 1
const game = (apiDate, over = {}) => ({
  gamePk: pk++,
  apiDate,
  gameNumber: 1,
  gameType: 'R',
  round: '',
  doubleHeader: 'N',
  isHome: true,
  away: { abbreviation: 'NYY' },
  home: { abbreviation: 'TB' },
  opponent: { id: 147, name: 'New York Yankees', abbreviation: 'NYY' },
  won: true,
  runs: 5,
  oppRuns: 2,
  ...over,
})
const cells = (grid) => grid.weeks.flatMap((w) => w.days.flatMap((d) => d.games))

test('no schedule, no grid', () => {
  assert.equal(buildSeasonGrid([], null, '2026-04-01'), null)
  assert.equal(buildSeasonGrid(undefined, null, '2026-04-01'), null)
})

test('weeks run Monday to Sunday and cover the first game to the last', () => {
  // 2026-03-26 is a Thursday, 2026-04-08 a Wednesday: three weeks, the first Monday 03-23.
  const grid = buildSeasonGrid([game('2026-03-26'), game('2026-04-08')], null, null)
  assert.equal(GRID_DAYS[0], 'Mon')
  assert.deepEqual(grid.weeks.map((w) => w.key), ['2026-03-23', '2026-03-30', '2026-04-06'])
  assert.ok(grid.weeks.every((w) => w.days.length === 7))
  assert.equal(grid.weeks[0].days[3].date, '2026-03-26')
  assert.equal(grid.weeks[0].days[3].games.length, 1)
})

test('a week names the month whose 1st it holds, and the first week names its own', () => {
  const grid = buildSeasonGrid([game('2026-03-26'), game('2026-05-20')], null, null)
  const labels = grid.weeks.map((w) => w.label)
  assert.equal(labels[0], 'Mar')
  assert.equal(labels[1], 'Apr') // the week of 03-30 holds 04-01
  assert.equal(labels[2], '')
  assert.equal(labels.filter((l) => l === 'May').length, 1)
})

test('a decided game shows its score and opens the box score', () => {
  const [g] = cells(buildSeasonGrid([game('2026-04-10', { runs: 5, oppRuns: 3 })], null, '2026-10-19'))
  assert.equal(g.state, 'w')
  assert.equal(g.score, '5–3')
  assert.equal(g.mark, 'NYY')
  assert.equal(g.path, '/04102026/nyytb/boxscore')
})

test('an away game carries an @ and the away side first in its path', () => {
  const [g] = cells(
    buildSeasonGrid(
      [game('2026-04-10', { isHome: false, away: { abbreviation: 'TB' }, home: { abbreviation: 'NYY' }, won: false, runs: 1, oppRuns: 4 })],
      null,
      null,
    ),
  )
  assert.equal(g.mark, '@NYY')
  assert.equal(g.state, 'l')
  assert.equal(g.path, '/04102026/tbnyy/boxscore')
})

test('a game past the cutoff shows no score and opens the lineup', () => {
  // The loader leaves won, runs and oppRuns null past `?d=`. Nothing here may recover them.
  const cut = game('2026-04-10', { won: null, runs: null, oppRuns: null })
  const [g] = cells(buildSeasonGrid([cut], null, '2026-09-01'))
  assert.equal(g.state, 'todo')
  assert.equal(g.score, '')
  assert.equal(g.path, '/04102026/nyytb/lineup1')
  assert.doesNotMatch(g.label, /won|lost|\d to \d/)
})

test('the page day marks an undecided game as next', () => {
  assert.equal(gameState(game('2026-10-19', { won: null }), '2026-10-19'), 'next')
  assert.equal(gameState(game('2026-10-20', { won: null }), '2026-10-19'), 'todo')
  assert.equal(gameState(game('2026-10-19', { won: true }), '2026-10-19'), 'w')
})

test('a doubleheader is two games in one day, each printing its score, the second linking -2', () => {
  const grid = buildSeasonGrid(
    [
      game('2026-07-17', { gameNumber: 1, doubleHeader: 'S', runs: 0, oppRuns: 10, won: false }),
      game('2026-07-17', { gameNumber: 2, doubleHeader: 'S', runs: 3, oppRuns: 5, won: false }),
    ],
    null,
    null,
  )
  const day = grid.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-07-17')
  assert.equal(day.games.length, 2)
  assert.deepEqual(day.games.map((g) => g.mark), ['0–10', '3–5'])
  assert.ok(day.games.every((g) => g.score === '' && g.doubled))
  assert.equal(day.games[0].path, '/07172026/nyytb/boxscore')
  assert.equal(day.games[1].path, '/07172026/nyytb-2/boxscore')
  assert.equal(grid.doubleHeaders, 1)
})

test('a club with a postseason gets a gold band on its first October week', () => {
  const grid = buildSeasonGrid(
    [game('2026-09-27'), game('2026-10-03', { gameType: 'D', round: 'DS' }), game('2026-10-12', { gameType: 'L', round: 'CS' })],
    null,
    null,
  )
  assert.equal(grid.hasPost, true)
  const lead = grid.weeks.filter((w) => w.postLead)
  assert.equal(lead.length, 1)
  assert.equal(lead[0].key, '2026-09-28') // the week of 10-03
  assert.ok(grid.weeks.find((w) => w.key === '2026-10-12').post)
  assert.equal(grid.weeks.find((w) => w.key === '2026-09-21').post, false)
  assert.ok(cells(grid).find((c) => c.post))
})

test('a club with no postseason has no band, and the grid just ends', () => {
  const grid = buildSeasonGrid([game('2026-09-26'), game('2026-09-27')], null, null)
  assert.equal(grid.hasPost, false)
  assert.ok(grid.weeks.every((w) => !w.post && !w.postLead))
  assert.deepEqual(filterOptions(grid.hasPost).map((o) => o.value), ['all', 'home', 'away', 'wins', 'losses'])
  assert.equal(filterOptions(true).at(-1).value, 'post')
})

test('the All-Star Game takes its own cell on its day', () => {
  const asg = { apiDate: '2026-07-14', away: { id: 159, name: 'American League', abbreviation: 'AL' }, home: { id: 160, name: 'National League', abbreviation: 'NL' } }
  const grid = buildSeasonGrid([game('2026-07-12'), game('2026-07-17')], asg, null)
  const day = grid.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-07-14')
  assert.equal(day.games.length, 1)
  assert.equal(day.games[0].state, 'asg')
  assert.equal(day.games[0].mark, 'ASG')
  assert.equal(day.games[0].path, '/07142026/alnl/lineup1')
})

test('filters fade what they do not match and never touch the All-Star cell as a home game', () => {
  const grid = buildSeasonGrid(
    [
      game('2026-04-10', { isHome: true }),
      game('2026-04-11', { isHome: false, won: false, runs: 1, oppRuns: 2 }),
      game('2026-10-03', { gameType: 'D' }),
    ],
    { apiDate: '2026-07-14', away: { name: 'AL', abbreviation: 'AL' }, home: { name: 'NL', abbreviation: 'NL' } },
    null,
  )
  const all = cells(grid)
  const [home, away, asg, post] = [all[0], all[1], all.find((c) => c.state === 'asg'), all.find((c) => c.post)]
  assert.ok(all.every((c) => matchesFilter(c, 'all')))
  assert.ok(matchesFilter(home, 'home') && !matchesFilter(away, 'home'))
  assert.ok(matchesFilter(away, 'away') && !matchesFilter(home, 'away'))
  assert.ok(!matchesFilter(asg, 'home') && !matchesFilter(asg, 'away'))
  assert.ok(matchesFilter(home, 'wins') && !matchesFilter(away, 'wins'))
  assert.ok(matchesFilter(away, 'losses') && !matchesFilter(home, 'losses'))
  assert.ok(matchesFilter(post, 'post') && !matchesFilter(home, 'post'))
})
