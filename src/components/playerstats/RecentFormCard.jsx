import '../../styles/26b-recent-form.css'
import { fetchHitterForm, hitterFormView } from '../../api/hitterForm.js'
import { useAsync } from '../../hooks/useAsync.js'

// The player page's recent-form card for hitters: his last 7 / 15 / 30 games
// read against his own full-season line — the hitter analog of
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
//
// The card is a four-row ledger, not a fact grid, because the thing it reports
// is a TREND: three nested windows narrowing toward now, and under them the
// season line they are all measured against. See hitterFormView's header for
// why the shape had to change; the deviation bars are drawn here.
export function RecentFormCard({ playerId, asOf, season }) {
  const skip = !!asOf
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchHitterForm(playerId, season)),
    [skip, playerId, season],
  )
  if (skip || !data) return null
  const view = hitterFormView(data)
  if (!view) return null

  const rows = view.anchor ? [...view.rows, view.anchor] : view.rows

  return (
    <div className="formtrend">
      <h3 className="section__title section__title--bar">
        <span>Recent form</span>
        <em>last 7 · 15 · 30 games</em>
      </h3>

      <div className="ledger-wrap">
        <table className="ledger formtrend__table">
          <thead>
            <tr>
              <th className="lft">Window</th>
              <th>AB</th>
              <th>AVG</th>
              <th>OPS</th>
              {view.hasBars && (
                <>
                  <th className="formtrend__barhead">Colder / hotter</th>
                  <th className="formtrend__deltahead">+/− OPS</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.isAnchor ? 'formtrend__anchor' : undefined}>
                <td className="lft yr">{r.label}</td>
                <td>{r.ab}</td>
                <td>{r.avg}</td>
                <td>{r.ops}</td>
                {view.hasBars && (
                  <>
                    <td className="formtrend__bar">
                      <DeviationBar lean={r.lean} clamped={r.clamped} anchor={r.isAnchor} />
                    </td>
                    <td className="formtrend__delta">
                      {r.isAnchor ? <span className="formtrend__zero">baseline</span> : r.deltaText}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.footer && (
        <p className="formtrend__count">
          <span className="formtrend__count-k">Last 30</span>
          <span className="formtrend__count-v">{view.footer}</span>
        </p>
      )}

      <p className="hint formtrend__note">
        Windows overlap — the last 7 games sit inside the last 30. A full bar is 300
        points of OPS.
      </p>
    </div>
  )
}

// One row's distance from the season line, drawn from a centre axis: right and
// green for better than himself, left and clay for worse. A diverging bar is
// the honest form here because the quantity really is signed and really does
// have a meaningful zero — the season line — and that zero is printed as its
// own row directly under the bars, so the axis is never an unlabelled claim.
// The anchor row draws the axis alone: it is the zero, so it has no length.
function DeviationBar({ lean, clamped, anchor }) {
  if (anchor || lean == null) return <span className="devbar devbar--axis" aria-hidden="true" />
  const pct = Math.abs(lean) * 50
  const side = lean < 0 ? 'is-down' : 'is-up'
  return (
    <span className={`devbar ${side}${clamped ? ' is-clamped' : ''}`} aria-hidden="true">
      <span className="devbar__fill" style={{ width: `${pct}%` }} />
    </span>
  )
}
