import '../../styles/report/streaks.css'
import { useId, useMemo, useState } from 'react'
import { STATS, statByKey, findStretches, firstSeason, loadGames } from '../../api/streaks/streaks.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { ALL_MLB_TEAM_IDS, PINNED_TEAM_ID, teamAbbr, teamFullName } from '../../lib/teams.js'
import { monthDayName } from '../../lib/dates.js'
import { gamePath } from '../../lib/route.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

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
    stat: statByKey(q.get('stat')).key,
    n: int(q.get('n'), 1, 20, 5),
    op: q.get('op') === 'max' ? 'max' : 'min',
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
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q}`)
}

function gameHref(teamId, g) {
  const me = teamAbbr({ id: teamId })
  const them = teamAbbr({ id: g.oppId })
  return g.isHome ? gamePath(g.date, them, me, 'boxscore', g.gameNumber) : gamePath(g.date, me, them, 'boxscore', g.gameNumber)
}

function Field({ label, children }) {
  const id = useId()
  return (
    <Stack gap="tight" className="streaks__field">
      <label className="t-label" htmlFor={id}>{label}</label>
      {children(id)}
    </Stack>
  )
}

// Any MLB club, any counting stat: every run of N games in a row at (or under) a total,
// read live from the club's game logs back to its first season. Overlapping windows
// show once, as the best of their run. Not a scoring surface; it opens live (ADR-0034).
export function StreakFinderPage() {
  useDocumentTitle('Streak Finder')
  const { favoriteTeamId } = useFavoriteTeam()
  const fav = ALL_MLB_TEAM_IDS.includes(favoriteTeamId) ? favoriteTeamId : PINNED_TEAM_ID
  const [draft, setDraft] = useState(() => readQuery(fav))
  const [applied, setApplied] = useState(draft)
  const [sort, setSort] = useState('total')
  const set = (k, val) => setDraft((d) => ({ ...d, [k]: val }))
  const stat = statByKey(applied.stat)

  const { data: first } = useAsync(() => firstSeason(applied.team), [applied.team])
  const from = Math.max(applied.from ?? first ?? THIS_YEAR, first ?? 0)
  const to = applied.to ?? THIS_YEAR
  const { loading, error, data: games } = useAsync(
    () => (first ? loadGames(applied.team, stat, from, to, applied.post) : Promise.resolve(null)),
    [applied.team, stat.key, from, to, applied.post, first],
  )

  const rows = useMemo(() => {
    if (!games) return []
    const found = findStretches(games, { n: applied.n, op: applied.op, threshold: applied.v, firstOnly: applied.first })
    const byDate = (a, b) => (a.games[0].date < b.games[0].date ? -1 : 1)
    if (sort === 'date') return found.sort(byDate)
    return found.sort((a, b) => (applied.op === 'max' ? a.total - b.total : b.total - a.total) || byDate(a, b))
  }, [games, applied, sort])

  const find = (e) => {
    e.preventDefault()
    setApplied(draft)
    writeQuery(draft)
  }
  const name = teamFullName(applied.team)
  const what = `${applied.op === 'max' ? 'at most' : 'at least'} ${applied.v} ${stat.label} in ${applied.n} game${applied.n === 1 ? '' : 's'}`
  const span = games?.length ? `${Math.min(...games.map((g) => g.season))}–${Math.max(...games.map((g) => g.season))}` : ''

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Streak Finder</h1>
      </header>
      <p className="hint">
        Pick a club, a stat and a number of games in a row. The table lists every stretch that reached your total,
        back to the club’s first season. Stretches never cross from one season into the next. When stretches share
        games, only the best one shows.
      </p>

      <form onSubmit={find} className="streaks__form">
        <Stack gap="snug">
          <Cluster className="streaks__fields">
            <Field label="Club">
              {(id) => (
                <select id={id} value={draft.team} onChange={(e) => set('team', Number(e.target.value))}>
                  {CLUBS.map((t) => <option key={t} value={t}>{teamFullName(t)}</option>)}
                </select>
              )}
            </Field>
            <Field label="Stat">
              {(id) => (
                <select id={id} value={draft.stat} onChange={(e) => set('stat', e.target.value)}>
                  {['hitting', 'pitching'].map((grp) => (
                    <optgroup key={grp} label={grp === 'hitting' ? 'Hitting' : 'Pitching'}>
                      {STATS.filter((s) => s.group === grp).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Games in a row">
              {(id) => <input id={id} type="number" inputMode="numeric" min="1" max="20" value={draft.n} onChange={(e) => set('n', int(e.target.value, 1, 20, 1))} />}
            </Field>
            <Field label="Total">
              {(id) => (
                <span className="streaks__total">
                  <select aria-label="At least or at most" value={draft.op} onChange={(e) => set('op', e.target.value)}>
                    <option value="min">At least</option>
                    <option value="max">At most</option>
                  </select>
                  <input id={id} type="number" inputMode="numeric" min="0" value={draft.v} onChange={(e) => set('v', int(e.target.value, 0, 999, 0))} />
                </span>
              )}
            </Field>
            <Field label="From season">
              {(id) => <input id={id} type="number" inputMode="numeric" placeholder="First" value={draft.from ?? ''} onChange={(e) => set('from', e.target.value ? Number(e.target.value) : null)} />}
            </Field>
            <Field label="To season">
              {(id) => <input id={id} type="number" inputMode="numeric" placeholder={String(THIS_YEAR)} value={draft.to ?? ''} onChange={(e) => set('to', e.target.value ? Number(e.target.value) : null)} />}
            </Field>
          </Cluster>
          <Cluster className="streaks__checks">
            <label><input type="checkbox" checked={draft.first} onChange={(e) => set('first', e.target.checked)} /> Only the first games of each season</label>
            <label><input type="checkbox" checked={draft.post} onChange={(e) => set('post', e.target.checked)} /> Add postseason games</label>
          </Cluster>
          <div><Button type="submit" skin="ink">Find streaks</Button></div>
        </Stack>
      </form>

      <AsyncStatus
        loading={loading || !first}
        error={error}
        hasData={!!games}
        errorMessage="Couldn’t load the game logs. Try again."
        emptyMessage="No games found for these seasons."
      />

      {games && !loading && (
        <Card frame="stamped" body="flush" label={`${name}: ${what}`} count={`${rows.length} ${rows.length === 1 ? 'streak' : 'streaks'}${span ? `, ${span}` : ''}`}>
          {rows.length ? (
            <>
              <Cluster gap="tight" className="streaks__sort" role="group" aria-label="Sort">
                <Button size="control" aria-pressed={sort === 'total'} onClick={() => setSort('total')}>Best first</Button>
                <Button size="control" aria-pressed={sort === 'date'} onClick={() => setSort('date')}>By date</Button>
              </Cluster>
              <Table frame="bare" label={`${name} streaks`} className="streaks">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th className="dates">Dates</th>
                    <th>Total</th>
                    <th className="games">Game by game</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => {
                    const a = w.games[0]
                    const z = w.games[w.games.length - 1]
                    return (
                      <tr key={`${a.date}:${a.gameNumber}:${w.post}`}>
                        <td>{w.season}{w.post && <span className="streaks__post"> · postseason</span>}</td>
                        <td className="dates">
                          <a href={gameHref(applied.team, a)}>{monthDayName(a.date)}</a>
                          {w.games.length > 1 && <> – <a href={gameHref(applied.team, z)}>{monthDayName(z.date)}</a></>}
                        </td>
                        <td className="total">{w.total}</td>
                        <td className="games">{w.games.map((g) => g.value).join(', ')}</td>
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

      <ReportFooter />
    </div>
  )
}
