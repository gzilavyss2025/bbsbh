import '../../styles/report/streaks.css'
import { useId, useMemo, useState } from 'react'
import { statsFor, statByKey, findStretches, rankStretches, labelRanks, firstSeason, loadLogs, toGames } from '../../api/streaks/streaks.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { ALL_MLB_TEAM_IDS, PINNED_TEAM_ID, teamAbbr, teamClubName, teamFullName } from '../../lib/teams.js'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { gamePath } from '../../lib/route.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Notice } from '../../components/ui/state/Notice.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

// 7/26: month and day only; the season has its own column.
const shortDate = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const teamClub = (id) => teamClubName(id) || 'them'
const THIS_YEAR = new Date().getFullYear()
const CLUBS = [...ALL_MLB_TEAM_IDS].sort((a, b) => teamFullName(a).localeCompare(teamFullName(b)))
const int = (v, lo, hi, dflt) => {
  const x = Number.parseInt(v, 10)
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt
}

// The picks live in the query so a link loads the same table (Gary, 2026-11-10).
function readQuery(favorite) {
  const q = new URLSearchParams(window.location.search)
  const team = int(q.get('team'), 1, 9999, favorite)
  return {
    team: ALL_MLB_TEAM_IDS.includes(team) ? team : PINNED_TEAM_ID,
    side: q.get('side') === 'against' ? 'against' : 'by',
    stat: statByKey(q.get('stat'), q.get('side') === 'against' ? 'against' : 'by').key,
    n: int(q.get('n'), 1, 20, 5),
    op: ['max', 'top', 'bottom'].includes(q.get('op')) ? q.get('op') : 'min',
    v: int(q.get('v'), 0, 999, 10),
    from: q.get('from') ? int(q.get('from'), 1871, THIS_YEAR, null) : null,
    to: q.get('to') ? int(q.get('to'), 1871, THIS_YEAR, null) : null,
    first: q.get('first') === '1',
    post: q.get('post') === '1',
  }
}

