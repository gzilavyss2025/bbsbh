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
              <th>PA</th>
              <th>AVG</th>
              <th>OPS</th>
              {view.hasBars && (
                <>
                  {/* Hidden from the accessibility tree: every cell under it is
                      itself aria-hidden (the bar is decoration over the +/− OPS
                      column beside it), so an announced column head would lead a
                      screen-reader user into a column with nothing in it. */}
                  <th className="formtrend__barhead" aria-hidden="true">
                    <span className="formtrend__axis">
                      <span>−.300</span>
                      <span>0</span>
                      <span>+.300</span>
                    </span>
                  </th>
                  <th className="formtrend__deltahead">+/− OPS</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={[r.isAnchor && 'formtrend__anchor', r.thin && 'formtrend__thin']
                  .filter(Boolean)
                  .join(' ') || undefined}
              >
                <td className="lft yr">{r.label}</td>
                <td>{r.pa}</td>
                <td>{r.avg}</td>
                <td>{r.ops}</td>
                {view.hasBars && (
                  <>
                    <td className="formtrend__bar">
                      <DeviationBar row={r} />
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

      {/* Kept to two lines on a phone. Under the global caps invariant, long
          prose is the worst-performing text in this system — all-caps kills
          word-shape recognition, so the sentence carrying the caveat is exactly
          the one a reader skips. The scale itself moved into the column head as
          ticks so it no longer has to be described here. */}
      <p className="hint formtrend__note">
        Windows overlap. A bar inside its pale band is luck, not form.
      </p>
    </div>
  )
}

// One row's distance from the season line, drawn from a centre axis: kraft
// amber to the hot side, navy to the cold side. A diverging bar is the honest
// form here because the quantity really is signed and really does have a
// meaningful zero — the season line — and that zero is printed as its own row
// directly under the bars, so the axis is never an unlabelled claim.
//
// NOT --accent-positive/--accent-negative. Those mean good and bad, and neither
// end of this scale is either: a .684 hitter having a .700 week is still a .684
// hitter, and a .900 bat at .850 is still mashing. The umpire zone-lean ramp
// (styles/53-umpire-tendencies.css) turned the same pair down for the same
// reason and went to navy/kraft; this follows it. The red/green pair also fails
// colour-blind separation outright (ΔE 4.4 under protanopia), where these two
// differ in lightness as well as hue.
//
// Behind the bar sits that window's own NOISE BAND — ±1 standard error at its
// own sample size, so it is wide on a 7-game window and narrow on a 30-game
// one. That band is the whole reason this card can be trusted: without it, the
// shortest window draws the longest bar for every hitter in the league, every
// day, and a reader sees a slump in the arithmetic of small denominators.
//
// The anchor row draws the axis alone: it is the zero, so it has no length.
function DeviationBar({ row }) {
  if (row.isAnchor || row.lean == null) {
    return <span className="devbar devbar--axis" aria-hidden="true" />
  }
  const side = row.lean < 0 ? 'is-down' : 'is-up'
  return (
    <span className={`devbar ${side}${row.clamped ? ' is-clamped' : ''}`} aria-hidden="true">
      {row.band != null && (
        <span className="devbar__band" style={{ width: `${row.band * 100}%` }} />
      )}
      <span className="devbar__fill" style={{ width: `${Math.abs(row.lean) * 50}%` }} />
    </span>
  )
}
