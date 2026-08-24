import { useState } from 'react'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'

const DASH = '—'

// Same ordinal suffix rule as ProspectTrendPill's own local copy
// (src/components/badges/ProspectTrendPill.jsx) — kept as its own copy here
// rather than a shared import for one formatter, same cross-boundary
// convention prospects.js's rate3/num2 already use.
function ordinal(value) {
  const mod100 = value % 100
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? 'th' : value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'
  return `${value}${suffix}`
}

function ScoutTile({ p }) {
  return (
    <li className="horizontile horizontile--compact">
      <span className="horizontile__shotwrap">
        <Headshot personId={p.playerId} name={p.name} teamId={p.affiliateTeamId} className="horizontile__shot" />
        {p.position && <span className="horizontile__posbadge">{p.position}</span>}
      </span>
      <div className="horizontile__body">
        <PlayerLink id={p.playerId} name={p.name} className="horizontile__name">
          {p.name}
        </PlayerLink>
        <div className="horizontile__meta">
          {p.affiliateTeamId && <TeamLogo teamId={p.affiliateTeamId} name={p.levelLabel} size={16} />}
          <span>{p.levelLabel || DASH}</span>
        </div>
      </div>
      <div className="horizontile__statbox">
        <span className="horizontile__statv">#{p.orgRank}</span>
        <span className="horizontile__statk">org rank</span>
      </div>
    </li>
  )
}

function PerformTile({ p }) {
  return (
    <li className="horizontile horizontile--compact">
      <span className="horizontile__shotwrap">
        <Headshot personId={p.playerId} name={p.name} teamId={p.affiliateTeamId} className="horizontile__shot" />
        {p.position && <span className="horizontile__posbadge">{p.position}</span>}
      </span>
      <div className="horizontile__body">
        <PlayerLink id={p.playerId} name={p.name} className="horizontile__name">
          {p.name}
        </PlayerLink>
        <div className="horizontile__meta">
          {p.affiliateTeamId && <TeamLogo teamId={p.affiliateTeamId} name={p.levelLabel} size={16} />}
          <span>{p.levelLabel || DASH}</span>
        </div>
      </div>
      <div className="horizontile__statbox">
        <span className="horizontile__statv">{ordinal(p.trend.percentile)}</span>
        <span className="horizontile__statk">{p.trend.group === 'pitching' ? 'ERA' : 'OPS'} pctile</span>
      </div>
    </li>
  )
}

// The org's positional depth, one position at a time — Scouting (this org's
// existing ranked pool, ordered by orgRank) beside Performance (the same
// pool re-ordered by bbsbh's own level-relative percentile). The two lists
// are kept deliberately separate rather than blended into one score: no
// outlet publishes a formula for merging a scouting grade with a stat line,
// and the two orders disagreeing is itself the finding a reader comes here
// for, not noise to resolve. Reference content, not a daily recap — it opens
// on the first position with any ranked prospect and stays client-side from
// there (buildDepthChart, ../../data/loadMinors.js, already grouped the
// data; this component only tracks which pill is selected).
export function DepthChartCard({ depthChart }) {
  const { positions, byPosition } = depthChart
  const [active, setActive] = useState(positions[0] ?? null)
  if (!positions.length) return null
  const current = byPosition[active] ?? byPosition[positions[0]]

  return (
    <div className="thub-card depthchart">
      <div className="thub-card__head">
        <span>Depth chart</span>
        <em>scouting vs. performance</em>
      </div>
      <div className="thub-card__body">
        <div className="depthchart__positions">
          {positions.map((pos) => (
            <button
              key={pos}
              type="button"
              className={`depthpos${pos === active ? ' is-active' : ''}`}
              onClick={() => setActive(pos)}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="depthchart__columns">
          <div className="depthchart__col">
            <h3 className="horizoncard__section">Scouting</h3>
            <ul className="horizoncard__list">
              {current.scouting.map((p) => (
                <ScoutTile key={p.playerId} p={p} />
              ))}
            </ul>
          </div>
          <div className="depthchart__col">
            <h3 className="horizoncard__section">Performance</h3>
            {current.performance.length > 0 ? (
              <ul className="horizoncard__list">
                {current.performance.map((p) => (
                  <PerformTile key={p.playerId} p={p} />
                ))}
              </ul>
            ) : (
              <p className="hint">Too early for a level-relative read at this position.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
