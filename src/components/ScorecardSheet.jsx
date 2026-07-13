import { AtBatBox } from './AtBatBox.jsx'

// The main scorecard grid: nine batting rows across eleven innings, a sticky
// Pos/Player column on the left and a sticky inning-header row on top, all inside
// one horizontal scroll (the sheet is wider than a phone by design — you swipe it
// the way you'd slide a paper scorebook across the table). Summary columns
// (AB H R RBI) and a TOTALS row close it out.
//
// Milestone 1 draws it empty. `lineup` (optional, [{ pos, name }]) fills the left
// column; the at-bat cells stay blank until a later milestone feeds them data.
const INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const SUMMARY = ['AB', 'H', 'R', 'RBI']
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function ScorecardSheet({ lineup = [] }) {
  return (
    <div className="sc-sheet__scroll">
      <table className="sc-sheet">
        <thead>
          <tr>
            <th className="sc-sheet__pos sc-sheet__corner" scope="col">
              Pos
            </th>
            <th className="sc-sheet__name sc-sheet__corner" scope="col">
              Player
            </th>
            {INNINGS.map((n) => (
              <th key={n} className="sc-sheet__inning-h" scope="col">
                {n}
              </th>
            ))}
            {SUMMARY.map((s) => (
              <th key={s} className="sc-sheet__sum-h" scope="col">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot, i) => (
            <tr key={slot}>
              <td className="sc-sheet__pos">{lineup[i]?.pos ?? ''}</td>
              <td className="sc-sheet__name">{lineup[i]?.name ?? ''}</td>
              {INNINGS.map((n) => (
                <td key={n} className="sc-sheet__cell">
                  <AtBatBox />
                </td>
              ))}
              {SUMMARY.map((s) => (
                <td key={s} className="sc-sheet__sum" />
              ))}
            </tr>
          ))}
          <tr className="sc-sheet__totals">
            <td className="sc-sheet__pos" />
            <td className="sc-sheet__name">Totals</td>
            {INNINGS.map((n) => (
              <td key={n} className="sc-sheet__totcell" />
            ))}
            {SUMMARY.map((s) => (
              <td key={s} className="sc-sheet__sum" />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
