import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'

const DASH = '—'

function monthDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// The real stat line — the hover card's own tile grid (.phcard__stats/
// .phcard__tile), reused under a Horizon-scoped class name rather than a
// third boxed-stat pattern. `stats` is loadMinors.js's statLineFor output:
// W-L/ERA/K/WHIP for a pitcher, AVG/HR/RBI/OPS for a hitter, or the
// Milestones tile's two-cell Status/Since pair.
function StatGrid({ stats }) {
  return (
    <div className="hzntile__stats">
      {stats.map((s) => (
        <div className="hzntile__tile" key={s.k}>
          <span className="hzntile__tilev">{s.v}</span>
          <span className="hzntile__tilek">{s.k}</span>
        </div>
      ))}
    </div>
  )
}

function PromotionTile({ p }) {
  return (
    <li className="hzntile">
      <div className="hzntile__head">
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
          <div className="hzntile__trend">
            &#9650; {p.trend.standing}
            {p.trend.movement.sinceDate ? ` since ${monthDay(p.trend.movement.sinceDate)}` : ''}
          </div>
        </div>
      </div>
      {p.stats ? <StatGrid stats={p.stats} /> : <p className="hint hzntile__nostat">No full-season line at this level yet.</p>}
    </li>
  )
}

function MilestoneTile({ p }) {
  const stats = [
    { k: 'Status', v: 'On rehab' },
    { k: 'Since', v: monthDay(p.since) || DASH },
  ]
  return (
    <li className="hzntile">
      <div className="hzntile__head">
        <span className="horizontile__shotwrap">
          <Headshot personId={p.playerId} name={p.playerName} teamId={p.orgId} className="horizontile__shot" />
          {p.position && <span className="horizontile__posbadge">{p.position}</span>}
        </span>
        <div className="horizontile__body">
          <PlayerLink id={p.playerId} name={p.playerName} className="horizontile__name">
            {p.playerName}
          </PlayerLink>
          <div className="horizontile__move">
            <TeamLogo teamId={p.orgId} name={p.orgName} size={16} />
            <span className="horizontile__arrow" aria-hidden="true">
              →
            </span>
            <TeamLogo teamId={p.clubId} name={p.clubName} size={16} />
          </div>
        </div>
      </div>
      <StatGrid stats={stats} />
    </li>
  )
}

// The Minors tab's forward-looking counterpart to the Affiliates recap cards
// above it: not what happened last night, but what to watch for next. Two
// signals, both recombined from data this app already ingests — no new
// pipeline: "Promotion watch" (a real, qualified level-relative standing that
// is also trending UP — see promotionWatchFrom, ../../data/loadMinors.js) and
// "Milestones" (this org's own rehab-assignment stints, the same league-wide
// snapshot RehabPage reads). Each tile leads with the real season stat line
// (statLineFor), not just the percentile label — the trending signal is why a
// player is on this list, but the line underneath it is what a reader
// actually wants to see. Renders nothing when both are empty rather than an
// empty-state card — a farm system with no one trending and no one
// rehabbing is the common case, not an error.
export function HorizonCard({ horizon }) {
  const { promotionWatch, milestones } = horizon
  if (!promotionWatch.length && !milestones.length) return null
  return (
    <div className="thub-card horizoncard">
      <div className="thub-card__head">
        <span>On the horizon</span>
      </div>
      <div className="thub-card__body">
        {promotionWatch.length > 0 && (
          <>
            <h3 className="horizoncard__section">Promotion watch</h3>
            <ul className="hznlist">
              {promotionWatch.map((p) => (
                <PromotionTile key={p.playerId} p={p} />
              ))}
            </ul>
          </>
        )}
        {milestones.length > 0 && (
          <>
            <h3 className="horizoncard__section">Milestones</h3>
            <ul className="hznlist">
              {milestones.map((p) => (
                <MilestoneTile key={p.playerId} p={p} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
