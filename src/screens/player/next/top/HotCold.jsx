import { useId, useState } from 'react'
import { loadHotCold } from '../../../../api/hotcold/load.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { slateToday } from '../../../../lib/dates.js'
import { hotColdView, toneTag } from './hotColdView.js'
import '../../../../styles/player-next/top/hot-cold.css'

// The seasons behind the count, ranked, his own in its place (marked, not linked: it is
// this page). Each other name opens that player's page.
function SeasonList({ id, list }) {
  return (
    <div id={id}>
      <ol className="pnext-hc__list">
        {list.rows.map((r) => (
          <li key={`${r.id ?? 'self'}:${r.season}`} className={r.self ? 'pnext-hc__row pnext-hc__row--self' : 'pnext-hc__row'}>
            <span className="pnext-hc__rank">{r.rank}</span>
            <span className="pnext-hc__who">
              {r.self ? r.name : <PlayerLink id={r.id} name={r.name}>{r.name}</PlayerLink>}
              {` · ${r.season}`}
            </span>
            <span className="pnext-hc__val">{r.value}</span>
          </li>
        ))}
      </ol>
      {list.more > 0 && <p className="pnext-hc__hint">{`And ${list.more} more.`}</p>}
    </div>
  )
}

// ONE callout (#1855): the kicker, the stat alone on its line, the sample, and the
// sentence that says how many past seasons were further out. A door under it opens those
// seasons in place. The look lives here and in hot-cold.css only, so a restyle is one
// place. Tone is said in words (the card's "1 hot" tag, "better" / "worse") and marked by
// the accent rule; colour never carries it alone.
export function HotColdCallout({ callout }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  return (
    <div className={`pnext-hc__item pnext-hc__item--${callout.tone}`}>
      <p className="pnext-hc__kicker">{callout.kicker}</p>
      <p className="pnext-hc__figure">{callout.figure}</p>
      <p className="pnext-hc__line">{callout.rest}</p>
      <p className="pnext-hc__hint">{callout.hint}</p>
      {callout.list && (
        <>
          {open && <SeasonList id={listId} list={callout.list} />}
          <Door layout="block" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen(!open)}>
            {open ? 'Hide the list' : `See ${callout.count === 1 ? 'the season' : `all ${callout.count}`}`}
          </Door>
        </>
      )}
    </div>
  )
}

// The third top card, under the tiles and above Overview extras: at most two season stats that stand out
// against the league at the same sample size (api/hotcold/rule.js). A normal season, a MiLB
// player or a failed read shows nothing, and the card hides. Today's games are held back:
// the cutoff is the page's ?d= date, or the slate's today.
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
        {callouts.map((c) => <HotColdCallout key={c.key} callout={c} />)}
      </Stack>
    </Card>
  )
}
