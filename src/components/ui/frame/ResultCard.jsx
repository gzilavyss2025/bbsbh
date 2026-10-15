import { Card } from './Card.jsx'

// THE RESULT CARD (ADR-0112) — a finished game's result, drawn from the focus-mode
// scorebug and the slate's game card: a club panel each side with its mark and the
// big outlined score, a dark centre with the status, two name bars below (the
// winning pitcher and the player of the game) and a footer row. Styled once, in
// styles/system/report/result.css.
//
//   away, home  { mark, name, score, tint, winner }. `mark` is a node for the 40px
//               slot (a TeamLogo); `tint` is the club's treatment tint as a CSS
//               colour, or nothing for the soft ink; `winner` draws the marker
//               underline under that panel.
//   status      the centre word ("Final").   note  the small line under it ("Game 6").
//   bars        [{ tag, name, line }]: "WP", "Sample Pitcher", "7.0 IP, 9 K".
//   footer      a node for the footer row: the date and park, and a Button that
//               opens the box score. The caller owns the click.
//   label       the card's accessible name ("Final: Dodgers 5, Yankees 3").
//
// FOR A FINISHED GAME ON A HISTORY PAGE ONLY. It draws the score it is given and
// gates nothing; a current-season score never goes in it (root CLAUDE.md, the
// spoiler rule). It imports no api/ module, no stamp module and no club theme.
function Panel({ side, club }) {
  const cls = `result__club result__club--${side}${club.winner ? ' result__club--win' : ''}`
  return (
    <div className={cls} style={club.tint ? { '--result-tint': club.tint } : undefined}>
      <span className="result__mark" role="img" aria-label={club.name}>
        {club.mark}
      </span>
      <span className="result__runs">{club.score}</span>
    </div>
  )
}

export function ResultCard({ away, home, status = 'Final', note, bars = [], footer, label, className = '', ...rest }) {
  return (
    <Card
      as="section"
      frame="stamped"
      body="flush"
      tone="soft"
      className={`result ${className}`.trim()}
      aria-label={label}
      {...rest}
    >
      <div className="result__strip">
        <Panel side="away" club={away} />
        <div className="result__mid">
          <b className="result__status">{status}</b>
          {note != null && note !== '' && <span className="result__note">{note}</span>}
        </div>
        <Panel side="home" club={home} />
      </div>
      {bars.map((bar) => (
        <div className="result__bar" key={bar.tag}>
          <span>
            <b className="result__tag">{bar.tag}</b>
            {bar.name}
          </span>
          <span className="result__line">{bar.line}</span>
        </div>
      ))}
      {footer != null && <div className="result__foot">{footer}</div>}
    </Card>
  )
}
