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
export function BoxScore({ feed, managers, scorebookWeather, onInnings }) {
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
          return (
            <BoxScoreBody
              box={box}
              managers={managers}
              scorebookWeather={scorebookWeather}
            />
          )
        }}
      </SealBox>
    </div>
  )
}

// Ordered to fill a #22 scorebook page as you work down it: the line score, the
// pitchers of record, then each team paired with its own header card — the
// visiting team's crew and first pitch above its batting/pitching, the home
// team's ballpark/weather/times above its own. The complete MLB-style game-info
// text sits at the very bottom so nothing is lost.
function BoxScoreBody({ box, managers, scorebookWeather }) {
  const get = (label) =>
    box.gameInfo.find((r) => r.label === label)?.value ?? ''
  const u = box.umpires ?? {}

  const awayFields = [
    { label: 'Visiting Team', value: box.away.teamName, wide: true },
    { label: 'Manager', value: managers?.away },
    { label: 'HP Umpire', value: u.hp },
    { label: '1B Umpire', value: u.first },
    { label: '2B Umpire', value: u.second },
    { label: '3B Umpire', value: u.third },
    { label: 'First Pitch', value: box.times.firstPitch },
  ]
  const homeFields = [
    { label: 'Home Team', value: box.home.teamName, wide: true },
    { label: 'Manager', value: managers?.home },
    { label: 'Ballpark', value: get('Venue'), wide: true },
    // Outdoor scorebook weather from the park's lat/lon (see weather.js) — the
    // value to copy onto paper. Falls back to the box-score weather when the
    // generator has nothing (e.g. a MiLB park with no coordinates).
    {
      label: 'Scorebook Wx',
      value: scorebookWeather?.text || get('Weather'),
      wide: true,
    },
    { label: 'Attendance', value: get('Att') },
    { label: 'Box weather', value: get('Weather') },
    { label: 'Time of Game', value: box.times.duration },
    { label: 'Game End', value: box.times.end },
  ]

  return (
    <div className="bs">
      <Scoreboard away={box.away} home={box.home} innings={box.innings} />
      <Decisions decisions={box.decisions} />
      <InfoCard fields={awayFields} />
      <TeamBlock side={box.away} />
      <InfoCard fields={homeFields} />
      <TeamBlock side={box.home} />
      <GameInfo rows={box.gameInfo} dateLabel={box.dateLabel} />
    </div>
  )
}

// A card of the scorebook's labeled fill-in boxes — each a small caption over
// its value, so you read a box and copy it into the matching slot on the sheet.
// Anything the feed didn't post shows "—".
function InfoCard({ fields }) {
  return (
    <div className="bs__fill">
      {fields.map((f) => (
        <div
          className={`bs__field${f.wide ? ' bs__field--wide' : ''}`}
          key={f.label}
        >
          <span className="bs__fieldLabel">{f.label}</span>
          <span className="bs__fieldValue">{f.value || '—'}</span>
        </div>
      ))}
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
// followed by each team's final R/H/E/LOB — the tallies you copy across the
// bottom of the #22 sheet once the game is final. It's the one wide table here,
// so it keeps the horizontal-scroll fallback for a long extra-inning line rather
// than cramping the totals. (The winning pitcher lives in the decisions block
// just below, not here.)
function Scoreboard({ away, home, innings }) {
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
    </div>
  )
}

// Pitchers of record, stacked one per line. Each name carries its season line in
// parens — (W-L) for the win and loss, (saves) for the save — the way a printed
// box score writes the decisions.
function Decisions({ decisions }) {
  const withRec = (name, rec) => (rec ? `${name} (${rec})` : name)
  const parts = [
    decisions.win && {
      k: 'Win',
      v: withRec(decisions.win, decisions.winRecord),
    },
    decisions.loss && {
      k: 'Loss',
      v: withRec(decisions.loss, decisions.lossRecord),
    },
    decisions.save && {
      k: 'Save',
      v: withRec(decisions.save, decisions.saveRecord),
    },
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

// The complete MLB-style game-info foot (WP/LP/SV detail, pitches-strikes,
// umpires, weather, T, Att, venue…) kept verbatim at the bottom so the full text
// box score is intact; the fill-in boxes up top are the transcription shortcut.
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
