import '../../styles/report/eliminated.css'
import { useState } from 'react'
import { loadEliminated, summarize } from '../../api/eliminated/eliminated.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { teamClubName, teamFullName } from '../../lib/teams.js'
import { monthDayName } from '../../lib/dates.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'

const n = (x) => x.toLocaleString('en-US')
const ordinal = (k) => k + (k % 100 > 10 && k % 100 < 14 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[k % 10] || 'th')

function Ranking({ clubs, teamId, onPick }) {
  return (
    <Table frame="bare" label="Games played after elimination, by club" className="elim__rank">
      <thead>
        <tr>
          <th className="club">Club</th>
          <th>Out</th>
          <th>GP</th>
        </tr>
      </thead>
      <tbody>
        {clubs.map((c) => (
          <tr key={c.teamId} className={c.teamId === teamId ? 'elim__picked' : undefined}>
            <td className="club">
              <button type="button" className="elim__club" onClick={() => onPick(c.teamId)}>
                <TeamLogo teamId={c.teamId} name={teamFullName(c.teamId)} size={20} />
                {teamClubName(c.teamId) || '—'}
              </button>
            </td>
            <td className="elim__num">{c.outGames}</td>
            <td>{n(c.games)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function Club({ club, of }) {
  const outSeasons = club.seasons.filter((s) => s.rows.length)
  const never = club.seasons.filter((s) => !s.rows.length).map((s) => s.season)
  return (
    <section className="elim__club-detail" aria-label={`${teamFullName(club.teamId)} games after elimination`}>
      <p className="elim__total">
        <strong>{club.outGames}</strong>
        <span>
          {teamFullName(club.teamId)} · of {n(club.games)} games · {ordinal(club.rank)} fewest of {of}
        </span>
      </p>
      {outSeasons.length > 0 && (
        <Table frame="bare" label="Games played after elimination" className="elim__games">
          <thead>
            <tr>
              <th>Season</th>
              <th>Date</th>
              <th className="club">Opponent</th>
              <th>Entering</th>
            </tr>
          </thead>
          <tbody>
            {outSeasons.flatMap((s) =>
              s.rows.map((r, i) => (
                <tr key={`${s.season}:${r.date}:${i}`}>
                  <td>{i === 0 ? s.season : ''}</td>
                  <td>{monthDayName(r.date)}</td>
                  <td className="club">
                    {r.home ? 'vs' : '@'} {teamClubName(r.oppId) || '—'}
                  </td>
                  <td>{r.entering ?? '—'}</td>
                </tr>
              )),
            )}
          </tbody>
        </Table>
      )}
      {never.length > 0 && <p className="hint">Never out: {never.join(', ')}.</p>}
    </section>
  )
}

// Regular-season games each club played after it was mathematically out of the
// postseason, over a chosen span of seasons. Pick a club for its games.
export function EliminatedPage() {
  useDocumentTitle('Games After Elimination')
  const { loading, error, data } = useAsync(() => loadEliminated(), [])
  const [teamId, setTeamId] = useState(null)
  const [range, setRange] = useState(null)
  const years = data ? Array.from({ length: data.last - data.first + 1 }, (_, i) => data.first + i) : []
  const [from, to] = range ?? [data?.first, data?.last]
  const clubs = data ? summarize(data, from, to) : []
  const club = clubs.find((c) => c.teamId === teamId)
  const byName = [...clubs].sort((a, b) => teamClubName(a.teamId).localeCompare(teamClubName(b.teamId)))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Games After Elimination</h1>
      </header>
      <p className="hint">
        Regular-season games a club played after it was mathematically out of the postseason: out before the day
        began, tiebreakers included.
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={clubs.length > 0}
        errorMessage="Couldn’t load these games. Try again."
        emptyMessage="No seasons yet."
      />

      {clubs.length > 0 && (
        <>
          <Cluster gap="snug" className="elim__controls">
            <label className="elim__team">
              Team
              <select value={teamId ?? ''} onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">All MLB</option>
                {byName.map((c) => (
                  <option key={c.teamId} value={c.teamId}>
                    {teamFullName(c.teamId)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From
              <select value={from} onChange={(e) => setRange([Number(e.target.value), Math.max(to, Number(e.target.value))])}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label>
              To
              <select value={to} onChange={(e) => setRange([Math.min(from, Number(e.target.value)), Number(e.target.value)])}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </Cluster>

          <div className={club ? 'elim__body elim__body--club' : 'elim__body'}>
            <div className="elim__list">
              <Ranking clubs={clubs} teamId={teamId} onPick={setTeamId} />
            </div>
            {club && (
              <div className="elim__detail">
                <Club club={club} of={clubs.length} />
                <button type="button" className="elim__back" onClick={() => setTeamId(null)}>
                  ← All MLB
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
