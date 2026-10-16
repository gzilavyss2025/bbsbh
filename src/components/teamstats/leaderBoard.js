import { computeLeaders } from '../../api/teamLeaders.js'

// The pure half of TeamLeaders.jsx (a node test cannot import a .jsx file).

// Competition ("1224") ranking with tie flags, keyed off the numeric `value`
// each entry already carries — so ties surface identically on the live and the
// precomputed (all-minors) boards without regenerating the static JSON. For each
// entry: its rank is the 1-based position of the FIRST entry sharing its value,
// and `tie` is true when 2+ entries share that value (the displayed rank then
// gets a "T" prefix — a three-way tie at the top reads "T1", "T1", "T1", and the
// next player is rank 4). Exact numeric equality only (two ".302"s that differ at
// the 4th decimal are NOT a tie; equal values tie regardless of formatting).
export function displayRanks(entries) {
  return entries.map((e, i) => {
    let first = i
    while (first > 0 && entries[first - 1].value === e.value) first -= 1
    let last = i
    while (last < entries.length - 1 && entries[last + 1].value === e.value) last += 1
    const tie = last > first
    return { rank: first + 1, tie, text: `${tie ? 'T' : ''}${first + 1}` }
  })
}

// Each category with its ranked rows. `precomputed` is a { categoryKey: entries[] } map of
// ALREADY-RANKED rows (the static all-minors and postseason boards), cut to `limit`; else the
// pool is ranked live. A category with no qualifying players (thin MiLB data) is hidden
// rather than rendered empty.
export function rankedCategories({ pool, categories, limit, qualifier, precomputed }) {
  return categories
    .map((category) => ({
      category,
      entries: precomputed
        ? (precomputed[category.key] ?? []).slice(0, limit)
        : computeLeaders(pool, category, { limit, qualifier }),
    }))
    .filter((r) => r.entries.length > 0)
}

// How one row looks. Rank 1 leads (the field wash, the marker rank pill). The reader's own club
// is "mine" (the ink tint, ADR-0030), and wins on rank 1: a highlight the reader asked for must
// show, and a state is one word. `filtering` (the team filter has an explicit pick) dims every
// OTHER club's row with a caller class; the pick supersedes the favorite while it is active, so
// the page passes the picked club as `favoriteTeamId`.
export function rowLook({ index, isFavorite = false, filtering = false }) {
  const classes = ['tlead__row']
  if (filtering && !isFavorite) classes.push('tlead__row--dim')
  return { state: isFavorite ? 'mine' : index === 0 ? 'lead' : undefined, className: classes.join(' ') }
}
