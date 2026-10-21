import { useId, useLayoutEffect, useRef, useState } from 'react'
import { loadHotCold } from '../../../../api/hotcold/load.js'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { LeaderRow } from '../../../../components/ui/frame/LeaderList.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { slateToday } from '../../../../lib/dates.js'
import { leaderListClassName } from '../../../../lib/design/report/classes.js'
import { PREVIEW, hotColdView, toneTag } from './hotColdView.js'
import '../../../../styles/player-next/top/hot-cold.css'

// The steps a long name takes to fit: 18px, 16px, 14px, then 14px on two lines (a 320px
// phone leaves the name column about 80px).
export const FIT_STEPS = ['', 'field', 'ui', 'wrap']

// A name that shrinks to fit its leader row (Gary, 2026-10-20): while the row's name box
// overflows, the next step is tried; the last wraps the name onto a second line, so only a
// single word too long for the column still meets the box's ellipsis. Measured again whenever the row's width changes. The step is a data attribute, so
// hot-cold.css owns the sizes.
function FitName({ children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!box) return undefined
    const fit = () => {
      let step = 0
      el.dataset.fit = FIT_STEPS[step]
      while (box.scrollWidth > box.clientWidth && step < FIT_STEPS.length - 1) el.dataset.fit = FIT_STEPS[++step]
    }
    fit()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    watch?.observe(box)
    return () => watch?.disconnect()
  }, [children])
  return <span ref={ref} className="pnext-hc__fit">{children}</span>
}

// ONE callout (#1855, design B): the sentence as the headline, his figure and sample under
// it, then the seasons behind the count as leader rows (ADR-0112): rank, headshot, name,
// "2022 · Padres", figure, and mid-season where that season ended ("ended .403", #1855
// slice 3, design A) with one line under the list that sums it up. His own row is marked
// ('mine'). The top PREVIEW show; a door
// opens the rest. The look lives here and in hot-cold.css only, so a restyle is one place.
// Tone is said in words (the card's "1 hot" tag, "better" / "worse") and marked by the
// accent rule; colour never carries it alone.
export function HotColdCallout({ callout, selfId }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const rows = callout.list?.rows ?? []
  const shown = open || rows.length <= PREVIEW + 1 ? rows : rows.slice(0, PREVIEW)
  return (
    <div className={`pnext-hc__item pnext-hc__item--${callout.tone}`}>
      <p className="pnext-hc__headline">{callout.headline}</p>
      <p className="pnext-hc__line">{callout.line}</p>
      {shown.length > 0 && (
        <ol id={listId} className={`${leaderListClassName({})} pnext-hc__list`}>
          {shown.map((r) => (
            <LeaderRow
              key={`${r.id ?? 'self'}:${r.sub}`}
              rank={r.rank}
              state={r.self ? 'mine' : undefined}
              mark={<Headshot personId={r.self ? selfId : r.id} name={r.name} className="pnext-hc__shot" />}
              name={<FitName>{r.self ? r.name : <PlayerLink id={r.id} name={r.name}>{r.name}</PlayerLink>}</FitName>}
              sub={r.sub}
              figure={r.value}
              unit={r.unit}
            />
          ))}
        </ol>
      )}
      {open && callout.list?.more > 0 && <p className="pnext-hc__note">{`And ${callout.list.more} more.`}</p>}
      {callout.list?.finish && <p className="pnext-hc__note">{callout.list.finish.sentence}</p>}
      {(open || shown.length < rows.length) && (
        <Door layout="block" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : callout.list.door}
        </Door>
      )}
    </div>
  )
}

// The third top card, under the tiles and above Overview extras: at most two season stats
// that stand out against the league at the same sample size (api/hotcold/rule.js). A normal
// season, a MiLB player or a failed read shows nothing, and the card hides. Today's games
// are held back: the cutoff is the page's ?d= date, or the slate's today.
export function HotColdCard({ playerId, name, roles, season, sportId, asOf }) {
  const cutoff = asOf || slateToday()
  const { data } = useAsync(
    () => loadHotCold({ id: playerId, roles, season, sportId, cutoff }),
    [playerId, roles.join(), season, sportId, cutoff],
  )
  if (!data?.flags.length) return null
  const twoWay = roles.length > 1
  const callouts = data.flags.map((f) => hotColdView(f, { seasons: data.seasons, twoWay, name, season: Number(season) }))
  return (
    <Card frame="stamped" label="Standing out" count={toneTag(data.flags)} className="pnext__slot">
      <Stack gap="base" className="pnext-hc">
        {callouts.map((c) => <HotColdCallout key={c.key} callout={c} selfId={playerId} />)}
      </Stack>
    </Card>
  )
}
