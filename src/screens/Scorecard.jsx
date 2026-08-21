import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ScorecardSheet } from '../components/scoring/ScorecardSheet.jsx'
import { DefenseDiamond } from '../components/scoring/DefenseDiamond.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'

// The Numbers Game "22" scorecard sheet, drawn in the paper-scorebook system
// and laid out the way the paper sheet is: the header band (TOP/BOTTOM, the
// club's logo, team over manager, uniforms, the crew in the #22's two stacked
// pairs — HP over 2B, 1B over 3B — the KEEPING SCORE BY options, FIRST PITCH
// with its AM/PM dots), the nine-slot at-bat grid with its P/WH/FO foot row,
// and the footer trio: the fielding club's defense diamond, its pitcher
// table, and the scoreboard block (both clubs' innings, the FINAL R/H/E/LOB
// line, the WP/LP/SV decisions).
//
// Three surfaces render this one sheet:
//  • Empty template (no `view`) — every field blank, every box unmarked.
//  • Pre-pitch (a `view` with an empty grid) — the staging data penciled in:
//    the batting club's lineup + header, the fielding club's defense +
//    probable starter. Everything score-shaped stays blank.
//  • Filled (a `view` from api/scorecardGame.js's scorecardFull) — the grid,
//    the P/WH/FO row, the pitcher lines and the scoreboard inked exactly as
//    far as the caller's reveal clamp allows, and no further.
//
// `side` picks which half the sheet scores: 'top' = the visiting team bats,
// 'bottom' = the home team. `notes` + `onCellTap` are the per-cell notation
// override layer (lib/scorecardNotes.js), threaded down to every at-bat box.

// The eight fielders + DH the footer diamond prints, with blank writing lines —
// DefenseDiamond keeps a spot's line and position number even when unposted, so an
// empty template shows the fielding shape without any names (see DefenseDiamond).
const EMPTY_DEFENSE = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map(
  (position) => ({ position, last: '' }),
)

const PITCHER_COLS = ['R/L', 'IP', 'P', 'BF', 'H', 'R', 'ER', 'BB', 'K']
// Blank pitcher rows the table always keeps below the filled ones — the paper
// sheet's writing room for the arms still to come.
const PITCHER_ROWS = 8
const SCOREBOARD_INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function Scorecard({
  side = 'top',
  view = null,
  notes = null,
  onCellTap = null,
  onFrontierTap = null,
  fresh = null,
  flip = null,
}) {
  // THE SHEET'S OWN WIDTH, measured by the grid and held to by everything
  // around it. On a wide screen the scorecard runs the whole window (ADR-0047's
  // full-bleed), but a #22's printed rules stop where its COLUMNS stop — the
  // header band and the footer trio are part of the same page, not a banner and
  // a caption stretched across the desk it is lying on. So the grid reports the
  // width it drew (Player + Pos + the innings + AB/H/R/RBI, hairlines included,
  // at whatever zoom is showing) and the two bands cap to it.
  //
  // Measured rather than calculated from the --sc-* tokens for the same reason
  // the zoom floor is: the per-column hairline borders are not in the tokens,
  // and a calculation that ignores them comes up short by a summary column or
  // three. The epsilon stops a sub-pixel difference from ping-ponging setState;
  // React bails out on an unchanged value, so the render-measure-render loop
  // settles on the first pass.
  const [sheetWidth, setSheetWidth] = useState(null)
  const holdToSheet = useCallback((w) => {
    setSheetWidth((was) => (was == null || Math.abs(was - w) > 0.5 ? w : was))
  }, [])

  return (
    // Capped with min(…, 100%) so the phone is untouched: there the grid is
    // WIDER than the column it is read in (that is what the zoom control is
    // for), and a band held to the grid's width would run off the screen.
    <div
      className="scorecard"
      style={sheetWidth ? { '--sc-sheet-w': `${Math.round(sheetWidth)}px` } : undefined}
    >
      <ScorecardHeader side={side} view={view} />
      <ScorecardSheet
        lineup={view?.lineup ?? []}
        grid={view?.grid ?? null}
        notes={notes}
        onCellTap={onCellTap}
        onFrontierTap={onFrontierTap}
        fresh={fresh}
        flip={flip}
        onWidth={holdToSheet}
      />
      <ScorecardFooter view={view} />
    </div>
  )
}

