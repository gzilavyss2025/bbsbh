import { PlayerLink } from '../player/PlayerLink.jsx'
import { Money, moneyLabel } from './Money.jsx'

const DASH = '—'
const total = (value) => (value > 0 ? moneyLabel(value) : DASH)

// A one-year deal's terms line says nothing the row does not already say twice:
// "1 Y/$787,300 (26)" sits under a salary cell reading $787K and an age cell
// reading 26. A MULTI-year deal's does — its length, its total and which years
// carry options are facts no single column holds. So the line earns its place by
// running longer than the season in hand, and every pre-arb row loses it.
const isMultiYear = (terms) => Boolean(terms) && !/^\s*1\s*y/i.test(terms)
import { CELL_LABELS } from '../../api/salaries.js'

// The ledger itself: players down, seasons across, subtotals per band and one
// club total at the foot — the shape a scorer already reads, and the shape the
// game's own contract sheets have always used.
//
// A cell says how FIRM the money is before it says how much. Cot's writes an
// out-year either as a figure or as a code (A1..A4 for an unsettled arbitration
// year, OPT for an option nobody has exercised, FA for a year the club has no
// hold at all), and a code is a status, never an amount — so an arbitration cell
// prints its code, not a guess at what the player will win. The pencil-hatched
// free-agent cells are the point of the whole grid: they are where the book runs
// out, and a club's future is mostly the shape of that hatching.

function Cell({ cell }) {
  if (cell.kind === 'free' || cell.kind === 'none') {
    return <td className={`ctr__cell ctr__cell--${cell.kind}`} aria-label={CELL_LABELS[cell.kind]} />
  }
  if (cell.value != null) {
    return (
      <td className={`ctr__cell ctr__cell--${cell.kind}`}>
        <Money value={cell.value} />
      </td>
    )
  }
  return (
    <td className={`ctr__cell ctr__cell--${cell.kind}`}>
      <span className="ctr__code">{cell.code}</span>
    </td>
  )
}

export function ContractGrid({ ledger }) {
  const { years, groups, totals, season } = ledger
  return (
    <div className="ctr__card">
      <div className="metricbar">
        <span className="metricbar__title">Commitment by season</span>
      </div>
      <div className="ctr__scroll">
        <table className="ctr__table">
          <thead>
            <tr>
              <th scope="col" className="ctr__namehead">
                Player
              </th>
              <th scope="col" className="ctr__agehead">
                Age
              </th>
              {years.map((year) => (
                <th
                  key={year}
                  scope="col"
                  className={`ctr__yearhead${year === season ? ' ctr__yearhead--now' : ''}`}
                >
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key}>
              <tr className="ctr__group">
                <td colSpan={years.length + 2}>{group.label}</td>
              </tr>
              {group.players.map((player) => (
                <tr key={player.id}>
                  <th scope="row" className="ctr__name">
                    <span className="ctr__player">
                      <span className={`ctr__pos ctr__pos--${group.key}`}>{player.pos ?? '—'}</span>
                      <span className="ctr__playername">
                        <PlayerLink id={player.id}>{player.name}</PlayerLink>
                        {isMultiYear(player.terms) && (
                          <span className="ctr__terms">{player.terms}</span>
                        )}
                      </span>
                    </span>
                  </th>
                  <td className="ctr__age">{player.age ?? DASH}</td>
                  {player.cells.map((cell) => (
                    <Cell key={cell.year} cell={cell} />
                  ))}
                </tr>
              ))}
              <tr className="ctr__subtotal">
                <th scope="row" colSpan={2}>
                  {group.label} subtotal
                </th>
                {years.map((year) => (
                  <td key={year}>
                    {total(
                      group.players.reduce(
                        (sum, player) =>
                          sum + (player.cells.find((cell) => cell.year === year)?.value ?? 0),
                        0,
                      ),
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="ctr__foot">
              <th scope="row" colSpan={2}>
                Club committed
              </th>
              {totals.map((entry) => (
                <td key={entry.year}>{total(entry.committed)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// The key, read left to right in order of how firm the money is. Its own export
// because the grid scrolls sideways and the key must not — a legend a reader has
// to swipe to reach is not a legend.
export function ContractKey() {
  return (
    <div className="ctr__key">
      <span className="ctr__keyitem">
        <span className="ctr__swatch" /> Guaranteed
      </span>
      <span className="ctr__keyitem">
        <span className="ctr__swatch ctr__swatch--arbitration" /> Arbitration, not yet settled
      </span>
      <span className="ctr__keyitem">
        <span className="ctr__swatch ctr__swatch--option" /> Option, not yet exercised
      </span>
      <span className="ctr__keyitem">
        <span className="ctr__swatch ctr__swatch--free" /> Free agent — no commitment
      </span>
    </div>
  )
}
