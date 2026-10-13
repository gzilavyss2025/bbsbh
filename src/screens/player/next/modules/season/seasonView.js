// The Season statistics module's shaping (#1885): which scopes the switch offers, the rows and
// footers each scope shows, the five tiles, and the WAR-vs-league read. Pure. The rows are the
// career register's (api/person/careerRegister.js: 2 TM subtotals, gap rows, the MLB and MiLB
// footers); a scope only filters them.
import { aggregateSplits, hitterTiles, pitcherTiles } from '../../../../../api/person.js'
import { rateText } from '../../../../../lib/math/leagueAverages.js'

const SCOPES = [
  { id: 'mlb', label: 'MLB' },
  { id: 'milb', label: 'Minors' },
  { id: 'all', label: 'All' },
  { id: 'post', label: 'Postseason' },
]

// The register's rows with the club cell filled: the 2 TM label, else the abbreviations.
export function withTeams(register, abbrevs) {
  const team = (r) => r.teamLabel || r.teamIds.map((id) => abbrevs[id]).filter(Boolean).join('/')
  return { ...register, rows: register.rows.map((r) => ({ ...r, team: team(r) })) }
}

export function scopesOf(register, post) {
  const rows = register?.rows ?? []
  const mlb = rows.some((r) => r.tier === 'mlb')
  const milb = rows.some((r) => r.tier === 'milb')
  const has = { mlb, milb, all: mlb && milb, post: Boolean(post?.rows?.length) }
  return SCOPES.filter((s) => has[s.id])
}

// A gap year before the MLB debut belongs to the minors; one after it, to the majors.
function gapScope(row, firstMlb) {
  return firstMlb == null || Number(row.year) < firstMlb ? 'milb' : 'mlb'
}

function rowOf(r) {
  return {
    key: r.key,
    year: String(r.year),
    tier: r.tier,
    className: [`reg-${r.tier === 'gap' ? 'gap' : r.tier}`, r.subtotal && 'reg-subtotal'].filter(Boolean).join(' '),
    team: r.team || '',
    pill: r.pill || '',
    gap: Boolean(r.gap),
    note: r.note,
    subtotal: Boolean(r.subtotal),
    // The season WAR sits on one row per MLB year: its single club row or its subtotal.
    compare: r.tier === 'mlb' && Boolean(r.seasonLead),
    cells: r.cells ?? [],
  }
}

export function tableFor(register, post, scope) {
  if (scope === 'post') {
    return {
      columns: post.columns,
      rows: post.rows.map((r) => rowOf({ ...r, tier: 'mlb' })),
      totals: post.totals.map((t) => ({ label: t.label, cells: t.cells, className: 'reg-mlb' })),
    }
  }
  const firstMlb = register.rows.reduce((y, r) => (r.tier === 'mlb' ? Math.min(y, Number(r.year)) : y), Infinity)
  const first = Number.isFinite(firstMlb) ? firstMlb : null
  const keep = (r) => scope === 'all' || (r.gap ? gapScope(r, first) : r.tier) === scope
  return {
    columns: register.columns,
    rows: register.rows.filter(keep).map(rowOf),
    totals: register.totals
      .filter((t) => scope === 'all' || t.tier === scope)
      .map((t) => ({ label: t.label, cells: t.cells, className: `reg-${t.tier}` })),
  }
}

const EMPTY = {
  milb: (season) => `No ${season} minor-league line yet.`,
  post: (season) => `No ${season} postseason yet.`,
}

// The five tiles for a scope, from that scope's current-season line. `lines` holds the raw stat
// lines ({ mlb, milb, post }); All is the MLB and minor-league lines summed. WAR is an MLB figure.
// ERA is the ink tile for an arm and AVG for a bat (the board).
export function tilesFor({ scope, group, role, lines, war, season }) {
  const pitching = group === 'pitching'
  const stat =
    scope === 'all'
      ? aggregateSplits([lines.mlb, lines.milb].filter(Boolean).map((s) => ({ stat: s })), group, { dedupe: false })
      : lines[scope]
  if (!stat || !(Number(stat.gamesPlayed) > 0)) {
    return { tiles: [], badge: '', empty: (EMPTY[scope] ?? ((y) => `No ${y} line in this scope yet.`))(season) }
  }
  const mlbWar = scope === 'mlb' || scope === 'all' ? war : null
  const made = pitching ? pitcherTiles(stat, role, mlbWar) : hitterTiles(stat, mlbWar)
  const lead = pitching ? 2 : 0
  const badge = {
    mlb: `${season} · MLB`,
    milb: `${season} · Minors`,
    all: `${season} · All levels`,
    post: `${season} postseason · ${stat.gamesPlayed} G`,
  }[scope]
  return {
    tiles: made.map((t, i) => ({ k: t.k, v: t.v, tone: i === lead ? 'ink' : 'plain' })),
    badge,
    empty: '',
  }
}

// The popover behind a season's WAR: that year's AVG (bat) or ERA (arm) against the league's.
// Null when the row or the league has no figure. `last` is the last complete season: a later
// year's league figure is to date.
export function compareView({ row, columns, group, league, last }) {
  const pitching = group === 'pitching'
  const key = pitching ? 'ERA' : 'AVG'
  const mine = row.cells[columns.indexOf(key)]
  const own = parseFloat(mine)
  if (!Number.isFinite(own) || league == null) return null
  const diff = Number((own - league).toFixed(pitching ? 2 : 3))
  const good = pitching ? diff < 0 : diff > 0
  return {
    title: `${row.year} vs league`,
    mineLabel: `Player ${key}`,
    mine,
    lgLabel: `League ${key}`,
    lg: rateText(league, group),
    diff: `${diff < 0 ? '−' : diff > 0 ? '+' : ''}${rateText(Math.abs(diff), group)} ${good ? 'better' : diff === 0 ? 'even' : 'worse'}`,
    good,
    note: [
      last != null && Number(row.year) > last ? 'League figure to date.' : 'Full-season league figure.',
      row.subtotal && 'Both clubs combined.',
      pitching && 'Lower ERA is better.',
    ].filter(Boolean).join(' '),
  }
}
