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
      {/* The note names what the card MEASURES AGAINST, not the windows — the
          Window column below already lists those, and a subtitle that repeats
          the first column teaches nobody anything. */}
      <h3 className="section__title section__title--bar">
        <span>Recent form</span>
        <em>vs. his season line</em>
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
                  {/* Empty, and hidden from the accessibility tree: every cell
                      under it is itself aria-hidden (the bar is decoration over
                      the +/− OPS column beside it), so an announced column head
                      would lead a screen-reader user into a column with nothing
                      in it. It used to print −.300 / 0 / +.300 tick labels,
                      which sat in the same row as PA and AVG and so read as a
                      third set of figures — a second scale for a quantity the
                      column beside it already prints in full. */}
                  <th className="formtrend__barhead" aria-hidden="true" />
                  <th className="formtrend__deltahead">+/− OPS</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.isAnchor ? 'formtrend__anchor' : undefined}>
                <td className="lft yr">{r.label}</td>
                <td>{r.pa}</td>
                <td>{r.avg}</td>
                <td>{r.ops}</td>
                {view.hasBars && (
                  <>
                    <td className="formtrend__bar">
                      <DeviationBar row={r} />
                    </td>
                    {/* The season row's delta cell stays EMPTY. It used to
                        print the word "baseline", which is the one piece of
                        vocabulary on the card a casual fan would have to be
                        taught; the row is already tinted, ruled off and
                        labelled Season, and a blank cell in a signed column is
                        read as zero by anyone who has looked at a ledger. */}
                    <td className="formtrend__delta">{r.isAnchor ? '' : r.deltaText}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The counting line for the widest window, as a caption under the table
          rather than a bordered chip. A card inside a card made the page read
          as four stacked containers where there is only one idea, and the chip
          repeated a row label printed two lines above it. */}
      {view.footer && (
        <p className="formtrend__count">
          <span className="formtrend__count-k">Last 30</span>
          <span className="formtrend__count-v">{view.footer}</span>
        </p>
      )}
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
// A window that does not clear its own standard error draws an EMPTY TRACK —
// the groove and the zero rule, and nothing in them. That is the whole guard
// against the arithmetic this card sits in: the shortest window is the noisiest
// one, so it would otherwise draw the longest bar for every hitter in the
// league, every day, and three windows fanning out would read as "he is cooling
// fast" when it is the denominator.
//
// This replaced a pale ±1 SE band painted BEHIND each bar. The band was honest
// but unreadable — at phone width it read as a two-tone bar, and it needed a
// line of prose under the card to say which tone meant what. Withholding the
// bar says the same thing with no legend: the figures stay in the row, so
// nothing is hidden, and only the claim is withheld. The anchor row is empty
// for the plainer reason that it IS the zero, so it has no length.
function DeviationBar({ row }) {
  // Two different empties. The anchor draws the zero rule alone (no groove: it
  // is the baseline, not a window that came up short). A window inside its own
  // noise keeps the groove, so the column plainly reads as a place where a bar
  // can appear and did not, rather than as a missing cell.
  if (row.isAnchor) return <span className="devbar devbar--axis" aria-hidden="true" />
  if (row.lean == null) return <span className="devbar" aria-hidden="true" />
  const side = row.lean < 0 ? 'is-down' : 'is-up'
  return (
    <span className={`devbar ${side}${row.clamped ? ' is-clamped' : ''}`} aria-hidden="true">
      <span className="devbar__fill" style={{ width: `${Math.abs(row.lean) * 50}%` }} />
    </span>
  )
}
