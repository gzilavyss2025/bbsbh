import { loadHotCold } from '../../../../api/hotcold/load.js'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { slateToday } from '../../../../lib/dates.js'
import { hotColdView, toneTag } from './hotColdView.js'
import '../../../../styles/player-next/top/hot-cold.css'

// ONE callout (#1855): the kicker, the stat alone on its line, the sample, and where it
// sits in the league. The look lives here and in hot-cold.css only, so a restyle is one
// place. Tone is said in words (the card's "1 hot" tag, "Better than" / "Worse than") and
// marked by the accent rule; colour never carries it alone.
export function HotColdCallout({ callout }) {
  return (
    <div className={`pnext-hc__item pnext-hc__item--${callout.tone}`}>
      <p className="pnext-hc__kicker">{callout.kicker}</p>
      <p className="pnext-hc__figure">{callout.figure}</p>
      <p className="pnext-hc__line">{callout.rest}</p>
      <p className="pnext-hc__hint">{callout.hint}</p>
    </div>
  )
}

// The third top card, under the tiles and above Overview extras: at most two season stats that stand out
// against the league at the same sample size (api/hotcold/rule.js). A normal season, a MiLB
// player or a failed read shows nothing, and the card hides. Today's games are held back:
// the cutoff is the page's ?d= date, or the slate's today.
export function HotColdCard({ playerId, roles, season, sportId, asOf }) {
  const cutoff = asOf || slateToday()
  const { data } = useAsync(
    () => loadHotCold({ id: playerId, roles, season, sportId, cutoff }),
    [playerId, roles.join(), season, sportId, cutoff],
  )
  if (!data?.flags.length) return null
  const twoWay = roles.length > 1
  const callouts = data.flags.map((f) => hotColdView(f, { seasons: data.seasons, twoWay }))
  return (
    <Card frame="stamped" label="Standing out" count={toneTag(data.flags)} className="pnext__slot">
      <Stack gap="base" className="pnext-hc">
        {callouts.map((c) => <HotColdCallout key={c.key} callout={c} />)}
      </Stack>
    </Card>
  )
}