// A club name written to FIT its box, never clipped. The scoreboard's team
// column is a fixed share of a fixed-layout table, and the clubs whose names
// run long (DIAMONDBACKS, ATHLETICS) are exactly the ones an ellipsis makes
// unreadable — "Diamondb…" names no team. So the name is measured against the
// space it actually got and its type size is pulled down until it fits, the
// way you'd write smaller to reach the edge of a printed box. Remeasured on
// every resize, since the box's width is a percentage of the page.
// The size is written straight onto the node rather than held in state: the
// measurement has to happen at full size, and a state round-trip would leave
// the name un-shrunk on any resize that lands on the same ratio it already had.
function FitText({ children }) {
  const boxRef = useRef(null)
  const fit = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    box.style.fontSize = ''
    // The node's OWN content box, not the cell's: the cell's clientWidth
    // includes its padding, which overstated the room by a few pixels and
    // left "Cardinals" still shaving its last letter off.
    const room = box.clientWidth
    const needed = box.scrollWidth
    if (room > 0 && needed > room) {
      box.style.fontSize = `${Math.max(room / needed, 0.55)}em`
    }
  }, [])
  // No dependency list on purpose — re-fit after every render, since a new
  // club name is the other thing that changes what fits.
  useLayoutEffect(fit)
  useEffect(() => {
    const parent = boxRef.current?.parentElement
    if (typeof ResizeObserver !== 'function' || !parent) return undefined
    const ro = new ResizeObserver(fit)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [fit])
  return (
    <span ref={boxRef} className="sc-fit">
      {children}
    </span>
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

// A pitcher of record, written the way a box score writes him: the name, then
// his figure in parentheses. No name means the game hasn't been revealed to
// its end (or nobody earned the save), and the field stays a blank line to
// write on — never an empty pair of brackets.
function decision(name, note) {
  if (!name) return ''
  return note ? `${name} (${note})` : name
}

// One of the KEEPING SCORE BY choices — a small ring you'd fill with a pencil,
// before a caption (or a write-in line for the third, unnamed one). Purely a
// write-in surface, like every line on this sheet: the app never marks one.
function ScoreByOption({ label }) {
  return (
    <span className="sc-scoreby__opt">
      <span className="sc-scoreby__ring" aria-hidden="true" />
      {label ? (
        <span className="sc-scoreby__optlabel">{label}</span>
      ) : (
        <span className="sc-scoreby__optline" />
      )}
    </span>
  )
}

function ScorecardHeader({ side, view }) {
  const bottom = side === 'bottom'
  const ump = view?.umpiresByRole ?? {}
  const firstPitch = view?.firstPitch ?? ''
  // The AM/PM dot the first-pitch time itself names, inked; its partner stays
  // an empty ring to match the printed sheet. Neither fills without a time.
  const meridiem = /\bAM\b/i.test(firstPitch) ? 'AM' : /\bPM\b/i.test(firstPitch) ? 'PM' : null
  return (
    <header className="sc-header">
      <div className="sc-header__half">{bottom ? 'Bottom' : 'Top'}</div>
      <div className="sc-header__fields">
        {/* The LOGO box: the batting club's mark once a game is loaded, the
            labeled empty box (a spot to sketch in) on the bare template. */}
        <div className="sc-logo">
          <span className="sc-field__label">Logo</span>
          <span className="sc-logo__box">
            {view?.teamId ? (
              <TeamLogo teamId={view.teamId} name={view.teamName} size={34} />
            ) : null}
          </span>
        </div>
        {/* Team over manager, stacked the way the sheet prints them. */}
        <div className="sc-header__stack sc-header__stack--wide">
          <Field
            label={bottom ? 'Home team' : 'Visiting team'}
            value={view?.teamName ?? ''}
            wide
          />
          <Field label="Manager" value={view?.manager ?? ''} wide />
        </div>
        <div className="sc-header__stack">
          <Field label="Uniforms" value={view?.uniforms ?? ''} />
        </div>
        {/* The crew in the #22's two stacked pairs: HP over 2B, 1B over 3B. */}
        <div className="sc-header__stack">
          <Field label="HP ump" value={ump.HP ?? ''} />
          <Field label="2B ump" value={ump['2B'] ?? ''} />
        </div>
        <div className="sc-header__stack">
          <Field label="1B ump" value={ump['1B'] ?? ''} />
          <Field label="3B ump" value={ump['3B'] ?? ''} />
        </div>
        {/* KEEPING SCORE BY, the sheet's three pencil-ring options. */}
        <div className="sc-scoreby">
          <span className="sc-field__label">Keeping score by</span>
          <ScoreByOption label="Attending the game" />
          <ScoreByOption label="Watching on screen" />
          <ScoreByOption />
        </div>
        {/* FIRST PITCH with its AM/PM dots; the named one inks solid. */}
        <div className="sc-firstpitch">
          <span className="sc-field__label">First pitch</span>
          <span className="sc-firstpitch__row">
            <span className="sc-field__line sc-firstpitch__time">
              {firstPitch.replace(/\s*[AP]M\b/i, '')}
            </span>
            <span className="sc-firstpitch__ampm" aria-hidden={meridiem == null}>
              <span
                className={`sc-scoreby__ring ${meridiem === 'AM' ? 'sc-scoreby__ring--inked' : ''}`}
              />
              <span className="sc-firstpitch__mlabel">AM</span>
              <span
                className={`sc-scoreby__ring ${meridiem === 'PM' ? 'sc-scoreby__ring--inked' : ''}`}
              />
              <span className="sc-firstpitch__mlabel">PM</span>
            </span>
          </span>
        </div>
      </div>
    </header>
  )
}

function ScorecardFooter({ view }) {
  const defense = view?.defense?.length ? view.defense : EMPTY_DEFENSE
  const defenseTitle = view?.fieldingTeamName
    ? `${view.fieldingTeamName} Defense`
    : 'Home Defense'
  // The fielding club's pitching lines (api/scorecardGame.js), clamped by the
  // caller; pre-pitch the table instead opens with the probable starter's
  // name on an otherwise blank first line, exactly as the print sheet does.
  const pitchers = view?.pitchers ?? []
  const blankRows = Math.max(PITCHER_ROWS - pitchers.length, 1)
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
            {pitchers.map((p) => (
              <tr key={p.id}>
                {/* Surname first, uniform number pinned to the column's right
                    edge — the same name/number pairing the batting rail and
                    the box score's own pitcher table use. */}
                <td className="pitchers__pitcher">
                  <span className="pitchers__cell">
                    <span className="sc-pitchers__name">{p.name}</span>
                    <span className="sc-pitchers__jersey">{p.jersey}</span>
                  </span>
                </td>
                <td>{p.hand}</td>
                <td>{p.ip}</td>
                <td>{p.p}</td>
                <td>{p.bf}</td>
                <td>{p.h}</td>
                <td>{p.r}</td>
                <td>{p.er}</td>
                <td>{p.bb}</td>
                <td>{p.k}</td>
              </tr>
            ))}
            {Array.from({ length: blankRows }).map((_, i) => (
              <tr key={`blank-${i}`}>
                {/* The fielding team's probable starter opens the blank table;
                    his line and every reliever's row stay blank to write on. */}
                <td className="pitchers__pitcher">
                  {i === 0 && pitchers.length === 0 ? view?.pitcherName ?? '' : ''}
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
        <FinalBlock board={view?.scoreboard} />
      </section>
    </footer>
  )
}

// The scoreboard's top half: each club's runs by inning, full club names the
// way the sheet has you write them. Empty template (no `board`) draws two
// blank rows over the 11 template innings; a loaded game inks each cell as
// its own half clears the reveal clamp (see scorecardScoreboard) — a sealed
// half stays blank, a skipped final bottom reads 'X'.
function Scoreboard({ board }) {
  const innings = board?.innings?.map((i) => i.num) ?? SCOREBOARD_INNINGS
  const rows = board
    ? [
        { key: 'away', label: board.away.name, side: 'away' },
        { key: 'home', label: board.home.name, side: 'home' },
      ]
    : [
        { key: 'away', label: '', side: 'away' },
        { key: 'home', label: '', side: 'home' },
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
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="sc-scoreboard__team">
              {row.label ? <FitText>{row.label}</FitText> : ''}
            </td>
            {innings.map((n) => (
              <td key={n}>{runAt(n, row.side) ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// The scoreboard's bottom half, the #22's FINAL block: R/H/E/LOB for each
// club beside the three decision lines (WP/LP/SV). Every value stays blank
// until the game is Final AND fully revealed (`board.done`) — these are
// whole-game facts, so mid-game there is nothing safe to ink here.
function FinalBlock({ board }) {
  const rows = board
    ? [
        { key: 'away', abbr: board.away.abbr, final: board.away.final },
        { key: 'home', abbr: board.home.abbr, final: board.home.final },
      ]
    : [
        { key: 'away', abbr: '', final: null },
        { key: 'home', abbr: '', final: null },
      ]
  return (
    <div className="sc-finalblock">
      <table className="sc-scoreboard sc-final">
        <thead>
          <tr>
            <th className="sc-scoreboard__team" scope="col">
              Final
            </th>
            {['R', 'H', 'E', 'LOB'].map((c) => (
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
              <td className="sc-scoreboard__rhe">{row.final ? row.final.r : ''}</td>
              <td className="sc-scoreboard__rhe">{row.final ? row.final.h : ''}</td>
              <td className="sc-scoreboard__rhe">{row.final ? row.final.e : ''}</td>
              <td className="sc-scoreboard__rhe">{row.final ? row.final.lob : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Each pitcher of record with the figure a box score prints after his
          name: the season record the decision moved for the two starters of
          record, the count of saves for the man who finished it. Both come off
          his own boxscore seasonStats and include tonight, so the line reads
          the way it will read in the morning paper. */}
      <div className="sc-decisions">
        <Field label="WP" value={decision(board?.decisions?.wp, board?.decisions?.wpNote)} />
        <Field label="LP" value={decision(board?.decisions?.lp, board?.decisions?.lpNote)} />
        <Field label="SV" value={decision(board?.decisions?.sv, board?.decisions?.svNote)} />
      </div>
    </div>
  )
}
