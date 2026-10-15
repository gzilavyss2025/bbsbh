import { useEffect, useMemo, useState } from 'react'
import { pageDay } from '../../../../api/schedule.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { ordinal } from '../../../../lib/format.js'
import { hasSeen, markSeen, viewKey } from '../../../../lib/motion/inViewOnce.js'
import { SPORT_LABEL } from '../../../../lib/teams.js'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { cutoffFor, divisionRecordFor } from '../../data/shared.js'
import { SHARED } from '../once.js'
import { ClubGrid } from './ClubGrid.jsx'
import { DaysRail } from './DaysRail.jsx'
import { FormLine } from './FormLine.jsx'
import { RunsBar } from './RunsBar.jsx'
import { clubLine, daysRail, formSeries, gridCells, lastTen, runsCaption, stretches } from './topData.js'
import '../../../../styles/team-next/top.css'

// The top of the one-scroll team page (#1107, row 5, design B "form line"): a stamped hero
// card (the club band head, the record spot, the form line, the two stretches) and two tiles.
// Open surface (ADR-0034): nothing here is sealed, and every shape stops at the page's `?d=`
// cutoff because it counts only games with a result (topData.js). The record spot opens the
// win-percentage grid, Last 10 the days calendar, Run diff the Runs bar. A tap opens a part and
// a second tap plays it again, so the part is keyed on its tap count. The schedule and the
// standings come through SHARED: the page already bought both, so the top asks for no new
// request, apart from the other league's standings, fetched on the first tap of the record spot.
const HERO_DELAY = '60ms'
const TILE_DELAY = ['110ms', '165ms']
const OTHER_LEAGUE = { 103: 104, 104: 103 }

