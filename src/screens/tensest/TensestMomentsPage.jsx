import '../../styles/report/tensest.css'
import { useMemo, useState } from 'react'
import { boardBars, loadTensest, rankLabel, postseasonLabel } from '../../api/tensest/tensest.js'
import { clubTop, filterOptions, filterPlays, leagueTop } from '../../api/tensest/slices.js'
import { PressureMeter } from '../../components/charts/PressureMeter.jsx'
import { TensestFilters } from './TensestFilters.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { TensestWatch } from './TensestWatch.jsx'
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
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'

const DASH = '—'

// A club as its logo, with the abbreviation for screen readers (the logo is aria-hidden).
function Club({ id }) {
  const abbr = teamAbbr({ id })
  return (
    <span className="tensest__club">
      <TeamLogo teamId={id} name={teamFullName(id) || abbr} size={16} />
      <span className="sr-only">{abbr}</span>
    </span>
  )
}

// "W 4-3 vs [CHC]" for the selected club's own games, "[PIT] 7, [WSH] 8" for the rest.
function GameLabel({ row, teamId }) {
  const hasScore = row.as != null && row.hs != null
  if (teamId && (row.aw === teamId || row.hm === teamId)) {
    const home = row.hm === teamId
    const mine = home ? row.hs : row.as
    const theirs = home ? row.as : row.hs
    const where = home ? 'vs' : 'at'
    const other = <Club id={home ? row.aw : row.hm} />
    if (!hasScore) return <>{where} {other}</>
    return <>{mine > theirs ? 'W' : 'L'} {mine}-{theirs} {where} {other}</>
  }
  if (!hasScore) return <><Club id={row.aw} /> at <Club id={row.hm} /></>
  return <><Club id={row.aw} /> {row.as}, <Club id={row.hm} /> {row.hs}</>
}

const boxPath = (r) => gamePath(r.d, teamAbbr({ id: r.aw }), teamAbbr({ id: r.hm }), 'boxscore', r.gn ?? 1)


function TensestTable({ rows, teamId, label }) {
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
        {rows.map((r) => {
          const round = postseasonLabel(r)
          return (
          <tr key={`${r.pk}:${r.i}`}>
            <td className="rank"><span className="sr-only tensest__cue">Rank </span>{rankLabel(r, rows)}</td>
            {/* The meter spreads this board's own range (boardBars), not the season's: on the
                season scale every row here is full. The number beside it is what a screen
                reader hears, so the meter is decorative. */}
            <td className="tensest__pressure"><PressureMeter bars={boardBars(r.li)} decorative /> <span className="sr-only tensest__cue">Pressure </span>{r.li.toFixed(2)}</td>
            <td className="date">{monthDay(r.d) || DASH}</td>
            <td className="game">
              <a className="tensest__gamelink" {...routeLink(boxPath(r))}><GameLabel row={r} teamId={teamId} /></a>
              {round && <span className="tensest__post"> · {round}</span>}
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
            <td className="what"><span className="tensest__what">{r.what}<TensestWatch row={r} /></span></td>
          </tr>
          )
        })}
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
  useDocumentTitle('Biggest At-Bats')
  const { loading, error, data } = useAsync(() => loadTensest(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  // undefined = the opening club; null = all of baseball (the strip's MLB pin).
  const [picked, setPicked] = useState(undefined)
  const [side, setSide] = useState('bat')
  const [filters, setFilters] = useState({})
  const plays = data?.plays
  const clubs = useMemo(() => {
    const ids = new Set((plays ?? []).flatMap((r) => [r.aw, r.hm]))
    return [...ids].map((id) => ({ id, name: teamFullName(id) || teamAbbr({ id }) })).sort((a, b) => a.name.localeCompare(b.name))
  }, [plays])
  const options = useMemo(() => ({ ...filterOptions(plays), clubs }), [plays, clubs])
  // The file holds MLB clubs only. A favorite that is a minor-league club (or any id it
  // does not know) falls back to the pinned club rather than showing an empty board.
  const known = (id) => id != null && clubs.some((c) => c.id === id)
  const teamId = picked !== undefined ? picked : known(favoriteTeamId) ? favoriteTeamId : PINNED_TEAM_ID
  // ONE board: the strip scopes it (a club, or all of baseball), the switch picks the
  // club's side, and the filters narrow it. A club's two pickers drop out under a club.
  const filtering = Object.values(teamId == null ? filters : { ...filters, batting: null, pitching: null }).some((v) => v != null)
  const rows = useMemo(() => {
    if (teamId == null) return leagueTop(filterPlays(plays, filters))
    return clubTop(filterPlays(plays, { ...filters, batting: null, pitching: null }), teamId, side)
  }, [plays, teamId, side, filters])
  const hasData = (plays?.length ?? 0) > 0
  const name = teamFullName(teamId) || 'This club'
  const updated = monthDay(data?.through)

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Biggest At-Bats{data?.season ? `, ${data.season}` : ''}</h1>
      </header>

      {/* One line up front; the explanation is opt-in, behind the (i) (src/styles/CLAUDE.md). */}
      <p className="hint infopop-row tensest__intro">
        The season’s tensest at-bats, by MLB’s pressure score.{' '}
        <InfoPopover label="About biggest at-bats" className="infopop--paper infopop--down">
          MLB gives every at-bat a pressure score from the game situation: the inning, the score, the outs and
          the runners. A normal at-bat is 1.0 and the scale stops at 9.99. Every at-bat here scores 4 or more;
          the meter runs from 4 (one bar) to 9.99 (full). Pick a club for its top 25 batting or pitching, or All
          for the league’s top 50; narrow either by batter, pitcher or park. Ties are marked T, and
          postseason games carry their round and game.
        </InfoPopover>
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasData}
        errorMessage="Couldn’t load the biggest at-bats. Try again."
        emptyMessage="No biggest at-bats yet."
      />

      {hasData && (
        <>
          <div className="tensest__picker">
            <TeamFilterStrip
              selectedTeamId={teamId}
              onSelect={setPicked}
              pinLabel="All"
              ariaLabel="Show one club, or all of baseball"
            />
          </div>
          <Card
            frame="stamped"
            body="flush"
            className="tensest__section"
          >
            <div className="tensest__controls">
              {teamId != null && (
                <Segmented
                  label="Which side"
                  value={side}
                  onChange={setSide}
                  options={[{ value: 'bat', label: 'Batting' }, { value: 'pit', label: 'Pitching' }]}
                  className="tensest__side"
                />
              )}
              <TensestFilters value={filters} options={options} onChange={setFilters} clubs={teamId == null} />
            </div>
            {rows.length ? (
              <TensestTable rows={rows} teamId={teamId} label={`${teamId == null ? 'All of baseball' : name}, tensest at-bats`} />
            ) : (
              <p className="hint">{filtering ? 'No tense at-bats match these filters.' : 'No tense at-bats yet.'}</p>
            )}
          </Card>
          {updated && <p className="hint">Games through {updated}.</p>}
        </>
      )}

      <ReportFooter />
    </div>
  )
}
