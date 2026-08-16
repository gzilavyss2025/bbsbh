import { SHEET_INNINGS } from './sheetModel.js'

// The printable sheet itself — one page of paper, drawn as DOM.
//
// It is the Scorecard Lab's sheet (`screens/Scorecard.jsx`) reduced to what a
// scorer actually needs in hand before first pitch, and re-laid out for paper
// rather than for a phone: a header band of game facts and the umpire crew, then
// BOTH clubs' batting orders — the visitors over the home side, the order they
// bat — each over its own empty at-bat grid, then a decision line.
//
// THE GRID IS EMPTY, AND THAT IS THE PRODUCT. Not one cell here can be filled
// from the feed: this component renders `model.clubs[].lineup` (nine names,
// numbers and positions from the spoiler-free selectors — see sheetModel.js) and
// draws blank boxes for everything else. The at-bat boxes, the per-inning
// totals, the AB/H/R/RBI columns and the decision line are yours to ink. Do not
// add a mode that fills them in; the Scorecard Lab is where the inked grid lives
// and where it stays (root CLAUDE.md's spoiler section).
//
// Everything is drawn with BORDERS and TEXT, never a background fill, because a
// browser's print dialog has "background graphics" switched off by default —
// anything painted as a background is simply absent from the paper. See
// styles/63-print-sheet.css.

const COLUMNS = Array.from({ length: SHEET_INNINGS }, (_, i) => i + 1)
const SUMMARY = ['AB', 'H', 'R', 'RBI']

export function ScoreSheet({ model }) {
  return (
    <article className="printsheet">
      <SheetHead model={model} />
      {model.clubs.map((club) => (
        <ClubBlock key={club.side} club={club} />
      ))}
      <SheetFoot />
    </article>
  )
}

// A caption over a writing line. A value inks the line; a blank one leaves the
// line to write on — which is how every unposted MiLB field, and every field
// nobody could know yet (the scorer's own name, the attendance), renders. Same
// convention as the Lab sheet's `Field`.
function WriteIn({ label, value = '', span = 1 }) {
  return (
    <div className={`ps-writein ps-writein--${span}`}>
      <span className="ps-writein__label">{label}</span>
      <span className="ps-writein__line">{value}</span>
    </div>
  )
}

function SheetHead({ model }) {
  const [away, home] = model.clubs
  return (
    <header className="printsheet__head">
      <h2 className="printsheet__matchup">
        <span className="printsheet__club">{away.name || 'Visitors'}</span>
        <span className="printsheet__at" aria-hidden="true">
          @
        </span>
        <span className="printsheet__club">{home.name || 'Home'}</span>
      </h2>

      <div className="printsheet__facts">
        <WriteIn label="Date" value={model.date} span={2} />
        <WriteIn label="Ballpark" value={model.venue} span={3} />
        <WriteIn label="First pitch" value={model.firstPitch} />
        {/* The widest field on the row: a full reading runs "81°F sunny, wind 6
            mph left to right", and truncating the wind is worse than truncating
            anything else here — it is the one fact on the band that changes how
            the game is played. */}
        <WriteIn label="Weather" value={model.weather} span={3} />
        {/* Never a value, always a line: the sheet does not know who is holding
            the pencil. */}
        <WriteIn label="Scored by" span={2} />
      </div>

      <div className="printsheet__crew">
        <span className="printsheet__crewhead">Umpires</span>
        {model.crew.map((u) => (
          <span key={u.role} className="ps-ump">
            <span className="ps-ump__role">{u.role}</span>
            <span className="ps-ump__name">{u.name}</span>
          </span>
        ))}
      </div>
    </header>
  )
}

// One club: its name line (manager, and the arm it faces) over its own grid.
function ClubBlock({ club }) {
  return (
    <section className="printsheet__block">
      <h3 className="printsheet__clubline">
        <span className="printsheet__clubname">{club.name || club.label}</span>
        <span className="printsheet__clubside">{club.label}</span>
        <span className="ps-clubfact">
          <span className="ps-clubfact__label">Mgr</span>
          <span className="ps-clubfact__line">{club.manager}</span>
        </span>
        {/* The pitcher this order bats against, which is the OTHER club's
            probable — the pairing a paper scorecard prints at the head of the
            pitching line. Blank when nobody has announced one (or when the feed
            never carries probables, as a MiLB one often doesn't). */}
        <span className="ps-clubfact">
          <span className="ps-clubfact__label">Pitching</span>
          <span className="ps-clubfact__line">
            {club.facing ? `${club.facing.name}${club.facing.hand ? ` (${club.facing.hand})` : ''}` : ''}
          </span>
        </span>
      </h3>

      <table className="printsheet__grid">
        <thead>
          <tr>
            <th className="ps-col-slot" scope="col">
              #
            </th>
            <th className="ps-col-pos" scope="col">
              Pos
            </th>
            <th className="ps-col-name" scope="col">
              {club.abbr || 'Batter'}
            </th>
            {COLUMNS.map((n) => (
              <th key={n} className="ps-col-inning" scope="col">
                {n}
              </th>
            ))}
            {SUMMARY.map((s) => (
              <th key={s} className="ps-col-sum" scope="col">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {club.lineup.map((row) => (
            <tr key={row.order}>
              <td className="ps-col-slot">{row.order}</td>
              <td className="ps-col-pos">{row.position}</td>
              <td className="ps-col-name">
                {row.jersey && <span className="ps-jersey">{row.jersey}</span>}
                {row.name}
              </td>
              {COLUMNS.map((n) => (
                <td key={n} className="ps-cell">
                  {/* The diamond a scorer runs the batter around. Drawn, not
                      filled — see the file header. */}
                  <span className="ps-cell__diamond" aria-hidden="true" />
                </td>
              ))}
              {SUMMARY.map((s) => (
                <td key={s} className="ps-col-sum" />
              ))}
            </tr>
          ))}
          <tr className="printsheet__totals">
            <td className="ps-col-slot" />
            <td className="ps-col-pos" />
            <td className="ps-col-name">Runs</td>
            {COLUMNS.map((n) => (
              <td key={n} className="ps-col-inning" />
            ))}
            {SUMMARY.map((s) => (
              <td key={s} className="ps-col-sum" />
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  )
}

// The facts that can only be written once the game is over — including
// attendance, which is announced late and therefore belongs down here with the
// decisions rather than up in the header band, where it would have crowded the
// weather reading for a number nobody has yet.
function SheetFoot() {
  return (
    <footer className="printsheet__foot">
      <WriteIn label="WP" />
      <WriteIn label="LP" />
      <WriteIn label="SV" />
      <WriteIn label="Time" />
      <WriteIn label="Attendance" />
      <span className="printsheet__mark">Tally Baseball</span>
    </footer>
  )
}
