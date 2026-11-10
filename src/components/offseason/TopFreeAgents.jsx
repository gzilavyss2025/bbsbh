import { useState } from 'react'
import { fetchTopFreeAgents, TOP_GROUPS } from '../../api/free-agents/freeAgents.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useRouteLink } from '../../lib/nav.js'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Chips } from '../ui/control/Chips.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { actionPhotoUrl } from '../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'


// TOP FREE AGENTS — the MLB offseason page's block between the winter
// calendar and the wire (wireframe approved by Gary, 2026-11-10). The best
// six unsigned major leaguers by WAR, filtered by group (All, SP, RP, CL, C,
// IF, OF, DH), read from a nightly file (scripts/gen-top-free-agents.mjs) so a
// signing is replaced by the next best the next morning; each drawn as the player hover card
// (PlayerHoverCard.jsx: navy band, photo, two-line name, four-stat table,
// no crest since no club holds him), and his action photo washed into the band
// behind the name (lib/headshot/actionPhoto.js); WAR orders the cards and is not printed. A phone swipes a row; wide,
// a grid. The one door opens the full class at /free-agents.
// Open surface (ADR-0034): season stats, no game result. Loading or a failed
// read shows nothing, and the calendar meets the wire as before.
export function TopFreeAgents({ season }) {
  const { data: file } = useAsync(() => fetchTopFreeAgents(), [])
  const linkProps = useRouteLink()
  const [group, setGroup] = useState('all')
  // A file for another class is not this winter's list.
  const groups = Number(file?.season) === Number(season) ? file.groups : null
  if (!groups?.all?.length) return null
  const options = ['all', ...TOP_GROUPS]
    .filter((g) => groups[g]?.length)
    .map((g) => ({ value: g, label: g === 'all' ? 'All' : g }))
  const data = groups[group] ?? groups.all

  return (
    <section className="ofa" aria-label="Top free agents">
      <div className="ofa__head">
        <SectionHead as="h2" className="ofa__title">Top free agents</SectionHead>
        <Door href="/free-agents" {...linkProps}>All free agents</Door>
      </div>
      <Chips label="Position" options={options} value={group} onChange={setGroup} className="ofa__chips" />
      <ol className="ofa__list">
        {data.map((r) => (
          <li key={r.id} className="ofa__card">
            <div className="phcard__band sectionhead--band">
              <ActionWash personId={r.id} />
              <span className="phcard__photo">
                <Headshot personId={r.id} name={r.name} teamId={r.teamId} />
              </span>
              <div className="phcard__id">
                <PlayerLink id={r.id} className="ofa__name" ariaLabel={r.name}>
                  {r.first && <span className="phcard__first">{r.first}</span>}
                  <span className="phcard__last">{r.last}</span>
                </PlayerLink>
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

// His action photo in the band, fading in from behind the name. Decorative (alt ""), and removed on
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
      crossOrigin={HEADSHOT_CROSS_ORIGIN}
      loading="lazy"
      decoding="async"
      onError={() => setGone(true)}
    />
  )
}
