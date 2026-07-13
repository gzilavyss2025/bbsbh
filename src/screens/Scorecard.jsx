import { ScorecardSheet } from '../components/ScorecardSheet.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'

// The Numbers Game "22" scorecard sheet, drawn in the paper-scorebook system: a
// header band of write-in fields, the nine-by-eleven at-bat grid, and a footer of
// the defense diamond, the pitcher table, and the line-score scoreboard.
//
// Milestone 1 is the empty template — every field blank, every at-bat box unmarked
// — fed only plain, spoiler-free labels. It takes plain-data props (not a feed) so
// the same sheet can later be rendered by the game view with real data. `side`
// picks which half the sheet scores: 'top' = the visiting team bats, 'bottom' =
// the home team.

// The eight fielders + DH the footer diamond prints, with blank writing lines —
// DefenseDiamond keeps a spot's line and position number even when unposted, so an
// empty template shows the fielding shape without any names (see DefenseDiamond).
const EMPTY_DEFENSE = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map(
  (position) => ({ position, last: '' }),
)

const PITCHER_COLS = ['R/L', 'IP', 'P', 'BF', 'H', 'R', 'ER', 'BB', 'K']
const SCOREBOARD_INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function Scorecard({ side = 'top', lineup = [] }) {
  return (
    <div className="scorecard">
      <ScorecardHeader side={side} />
      <ScorecardSheet lineup={lineup} />
      <ScorecardFooter />
    </div>
  )
}

// A single write-in field: a caption over a blank pencil line.
function Field({ label, wide = false }) {
  return (
    <div className={`sc-field ${wide ? 'sc-field--wide' : ''}`}>
      <span className="sc-field__label">{label}</span>
      <span className="sc-field__line" />
    </div>
  )
}

function ScorecardHeader({ side }) {
  const bottom = side === 'bottom'
  return (
    <header className="sc-header">
      <div className="sc-header__half">{bottom ? 'Bottom' : 'Top'}</div>
      <div className="sc-header__fields">
        <Field label="Logo" />
        <Field label={bottom ? 'Home team' : 'Visiting team'} wide />
        <Field label="Manager" wide />
        <Field label="Uniforms" />
        <Field label="HP ump" />
        <Field label="1B ump" />
        <Field label="2B ump" />
        <Field label="3B ump" />
        <Field label="Keeping score by" wide />
        <Field label="First pitch" />
      </div>
    </header>
  )
}

function ScorecardFooter() {
  return (
    <footer className="sc-footer">
      <section className="sc-footer__block sc-footer__defense">
        <h3 className="sc-footer__title">Home Defense</h3>
        <DefenseDiamond defense={EMPTY_DEFENSE} />
      </section>

      <section className="sc-footer__block sc-footer__pitcher">
        <h3 className="sc-footer__title">Pitcher</h3>
        <table className="pitchers__grid sc-pitchers">
          <thead>
            <tr>
              <th className="pitchers__pitcher" scope="col">
                Pitcher
              </th>
              {PITCHER_COLS.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="pitchers__pitcher" />
                {PITCHER_COLS.map((c) => (
                  <td key={c} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sc-footer__block sc-footer__scoreboard">
        <h3 className="sc-footer__title">Scoreboard</h3>
        <table className="sc-scoreboard">
          <thead>
            <tr>
              <th className="sc-scoreboard__team" scope="col">
                Team
              </th>
              {SCOREBOARD_INNINGS.map((n) => (
                <th key={n} scope="col">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sc-scoreboard__team" />
              {SCOREBOARD_INNINGS.map((n) => (
                <td key={n} />
              ))}
            </tr>
            <tr>
              <td className="sc-scoreboard__team" />
              {SCOREBOARD_INNINGS.map((n) => (
                <td key={n} />
              ))}
            </tr>
          </tbody>
        </table>
        <div className="sc-final">
          {['Final', 'R', 'H', 'E', 'LOB'].map((c) => (
            <span key={c} className="sc-final__cell">
              {c}
            </span>
          ))}
        </div>
        <div className="sc-decisions">
          <Field label="WP" />
          <Field label="LP" />
          <Field label="SV" />
        </div>
      </section>
    </footer>
  )
}
