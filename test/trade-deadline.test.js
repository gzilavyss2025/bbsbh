import assert from 'node:assert/strict'
import test from 'node:test'
import { dedupeTransactions } from '../src/api/teamTransactions.js'
import {
  groupTradeStories,
  seasonMeta,
  SEASONS,
  buildEntryLine,
  buildLevelGamesLine,
  formatHittingLine,
  formatPitchingLine,
  dedupeStatSplits,
} from '../src/api/tradeDeadline.js'

const hasType = (list, type) => list.some((c) => c.type === type)

const BREWERS = { id: 158, name: 'Milwaukee Brewers' }
const ASTROS = { id: 117, name: 'Houston Astros' }
const ROYALS = { id: 118, name: 'Kansas City Royals' }
const RANGERS = { id: 140, name: 'Texas Rangers' }

// Real fixture, verbatim from test/team-transactions.test.js's
// JUL15_MULTI_PLAYER — the Astros' 2026-07-15 2-for-1(+cash) deal for
// Fielder: 4 raw rows sharing one description, one of them a person-less
// mirror copy dedupeTransactions drops.
const MCCULLERS_GORDON_TRADE = [
  {
    id: 930001, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700501, fullName: 'Jadyn Fielder' }, fromTeam: BREWERS, toTeam: ASTROS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
  {
    id: 930002, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
  {
    id: 930003, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700502, fullName: 'Colton Gordon' }, fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
  {
    id: 930004, typeCode: 'TR', date: '2026-07-15', effectiveDate: '2026-07-15',
    person: { id: 700503, fullName: 'Lance McCullers Jr.' }, fromTeam: ASTROS, toTeam: BREWERS,
    description: 'Houston Astros traded RHP Lance McCullers Jr., LHP Colton Gordon and cash to Milwaukee Brewers for OF Jadyn Fielder.',
  },
]

// A plain 1-for-1 trade, logged from both perspectives (the ordinary mirror
// case dedupeTransactions Pass B collapses).
const SIMPLE_MIRROR_TRADE = [
  {
    id: 500001, typeCode: 'TR', date: '2026-07-20', effectiveDate: '2026-07-20',
    person: { id: 800001, fullName: 'Sam Rivera' }, fromTeam: ROYALS, toTeam: BREWERS,
    description: 'Kansas City Royals traded RHP Sam Rivera to Milwaukee Brewers for cash.',
  },
  {
    id: 500001, typeCode: 'TR', date: '2026-07-20', effectiveDate: '2026-07-20',
    fromTeam: BREWERS, toTeam: ROYALS,
    description: 'Kansas City Royals traded RHP Sam Rivera to Milwaukee Brewers for cash.',
  },
]

// Three pairwise TR legs sharing one day and chaining through shared teams
// (Brewers-Astros, Astros-Royals, Royals-Brewers) but each with its OWN
// distinct description — i.e. NOT a single 3-team trade, just three same-day
// deals that happen to share partners. Grouping by (date, description) must
// keep these as three separate stories; an earlier connected-components
// approach incorrectly merged this shape into one story (see the module
// header's account of the real 2022-08-02 deadline-day bug this exact
// pattern caused).
const CHAINED_BUT_UNRELATED_TRADES = [
  {
    id: 600001, typeCode: 'TR', date: '2026-07-25', effectiveDate: '2026-07-25',
    person: { id: 810001, fullName: 'Player A' }, fromTeam: BREWERS, toTeam: ASTROS,
    description: 'Milwaukee Brewers traded RHP Player A to Houston Astros.',
  },
  {
    id: 600002, typeCode: 'TR', date: '2026-07-25', effectiveDate: '2026-07-25',
    person: { id: 810002, fullName: 'Player B' }, fromTeam: ASTROS, toTeam: ROYALS,
    description: 'Houston Astros traded LHP Player B to Kansas City Royals.',
  },
  {
    id: 600003, typeCode: 'TR', date: '2026-07-25', effectiveDate: '2026-07-25',
    person: { id: 810003, fullName: 'Player C' }, fromTeam: ROYALS, toTeam: BREWERS,
    description: 'Kansas City Royals traded 3B Player C to Milwaukee Brewers.',
  },
]

// Two genuinely unrelated same-day trades that share NO team — must stay
// two separate stories.
const TWO_UNRELATED_TRADES = [
  {
    id: 700001, typeCode: 'TR', date: '2026-07-28', effectiveDate: '2026-07-28',
    person: { id: 820001, fullName: 'Player D' }, fromTeam: BREWERS, toTeam: ASTROS,
    description: 'Milwaukee Brewers traded RHP Player D to Houston Astros.',
  },
  {
    id: 700002, typeCode: 'TR', date: '2026-07-28', effectiveDate: '2026-07-28',
    person: { id: 820002, fullName: 'Player E' }, fromTeam: ROYALS, toTeam: RANGERS,
    description: 'Kansas City Royals traded LHP Player E to Texas Rangers.',
  },
]

test('groupTradeStories collapses a real 2-for-1(+cash) trade into one story', () => {
  const deduped = dedupeTransactions(MCCULLERS_GORDON_TRADE)
  const stories = groupTradeStories(deduped)
  assert.equal(stories.length, 1)
  const story = stories[0]
  assert.equal(story.shape, '2-team')
  assert.equal(story.teams.length, 2)

  const astros = story.teams.find((t) => t.teamId === ASTROS.id)
  const brewers = story.teams.find((t) => t.teamId === BREWERS.id)
  assert.equal(astros.sends.length, 2) // McCullers Jr. + Gordon
  assert.deepEqual(astros.sends.map((p) => p.surname).sort(), ['Gordon', 'McCullers Jr.'])
  assert.equal(brewers.sends.length, 1) // Fielder
  assert.equal(brewers.sends[0].surname, 'Fielder')
  // Astros sent cash alongside the players.
  assert.equal(hasType(astros.considerationsOut, 'cash'), true)
  assert.equal(hasType(brewers.considerationsIn, 'cash'), true)
  assert.equal(hasType(brewers.considerationsOut, 'cash'), false)
})

test('groupTradeStories: a plain 1-for-1 mirror trade is one story, cash lands on the right side', () => {
  const deduped = dedupeTransactions(SIMPLE_MIRROR_TRADE)
  const stories = groupTradeStories(deduped)
  assert.equal(stories.length, 1)
  const story = stories[0]
  assert.equal(story.shape, '2-team')
  const royals = story.teams.find((t) => t.teamId === ROYALS.id)
  const brewers = story.teams.find((t) => t.teamId === BREWERS.id)
  assert.equal(royals.sends[0].surname, 'Rivera')
  // "traded to Brewers for cash" — Brewers sent cash back for Rivera.
  assert.equal(hasType(brewers.considerationsOut, 'cash'), true)
  assert.equal(hasType(royals.considerationsIn, 'cash'), true)
})

// Real fixture, verbatim (minus diacritics) from 2023-07-31: a compound
// return spanning a period rather than a comma — "for RHP Josh Roberson.
// International Signing Bonus Pool Space." — proving detection scans the
// whole returned half rather than stopping at the first sentence break.
test('groupTradeStories detects future considerations and international bonus pool space, including a period-separated compound return', () => {
  const CUBS = { id: 112, name: 'Chicago Cubs' }
  const rows = [
    {
      id: 3, typeCode: 'TR', date: '2023-07-31', effectiveDate: '2023-07-31',
      person: { id: 3001, fullName: 'Josh Roberson' }, fromTeam: RANGERS, toTeam: CUBS,
      description:
        'Chicago Cubs traded RHP Manuel Rodriguez, RHP Adrian Sampson and Future Considerations to Texas Rangers for RHP Josh Roberson. International Signing Bonus Pool Space.',
    },
  ]
  const stories = groupTradeStories(rows)
  const cubs = stories[0].teams.find((t) => t.teamId === CUBS.id)
  const rangers = stories[0].teams.find((t) => t.teamId === RANGERS.id)
  assert.equal(hasType(cubs.considerationsOut, 'futureConsiderations'), true)
  assert.equal(hasType(rangers.considerationsIn, 'futureConsiderations'), true)
  assert.equal(hasType(cubs.considerationsIn, 'intlBonus'), true)
  assert.equal(hasType(rangers.considerationsOut, 'intlBonus'), true)
})

// Real fixture, verbatim from 2022-08-01: a draft-pick return naming the
// specific competitive-balance pick.
test('groupTradeStories detects a draft-pick consideration and extracts its CBA pick number', () => {
  const BRAVES = { id: 144, name: 'Atlanta Braves' }
  const rows = [
    {
      id: 4, typeCode: 'TR', date: '2022-08-01', effectiveDate: '2022-08-01',
      person: { id: 4001, fullName: 'Drew Waters' }, fromTeam: BRAVES, toTeam: ROYALS,
      description:
        'Atlanta Braves traded OF Drew Waters, RHP Andrew Hoffmann and 3B CJ Alexander to Kansas City Royals for Draft Pick. CBA Pick # 35.',
    },
  ]
  const stories = groupTradeStories(rows)
  const braves = stories[0].teams.find((t) => t.teamId === BRAVES.id)
  const royals = stories[0].teams.find((t) => t.teamId === ROYALS.id)
  assert.equal(hasType(braves.considerationsIn, 'draftPick'), true)
  assert.equal(braves.considerationsIn.find((c) => c.type === 'draftPick').detail, 'CBA #35')
  assert.equal(hasType(royals.considerationsOut, 'draftPick'), true)
})

// Real fixture, verbatim from 2021-07-30: the row's structured toTeam.name
// is "Cleveland Guardians" (a live join against CURRENT team data — the
// rename happened Nov 2021, months after this trade), but the description
// text, frozen at the time, reads "Cleveland Indians" — a FULL rename
// sharing no substring with the current name at all. Confirmed this used to
// break direction completely: both sides showed cash RECEIVED, cash SENT
// by neither, since the acting team couldn't be resolved.
test('groupTradeStories resolves acting/other correctly across a full team rename (Indians -> Guardians)', () => {
  const CLEVELAND = { id: 114, name: 'Cleveland Guardians' } // current name, per statsapi's live join
  const BRAVES = { id: 144, name: 'Atlanta Braves' }
  const desc = 'Cleveland Indians traded LF Eddie Rosario and cash to Atlanta Braves for 3B Pablo Sandoval.'
  const rows = [
    {
      id: 5, typeCode: 'TR', date: '2021-07-30', effectiveDate: '2021-07-30',
      person: { id: 5001, fullName: 'Eddie Rosario' }, fromTeam: CLEVELAND, toTeam: BRAVES,
      description: desc,
    },
    {
      id: 6, typeCode: 'TR', date: '2021-07-30', effectiveDate: '2021-07-30',
      person: { id: 5002, fullName: 'Pablo Sandoval' }, fromTeam: BRAVES, toTeam: CLEVELAND,
      description: desc,
    },
  ]
  const stories = groupTradeStories(rows)
  assert.equal(stories.length, 1)
  const cleveland = stories[0].teams.find((t) => t.teamId === CLEVELAND.id)
  const braves = stories[0].teams.find((t) => t.teamId === BRAVES.id)
  // Cleveland sent Rosario AND cash; got Sandoval back.
  assert.equal(hasType(cleveland.considerationsOut, 'cash'), true)
  assert.equal(hasType(cleveland.considerationsIn, 'cash'), false)
  assert.equal(hasType(braves.considerationsIn, 'cash'), true)
  assert.equal(hasType(braves.considerationsOut, 'cash'), false)
})

// Real fixture, verbatim from 2023-07-31: team 133's structured `.name` is
// the bare "Athletics" (unlike every other current club, which already
// includes its city), but the description spells it "Oakland Athletics" —
// a superset match a plain equality/startsWith check misses.
test('groupTradeStories resolves acting/other when a club\'s prose name is a superset of its structured name', () => {
  const ATHLETICS = { id: 133, name: 'Athletics' } // statsapi's own bare structured name
  const DIAMONDBACKS = { id: 109, name: 'Arizona Diamondbacks' }
  const rows = [
    {
      id: 7, typeCode: 'TR', date: '2021-07-02', effectiveDate: '2021-07-02',
      person: { id: 5003, fullName: 'Sam Moll' }, fromTeam: DIAMONDBACKS, toTeam: ATHLETICS,
      description: 'Arizona Diamondbacks traded LHP Sam Moll to Oakland Athletics for cash.',
    },
  ]
  const stories = groupTradeStories(rows)
  const diamondbacks = stories[0].teams.find((t) => t.teamId === DIAMONDBACKS.id)
  const athletics = stories[0].teams.find((t) => t.teamId === ATHLETICS.id)
  // "Diamondbacks traded Moll to A's FOR cash" — the A's paid cash.
  assert.equal(hasType(diamondbacks.considerationsIn, 'cash'), true)
  assert.equal(hasType(athletics.considerationsOut, 'cash'), true)
  assert.equal(hasType(athletics.considerationsIn, 'cash'), false)
})

// Real fixture, verbatim from 2021-07-04/07-06: one real trade statsapi
// logged as two independent one-directional records, 2 days apart, with no
// shared description at all — the split-record pattern.
test('groupTradeStories merges a genuine split-record trade pair into one story', () => {
  const PIRATES = { id: 134, name: 'Pittsburgh Pirates' }
  const rows = [
    {
      id: 501007, typeCode: 'TR', date: '2021-07-04', effectiveDate: '2021-07-04',
      person: { id: 6001, fullName: 'Kevin Kramer' }, fromTeam: PIRATES, toTeam: BREWERS,
      description: 'Pittsburgh Pirates traded 3B Kevin Kramer to Milwaukee Brewers.',
    },
    {
      id: 501310, typeCode: 'TR', date: '2021-07-06', effectiveDate: '2021-07-06',
      person: { id: 6002, fullName: 'Nathan Kirby' }, fromTeam: BREWERS, toTeam: PIRATES,
      description: 'Milwaukee Brewers traded LHP Nathan Kirby to Pittsburgh Pirates.',
    },
  ]
  const stories = groupTradeStories(rows)
  assert.equal(stories.length, 1)
  const story = stories[0]
  assert.equal(story.merged, true)
  assert.equal(story.date, '2021-07-04') // the earlier of the two raw dates
  assert.equal(story.cutline.length, 2)
  const pirates = story.teams.find((t) => t.teamId === PIRATES.id)
  const brewers = story.teams.find((t) => t.teamId === BREWERS.id)
  assert.equal(pirates.sends[0].surname, 'Kramer')
  assert.equal(pirates.receives[0].surname, 'Kirby')
  assert.equal(brewers.sends[0].surname, 'Kirby')
  assert.equal(brewers.receives[0].surname, 'Kramer')
})

// Synthetic: Brewers give a player to Astros in TWO separate, genuinely
// unrelated bare trades within the merge window, while Astros give a
// player back to Brewers once — Brewers now has two candidate partners for
// its "gave nothing" side, so neither should merge (an ambiguous match is
// left alone, not guessed at — see mergeSplitRecordPairs' header).
test('groupTradeStories does not merge a split-record candidate that has more than one match', () => {
  const rows = [
    {
      id: 8001, typeCode: 'TR', date: '2026-07-10', effectiveDate: '2026-07-10',
      person: { id: 8101, fullName: 'Prospect One' }, fromTeam: ASTROS, toTeam: BREWERS,
      description: 'Houston Astros traded RHP Prospect One to Milwaukee Brewers.',
    },
    {
      id: 8002, typeCode: 'TR', date: '2026-07-11', effectiveDate: '2026-07-11',
      person: { id: 8102, fullName: 'Prospect Two' }, fromTeam: BREWERS, toTeam: ASTROS,
      description: 'Milwaukee Brewers traded LHP Prospect Two to Houston Astros.',
    },
    {
      id: 8003, typeCode: 'TR', date: '2026-07-12', effectiveDate: '2026-07-12',
      person: { id: 8103, fullName: 'Prospect Three' }, fromTeam: BREWERS, toTeam: ASTROS,
      description: 'Milwaukee Brewers traded 3B Prospect Three to Houston Astros.',
    },
  ]
  const stories = groupTradeStories(rows)
  assert.equal(stories.length, 3)
  assert.ok(stories.every((s) => !s.merged))
})

test('groupTradeStories keeps three same-day trades separate even when they chain through shared teams', () => {
  const stories = groupTradeStories(CHAINED_BUT_UNRELATED_TRADES)
  assert.equal(stories.length, 3)
  assert.ok(stories.every((s) => s.shape === '2-team' && s.teams.length === 2))
})

test('groupTradeStories keeps two unrelated same-day trades separate when they share no team', () => {
  const stories = groupTradeStories(TWO_UNRELATED_TRADES)
  assert.equal(stories.length, 2)
})

test('groupTradeStories shapes a story with 3+ teams when rows genuinely share one description', () => {
  // Synthetic: not seen in real 2021-2026 data (see the module header), but
  // buildTradeStory must still shape correctly if a future description ever
  // names 3+ clubs in one shared sentence.
  const rows = [
    {
      id: 1, typeCode: 'TR', date: '2026-07-29', effectiveDate: '2026-07-29',
      person: { id: 830001, fullName: 'Player X' }, fromTeam: BREWERS, toTeam: ASTROS,
      description: 'Three-way blockbuster.',
    },
    {
      id: 2, typeCode: 'TR', date: '2026-07-29', effectiveDate: '2026-07-29',
      person: { id: 830002, fullName: 'Player Y' }, fromTeam: ASTROS, toTeam: ROYALS,
      description: 'Three-way blockbuster.',
    },
  ]
  const stories = groupTradeStories(rows)
  assert.equal(stories.length, 1)
  assert.equal(stories[0].shape, '3-team')
  assert.equal(stories[0].teams.length, 3)
})

test('groupTradeStories flags isMlb per player from ctx.debutedIds, defaulting to true when absent', () => {
  const desc = 'Milwaukee Brewers traded RHP Veteran Vet to Houston Astros for SS Fresh Prospect.'
  const rows = [
    {
      id: 900001, typeCode: 'TR', date: '2026-07-27', effectiveDate: '2026-07-27',
      person: { id: 900101, fullName: 'Veteran Vet' }, fromTeam: BREWERS, toTeam: ASTROS,
      description: desc,
    },
    {
      id: 900002, typeCode: 'TR', date: '2026-07-27', effectiveDate: '2026-07-27',
      person: { id: 900102, fullName: 'Fresh Prospect' }, fromTeam: ASTROS, toTeam: BREWERS,
      description: desc,
    },
  ]
  const withCtx = groupTradeStories(rows, { debutedIds: new Set([900101]) })
  assert.equal(withCtx.length, 1)
  const brewers = withCtx[0].teams.find((t) => t.teamId === BREWERS.id)
  const astros = withCtx[0].teams.find((t) => t.teamId === ASTROS.id)
  assert.equal(brewers.sends[0].isMlb, true) // Veteran Vet, in debutedIds
  assert.equal(astros.sends[0].isMlb, false) // Fresh Prospect, not in debutedIds

  const withoutCtx = groupTradeStories(rows)
  const brewersNoCtx = withoutCtx[0].teams.find((t) => t.teamId === BREWERS.id)
  assert.equal(brewersNoCtx.sends[0].isMlb, true) // defaults true, no ctx.debutedIds
})

test('groupTradeStories resolves an affiliate-level trade up to its MLB parent orgs', () => {
  // Real fixture, verbatim from the live 2021-07-30 feed: a prospect-only
  // trade logged entirely at the Single-A affiliate level — neither row
  // names an MLB team id anywhere.
  const LAKE_ELSINORE = { id: 103, name: 'Lake Elsinore Storm' }
  const FREDERICKSBURG = { id: 436, name: 'Fredericksburg Nationals' }
  const rows = [
    {
      id: 508420, typeCode: 'TR', date: '2021-07-30', effectiveDate: '2021-07-30',
      person: { id: 672357, fullName: 'Jordy Barley' }, fromTeam: LAKE_ELSINORE, toTeam: FREDERICKSBURG,
      description: 'Lake Elsinore Storm traded SS Jordy Barley to Fredericksburg Nationals.',
    },
  ]
  const affilToOrg = new Map([
    [LAKE_ELSINORE.id, 135], // San Diego Padres
    [FREDERICKSBURG.id, 120], // Washington Nationals
  ])
  const stories = groupTradeStories(rows, { affilToOrg })
  assert.equal(stories.length, 1)
  const teamIds = stories[0].teams.map((t) => t.teamId).sort((a, b) => a - b)
  assert.deepEqual(teamIds, [120, 135])
  const padres = stories[0].teams.find((t) => t.teamId === 135)
  assert.equal(padres.sends[0].surname, 'Barley')
})

test('SEASONS covers 2021-2026 with no gaps, and seasonMeta resolves each', () => {
  const years = SEASONS.map((s) => s.year)
  assert.deepEqual(years, [2021, 2022, 2023, 2024, 2025, 2026])
  for (const year of years) {
    const meta = seasonMeta(year)
    assert.ok(meta.deadlineDate.startsWith(String(year)) || meta.year === year)
    assert.ok(meta.windowStart < meta.deadlineDate)
    assert.ok(meta.deadlineDate <= meta.windowEnd)
  }
  assert.equal(seasonMeta(2099), null)
})

// ---------------------------------------------------------------------------
// Player stat-line formatting — buildEntryLine / buildLevelGamesLine /
// formatHittingLine / formatPitchingLine
// ---------------------------------------------------------------------------

test('buildEntryLine formats a drafted player with round + pick as an ordinal round', () => {
  assert.equal(
    buildEntryLine({ draft: { year: 2023, round: 10, overall: 299 } }),
    '2023 10th Round Pick, #299',
  )
  assert.equal(
    buildEntryLine({ draft: { year: 2025, round: 1, overall: 20 } }),
    '2025 1st Round Pick, #20',
  )
})

test('buildEntryLine omits the pick number when unknown, and falls back to just the year with no round', () => {
  assert.equal(buildEntryLine({ draft: { year: 2022, round: 3 } }), '2022 3rd Round Pick')
  assert.equal(buildEntryLine({ draft: { year: 2022 } }), '2022')
})

test('buildEntryLine reads a signed player as domestic vs. international by birth country', () => {
  assert.equal(buildEntryLine({ signedYear: 2018, birthCountry: 'USA' }), 'Signed 2018')
  assert.equal(buildEntryLine({ signedYear: 2018, birthCountry: 'Puerto Rico' }), 'Signed 2018')
  assert.equal(
    buildEntryLine({ signedYear: 2018, birthCountry: 'Dominican Republic' }),
    'International signee, 2018',
  )
  assert.equal(buildEntryLine({ signedYear: 2018 }), 'Signed 2018')
})

test('buildEntryLine returns null with no draft record and no signing year', () => {
  assert.equal(buildEntryLine({}), null)
})

test('buildLevelGamesLine breaks out multiple levels in low-to-high order, single level has no parenthetical', () => {
  assert.equal(
    buildLevelGamesLine([
      { label: 'A+', games: 54 },
      { label: 'AA', games: 37 },
    ]),
    '91 G (54 G at A+, 37 G at AA)',
  )
  assert.equal(buildLevelGamesLine([{ label: 'AA', games: 91 }]), '91 G at AA')
  assert.equal(buildLevelGamesLine([{ label: 'A+', games: 0 }]), null)
  assert.equal(buildLevelGamesLine([]), null)
})

test('formatHittingLine matches the ".288 AVG, 34 HR, 78 RBI, 33% SO%, 15% BB%" example', () => {
  const line = formatHittingLine({
    avg: 0.288, homeRuns: 34, rbi: 78, strikeOuts: 132, baseOnBalls: 60, plateAppearances: 400,
  })
  assert.equal(line, '.288 AVG, 34 HR, 78 RBI, 33% SO%, 15% BB%')
})

test('dedupeStatSplits drops byDateRange\'s duplicate single-team row', () => {
  const stat = { atBats: 10, hits: 3, gamesPlayed: 3, strikeOuts: 2, inningsPitched: '0.0' }
  const splits = [{ stat }, { stat: { ...stat } }]
  assert.equal(dedupeStatSplits(splits).length, 1)
})

test('dedupeStatSplits drops the team-less multi-team roll-up row, keeping the real per-team stints', () => {
  const padres = { stat: { atBats: 10, hits: 3, gamesPlayed: 3, strikeOuts: 2, inningsPitched: '0.0' }, team: { id: 135 } }
  const pirates = { stat: { atBats: 5, hits: 1, gamesPlayed: 1, strikeOuts: 1, inningsPitched: '0.0' }, team: { id: 134 } }
  const rollup = { stat: { atBats: 15, hits: 4, gamesPlayed: 4, strikeOuts: 3, inningsPitched: '0.0' }, numTeams: 2 }
  const deduped = dedupeStatSplits([padres, pirates, rollup])
  assert.deepEqual(deduped, [padres, pirates])
})

test('dedupeStatSplits leaves a genuine single stint (no team field at all) alone', () => {
  const stat = { atBats: 10, hits: 3, gamesPlayed: 3, strikeOuts: 2, inningsPitched: '0.0' }
  assert.deepEqual(dedupeStatSplits([{ stat }]), [{ stat }])
})

test('formatPitchingLine includes a record for SP, drops it for RP, and shows saves for CL', () => {
  const base = {
    era: 3.15, wins: 9, losses: 6, saves: 2, inningsPitched: '142.0',
    strikeOuts: 144, baseOnBalls: 42, battersFaced: 600,
  }
  assert.equal(formatPitchingLine('SP', base), '3.15 ERA, 9-6, 142.0 IP, 24% SO%, 7% BB%')
  assert.equal(formatPitchingLine('RP', base), '3.15 ERA, 142.0 IP, 24% SO%, 7% BB%')
  assert.equal(formatPitchingLine('CL', base), '3.15 ERA, 2 SV, 142.0 IP, 24% SO%, 7% BB%')
})
