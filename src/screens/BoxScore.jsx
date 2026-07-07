import { selectBoxscore, computeThreeStars } from '../api/boxscore.js'
import { managerLabel } from '../api/mlb.js'
import { revealDefense } from '../api/defense.js'
import { SealBox } from '../components/SealBox.jsx'
import { GameBuzzCard } from '../components/GameBuzz.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'

// Manager fill-in value, surname-first with the uniform number riding along —
// "MURPHY, PAT · 21" — matching how every staged name is penciled in. The
// number is inked red like every uniform number on the box score.
function managerValue(mgr) {
  const label = managerLabel(mgr)
  if (!label) return ''
  if (!mgr.jersey) return label
  return (
    <>
      {label} · <span className="bs__unum">{mgr.jersey}</span>
    </>
  )
}

// A player's uniform number and position after his name — "21 | SS" — the
// number inked red like every uniform number on the sheet, a pipe between it and
// the position, both at the position's size. Falls back to just the position
// when the feed didn't post a number.
function NumPos({ num, pos }) {
  return (
    <span className="bs__pos">
      {num !== '' && num != null && (
        <>
          <span className="bs__unum">{num}</span>
          {' | '}
        </>
      )}
      {pos}
    </span>
  )
}

// The full, MLB.com-style final box score for a game — batting orders (with
// substitutes indented), pitching lines, the BATTING/BASERUNNING/FIELDING notes,
// per-team footnotes, and the game-info foot (WP, umpires, weather, T, Att…).
//
// SPOILER RULE: the whole thing is score-revealing, so it lives behind a single
// SealBox. `selectBoxscore` is only called inside the reveal render function —
// nothing score-revealing is in the DOM until the user taps to reveal, exactly
// like every half-inning seal. This holds even for a deep link straight to the
// box score, so the card's "Box score" shortcut can't spoil either.
export function BoxScore({
  feed,
  managers,
  uniforms,
  scorebookWeather,
  winProbability,
  onInnings,
}) {
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

      <SealBox label="Tap to reveal the box score">
        {() => {
          const box = selectBoxscore(feed)
          // Computed here, inside the reveal render, so WPA never reaches the DOM
          // before the tap — same gate as the box score itself.
          const stars = computeThreeStars(winProbability, feed)
          return (
            <BoxScoreBody
              feed={feed}
              box={box}
              stars={stars}
              managers={managers}
              uniforms={uniforms}
              scorebookWeather={scorebookWeather}
            />
          )
        }}
      </SealBox>

      {/* A second, independent seal: the night's Bluesky buzz to seed GAME
          NOTES. Separately sealed because it too reveals the score, and its
          fetch is deferred until its own tap. */}
      <GameBuzzCard feed={feed} />
    </div>
  )
}

