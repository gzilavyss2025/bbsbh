// The Roster card's model (#2316, docs/world-series-scouting.md). Pure. It answers: which section
// a player sits in, whether a pitcher is a starter, and the figures of one stat line.

const DASH = '—'

// STARTER RULE (the mock's inference, not yet confirmed by Gary). October decides first: a pitcher
// who has pitched this postseason is a starter only if he made a start. One with no October game
// yet is a starter if he started more than half his regular-season games.
// `ps` and `rs` are { g, gs } (games, games started), or null when he has none.
export function isStarter({ ps, rs }) {
  if (ps?.g) return ps.gs > 0
  return Boolean(rs?.g) && rs.gs > rs.g / 2
}

const INFIELD = ['1B', '2B', '3B', 'SS', 'IF']
const OUTFIELD = ['LF', 'CF', 'RF', 'OF']
const hitGroup = (pos) => (pos === 'C' ? 'catchers' : INFIELD.includes(pos) ? 'infielders' : OUTFIELD.includes(pos) ? 'outfielders' : 'dh')

const SECTIONS = [
  { id: 'catchers', label: 'Catchers', side: 'hit' },
  { id: 'infielders', label: 'Infielders', side: 'hit' },
  { id: 'outfielders', label: 'Outfielders', side: 'hit' },
  { id: 'dh', label: 'DH and two-way', side: 'hit' },
  { id: 'starters', label: 'Starting pitchers', side: 'pitch' },
  { id: 'relievers', label: 'Relievers', side: 'pitch' },
]

// `roster` is fetchSeriesRoster's { positionPlayers, pitchers } (already in scorebook order);
// `starters` a Set of pitcher ids. -> the six sections in order, each { id, label, side, players }.
export function rosterSections(roster, starters) {
  const groupOf = (p) => (p.position === 'P' ? (starters.has(p.id) ? 'starters' : 'relievers') : hitGroup(p.position))
  const all = [...(roster?.positionPlayers ?? []), ...(roster?.pitchers ?? [])]
  return SECTIONS.map((s) => ({ ...s, players: all.filter((p) => groupOf(p) === s.id) }))
}

// The stat groups a player's line reads: a two-way player gets both.
export function lineGroups(position) {
  if (position === 'TWP') return ['hitting', 'pitching']
  return position === 'P' ? ['pitching'] : ['hitting']
}

const shown = (v) => (v == null || v === '' ? DASH : String(v))

// One stat object (the API's own, or aggregateSplits' sum) -> { cells: [{ label, value, lead }] },
// or null when he has no games in it. Every figure is text; a missing one is a dash.
export function statLine(stat, group) {
  if (!stat?.gamesPlayed) return null
  const s = stat
  if (group === 'pitching') {
    return {
      cells: [
        { label: 'ERA', value: shown(s.era), lead: true },
        { label: 'WHIP', value: shown(s.whip) },
        { label: 'IP', value: shown(s.inningsPitched) },
        { label: 'SO', value: shown(s.strikeOuts) },
        { label: 'W-L', value: s.wins != null && s.losses != null ? `${s.wins}-${s.losses}` : DASH },
        { label: 'SV', value: shown(s.saves) },
      ],
    }
  }
  return {
    cells: [
      { label: 'AVG', value: shown(s.avg) },
      { label: 'OBP', value: shown(s.obp) },
      { label: 'SLG', value: shown(s.slg) },
      { label: 'OPS', value: shown(s.ops), lead: true },
      { label: 'HR', value: shown(s.homeRuns) },
      { label: 'RBI', value: shown(s.rbi) },
    ],
  }
}
