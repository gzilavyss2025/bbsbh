import { halfIndex } from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { ordinal } from '../lib/format.js'

// The running line at the top of the innings view. It "builds as you reveal":
// each half you uncover drops its runs into this grid; halves you haven't
// revealed stay blank (·). It only reads a linescore value along a reveal path:
// a cell is read only when its half-index is at or below `revealedThrough`, so
// nothing sealed is ever computed into the grid.
//
// It doubles as the half-inning navigator: every run cell is a button that jumps
// to that half (away row = tops, home row = bottoms), with the current half
// highlighted — so selecting a half reads like reading a line score, no separate
// scrolling chip strip. The Back/Next nav above covers the full unlocked range in
// the rare extra-innings case where the visible window has scrolled a half off.
//
// The grid can only hold `regulation` inning columns, so once extra innings
// unlock it scrolls that window forward — dropping inning 1 when inning 10
// appears, inning 2 for 11, and so on — while the R/H/E totals stay cumulative
// over every revealed inning.
export function RollingLine({
  feed,
  regulation,
  unlocked,
  revealedThrough,
  awayAbbr,
  homeAbbr,
  awayName,
  homeName,
  curIdx,
  onSelect,
}) {
  const firstCol = Math.max(1, unlocked - regulation + 1)
  const cols = []
  for (let n = firstCol; n <= unlocked; n++) cols.push(n)

  const lineFor = (n, half, side) =>
    halfIndex(n, half) <= revealedThrough ? revealInning(feed, n, side) : null

  // Team label: the mascot/club name ("BREWERS", "WHITE SOX"), falling back to
  // the abbreviation for a thin MiLB feed that never posted a clubName.
  const rows = [
    { abbr: awayName || awayAbbr || 'AWY', half: 'top', side: 'away' },
    { abbr: homeName || homeAbbr || 'HOM', half: 'bottom', side: 'home' },
  ]

  // Totals span every revealed inning (1..unlocked), not just the visible window.
  // R/H are batting stats gated on the batting half; E is a *fielding* stat, so
  // it accrues in — and is gated on — the opposite (fielding) half. Gating E on
  // the batting half would leak the fielding half's errors before it's revealed.
  const totals = (battingHalf, side) => {
    const fieldingHalf = battingHalf === 'top' ? 'bottom' : 'top'
    let r = 0, h = 0, e = 0, any = false
    for (let n = 1; n <= unlocked; n++) {
      if (halfIndex(n, battingHalf) <= revealedThrough) {
        const l = revealInning(feed, n, side)
        if (l) { any = true; r += l.runs; h += l.hits }
      }
      if (halfIndex(n, fieldingHalf) <= revealedThrough) {
        e += revealInning(feed, n, side)?.errors ?? 0
      }
    }
    return { r, h, e, any }
  }

  return (
    <section className="rolling" aria-label="Running line">
      <div className="rolling__scroll">
        <table className="rolling__grid">
          <thead>
            <tr>
              <th className="rolling__corner" />
              {cols.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th className="rolling__tot">R</th>
              <th className="rolling__tot">H</th>
              <th className="rolling__tot">E</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const t = totals(row.half, row.side)
              return (
                <tr key={row.side}>
                  <th className="rolling__team">{row.abbr}</th>
                  {cols.map((n) => {
                    const l = lineFor(n, row.half, row.side)
                    const idx = halfIndex(n, row.half)
                    const active = idx === curIdx
                    return (
                      <td key={n} className="rolling__cell">
                        <button
                          type="button"
                          className={`rolling__pick ${active ? 'is-active' : ''} ${
                            l ? '' : 'rolling__pending'
                          } ${l && l.runs > 0 ? 'rolling__runs' : ''}`}
                          aria-current={active ? 'true' : undefined}
                          // The label must carry the cell's value too — it
                          // overrides the visible text in the accessible name,
                          // and "Top of inning 3" alone hides both the runs
                          // and the sealed/revealed distinction from a screen
                          // reader. Revealed runs are only read here when the
                          // half is already at/under the reveal mark.
                          aria-label={`${row.half === 'top' ? 'Top' : 'Bottom'} of the ${ordinal(n)}${
                            l ? `, ${l.runs} run${l.runs === 1 ? '' : 's'}` : ', sealed'
                          }`}
                          onClick={() => onSelect(idx)}
                        >
                          {l ? l.runs : '·'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="rolling__tot">{t.any ? t.r : '·'}</td>
                  <td className="rolling__tot">{t.any ? t.h : '·'}</td>
                  <td className="rolling__tot">{t.any ? t.e : '·'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
