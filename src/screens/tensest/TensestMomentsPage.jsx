import '../../styles/report/tensest.css'
import { useMemo, useState } from 'react'
import { loadTensest, rankLabel, postseasonLabel } from '../../api/tensest/tensest.js'
import { clubTop, filterOptions, filterPlays, leagueTop } from '../../api/tensest/slices.js'
import { loadCutoffs, tenseBars } from '../../api/tensest/tenseBars.js'
import { PressureMeter } from '../../components/charts/PressureMeter.jsx'
import { TensestFilters } from './TensestFilters.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { PINNED_TEAM_ID, teamAbbr, teamFullName } from '../../lib/teams.js'
import { monthDay } from '../../lib/dates.js'
import { gamePath } from '../../lib/route.js'
import { useRouteLink } from '../../lib/nav.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
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

const boxPath = (r) => gamePath(r.d, teamAbbr({ id: r.aw }), teamAbbr({ id: r.hm }), 'boxscore', r.gn ?? 1)

const countOf = (rows) => (rows?.length ? `${rows.length} at-bats` : undefined)

function TensestTable({ rows, teamId, label, cutoffs }) {
  const routeLink = useRouteLink()
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
            {/* The meter and the number beside it: every play here is in the season's top 1%,
                so the meter is nearly always full and the number tells the rows apart (Gary). */}
            <td className="tensest__pressure">{cutoffs && <PressureMeter bars={tenseBars(r.li, cutoffs)} cutoffs={cutoffs} />} {r.li.toFixed(2)}</td>
            <td className="date">{monthDay(r.d) || DASH}</td>
            <td className="game">
              <a className="tensest__gamelink" {...routeLink(boxPath(r))}>{gameLabel(r, teamId)}</a>
              {postseasonLabel(r) && <span className="tensest__post"> · {postseasonLabel(r)}</span>}
            </td>
            {/* ▲ top / ▼ bottom, as the box score and Gameday mark the half. */}
            <td className="inn" aria-label={`${r.top ? 'Top' : 'Bottom'} ${r.inn}`}>
              {r.top ? '▲' : '▼'}
              {r.inn}
            </td>
            <td className="batter">
              <PlayerLink id={r.bid}>{r.bn}</PlayerLink>{' '}
              {/* "vs" rides with the pitcher, so a wrap never leaves it dangling. */}
              <span className="tensest__vs">
                vs <PlayerLink id={r.pid}>{r.pn}</PlayerLink>
              </span>
            </td>
            <td className="what">{r.what}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// The season's tensest at-bats by MLB's pressure score: a club batting, the same club
// pitching, and all of baseball, which filters by batter, pitcher, park and club
// (#2981). Every list is ranked here from the file's flat list (slices.js). Postseason
// games are included and marked. The page opens on the favorite club; the strip picks
// another. Not a scoring surface, so it opens live with no seal (ADR-0034).
export function TensestMomentsPage() {
  useDocumentTitle('Pressure Moments')
  const { loading, error, data } = useAsync(() => loadTensest(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  const { data: cutoffs } = useAsync(() => loadCutoffs(), [])
  const [picked, setPicked] = useState(null)
  const [filters, setFilters] = useState({})
  const plays = data?.plays
  const clubs = useMemo(() => {
    const ids = new Set((plays ?? []).flatMap((r) => [r.aw, r.hm]))
    return [...ids].map((id) => ({ id, name: teamFullName(id) || teamAbbr({ id }) })).sort((a, b) => a.name.localeCompare(b.name))
  }, [plays])
  const options = useMemo(() => ({ ...filterOptions(plays), clubs }), [plays, clubs])
  // The file holds MLB clubs only. A favorite that is a minor-league club (or any id it
  // does not know) falls back to the pinned club rather than showing empty tables.
  const known = (id) => id != null && clubs.some((c) => c.id === id)
  const teamId = picked ?? (known(favoriteTeamId) ? favoriteTeamId : PINNED_TEAM_ID)
  const mine = useMemo(() => ({ bat: clubTop(plays, teamId, 'bat'), pit: clubTop(plays, teamId, 'pit') }), [plays, teamId])
  const filtering = Object.values(filters).some((v) => v != null)
  const league = useMemo(() => leagueTop(filtering ? filterPlays(plays, filters) : plays), [plays, filters, filtering])
  const hasData = (plays?.length ?? 0) > 0
  const name = teamFullName(teamId) || 'This club'
  const updated = monthDay(data?.through)

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Pressure Moments{data?.season ? `, ${data.season}` : ''}</h1>
      </header>

      <p className="hint">
        MLB gives every at-bat a pressure score from the game situation: the inning, the score, the outs and
        the runners. A normal at-bat is 1.0 and the scale stops at 9.99. The meter shows where each one ranks
        among every at-bat of the season. These are the season’s tensest: each club’s top 25 batting and pitching,
        and the league’s top 50, which you can narrow by batter, pitcher, park or club. Ties are included and marked T.
        Postseason games are included and marked with their round and game.
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasData}
        errorMessage="Couldn’t load pressure moments. Try again."
        emptyMessage="No pressure moments yet."
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
          {/* Stamped cards stack in a Stack, never on sibling margins: margins collapse and
              leave the name tab no air (ADR-0132). */}
          <Stack gap="loose">
          <Card frame="stamped" body="flush" label={`${name} batting`} count={countOf(mine?.bat)} className="tensest__section">
            {mine?.bat?.length ? (
              <TensestTable rows={mine.bat} teamId={teamId} cutoffs={cutoffs} label={`${name} batting, tensest at-bats`} />
            ) : (
              <p className="hint">No tense at-bats for this club yet.</p>
            )}
          </Card>
          <Card frame="stamped" body="flush" label={`${name} pitching`} count={countOf(mine?.pit)} className="tensest__section">
            {mine?.pit?.length ? (
              <TensestTable rows={mine.pit} teamId={teamId} cutoffs={cutoffs} label={`${name} pitching, tensest at-bats`} />
            ) : (
              <p className="hint">No tense at-bats for this club yet.</p>
            )}
          </Card>
          <Card frame="stamped" body="flush" label="All of baseball" count={countOf(league)} className="tensest__section">
            <TensestFilters value={filters} options={options} onChange={setFilters} />
            {league.length ? (
              <TensestTable rows={league} teamId={null} cutoffs={cutoffs} label="All of baseball, tensest at-bats" />
            ) : (
              <p className="hint">{filtering ? 'No tense at-bats match these filters.' : 'No tense at-bats yet.'}</p>
            )}
          </Card>
          </Stack>
          {updated && <p className="hint">Games through {updated}.</p>}
        </>
      )}

      <ReportFooter />
    </div>
  )
}
