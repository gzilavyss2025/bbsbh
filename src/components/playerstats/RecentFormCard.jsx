import { fetchHitterForm, hitterFormView } from '../../api/hitterForm.js'
import { useAsync } from '../../hooks/useAsync.js'

// The player page's recent-form card for hitters: his line over his last
// 7 / 15 / 30 games against his own full-season OPS — the hitter analog of
// PitcherWorkloadCard. Current-day only (hidden under a spoiler `asOf`
// cutoff), same rule as FoulCard/Milestone Watch/PitcherWorkloadCard: past
// days have no reason to show "recent form" at all (there's no "now" for it
// to be relative to), so it's simplest to just not fetch.
//
// Accepted drift: statsapi's `lastXGames` can include TODAY's game while it's
// still in progress (an at-bat already logged mid-game). That's the same
// footing the season/splits ledgers already stand on elsewhere on this page —
// aggregate stat lines, never a play-by-play score — so it's not a spoiler:
// no score ever lands in the DOM from this card.
export function RecentFormCard({ playerId, asOf, season }) {
  const skip = !!asOf
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchHitterForm(playerId, season)),
    [skip, playerId, season],
  )
  if (skip || !data) return null
  const view = hitterFormView(data)
  if (!view) return null

  return (
    <div className="loadcard">
      <h3 className="section__title section__title--bar">
        <span>Recent form</span>
        <em>last 30 games</em>
      </h3>
      <dl className="factgrid">
        {view.facts.map((f) => (
          <div className="fact" key={f.label}>
            <dt className="fact__label">{f.label}</dt>
            <dd className="fact__value">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
