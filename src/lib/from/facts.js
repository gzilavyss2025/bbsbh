// The numbers on a place page (#1526, SPEC §7.4). A player is a [id, name, pos, debutYear] tuple.
// Everything here is a count or a year taken from the list itself: nothing reads a game.
const decadeOf = (year) => Math.floor(year / 10) * 10
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// -> [{ decade, players }], the newest decade first. Inside a decade the newest debut comes first,
// then the name (and the id, so a rerun agrees).
export function decadeGroups(players) {
  const by = new Map()
  for (const p of players) {
    const d = decadeOf(p[3])
    if (!by.has(d)) by.set(d, [])
    by.get(d).push(p)
  }
  return [...by]
    .sort(([a], [b]) => b - a)
    .map(([decade, list]) => ({ decade, players: list.sort((a, b) => b[3] - a[3] || cmp(a[1], b[1]) || a[0] - b[0]) }))
}

const isPitcher = (p) => p[2] === 'P' || p[2] === 'TWP'

// -> the figures of the hero. `tile` is the second tile: the busiest decade, or the span when no
// decade has more than one player (and there is more than one decade). A tie for busiest goes to
// the newer decade. Pitchers are `P` and `TWP`; everyone else, an unknown position `X` too, is a
// hitter.
export function placeFacts(players) {
  if (!players.length) return null
  const groups = decadeGroups(players)
  const years = players.map((p) => p[3])
  const first = Math.min(...years)
  const latest = Math.max(...years)
  const busiest = groups.reduce((best, g) => (g.players.length > best.players.length ? g : best), groups[0])
  const everyOne = groups.length > 1 && groups.every((g) => g.players.length === 1)
  const pitchers = players.filter(isPitcher).length
  return {
    count: players.length,
    first,
    latest,
    decades: groups.length,
    pitchers,
    hitters: players.length - pitchers,
    newest: { year: latest, n: players.filter((p) => p[3] === latest).length },
    tile: everyOne
      ? { label: 'Span', value: latest - first, caption: 'Years, first debut to latest' }
      : { label: 'Busiest decade', value: busiest.players.length, caption: `The ${busiest.decade}s` },
  }
}

// "Nashville, TN · College": the line under a place's name (SPEC §3). A missing part is left out.
export function placeSubtitle(kind, { name, city, state, countryName }) {
  const join = (...parts) => parts.filter(Boolean).join(', ')
  if (kind === 'college') return [join(city, state), 'College'].filter(Boolean).join(' · ')
  if (kind === 'high-school') return [join(city, state), 'High school'].filter(Boolean).join(' · ')
  if (kind === 'abroad') return `${join(name, countryName)} · Birthplace`
  return `${join(name, state)} · Birthplace`
}

// Balances cards over `cols` columns, each card going to the column with the fewest rows so far
// (SPEC §9.5). `weight(card)` is its height in rows. -> an array of `cols` arrays, each card keeping
// its place in the original order within its column.
export function balanceColumns(cards, cols, weight) {
  const out = Array.from({ length: Math.max(1, cols) }, () => ({ rows: 0, cards: [] }))
  for (const card of cards) {
    const target = out.reduce((best, c) => (c.rows < best.rows ? c : best), out[0])
    target.cards.push(card)
    target.rows += weight(card)
  }
  return out.map((c) => c.cards)
}
