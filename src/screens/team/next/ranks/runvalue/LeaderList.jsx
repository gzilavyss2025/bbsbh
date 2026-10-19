import { useMemo } from 'react'
import { COMPONENTS, clubLeaders, signed, tone } from '../../../../../api/around-the-game/runValue.js'
import { RunValueTrack, splitScale } from '../../../../../components/around-the-game/RunValueParts.jsx'
import { Headshot } from '../../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'

// The run value card's top six (#2295), re-ranked by the part the reader picked.
//
// Every man on any of the five boards (the total and the four parts, at most 30) keeps ONE row node,
// keyed by his id, so a man who stays on the board slides to his new place instead of stamping in
// again (flip.js). The DOM is in rank order: the six on the board first, then the rest. A man off
// the board is hidden, aria-hidden and out of the Tab order (visibility), and draws a zero-width bar:
// on a small board's scale his own bar would run past the card and scroll the page sideways.
//
// A man who joins the board on a tap stamps in, after the others have started to slide. The
// keyframe is one of two identical ones picked by the tap count's parity, because a changed
// animation-name restarts an animation and a changed delay does not.
export const BOARD_KEYS = ['total', ...COMPONENTS.map((c) => c.key)]
const LEAD_H = 104
const ROW_H = 77
const topOf = (i) => (i <= 0 ? 0 : LEAD_H + (i - 1) * ROW_H)
export const listHeight = (n) => (n > 0 ? topOf(n - 1) + (n === 1 ? LEAD_H : ROW_H) : 0)

export function LeaderList({ club, part, prev, gen, ref }) {
  const everyone = useMemo(() => {
    const seen = new Map()
    for (const key of BOARD_KEYS) for (const p of clubLeaders(club, key)) if (!seen.has(p.id)) seen.set(p.id, p)
    return [...seen.values()]
  }, [club])
  const board = clubLeaders(club, part)
  const ids = board.map((p) => p.id)
  const scale = splitScale(board)
  const rows = [...board, ...everyone.filter((p) => !ids.includes(p.id))]
  const selected = part === 'total' ? null : part
  return (
    <ol ref={ref} className="rvlead" style={{ height: `${listHeight(board.length)}px` }}>
      {rows.map((p) => {
        const i = ids.indexOf(p.id)
        const shown = i >= 0
        const lead = i === 0
        const entering = shown && gen > 0 && !prev?.includes(p.id)
        // A face loads only for a man on the board, or leaving it on this tap (he fades out): the
        // other rows are hidden, and their photos would all load with the card for nothing.
        const face = shown || Boolean(prev?.includes(p.id))
        const value = part === 'total' ? p.total : p[part]
        const cls = [
          'rvrow',
          lead && 'rvrow--lead',
          !shown && 'rvrow--off',
          entering && `rvrow--enter-${gen % 2 ? 'b' : 'a'}`,
        ]
        return (
          <li
            key={p.id}
            data-flip={`row:${p.id}`}
            data-shown={shown}
            className={cls.filter(Boolean).join(' ')}
            aria-hidden={shown ? undefined : true}
            style={{ top: `${topOf(i)}px`, '--i': Math.max(i, 0) }}
          >
            <span className="rvrow__rank">{shown ? i + 1 : ''}</span>
            <span className="rvrow__frame" data-flip={`frame:${p.id}`}>
              {face ? <Headshot personId={p.id} name={p.name} teamId={p.teamId} className="rvrow__shot" tint={false} /> : null}
            </span>
            <span className="rvrow__body">
              <span className="rvrow__name">
                <PlayerLink id={p.id} name={p.name}>
                  {p.name}
                </PlayerLink>
              </span>
              <span className="rvrow__line">
                <span className="rvrow__pos">{p.pos}</span>
                <RunValueTrack entry={shown ? p : null} scale={scale} selected={selected} mini flip={p.id} />
              </span>
            </span>
            <span
              className={`rvrow__value rv__num--${tone(value)}`}
              data-count={value}
              data-count-at={shown ? `${900 + i * 55},900` : undefined}
            >
              {signed(value)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
