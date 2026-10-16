import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Headshot } from '../../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'
import { leagueLogoUrl } from '../../../../../lib/teams.js'
import { challengeDetail } from './challengeDetail.js'
import { useDetailHover } from './useDetailHover.js'

// THE ABS CHALLENGES CARD'S LIST — every man on the club's roster who saw a
// pitch (or caught one), not only the ones the plot draws. It scrolls inside
// the card, its head stays put, and the MLB average sits pinned under the head
// as the line to read every row against. The men under the plot's floor come
// last, under a divider, and are not drawn on the plot.
//
// A row is a pick target: a tap anywhere on it picks the man, and the name is a
// link to his page. On a mouse, hovering the photo opens the app's player hover
// card with the figures that placed him on the plot; a keyboard reader gets the
// same card when focus lands in the row.
const num0 = (n) => Math.round(n).toLocaleString('en-US')

function ListRow({ job, measure, row, picked, onPick }) {
  const detail = useMemo(() => challengeDetail(job, measure, row), [job, measure, row])
  const hover = useDetailHover(row.playerId, row.name, detail)
  const success = measure === 'success'
  const over = row.qualified && (success ? row.pct != null && row.pct > job.league.success : row.over)
  const cls = ['challist__row', over ? 'challist__row--over' : '', row.qualified ? '' : 'challist__row--minor', picked ? 'is-on' : ''].filter(Boolean).join(' ')
  const figures = success ? [row.won ?? '—', row.calls, row.successText] : [row.calls, row.exposureText, row.rateText ?? '—']
  return (
    <li>
      {/* The row is a pick target for a pointer. A keyboard picks through the
          plot's faces and reaches the player through the name link. */}
      <div className={cls} data-pid={row.playerId} aria-current={picked || undefined} onClick={() => onPick(row.playerId)} {...hover.focusProps}>
        <span className="challist__photo" {...hover.anchorProps}>
          <Headshot personId={row.playerId} name={row.name} teamId={job.teamId} tint={false} className="challist__shot" />
        </span>
        <PlayerLink id={row.playerId} name={row.name}>
          <span className="challist__name">{row.name}</span>
        </PlayerLink>
        <span className="challist__figure">{figures[0]}</span>
        <span className="challist__figure">{typeof figures[1] === 'number' ? num0(figures[1]) : figures[1]}</span>
        <span className={`challist__figure challist__figure--rate${over ? ' challist__figure--over' : ''}`}>{figures[2]}</span>
      </div>
    </li>
  )
}

function AverageRow({ job, measure, picked, onPick, top }) {
  const success = measure === 'success'
  const avg = job.average
  const calls = avg ? (avg.calls >= 100 ? num0(avg.calls) : avg.calls.toFixed(1)) : '—'
  const figures = success ? ['—', calls, job.averageSuccess] : [calls, avg ? num0(avg.exposure) : '—', job.averageRate]
  return (
    <li className="challist__avg" style={{ top }}>
      <div className={`challist__row${picked ? ' is-on' : ''}`} aria-current={picked || undefined} onClick={() => onPick('mlb')}>
        <span className="challist__photo">
          <span className="shot challist__shot">
            <img className="challist__mlb" src={leagueLogoUrl()} alt="" />
          </span>
        </span>
        <span className="challist__name">MLB average</span>
        <span className="challist__figure">{figures[0]}</span>
        <span className="challist__figure">{figures[1]}</span>
        <span className="challist__figure challist__figure--rate">{figures[2]}</span>
      </div>
    </li>
  )
}

export function ChallengeList({ job, measure, pick, onPick }) {
  const success = measure === 'success'
  const scrollRef = useRef(null)
  const headRef = useRef(null)
  const [headH, setHeadH] = useState(0)
  useLayoutEffect(() => {
    const el = headRef.current
    if (!el) return undefined
    const read = () => setHeadH(el.offsetHeight)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const groups = useMemo(() => {
    const order = success ? (a, b) => b.calls - a.calls || b.exposure - a.exposure : (a, b) => b.exposure - a.exposure
    return [job.rows.filter((r) => r.qualified).sort(order), job.rows.filter((r) => !r.qualified).sort(order)]
  }, [job, success])

  // A pick made on the plot brings its row into view, under the pinned head and
  // the pinned average.
  useEffect(() => {
    if (!pick.fromPlot) return
    const box = scrollRef.current
    const row = box?.querySelector('[aria-current="true"]')?.closest('li')
    if (!box || !row) return
    const avg = box.querySelector('.challist__avg')
    const pinned = headH + (avg ? avg.offsetHeight : 0)
    if (row.offsetTop - pinned < box.scrollTop) box.scrollTop = row.offsetTop - pinned
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight
  }, [pick, headH])

  const plotted = job.plotted.length
  return (
    <div className="challist">
      <div ref={scrollRef} className="challist__scroll" tabIndex={0} role="region" aria-label={`Every ${job.where === 'at the plate' ? 'hitter' : 'catcher'} on the club, scrolls`}>
        <div ref={headRef} className="challist__head">
          <span className="challist__floor">
            {plotted} of {job.rows.length} plotted · {job.floorText}
          </span>
          <span>{success ? 'Won' : 'Calls'}</span>
          <span>{success ? 'Called' : job.exposureLabel}</span>
          <span>Rate</span>
        </div>
        <ul className="challist__rows">
          <AverageRow job={job} measure={measure} picked={pick.id === 'mlb'} onPick={onPick} top={headH} />
          {groups[0].map((r) => (
            <ListRow key={r.playerId} job={job} measure={measure} row={r} picked={pick.id === r.playerId} onPick={onPick} />
          ))}
          {groups[1].length > 0 && <li className="challist__sep">Under {job.floorText}</li>}
          {groups[1].map((r) => (
            <ListRow key={r.playerId} job={job} measure={measure} row={r} picked={pick.id === r.playerId} onPick={onPick} />
          ))}
        </ul>
      </div>
    </div>
  )
}
