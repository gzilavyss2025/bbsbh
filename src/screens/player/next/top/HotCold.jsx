import { useId, useState } from 'react'
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

// ONE callout (#1855, design B): the sentence as the headline, his figure and sample under
// it, then the seasons behind the count as leader rows (ADR-0112): rank, headshot, name,
// "2022 · Padres", figure. His own row is marked ('mine'). The top PREVIEW show; a door
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
              name={r.self ? r.name : <PlayerLink id={r.id} name={r.name}>{r.name}</PlayerLink>}
              sub={r.sub}
              figure={r.value}
            />
          ))}
        </ol>
      )}
      {open && callout.list?.more > 0 && <p className="pnext-hc__note">{`And ${callout.list.more} more.`}</p>}
      {(open || shown.length < rows.length) && (
        <Door layout="block" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `See all ${rows.length}`}
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
