// The all-time leaders card (#2785; wireframe approved by Gary 2026-11-05), shaped from the
// franchise-leaders store (api/history/franchiseLeaders.js). Pure: no fetch, no clock.

// Every category, in the order the card draws it. The first five hitting and first four pitching
// are the headline lists the closed card shows; "Show all" adds the rest of each group under them.
const HITTING = [
  ['homeRuns', 'Home runs'],
  ['hits', 'Hits'],
  ['battingAverage', 'Average'],
  ['runsBattedIn', 'RBI'],
  ['stolenBases', 'Stolen bases'],
  ['runs', 'Runs'],
  ['doubles', 'Doubles'],
  ['triples', 'Triples'],
  ['walks', 'Walks'],
  ['onBasePercentage', 'OBP'],
  ['sluggingPercentage', 'SLG'],
  ['onBasePlusSlugging', 'OPS'],
  ['gamesPlayed', 'Games'],
  ['atBats', 'At bats'],
  ['strikeouts', 'Strikeouts'],
]
const PITCHING = [
  ['wins', 'Wins'],
  ['pitchingStrikeouts', 'Strikeouts'],
  ['earnedRunAverage', 'ERA'],
  ['saves', 'Saves'],
  ['inningsPitched', 'Innings'],
  ['walksAndHitsPerInningPitched', 'WHIP'],
  ['gamesStarted', 'Starts'],
  ['completeGames', 'Complete games'],
  ['shutouts', 'Shutouts'],
  ['gamesPitched', 'Games'],
  ['losses', 'Losses'],
]
const HEADLINE = { hitting: 5, pitching: 4 }
const TOP = 5

// leaders: { career, season }; mode 'career' | 'season'; all: every category or the headline ones.
// -> [{ key: 'hitting'|'pitching', label, lists: [{ key, label, rows: [{ rank, id, name, value, season }] }] }]
// The store's rank is kept, so tied rows share one. A category the store lacks is left out, and a
// group with no list is too.
export function leadersView(leaders, mode, all) {
  const book = leaders?.[mode] ?? {}
  return [
    ['hitting', 'Hitting', HITTING],
    ['pitching', 'Pitching', PITCHING],
  ]
    .map(([key, label, cats]) => ({
      key,
      label,
      lists: (all ? cats : cats.slice(0, HEADLINE[key]))
        .filter(([k]) => book[k]?.length)
        .map(([k, l]) => ({
          key: k,
          label: l,
          rows: book[k].slice(0, TOP).map((e) => ({ rank: e.rank, id: e.id, name: e.name, value: e.value, season: e.season ?? null })),
        })),
    }))
    .filter((g) => g.lists.length)
}

export const CATEGORY_COUNT = HITTING.length + PITCHING.length