function writeQuery(p) {
  const q = new URLSearchParams({ team: p.team, stat: p.stat, n: p.n, op: p.op, v: p.v })
  if (p.from) q.set('from', p.from)
  if (p.to) q.set('to', p.to)
  if (p.first) q.set('first', '1')
  if (p.post) q.set('post', '1')
  if (p.side === 'against') q.set('side', 'against')
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q}`)
}

function gameHref(teamId, g) {
  const me = teamAbbr({ id: teamId })
  const them = teamAbbr({ id: g.oppId })
  return g.isHome ? gamePath(g.date, them, me, 'boxscore', g.gameNumber) : gamePath(g.date, me, them, 'boxscore', g.gameNumber)
}

// One control: a <label htmlFor>. A `group` field (several controls, or one that can
// unmount) gets a plain caption the group points at with aria-labelledby instead.
function Field({ label, wide = false, group = false, children }) {
  const id = useId()
  const labelId = `${id}-label`
  return (
    <Stack gap="tight" className={`streaks__field${wide ? ' streaks__field--wide' : ''}`}>
      {group
        ? <span className="t-label" id={labelId}>{label}</span>
        : <label className="t-label" htmlFor={id}>{label}</label>}
      {children(id, labelId)}
    </Stack>
  )
}

// A typed season, kept inside [lo, hi]; empty stays null (the default).
const season = (v, lo, hi) => (v === '' ? null : int(v, lo, hi, null))

// Any MLB club, any counting stat: every run of N games in a row at (or under) a total,
// read live from the club's game logs back to its first season. Overlapping windows
// show once, as the best of their run. Not a scoring surface; it opens live (ADR-0034).
export function StreakFinderPage() {
  useDocumentTitle('Streak Finder')
  const { favoriteTeamId } = useFavoriteTeam()
  const fav = ALL_MLB_TEAM_IDS.includes(favoriteTeamId) ? favoriteTeamId : PINNED_TEAM_ID
  const [draft, setDraft] = useState(() => readQuery(fav))
  const [applied, setApplied] = useState(draft)
  const [sort, setSort] = useState({ key: 'total', desc: true })
  const set = (k, val) => setDraft((d) => ({ ...d, [k]: val }))
  const stat = statByKey(applied.stat, applied.side)
  // Switching sides keeps the stat when that side's log carries it, else falls back.
  const setSide = (side) => setDraft((d) => ({ ...d, side, stat: statByKey(d.stat, side).key }))

  const { data: firstData, error: firstError, reload: reloadFirst } = useAsync((signal) => firstSeason(applied.team, signal), [applied.team])
  // If the first-season lookup fails, fall back to 1871 rather than spin; an empty
  // early season costs one small request each.
  const first = firstData ?? (firstError ? 1871 : null)
  const [lo, hi] = [applied.from, applied.to].map((y) => (y == null ? null : int(y, first ?? 1871, THIS_YEAR, null)))
  const from = Math.min(lo ?? first ?? THIS_YEAR, hi ?? THIS_YEAR)
  const to = Math.max(lo ?? first ?? THIS_YEAR, hi ?? THIS_YEAR)
  const [group, field] = stat[applied.side]
  // Keyed on the log, not the stat: a stat switch on the same side reuses it.
  const { loading, error, data: loaded, reload } = useAsync(
    (signal) => (first ? loadLogs(applied.team, group, from, to, applied.post, signal) : Promise.resolve(null)),
    [applied.team, group, from, to, applied.post, first],
  )
  const games = useMemo(() => (loaded ? toGames(loaded.logs, field) : null), [loaded, field])

  const rows = useMemo(() => {
    if (!games) return []
    const ranked = applied.op === 'top' || applied.op === 'bottom'
    const found = labelRanks(ranked
      ? rankStretches(games, { n: applied.n, dir: applied.op, firstOnly: applied.first })
      : findStretches(games, { n: applied.n, op: applied.op, threshold: applied.v, firstOnly: applied.first }),
    applied.op === 'max' || applied.op === 'bottom')
    const byDate = (a, b) => (a.games[0].date < b.games[0].date ? -1 : 1)
    const better = (a, b) => (applied.op === 'max' || applied.op === 'bottom' ? a - b : b - a)
    const sign = sort.desc ? -1 : 1
    if (sort.key === 'date') return found.sort((a, b) => sign * byDate(a, b))
    // Total sorts by rank: the first tap puts rank 1 on top, the lowest for "at most" and "bottom 10".
    return found.sort((a, b) => -sign * better(a.total, b.total) || byDate(a, b))
  }, [games, applied, sort])

  // A header tap sorts by that column, largest first; a second tap flips it (Gary).
  const sortHead = (key, label) => (
    <th className={key === 'date' ? 'season' : 'total'} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button type="button" className="streaks__sorthead" onClick={() => setSort((p) => ({ key, desc: p.key === key ? !p.desc : true }))}>
        {label}<span aria-hidden="true" className="streaks__arrow">{sort.key === key ? (sort.desc ? '▼' : '▲') : ''}</span>
      </button>
    </th>
  )
  const find = (e) => {
    e.preventDefault()
    const from = season(draft.from ?? '', 1871, THIS_YEAR)
    const to = season(draft.to ?? '', 1871, THIS_YEAR)
    const next = from != null && to != null && from > to ? { ...draft, from: to, to: from } : { ...draft, from, to }
    setDraft(next)
    setApplied(next)
    writeQuery(next)
  }
  const name = applied.side === 'against' ? `Against the ${teamFullName(applied.team)}` : teamFullName(applied.team)
  const games_ = `${applied.n} game${applied.n === 1 ? '' : 's'}`
  const what = applied.op === 'top' || applied.op === 'bottom'
    ? `${applied.op === 'top' ? 'Most' : 'Fewest'} ${stat.label}, ${games_}`
    : `${applied.v}${applied.op === 'max' ? ' or fewer' : '+'} ${stat.label}, ${games_}`

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Streak Finder</h1>
      </header>
      <Stack gap="loose">
      <Card frame="stamped" label="Find a streak" className="streaks__search">
      <form onSubmit={find}>
        <Stack gap="snug">
          <Cluster className="streaks__fields">
            <Field label="Club">
              {(id) => (
                <select id={id} value={draft.team} onChange={(e) => set('team', Number(e.target.value))}>
                  {CLUBS.map((t) => <option key={t} value={t}>{teamFullName(t)}</option>)}
                </select>
              )}
            </Field>
            <Field label="Side" wide group>
              {() => (
                <Segmented label="By the club or against it" value={draft.side} onChange={setSide}
                  options={[{ value: 'by', label: `By the ${teamClub(draft.team)}` }, { value: 'against', label: `Against them` }]} />
              )}
            </Field>
            <Field label="Stat">
              {(id) => (
                <select id={id} value={draft.stat} onChange={(e) => set('stat', e.target.value)}>
                  {['batting', 'pitching'].map((grp) => (
                    <optgroup key={grp} label={grp === 'batting' ? 'Batting' : 'Pitching'}>
                      {statsFor(draft.side).filter((s) => s.group === grp).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Games in a row">
              {(id) => <input id={id} type="number" inputMode="numeric" min="1" max="20" value={draft.n} onChange={(e) => set('n', int(e.target.value, 1, 20, 1))} />}
            </Field>
            <Field label="Total" wide group>
              {(id, labelId) => (
                <span className="streaks__total streaks__total--wrap" role="group" aria-labelledby={labelId}>
                  <Segmented label="Which streaks" value={draft.op} onChange={(v) => set('op', v)}
                    options={[{ value: 'min', label: 'At least' }, { value: 'max', label: 'At most' }, { value: 'top', label: 'Top 10' }, { value: 'bottom', label: 'Bottom 10' }]} />
                  {draft.op !== 'top' && draft.op !== 'bottom' && <input type="number" inputMode="numeric" min="0" aria-label="Total" value={draft.v} onChange={(e) => set('v', int(e.target.value, 0, 999, 0))} />}
                </span>
              )}
            </Field>
            <Field label="Seasons" wide group>
              {(_id, labelId) => (
                <span className="streaks__total" role="group" aria-labelledby={labelId}>
                  <input aria-label="From season" type="number" inputMode="numeric" placeholder="First" value={draft.from ?? ''} min="1871" max={THIS_YEAR} onChange={(e) => set('from', e.target.value ? Number(e.target.value) : null)} onBlur={(e) => set('from', season(e.target.value, 1871, THIS_YEAR))} />
                  <span className="streaks__to">to</span>
                  <input aria-label="To season" type="number" inputMode="numeric" placeholder={String(THIS_YEAR)} value={draft.to ?? ''} min="1871" max={THIS_YEAR} onChange={(e) => set('to', e.target.value ? Number(e.target.value) : null)} onBlur={(e) => set('to', season(e.target.value, 1871, THIS_YEAR))} />
                </span>
              )}
            </Field>
          </Cluster>
          <Cluster className="streaks__checks">
            <label className="t-label t-label--nocaps"><input type="checkbox" checked={draft.first} onChange={(e) => set('first', e.target.checked)} /> First games of each season only</label>
            <label className="t-label t-label--nocaps"><input type="checkbox" checked={draft.post} onChange={(e) => set('post', e.target.checked)} /> Add postseason games</label>
          </Cluster>
          <div><Button type="submit" skin="ink">Find streaks</Button></div>
        </Stack>
      </form>
      </Card>

      <AsyncStatus
        loading={loading || !first}
        error={error}
        hasData={!!games}
        onRetry={reload}
        errorMessage="Couldn’t load the game logs. Try again."
        emptyMessage="No games found for these seasons."
      />

      {firstError && !firstData && (
        <Notice tone="error" role="status" action={<Button onClick={reloadFirst}>Retry</Button>}>
          Couldn’t find the club’s first season, so this searches from 1871.
        </Notice>
      )}
      {loaded?.failed.length > 0 && !loading && (
        <Notice tone="error" role="status" action={<Button onClick={reload}>Retry</Button>}>
          {loaded.failed.length} {loaded.failed.length === 1 ? 'season' : 'seasons'} couldn’t load ({loaded.failed.join(', ')}), so these ranks leave {loaded.failed.length === 1 ? 'it' : 'them'} out.
        </Notice>
      )}
      {games && !loading && (
        <Card frame="stamped" body="flush" label={what} count={`${rows.length} ${rows.length === 1 ? 'streak' : 'streaks'}`}>
          {rows.length ? (
            <>
              <Table frame="bare" label={`${name} streaks`} className="streaks">
                <thead>
                  <tr>
                    <th className="rank">Rank</th>
                    <th className="dates">Dates</th>
                    {sortHead('date', 'Season')}
                    <th className="opp">Opponents</th>
                    {sortHead('total', 'Total')}
                    <th className="games">Game by game</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => {
                    const a = w.games[0]
                    const z = w.games[w.games.length - 1]
                    return (
                      <tr key={`${a.date}:${a.gameNumber}:${w.post}`}>
                        <td className="rank">{w.rank}</td>
                        <td className="dates">
                          <a href={gameHref(applied.team, a)}>{shortDate(a.date)}</a>
                          {w.games.length > 1 && <> – <a href={gameHref(applied.team, z)}>{shortDate(z.date)}</a></>}
                        </td>
                        <td className="season">{w.season}{w.post && <span className="streaks__post"> · postseason</span>}</td>
                        <td className="opp">
                          {[...new Set(w.games.map((g) => g.oppId))].map((id) => (
                            <TeamLogo key={id} teamId={id} name={teamFullName(id)} size={20} />
                          ))}
                        </td>
                        <td className="total">{w.total}<span className="streaks__unit">{stat.unit}</span></td>
                        <td className="games">
                          {w.games.map((g, i) => <span key={i} className="streaks__game">{g.value}<span className="streaks__unit">{stat.unit}</span></span>)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </>
          ) : (
            <p className="hint">No streaks reached that total. Try a lower number.</p>
          )}
        </Card>
      )}
      </Stack>

      <ReportFooter />
    </div>
  )
}