export function TeamNextTop({ team, standings, season, asOf }) {
  const sportId = team.sport?.id ?? 1
  const mlb = sportId === 1
  const cutoff = cutoffFor(asOf)
  const line = useMemo(() => clubLine(standings, team), [standings, team])
  const schedule = useAsync(() => SHARED.fetchTeamSchedule(team.id, season, sportId, cutoff), [team.id, season, sportId, cutoff]).data
  const series = useMemo(() => schedule && formSeries(schedule), [schedule])
  const ends = useMemo(() => schedule && stretches(schedule), [schedule])
  const ten = useMemo(() => schedule && lastTen(schedule), [schedule])
  const today = pageDay(cutoff)
  const rail = useMemo(() => schedule && daysRail(schedule, today), [schedule, today])

  // Motion plays once per page visit (docs/motion.md, "The one-shot gate"); a return shows it at rest.
  const seenKey = viewKey(team.id, 'team-top')
  const [still] = useState(() => hasSeen(seenKey))
  useEffect(() => {
    markSeen(seenKey)
  }, [seenKey])

  const [taps, setTaps] = useState({ clubs: 0, days: 0, runs: 0 })
  const tap = (k) => setTaps((t) => ({ ...t, [k]: t[k] + 1 }))
  const [other, setOther] = useState(null)
  const openClubs = () => {
    tap('clubs')
    const league = OTHER_LEAGUE[team.league?.id]
    if (mlb && league && !other) SHARED.fetchStandings(league, season, cutoff).then((s) => s?.length && setOther(s))
  }

  // MLB: all thirty clubs, so the other league's standings are needed. Any other club: its own
  // division, or its league when it has no division. A pool of one is no grid.
  const pool = (mlb ? [...standings, ...(other ?? [])] : [divisionRecordFor(standings, team)]).flatMap((d) => d?.teamRecords ?? [])
  const cells = gridCells(pool, team.id)
  const gridReady = cells.length > 1 && (!mlb || other?.length > 0)

  const rank = line?.rank
  return (
    <Stack gap="section" className={`tnext__top${still ? ' tnext__top--still' : ''}`}>
      <Card as="div" frame="stamped" body="flush" stampIn className="tnext__hero" style={{ '--stamp-delay': HERO_DELAY }} count={`${season} · ${SPORT_LABEL[sportId] ?? ''}`}>
        <div className="sectionhead--band tnext__head">
          <div className="tnext__plate">
            <TeamLogo teamId={team.id} name="" variant="mono" size={40} />
          </div>
          <div className="tnext__club">
            <h1 className="tnext__name">{team.name}</h1>
            <p className="tnext__sub">{[line?.divisionName, season].filter(Boolean).join(' · ')}</p>
          </div>
          {line?.flag && <span className="tnext__flag">{line.flag.letter} · {line.flag.word}</span>}
        </div>
        <div className="tnext__main">
          <div className="tnext__lead">
            {line && (
              <button type="button" className="card--interactive tnext__spot" aria-controls="tnext-clubs" aria-expanded={taps.clubs > 0} onClick={openClubs}>
                <span className="tnext__record">{line.record}</span>
                {rank && <span className="rankmark">{ordinal(rank.rank)} of {rank.of}</span>}
              </button>
            )}
            <div id="tnext-clubs">
              {taps.clubs > 0 && gridReady && (
                <ClubGrid key={taps.clubs} cells={cells} title={mlb ? `All ${cells.length} clubs` : (line?.divisionName ?? 'Standings')} name={team.teamName ?? team.name} />
              )}
          </div>
          </div>
          {(series || taps.days > 0 || taps.runs > 0) && (
            <div className="tnext__form">
              {series && (
                <>
                  <p className="tnext__label"><span>Games over .500</span><span>{series.n} G</span></p>
                  <FormLine series={series} />
                </>
              )}
              <div id="tnext-days">{taps.days > 0 && rail && <DaysRail key={taps.days} rail={rail} />}</div>
              <div id="tnext-runs">{taps.runs > 0 && line?.rs != null && line.ra != null && <RunsBar key={taps.runs} rs={line.rs} ra={line.ra} diff={line.diff} />}</div>
            </div>
          )}
        </div>
        {ends && (
          <div className="tnext__ends">
            <div><p className="tnext__endk">Best stretch</p><p className="tnext__endv tnext__endv--good">{ends.best.w}-{ends.best.l}</p></div>
            <div><p className="tnext__endk">Worst stretch</p><p className="tnext__endv tnext__endv--bad">{ends.worst.w}-{ends.worst.l}</p></div>
          </div>
        )}
      </Card>
      {(ten || line?.diff) && (
        <div className="tnext__tiles">
          {ten && (
            <Tile label={ten.n < 10 ? `Last ${ten.n}` : 'Last 10'} value={`${ten.w}-${ten.l}`} caption={`Streak ${ten.streak}`} delay={TILE_DELAY[0]}
              controls={rail ? 'tnext-days' : null} open={taps.days > 0} onTap={() => tap('days')} />
          )}
          {line?.diff && (
            <Tile label="Run diff" value={line.diff} caption={runsCaption(line)} delay={TILE_DELAY[1]}
              controls={line.rs != null ? 'tnext-runs' : null} open={taps.runs > 0} onTap={() => tap('runs')} />
          )}
        </div>
      )}
    </Stack>
  )
}

// A plain stamped tile (no ink, no tint). It is a button only when it has a part to open: with
// no `controls` it is a still tile. A button holds phrasing content, so the parts are spans.
function Tile({ label, value, caption, delay, controls, open, onTap }) {
  const tapProps = controls ? { as: 'button', 'aria-controls': controls, 'aria-expanded': open, onClick: onTap } : { as: 'div' }
  return (
    <Card frame="stamped" body="flush" stampIn className="stattile stattile--compact tnext__tile" style={{ '--stamp-delay': delay }} {...tapProps}>
      <span className="stattile__label">{label}</span>
      <span className="stattile__value">{value}</span>
      {caption && <span className="stattile__caption">{caption}</span>}
    </Card>
  )
}
