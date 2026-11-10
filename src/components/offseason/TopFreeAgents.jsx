import { useState } from 'react'
import { loadTopFreeAgents } from '../../api/free-agents/freeAgents.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useRouteLink } from '../../lib/nav.js'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Door } from '../ui/control/Door.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { actionPhotoUrl } from '../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'

// The hover card's two-line name: everything before the last word, then it.
const first = (n) => n.split(' ').slice(0, -1).join(' ')
const last = (n) => n.split(' ').at(-1)

// TOP FREE AGENTS — the MLB offseason page's block between the winter
// calendar and the wire (wireframe approved by Gary, 2026-11-10). The best
// six unsigned major leaguers by WAR, each drawn as the player hover card
// (PlayerHoverCard.jsx: navy band, photo, two-line name, crest, four-stat
// table) no crest (no club holds him), and his action photo washed behind the whole
// card (lib/headshot/actionPhoto.js); WAR orders the cards and is not printed. A phone swipes a row; wide,
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
        {data.map((r) => (
          <li key={r.id} className="ofa__card">
            <ActionWash personId={r.id} />
            <div className="phcard__band sectionhead--band">
              <span className="phcard__photo">
                <Headshot personId={r.id} name={r.name} teamId={r.teamId} />
              </span>
              <div className="phcard__id">
                {first(r.name) && <div className="phcard__first">{first(r.name)}</div>}
                <PlayerLink id={r.id} className="phcard__last ofa__name">{last(r.name)}</PlayerLink>
                <div className="phcard__meta">{r.pos || '—'}</div>
              </div>
            </div>
            <table className="phcard__table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Split</span></th>
                  {r.fields.map((f) => (
                    <th key={f.k} scope="col" className="phcard__colk t-label t-label--nocaps">{f.k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="phcard__row">
                  <th scope="row" className="phcard__rowk">{season}</th>
                  {r.fields.map((f) => (
                    <td key={f.k} className="phcard__rowv">{f.v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </li>
        ))}
      </ol>
    </section>
  )
}

// His action photo behind the whole card. Decorative (alt ""), and removed on
// a 404 (MiLB, retired, photos off) so the card keeps its plain look.
function ActionWash({ personId }) {
  const [gone, setGone] = useState(false)
  const src = actionPhotoUrl(personId)
  if (!src || gone) return null
  return (
    <img
      className="ofa__wash"
      src={src}
      alt=""
      aria-hidden="true"
      crossOrigin={HEADSHOT_CROSS_ORIGIN}
      loading="lazy"
      decoding="async"
      onError={() => setGone(true)}
    />
  )
}
