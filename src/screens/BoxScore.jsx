import { selectBoxscore } from '../api/boxscore.js'
import { SealBox } from '../components/SealBox.jsx'

// The full, MLB.com-style final box score for a game — batting orders (with
// substitutes indented), pitching lines, the BATTING/BASERUNNING/FIELDING notes,
// per-team footnotes, and the game-info foot (WP, umpires, weather, T, Att…).
//
// SPOILER RULE: the whole thing is score-revealing, so it lives behind a single
// SealBox. `selectBoxscore` is only called inside the reveal render function —
// nothing score-revealing is in the DOM until the user taps to reveal, exactly
// like every half-inning seal. This holds even for a deep link straight to the
// box score, so the card's "Box score" shortcut can't spoil either.
export function BoxScore({ feed, onInnings }) {
  return (
    <div className="boxscore">
      <div className="boxscore__head">
        <h2 className="boxscore__title">Box score</h2>
        {onInnings && (
          <button type="button" className="btn btn--ghost" onClick={onInnings}>
            ‹ Innings
          </button>
        )}
      </div>

      <SealBox>
        {() => {
          const box = selectBoxscore(feed)
          return <BoxScoreBody box={box} />
        }}
      </SealBox>
    </div>
  )
}

function BoxScoreBody({ box }) {
  return (
    <div className="bs">
      <TeamBlock side={box.away} />
      <TeamBlock side={box.home} />
      <Decisions decisions={box.decisions} />
      <GameInfo rows={box.gameInfo} dateLabel={box.dateLabel} />
    </div>
  )
}

function TeamBlock({ side }) {
  return (
    <section className="bs__team">
      <h3 className="bs__teamname">{side.teamName}</h3>

      <div className="bs__scroll">
        <table className="bs__grid bs__grid--bat">
          <thead>
            <tr>
              <th className="bs__nameCol">Batting</th>
              <th>AB</th>
              <th>R</th>
              <th>H</th>
              <th>RBI</th>
              <th>BB</th>
              <th>SO</th>
              <th>AVG</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map((b) => (
              <tr key={b.id} className={b.isSub ? 'bs__sub' : ''}>
                <td className="bs__nameCol">
                  <span className="bs__player">
                    {b.mark && <span className="bs__mark">{b.mark}</span>}
                    <span className="bs__pname">{b.name}</span>
                    {b.position && <span className="bs__pos">{b.position}</span>}
                  </span>
                </td>
                <td>{b.ab}</td>
                <td>{b.r}</td>
                <td>{b.h}</td>
                <td>{b.rbi}</td>
                <td>{b.bb}</td>
                <td>{b.so}</td>
                <td className="bs__avg">{b.avg}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bs__totals">
              <td className="bs__nameCol">Totals</td>
              <td>{side.batTotals.ab}</td>
              <td>{side.batTotals.r}</td>
              <td>{side.batTotals.h}</td>
              <td>{side.batTotals.rbi}</td>
              <td>{side.batTotals.bb}</td>
              <td>{side.batTotals.so}</td>
              <td className="bs__avg" />
            </tr>
          </tfoot>
        </table>
      </div>

      {side.footnotes.length > 0 && (
        <ul className="bs__footnotes">
          {side.footnotes.map((n) => (
            <li key={n.label}>
              <span className="bs__mark">{n.label}</span>
              {n.value}
            </li>
          ))}
        </ul>
      )}

      {side.notes.map((g) => (
        <div className="bs__notes" key={g.title}>
          <h4 className="bs__notesTitle">{g.title}</h4>
          {g.rows.map((r, i) => (
            <p className="bs__note" key={i}>
              <span className="bs__noteLabel">{r.label}:</span> {r.value}
            </p>
          ))}
        </div>
      ))}

      <div className="bs__scroll">
        <table className="bs__grid bs__grid--pit">
          <thead>
            <tr>
              <th className="bs__nameCol">Pitching</th>
              <th>IP</th>
              <th>H</th>
              <th>R</th>
              <th>ER</th>
              <th>BB</th>
              <th>SO</th>
              <th>HR</th>
              <th>P-S</th>
              <th>ERA</th>
            </tr>
          </thead>
          <tbody>
            {side.pitchers.map((p) => (
              <tr key={p.id}>
                <td className="bs__nameCol">
                  <span className="bs__player">
                    <span className="bs__pname">{p.name}</span>
                    {p.dec && <span className="bs__dec">{p.dec}</span>}
                  </span>
                </td>
                <td>{p.ip}</td>
                <td>{p.h}</td>
                <td>{p.r}</td>
                <td>{p.er}</td>
                <td>{p.bb}</td>
                <td>{p.so}</td>
                <td>{p.hr}</td>
                <td className="bs__ps">{`${p.pitches}-${p.strikes}`}</td>
                <td className="bs__avg">{p.era}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bs__totals">
              <td className="bs__nameCol">Totals</td>
              <td>{side.pitchTotals.ip}</td>
              <td>{side.pitchTotals.h}</td>
              <td>{side.pitchTotals.r}</td>
              <td>{side.pitchTotals.er}</td>
              <td>{side.pitchTotals.bb}</td>
              <td>{side.pitchTotals.so}</td>
              <td>{side.pitchTotals.hr}</td>
              <td />
              <td className="bs__avg" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function Decisions({ decisions }) {
  const parts = [
    decisions.win && { k: 'Win', v: decisions.win },
    decisions.loss && { k: 'Loss', v: decisions.loss },
    decisions.save && { k: 'Save', v: decisions.save },
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div className="bs__decisions">
      {parts.map((p) => (
        <span className="bs__decision" key={p.k}>
          <span className="bs__decisionK">{p.k}</span>
          <span className="bs__decisionV">{p.v}</span>
        </span>
      ))}
    </div>
  )
}

function GameInfo({ rows, dateLabel }) {
  if (rows.length === 0 && !dateLabel) return null
  return (
    <div className="bs__info">
      {dateLabel && <p className="bs__infoDate">{dateLabel}</p>}
      {rows.map((r, i) => (
        <p className="bs__infoRow" key={i}>
          <span className="bs__infoLabel">{r.label}:</span> {r.value}
        </p>
      ))}
    </div>
  )
}
