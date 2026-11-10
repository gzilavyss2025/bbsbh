import { loadTopFreeAgents } from '../../api/free-agents/freeAgents.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useRouteLink } from '../../lib/nav.js'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Door } from '../ui/control/Door.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// TOP FREE AGENTS — the MLB offseason page's block between the winter
// calendar and the wire (wireframe approved by Gary, 2026-11-10). The best
// eight unsigned major leaguers by WAR, each with the player hover card's four
// stats; WAR orders the cards and is not printed. A phone swipes a row; wide,
// a grid. The one door opens the full class at /free-agents.
// Open surface (ADR-0034): season stats, no game result. Loading or a failed
// read shows nothing, and the calendar meets the wire as before.
export function TopFreeAgents({ season }) {
  const { data } = useAsync((signal) => loadTopFreeAgents(season, { signal }), [season])
  const linkProps = useRouteLink()
  if (!data?.length) return null

  return (
    <section className="ofa" aria-label="Top free agents">
      <div className="ofa__head">
        <SectionHead as="h2" className="ofa__title">Top free agents</SectionHead>
        <Door href="/free-agents" {...linkProps}>All free agents</Door>
      </div>
      <ol className="ofa__list">
        {data.map((r, i) => (
          <li key={r.id} className="ofa__card">
            <span className="ofa__rank">{i + 1}</span>
            <div className="ofa__who">
              <Headshot personId={r.id} name={r.name} teamId={r.teamId} className="ofa__face" />
              <div>
                <PlayerLink id={r.id} className="ofa__name">{r.name}</PlayerLink>
                <p className="ofa__meta">
                  {r.teamId && <TeamLogo teamId={r.teamId} name={r.teamName} size={18} />}
                  <span>{r.pos || '—'}</span>
                </p>
              </div>
            </div>
            <dl className="ofa__stats">
              {r.fields.map((f) => (
                <div key={f.k}>
                  <dt className="t-label t-label--nocaps">{f.k}</dt>
                  <dd className="ofa__num">{f.v}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  )
}
