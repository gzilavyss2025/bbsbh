import { ScorecardSheet } from '../components/ScorecardSheet.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'

// The Numbers Game "22" scorecard sheet, drawn in the paper-scorebook system: a
// header band of write-in fields, the nine-by-eleven at-bat grid, and a footer of
// the defense diamond, the pitcher table, and the line-score scoreboard.
//
// Two modes, one sheet:
//  • Empty template (no `view`) — Milestone 1: every field blank, every at-bat
//    box unmarked, fed only plain spoiler-free labels.
//  • Loaded game (`view` from api/loadScorecard.js) — the pre-pitch reference
//    data penciled in: the batting team's lineup + header, the fielding team's
//    defense + starter. The score-revealing cells (at-bat grid, pitcher line,
//    scoreboard) STAY blank either way — you ink those by hand.
//
// `side` picks which half the sheet scores: 'top' = the visiting team bats,
// 'bottom' = the home team.

// The eight fielders + DH the footer diamond prints, with blank writing lines —
// DefenseDiamond keeps a spot's line and position number even when unposted, so an
// empty template shows the fielding shape without any names (see DefenseDiamond).
const EMPTY_DEFENSE = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map(
  (position) => ({ position, last: '' }),
)

const PITCHER_COLS = ['R/L', 'IP', 'P', 'BF', 'H', 'R', 'ER', 'BB', 'K']
const SCOREBOARD_INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function Scorecard({ side = 'top', view = null }) {
  return (
    <div className="scorecard">
      <ScorecardHeader side={side} view={view} />
      <ScorecardSheet lineup={view?.lineup ?? []} grid={view?.grid ?? null} />
      <ScorecardFooter view={view} />
    </div>
  )
}

// A single write-in field: a caption over a pencil line. A filled value inks the
// line; a blank one leaves it empty to write on, exactly as the template did.
function Field({ label, value = '', wide = false }) {
  return (
    <div className={`sc-field ${wide ? 'sc-field--wide' : ''}`}>
      <span className="sc-field__label">{label}</span>
      <span className="sc-field__line">{value}</span>
    </div>
  )
}

function ScorecardHeader({ side, view }) {
  const bottom = side === 'bottom'
  const ump = view?.umpiresByRole ?? {}
  return (
    <header className="sc-header">
      <div className="sc-header__half">{bottom ? 'Bottom' : 'Top'}</div>
      <div className="sc-header__fields">
        <Field label="Logo" />
        <Field
          label={bottom ? 'Home team' : 'Visiting team'}
          value={view?.teamName ?? ''}
          wide
        />
        <Field label="Manager" value={view?.manager ?? ''} wide />
        <Field label="Uniforms" value={view?.uniforms ?? ''} />
        <Field label="HP ump" value={ump.HP ?? ''} />
        <Field label="1B ump" value={ump['1B'] ?? ''} />
        <Field label="2B ump" value={ump['2B'] ?? ''} />
        <Field label="3B ump" value={ump['3B'] ?? ''} />
        <Field label="Keeping score by" wide />
        <Field label="First pitch" value={view?.firstPitch ?? ''} />
      </div>
    </header>
  )
}

function ScorecardFooter({ view }) {
  const defense = view?.defense?.length ? view.defense : EMPTY_DEFENSE
  const defenseTitle = view?.fieldingTeamName
    ? `${view.fieldingTeamName} Defense`
    : 'Home Defense'
  return (
    <footer className="sc-footer">
      <section className="sc-footer__block sc-footer__defense">
        <h3 className="sc-footer__title">{defenseTitle}</h3>
        <DefenseDiamond defense={defense} />
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
                {/* The fielding team's probable starter opens the table; the
                    rest of the box (his line and every reliever) stays blank. */}
                <td className="pitchers__pitcher">
                  {i === 0 ? view?.pitcherName ?? '' : ''}
                </td>
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
        <Scoreboard board={view?.scoreboard} />
        <div className="sc-decisions">
          <Field label="WP" />
          <Field label="LP" />
          <Field label="SV" />
        </div>
      </section>
    </footer>
  )
}

// The line-score scoreboard: runs per inning for both clubs plus R/H/E. Empty
// template (no `board`) draws two blank rows over the 11 template innings; a
// loaded game inks the real linescore. A half not played reads blank.
function Scoreboard({ board }) {
  const innings = board?.innings?.map((i) => i.num) ?? SCOREBOARD_INNINGS
  const rows = board
    ? [
        { key: 'away', abbr: board.away.abbr, side: 'away', tot: board.away },
        { key: 'home', abbr: board.home.abbr, side: 'home', tot: board.home },
      ]
    : [
        { key: 'away', abbr: '', side: 'away', tot: null },
        { key: 'home', abbr: '', side: 'home', tot: null },
      ]
  const runAt = (num, side) =>
    board?.innings?.find((i) => i.num === num)?.[side]

  return (
    <table className="sc-scoreboard">
      <thead>
        <tr>
          <th className="sc-scoreboard__team" scope="col">
            Team
          </th>
          {innings.map((n) => (
            <th key={n} scope="col">
              {n}
            </th>
          ))}
          {['R', 'H', 'E'].map((c) => (
            <th key={c} className="sc-scoreboard__rhe" scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="sc-scoreboard__team">{row.abbr}</td>
            {innings.map((n) => {
              const runs = runAt(n, row.side)
              return <td key={n}>{runs == null ? '' : runs}</td>
            })}
            <td className="sc-scoreboard__rhe">{row.tot ? row.tot.runs : ''}</td>
            <td className="sc-scoreboard__rhe">{row.tot ? row.tot.hits : ''}</td>
            <td className="sc-scoreboard__rhe">{row.tot ? row.tot.errors : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
