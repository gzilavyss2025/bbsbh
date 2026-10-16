import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { managerPath } from '../../../../lib/route.js'
import { fetchCoachingStaff } from '../../../../api/staff/coaches.js'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { IconButton } from '../../../../components/ui/control/IconButton.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { seasonOf } from '../../data/shared.js'
import { rangeLabel } from './coachingData.js'
import '../../../../styles/team-next/coaching.css'

// The Coaching staff card (Roster band): every coach the club's /coaches feed lists, as headshots
// you swipe through, the manager first on the ink tone. Open surface (ADR-0034): a staff is no
// score. It owns its read (`fetchCoachingStaff`), so the Roster loader and its jump-bar count
// are untouched. A club with no staff on file (MiLB feeds often have none) draws nothing, and
// so does a failed read: missing data is quiet.
// [DECISION: each slide opens that person's career page (`/manager/{id}`), the page the manager
// link already uses. It lists any staff job, so it works for a bench coach or a bullpen catcher.]
const EMPTY = { first: 1, last: 1, left: 0, share: 1 }

export function CoachingStaff({ team, asOf, sportId }) {
  const season = seasonOf(asOf, sportId)
  const { data } = useAsync(() => fetchCoachingStaff(team.id, season), [team.id, season])
  const linkProps = useRouteLink()
  const track = useRef(null)
  const [view, setView] = useState(EMPTY)
  const total = data?.length ?? 0

  // Which slides sit fully inside the track, and how far along it is scrolled. A half-seen
  // slide at the edge is the peek that says "swipe", so it is not counted.
  const measure = useCallback(() => {
    const t = track.current
    if (!t) return
    const edge = t.getBoundingClientRect().left
    let first = 0
    let last = 0
    t.querySelectorAll('li').forEach((li, i) => {
      const r = li.getBoundingClientRect()
      if (r.left - edge >= -2 && r.right - edge <= t.clientWidth + 2) {
        if (!first) first = i + 1
        last = i + 1
      }
    })
    const next = {
      first: first || 1,
      last: last || first || 1,
      left: t.scrollWidth ? t.scrollLeft / t.scrollWidth : 0,
      share: t.scrollWidth ? t.clientWidth / t.scrollWidth : 1,
    }
    setView((v) => (v.first === next.first && v.last === next.last && v.left === next.left && v.share === next.share ? v : next))
  }, [])
  // Before paint, so the first frame reads the real slides in view, not the empty guess.
  useLayoutEffect(() => {
    if (!total) return undefined
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [total, measure])

  if (!total) return null
  const page = (dir) => {
    const t = track.current
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    t?.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: still ? 'auto' : 'smooth' })
  }

  return (
    <Card frame="stamped" label="Coaching staff" labelAs="h3" body="flush" className="coachstaff" stampIn>
      <ul ref={track} role="list" className="coachstaff__track" tabIndex={0} aria-label="Coaching staff, scroll sideways" onScroll={measure}>
        {data.map((c) => (
          <li key={c.id} className={`coachstaff__slide${c.manager ? ' coachstaff__slide--lead' : ''}`}>
            <a className="coachstaff__link" {...linkProps(managerPath(c.id, c.name))}>
              <span className="coachstaff__photo">
                <Headshot personId={c.id} name={c.name} teamId={team.id} coach tint={false} />
                {c.jersey && <span className="coachstaff__num">{c.jersey}</span>}
              </span>
              <Stack gap="tight" className="coachstaff__text">
                <span className="coachstaff__name">{c.name}</span>
                <span className="coachstaff__role">{c.title}</span>
              </Stack>
            </a>
          </li>
        ))}
      </ul>
      <div className="coachstaff__foot">
        <p className="coachstaff__pos">{rangeLabel(view.first, view.last, total)}</p>
        <div className="coachstaff__rule" aria-hidden="true">
          <span style={{ left: `${view.left * 100}%`, width: `${view.share * 100}%` }} />
        </div>
        <IconButton label="Previous coaches" skin="outline" className="coachstaff__btn" disabled={view.first <= 1} onClick={() => page(-1)}>‹</IconButton>
        <IconButton label="Next coaches" skin="outline" className="coachstaff__btn" disabled={view.last >= total} onClick={() => page(1)}>›</IconButton>
      </div>
    </Card>
  )
}
