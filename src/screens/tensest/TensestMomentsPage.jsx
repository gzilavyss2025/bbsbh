import '../../styles/report/tensest.css'
import { useMemo, useState } from 'react'
import { boardBars, loadTensest, momentParts, postseasonCitation, rankLabel, swingFor, boardRecord, mlbRate, versusMlb } from '../../api/tensest/tensest.js'
import { clubTop, filterOptions, filterPlays, leagueTop } from '../../api/tensest/slices.js'
import { PressureMeter } from '../../components/charts/PressureMeter.jsx'
import { TensestFilters } from './TensestFilters.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
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

// "won 4-3 vs [CHC]" for the selected club's own games (the winner's runs first, as a
// game story writes it), "[PIT] 7, [WSH] 8" for the rest.
function GameLabel({ row, teamId }) {
  const hasScore = row.as != null && row.hs != null
  if (teamId && (row.aw === teamId || row.hm === teamId)) {
    const home = row.hm === teamId
    const mine = home ? row.hs : row.as
    const theirs = home ? row.as : row.hs
    const where = home ? 'vs' : 'at'
    const other = <Club id={home ? row.aw : row.hm} />
    if (!hasScore) return <>{where} {other}</>
    const won = mine > theirs
    return <>{won ? 'won' : 'lost'} {Math.max(mine, theirs)}-{Math.min(mine, theirs)} {where} {other}</>
  }
  if (!hasScore) return <><Club id={row.aw} /> at <Club id={row.hm} /></>
  return <><Club id={row.aw} /> {row.as}, <Club id={row.hm} /> {row.hs}</>
}

const boxPath = (r) => gamePath(r.d, teamAbbr({ id: r.aw }), teamAbbr({ id: r.hm }), 'boxscore', r.gn ?? 1)


// One row, one moment (a baseball writer's review, 2026-11-17): a sentence a game story
// would print, "Jarren Duran singled to right off Devin Williams, scoring Cheng, in the
// 9th.", over a small citation line naming the game: "July 12 at [NYM] · won 3-2".
function Moment({ r, teamId, routeLink }) {
  const m = momentParts(r)
  const batter = <PlayerLink id={r.bid}>{r.bn}</PlayerLink>
  const pitcher = <PlayerLink id={r.pid}>{r.pn}</PlayerLink>
  const round = postseasonCitation(r)
  // Each runner who scored, by full name and linked, joined as a sentence lists them.
  const scoring = m.runners
    ? <>, scoring {m.runners.map(([id, n], i) => (
        <span key={id}>{i === 0 ? '' : i === m.runners.length - 1 ? ' and ' : ', '}<span className="tensest__nobreak"><PlayerLink id={id}>{n}</PlayerLink>{i === m.runners.length - 1 ? ',' : ''}</span></span>
      ))}</>
    : null
  // The comma rides with the word before it: a name is a button, and a line may break
  // after a button, which left a comma alone at the start of a line.
  const tail = scoring
    ? <>{pitcher}{scoring}</>
    : m.scoring
      ? <>{pitcher}{m.scoring},</>
      : <span className="tensest__nobreak">{pitcher},</span>
  return (
    <>
      <p className="tensest__moment">
        {m.lead === 'batter'
          ? <>{batter} {m.verb} {m.prep} {tail} {m.when}.</>
          : <>{m.verb} with {batter} up against {tail} {m.when}.</>}
      </p>
      <p className="tensest__cite">
        {monthDay(r.d) || DASH}{' '}
        <a className="tensest__gamelink" {...routeLink(boxPath(r))}><GameLabel row={r} teamId={teamId} /></a>
        {round && <> · {round}</>}
      </p>
    </>
  )
}

function TensestTable({ rows, teamId, side, label }) {
  const routeLink = useRouteLink()
  return (
    <Table frame="bare" label={label} className="tensest">
      <thead>
        <tr>
          <th>Rank</th>
          <th className="moment">Moment</th>
          <th className="tensest__pressure">Pressure</th>
          <th><span className="sr-only">Watch</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          // A faint green or red wash: the picked club's side won or lost the at-bat.
          <tr key={`${r.pk}:${r.i}`} className={swingFor(r, teamId, side) ? `tensest__row--${swingFor(r, teamId, side)}` : undefined}>
            <td className="rank"><span className="sr-only tensest__cue">Rank </span>{rankLabel(r, rows)}</td>
            <td className="moment"><Moment r={r} teamId={teamId} routeLink={routeLink} /></td>
            {/* The meter spreads this board's own range (boardBars), not the season's: on the
                season scale every row here is full. The number beside it is what a screen
                reader hears, so the meter is decorative. */}
            <td className="tensest__pressure"><span className="sr-only tensest__cue">Pressure </span>{r.li.toFixed(2)} <PressureMeter bars={boardBars(r.li)} decorative /></td>
            <td className="watch"><TensestWatch row={r} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

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
  const record = boardRecord(rows, side)
  const mlb = useMemo(() => mlbRate(plays, side), [plays, side])
  const pct = record.of ? Math.round((record.succeeded / record.of) * 100) : null
  const versus = versusMlb(pct, mlb)
  const hasData = (plays?.length ?? 0) > 0
  const name = teamFullName(teamId) || 'This club'

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
          for the league’s top 50 (a tie for the last place can add one); narrow either by batter, pitcher or park.
          With a club picked, each row is green when its side succeeded in the at-bat and red when it didn’t, and
          the box counts them: each square is one at-bat, in rank order. The MLB average beside it is every at-bat
          in baseball this season at a pressure of 4 or more; within 5 points of it reads as near. Ties are marked T, and
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
                <Cluster gap="snug" align="center" className="tensest__sidebar">
                  <Segmented
                    label="Which side"
                    value={side}
                    onChange={setSide}
                    options={[{ value: 'bat', label: 'Batting' }, { value: 'pit', label: 'Pitching' }]}
                    className="tensest__side"
                  />
                  {/* How the club's side did in these at-bats, by the row tints' own rule —
                      never the games' won-lost record, which every row already carries. */}
                  {record.of > 0 && (
                    <div className="tensest__record">
                      <p className="tensest__recordline">
                        <span className="tensest__recordlabel">Succeeded in</span>{' '}
                        <span className="tensest__recordfig">{record.succeeded} of {record.of}</span>{' '}
                        <span className="tensest__recordlabel">({pct}%)</span>
                      </p>
                      {versus && (
                        <p className={`tensest__versus${versus.tone ? ` tensest__versus--${versus.tone}` : ''}`}>{versus.text}</p>
                      )}
                      {/* One square per at-bat, in rank order, in its row's green or red: the
                          count, and where on the list the successes fell. */}
                      <span className="tensest__tally" aria-hidden="true">
                        {rows.map((r) => <i key={`${r.pk}:${r.i}`} className={`tensest__tick tensest__tick--${swingFor(r, teamId, side)}`} />)}
                      </span>
                    </div>
                  )}
                </Cluster>
              )}
              <TensestFilters value={filters} options={options} onChange={setFilters} clubs={teamId == null} />
            </div>
            {rows.length ? (
              <TensestTable rows={rows} teamId={teamId} side={side} label={`${teamId == null ? 'All of baseball' : name}, tensest at-bats`} />
            ) : (
              <p className="hint">{filtering ? 'No tense at-bats match these filters.' : 'No tense at-bats yet.'}</p>
            )}
          </Card>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
