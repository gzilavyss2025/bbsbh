import { useMemo } from 'react'
import { selectDueUpDuring } from '../../api/dueup.js'
import { computeBatterLine, preGameAvg } from '../../api/boxscore.js'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'

// Focus mode's desktop-only console card (ADR-0043 follow-up): the next few
// batters scheduled to come up in the half currently being scored, filling
// the width `.consolebar` frees once the scorebug narrows back to its old
// dock width (24-floating-nav-and-hud.css). Hidden below the wide breakpoint
// itself (styles/focus/reference.css) — the scorebug needs the row's full
// width there for its own bumped-up mobile sizing instead.
//
// SPOILER FOOTING: entirely selectDueUpDuring's (api/dueup.js) — a mid-half
// pinch-hitter never surfaces here ahead of his own notice card in the feed,
// since lineupEntering only ever names who occupied a slot as the half BEGAN.
// `computeBatterLine`/`preGameAvg` are the same cutoff-gated tier the
// Pitchers table stands on (ADR-0009): safe to call from render top level,
// because each takes `revealedThrough` as its own hard boundary rather than
// relying on a SealBox closure.
export function DueUpConsole({ feed, inning, half, revealedThrough, stepAtBatIndex, teamId, count = 3 }) {
  const info = useMemo(
    () => selectDueUpDuring(feed, inning, half, revealedThrough, stepAtBatIndex, count),
    [feed, inning, half, revealedThrough, stepAtBatIndex, count],
  )
  if (!info) return null

  const lineFor = (id) => {
    const box = feed?.liveData?.boxscore?.teams?.[info.battingSide]?.players?.[`ID${id}`]
    if (!box) return '—'
    const { hits, atBats } = computeBatterLine(feed, id, revealedThrough)
    if (atBats > 0 || hits > 0) return `${hits}-${atBats}`
    return preGameAvg(box)
  }

  return (
    <div className="dueupconsole">
      {info.batters.map((b) => (
        <div className="dueupconsole__col" key={b.id}>
          <Headshot personId={b.id} name={b.last} teamId={teamId} className="dueupconsole__shot" />
          <div className="dueupconsole__info">
            <span className="dueupconsole__order">{b.slot}</span>
            <PlayerLink id={b.id} className="dueupconsole__name">
              {b.first && <span className="dueupconsole__first">{b.first}</span>}
              <span className="dueupconsole__last">{b.last}</span>
            </PlayerLink>
            <span className="dueupconsole__line">{lineFor(b.id)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
