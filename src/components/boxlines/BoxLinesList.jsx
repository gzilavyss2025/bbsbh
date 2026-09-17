// THE LIST INSIDE A BOX LINES SHEET (ADR-0069, issue #1048). Most doors open
// on rows; a list door opens on its GROUPS — the nine spots in the batting
// order today, #998's thirty-six ballparks next — and each group opens the
// rows behind it.
//
// WHY A LIST AND NOT NINE DOORS. The card could hold nine more rows. It could
// not label them: MLB's own `b1`…`b9` count games with a plate appearance in a
// slot, the lineups count who started there, and the two differ by enough that
// a door reading "Batting ninth: 18 G" would open an empty sheet
// (api/boxlines/fold.js has the measurement). The figures here are folded from
// the gated rows instead, so an entry and the rows behind it are the same games
// counted once.
//
// IT IS A GRID, NOT A LEDGER STACK, for the reason the Game lines card became a
// table (ADR-0073): this is a comparison, and a comparison is read DOWN a
// column. Two figures, not the card's five — games and the one rate that
// answers "how well" — because that is all the rows can honestly fold
// (fold.js).
//
// Every value here arrived already gated (api/boxlines/rows.js); this panel
// decides nothing about what may show, and it never sees a score.
export function BoxLinesList({ groups, columns, onPick }) {
  return (
    <>
      <ul className="boxlines__list">
        <li className="boxlines__listhead">
          <span />
          {columns.map((name) => (
            <span className="boxlines__listcol" key={name}>
              {name}
            </span>
          ))}
          <span />
        </li>
        {groups.map((g) => (
          <li className="boxlines__listrow" key={g.key}>
            <button type="button" className="boxlines-entry" onClick={() => onPick(g)}>
              <span className="boxlines-entry__name">{g.name}</span>
              <span className="boxlines-entry__fig">{g.games}</span>
              {/* The rate, or the card's own quiet mark where there is nothing
                  to print — a group with no at-bats would otherwise read ".000"
                  and say he came up and failed (fold.js). */}
              <span
                className={`boxlines-entry__fig ${g.line.rate == null ? 'boxlines-entry__fig--nil' : 'boxlines-entry__fig--key'}`}
              >
                {g.line.rate ?? '·'}
              </span>
              <span className="boxlines-entry__chev" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="boxlines__foot">
        Each line is counted from the games behind it. Tap a line to see those games.
      </p>
    </>
  )
}