// Ordered to fill a #22 scorebook page as you work down it: the final R/H/E/LOB
// totals, the pitchers of record, the line score, then each team paired with its
// own header card — the visiting team's crew and first pitch above its
// batting/pitching, the home team's ballpark/weather/times above its own. The
// complete MLB-style game-info text sits at the very bottom so nothing is lost.
function BoxScoreBody({ feed, box, stars, managers, uniforms, scorebookWeather }) {
  const get = (label) =>
    box.gameInfo.find((r) => r.label === label)?.value ?? ''
  const u = box.umpires ?? {}

  const awayFields = [
    { label: 'Visiting Team', value: box.away.teamName, wide: true },
    { label: 'Manager', value: managerValue(managers?.away), wide: true },
    // What they wore (jersey · pants · cap) — spoiler-free, posted ~game time.
    { label: 'Uniform', value: uniforms?.away, wide: true },
    { label: 'HP Umpire', value: u.hp },
    { label: '1B Umpire', value: u.first },
    { label: '2B Umpire', value: u.second },
    { label: '3B Umpire', value: u.third },
    { label: 'First Pitch', value: box.times.firstPitch, wide: true },
  ]
  const homeFields = [
    { label: 'Home Team', value: box.home.teamName, wide: true },
    { label: 'Manager', value: managerValue(managers?.home), wide: true },
    { label: 'Uniform', value: uniforms?.home, wide: true },
    // The feed appends a period to the venue name ("Busch Stadium.") — drop it.
    // Ballpark + Attendance pair on one row; Time of Game + Game End on another.
    { label: 'Ballpark', value: get('Venue').replace(/\.\s*$/, '') },
    { label: 'Attendance', value: get('Att') },
    // Outdoor scorebook weather from the park's lat/lon (see weather.js) — the
    // value to copy onto paper. Falls back to the box-score weather when the
    // generator has nothing (e.g. a MiLB park with no coordinates).
    {
      label: 'Weather',
      value: scorebookWeather?.text || get('Weather'),
      wide: true,
    },
    { label: 'Time of Game', value: box.times.duration },
    { label: 'Game End', value: box.times.end },
  ]

  return (
    <div className="bs">
      {/* The duo/col wrappers are transparent on a phone (display: contents —
          everything keeps stacking in this order on .bs's own gap) and become
          two-up grids at the wide breakpoint: totals beside the decisions,
          line score beside the stars, then each club's header card +
          batting/pitching as its own column, away beside home. */}
      <div className="bs__duo">
        <LineTotals away={box.away} home={box.home} />
        <Decisions decisions={box.decisions} />
      </div>
      <div className="bs__duo">
        <Scoreboard away={box.away} home={box.home} innings={box.innings} />
        <ThreeStars stars={stars} />
      </div>
      <div className="bs__duo">
        <div className="bs__col">
          <InfoCard fields={awayFields} />
          <TeamBlock side={box.away} feed={feed} sideKey="away" />
        </div>
        <div className="bs__col">
          <InfoCard fields={homeFields} />
          <TeamBlock side={box.home} feed={feed} sideKey="home" />
        </div>
      </div>
      <GameInfo rows={box.footNotes} dateLabel={box.dateLabel} />
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

function TeamBlock({ side, feed, sideKey }) {
  return (
    <section className="bs__team">
      <h3 className="bs__teamname">
        <TeamLink id={side.id}>{side.teamName}</TeamLink>
      </h3>

      <div className="bs__scroll">
        {/* Columns follow the #22 scorebook's batter-totals order (AB·R·H·RBI),
            matching MLB.com, so each row transcribes straight across. */}
        <table className="bs__grid bs__grid--bat">
          <thead>
            <tr>
              <th className="bs__nameCol">Batting</th>
              <th>AB</th>
              <th>R</th>
              <th>H</th>
              <th>RBI</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map((b) => (
              <tr key={b.id} className={b.isSub ? 'bs__sub' : ''}>
                <td className="bs__nameCol">
                  <span className="bs__player">
                    {b.mark && <span className="bs__mark">{b.mark}</span>}
                    <PlayerLink id={b.id} className="bs__pname">{b.name}</PlayerLink>
                    {b.position && <NumPos num={b.num} pos={b.position} />}
                  </span>
                </td>
                <td>{b.ab}</td>
                <td>{b.r}</td>
                <td>{b.h}</td>
                <td>{b.rbi}</td>
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
                    <PlayerLink id={p.id} className="bs__pname">{p.name}</PlayerLink>
                    {p.num !== '' && p.num != null && (
                      <span className="bs__pos">
                        <span className="bs__unum">{p.num}</span>
                      </span>
                    )}
                    {p.dec && (
                      <span
                        className={`bs__dec bs__dec--${
                          p.dec === 'L' ? 'loss' : 'win'
                        }`}
                      >
                        {p.dec}
                      </span>
                    )}
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

      {side.pitchNotes.length > 0 && (
        <div className="bs__notes">
          <h4 className="bs__notesTitle">Pitching</h4>
          {side.pitchNotes.map((r, i) => (
            <p className="bs__note" key={i}>
              <span className="bs__noteLabel">{r.label}:</span> {r.value}
            </p>
          ))}
        </div>
      )}

      <BoxDefense feed={feed} sideKey={sideKey} />
    </section>
  )
}

// The team's complete defensive alignment for the game — the same scorebook
// diamond as the innings view (api/defense.js), but with every substitution
// through the game's final play folded in (or, for a game still in progress
// when this box score is viewed, every substitution made so far). Safe to
// compute here: the whole box score is already behind its own SealBox, so
// there's nothing left to spoil by walking the full play-by-play.
function BoxDefense({ feed, sideKey }) {
  const defense = revealDefense(feed, sideKey, Infinity, 'bottom')
  if (defense.length === 0) return null
  return (
    <section className="halfdefense">
      <h4 className="halfdefense__title">Defense</h4>
      <DefenseDiamond defense={defense} />
    </section>
  )
}

// The final tally card — each club's R/H/E/LOB by abbreviation — lifted to the
// top of the page as the first thing you copy onto the #22 sheet. The line score
// below fills in the inning-by-inning story; this is the bottom-line summary.
function LineTotals({ away, home }) {
  return (
    <div className="bs__totalsCard">
      <table className="bs__grid bs__grid--totals">
        <thead>
          <tr>
            <th className="bs__nameCol">Team</th>
            <th>R</th>
            <th>H</th>
            <th>E</th>
            <th>LOB</th>
          </tr>
        </thead>
        <tbody>
          {[away, home].map((side) => (
            <tr key={side.teamName}>
              <td className="bs__nameCol">
                <span className="bs__pname">
                  {side.abbreviation || side.teamName}
                </span>
              </td>
              <td className="bs__totCell">{side.line.r}</td>
              <td>{side.line.h}</td>
              <td>{side.line.e}</td>
              <td>{side.line.lob}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The scorebook's line score: runs by inning (1…N, extras included) then each
// club's R/H/E, one row per team the way it reads across the bottom of the #22
// sheet. Team names ride in full-caps nickname (BREWERS / CARDINALS) hard against
// the innings — each half-inning a fixed, equal-width bordered box, and any half
// that scored inked bold red. (LOB and the winning pitcher live elsewhere: the
// totals card up top and the decisions block above.)
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
              <th className="bs__boardName" />
              {innings.map((i) => (
                <th key={i.num} className="bs__boardInn">
                  {i.num}
                </th>
              ))}
              <th className="bs__boardFinal">R</th>
              <th className="bs__boardFinal">H</th>
              <th className="bs__boardFinal">E</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ side, cells }) => (
              <tr key={side.teamName}>
                <td className="bs__boardName">
                  {side.clubName || side.abbreviation || side.teamName}
                </td>
                {cells.map((v, i) => {
                  const scored = typeof v === 'number' && v > 0
                  return (
                    <td
                      key={innings[i].num}
                      className={`bs__boardInn${
                        scored ? ' bs__boardInn--scored' : ''
                      }`}
                    >
                      {v}
                    </td>
                  )
                })}
                <td className="bs__boardFinal">{side.line.r}</td>
                <td className="bs__boardFinal">{side.line.h}</td>
                <td className="bs__boardFinal">{side.line.e}</td>
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

// The three stars of the game — the hockey-tradition nod, ranked by
// win-probability added (see computeThreeStars). Three filled stars for the top
// mover, two for the second, one for the third; each name carries its game line
// in smaller type. Hidden entirely when WPA isn't available (most MiLB parks).
function ThreeStars({ stars }) {
  if (!stars || stars.length === 0) return null
  return (
    <div className="bs__stars">
      <h3 className="bs__starsTitle">Three stars</h3>
      <ol className="bs__starList">
        {stars.map((s) => (
          <li className="bs__star" key={s.id}>
            <span className="bs__starMarks" aria-label={`${s.stars} star`}>
              {'★'.repeat(s.stars)}
            </span>
            <span className="bs__starWho">
              <span className="bs__starHead">
                <PlayerLink id={s.id} className="bs__starName">{s.name}</PlayerLink>
                {(s.teamAbbr || s.pos) && (
                  <span className="bs__starMeta">
                    {[s.teamAbbr, s.pos].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <span className="bs__starStat">{s.stat}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// What's left of the info block after selectBoxscore peels off the
// structured fill-in-box fields (umpires, weather+wind, venue, attendance,
// first pitch, duration) and splits every per-pitcher row onto its own team's
// TeamBlock (see `pitchNotes` there): whole-game fields with no team owner,
// plus any entry that couldn't be matched to a roster name.
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
