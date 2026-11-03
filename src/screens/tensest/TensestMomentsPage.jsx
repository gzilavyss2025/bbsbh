import '../../styles/report/tensest.css'
import { useState } from 'react'
import { loadTensest, rankLabel, isPostseason } from '../../api/tensest/tensest.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { PINNED_TEAM_ID, teamAbbr, teamFullName } from '../../lib/teams.js'
import { monthDayName } from '../../lib/dates.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'

const DASH = '—'

// "W 4-3 vs CHC" for the selected club's own games, "PIT 7 at WSH 8"-style for the rest.
function gameLabel(row, teamId) {
  const hasScore = row.as != null && row.hs != null
  if (teamId && (row.aw === teamId || row.hm === teamId)) {
    const home = row.hm === teamId
    const mine = home ? row.hs : row.as
    const theirs = home ? row.as : row.hs
    const other = teamAbbr({ id: home ? row.aw : row.hm })
    if (!hasScore) return `${home ? 'vs' : 'at'} ${other}`
    return `${mine > theirs ? 'W' : 'L'} ${mine}-${theirs} ${home ? 'vs' : 'at'} ${other}`
  }
  const away = teamAbbr({ id: row.aw })
  const home = teamAbbr({ id: row.hm })
  return hasScore ? `${away} ${row.as}, ${home} ${row.hs}` : `${away} at ${home}`
}

const countOf = (rows) => (rows?.length ? `${rows.length} at-bats` : undefined)

function TensestTable({ rows, teamId, label }) {
  return (
    <Table frame="bare" label={label} className="tensest">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Pressure</th>
          <th>Date</th>
          <th className="game">Game</th>
          <th>Inning</th>
          <th className="batter">At-bat</th>
          <th className="what">What happened</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.pk}:${r.i}`}>
            <td className="rank">{rankLabel(r, rows)}</td>
            <td>{r.li.toFixed(2)}</td>
            <td>{monthDayName(r.d) || DASH}</td>
            <td className="game">
              {gameLabel(r, teamId)}
              {isPostseason(r) && <span className="tensest__post"> · postseason</span>}
            </td>
            <td>
              {r.top ? 'Top' : 'Bottom'} {r.inn}
            </td>
            <td className="batter">
              {r.bn} vs {r.pn}
            </td>
            <td className="what">{r.what}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// The season's tensest at-bats by MLB's pressure score: a club batting, the same club
// pitching, and all of baseball. Postseason games are included and marked. The page
// opens on the favorite club; the strip picks another. Not a scoring surface, so it
// opens live with no seal (ADR-0034).
export function TensestMomentsPage() {
  useDocumentTitle('Tensest Moments')
  const { loading, error, data } = useAsync(() => loadTensest(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  const [picked, setPicked] = useState(null)
  const teamId = picked ?? favoriteTeamId ?? PINNED_TEAM_ID
  const mine = data?.teams?.[teamId]
  const hasData = (data?.league?.length ?? 0) > 0
  const name = teamFullName(teamId) || 'This club'
  const updated = monthDayName(data?.through)

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Tensest Moments{data?.season ? `, ${data.season}` : ''}</h1>
      </header>

      <p className="hint">
        MLB gives every at-bat a pressure score from the game situation: the inning, the score, the outs and
        the runners. A normal at-bat is 1.0 and the scale stops at 9.99. These are the season’s tensest.
        Postseason games are included and marked. T means tied.
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasData}
        errorMessage="Couldn’t load tensest moments. Try again."
        emptyMessage="No tensest moments yet."
      />

      {hasData && (
        <>
          <div className="tensest__picker">
            <TeamFilterStrip
              selectedTeamId={teamId}
              onSelect={setPicked}
              showMlbPin={false}
              ariaLabel="Pick a club for its batting and pitching tables"
            />
          </div>
          <Card frame="stamped" body="flush" label={`${name} batting, top 25`} count={countOf(mine?.bat)} className="tensest__section">
            {mine?.bat?.length ? (
              <TensestTable rows={mine.bat} teamId={teamId} label={`${name} batting, tensest at-bats`} />
            ) : (
              <p className="hint">No tense at-bats for this club yet.</p>
            )}
          </Card>
          <Card frame="stamped" body="flush" label={`${name} pitching, top 25`} count={countOf(mine?.pit)} className="tensest__section">
            {mine?.pit?.length ? (
              <TensestTable rows={mine.pit} teamId={teamId} label={`${name} pitching, tensest at-bats`} />
            ) : (
              <p className="hint">No tense at-bats for this club yet.</p>
            )}
          </Card>
          <Card frame="stamped" body="flush" label="All of baseball, top 50" count={countOf(data.league)} className="tensest__section">
            <TensestTable rows={data.league} teamId={null} label="All of baseball, tensest at-bats" />
          </Card>
          {updated && <p className="hint">Games through {updated}.</p>}
        </>
      )}

      <ReportFooter />
    </div>
  )
}
