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
      <Scoreboard
        away={box.away}
        home={box.home}
        innings={box.innings}
        wp={box.decisions.win}
      />
      <Decisions decisions={box.decisions} />
      <GameInfo
        rows={box.gameInfo}
        umpires={box.umpires}
        dateLabel={box.dateLabel}
      />
    </div>
  )
}

function TeamBlock({ side }) {
  return (
    <section className="bs__team">
      <h3 className="bs__teamname">{side.teamName}</h3>

      <div className="bs__scroll">
        {/* Columns follow the #22 scorebook's batter-totals order (AB·H·R·RBI),
            not MLB.com's AB·R·H·RBI, so each row transcribes straight across. */}
        <table className="bs__grid bs__grid--bat">
          <thead>
            <tr>
              <th className="bs__nameCol">Batting</th>
              <th>AB</th>
              <th>H</th>
              <th>R</th>
              <th>RBI</th>
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
                <td>{b.h}</td>
                <td>{b.r}</td>
                <td>{b.rbi}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bs__totals">
              <td className="bs__nameCol">Totals</td>
              <td>{side.batTotals.ab}</td>
              <td>{side.batTotals.h}</td>
              <td>{side.batTotals.r}</td>
              <td>{side.batTotals.rbi}</td>
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
        {/* Columns match the #22 scorebook's pitcher table: throwing hand, IP,
            pitch count, batters faced, then H·R·ER·BB·K. (SO is the scorebook's
            K; HR/ERA/strike-split aren't on the sheet, so they're dropped.) */}
        <table className="bs__grid bs__grid--pit">
          <thead>
            <tr>
              <th className="bs__nameCol">Pitching</th>
              <th>R/L</th>
              <th>IP</th>
              <th>P</th>
              <th>BF</th>
              <th>H</th>
              <th>R</th>
              <th>ER</th>
              <th>BB</th>
              <th>K</th>
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
                <td className="bs__hand">{p.hand || '—'}</td>
                <td>{p.ip}</td>
                <td>{p.pitches}</td>
                <td>{p.bf}</td>
                <td>{p.h}</td>
                <td>{p.r}</td>
                <td>{p.er}</td>
                <td>{p.bb}</td>
                <td>{p.so}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bs__totals">
              <td className="bs__nameCol">Totals</td>
              <td />
              <td>{side.pitchTotals.ip}</td>
              <td />
              <td>{side.pitchTotals.bf}</td>
              <td>{side.pitchTotals.h}</td>
              <td>{side.pitchTotals.r}</td>
              <td>{side.pitchTotals.er}</td>
              <td>{side.pitchTotals.bb}</td>
              <td>{side.pitchTotals.so}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

// The scorebook's scoreboard strip: runs by inning (1…N, extras included)
// followed by each team's final R/H/E/LOB and the winning pitcher — the tallies
// you copy across the bottom of the #22 sheet once the game is final. It's the
// one wide table here, so it keeps the horizontal-scroll fallback for a long
// extra-inning line rather than cramping the totals.
function Scoreboard({ away, home, innings, wp }) {
  const rows = [
    { side: away, cells: innings.map((i) => i.away) },
    { side: home, cells: innings.map((i) => i.home) },
  ]
  return (
    <div className="bs__board">
      <div className="bs__scroll">
        <table className="bs__grid bs__grid--board">
          <thead>
            <tr>
              <th className="bs__nameCol">Final</th>
              {innings.map((i) => (
                <th key={i.num}>{i.num}</th>
              ))}
              <th className="bs__boardTot">R</th>
              <th>H</th>
              <th>E</th>
              <th>LOB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ side, cells }) => (
              <tr key={side.teamName}>
                <td className="bs__nameCol">
                  <span className="bs__pname">
                    {side.abbreviation || side.teamName}
                  </span>
                </td>
                {cells.map((v, i) => (
                  <td key={innings[i].num} className="bs__inn">
                    {v}
                  </td>
                ))}
                <td className="bs__boardTot">{side.line.r}</td>
                <td>{side.line.h}</td>
                <td>{side.line.e}</td>
                <td>{side.line.lob}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {wp && (
        <p className="bs__wp">
          <span className="bs__infoLabel">WP:</span> {wp}
        </p>
      )}
    </div>
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

function GameInfo({ rows, umpires, dateLabel }) {
  // The scorebook header has four umpire slots (HP/1B/2B/3B); list them first,
  // then the remaining game-info the sheet asks for (weather, first pitch, T,
  // Att, venue…), each already a label/value row that copies straight across.
  const umpRows = umpires
    ? [
        { label: 'HP', value: umpires.hp },
        { label: '1B', value: umpires.first },
        { label: '2B', value: umpires.second },
        { label: '3B', value: umpires.third },
      ].filter((u) => u.value)
    : []
  if (rows.length === 0 && umpRows.length === 0 && !dateLabel) return null
  return (
    <div className="bs__info">
      {dateLabel && <p className="bs__infoDate">{dateLabel}</p>}
      {umpRows.length > 0 && (
        <p className="bs__infoRow">
          <span className="bs__infoLabel">Umpires</span>
          {umpRows.map((u) => (
            <span className="bs__ump" key={u.label}>
              <span className="bs__umpSlot">{u.label}</span> {u.value}
            </span>
          ))}
        </p>
      )}
      {rows.map((r, i) => (
        <p className="bs__infoRow" key={i}>
          <span className="bs__infoLabel">{r.label}:</span> {r.value}
        </p>
      ))}
    </div>
  )
}
