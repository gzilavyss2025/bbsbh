import { useMemo } from 'react'
import {
  selectLineup,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
  selectOpposingPitcher,
  selectOpposingDefense,
} from '../api/select.js'
import { scorebookDate } from '../lib/dates.js'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'

// Away/home info + lineup page — the staging page you copy the scorebook
// header from, so facts run in the sheet's order (date, park, first pitch,
// weather, attendance, manager, umpires) and every person outside the
// opposing-defense diamond is penciled surname-first with a uniform number.
// Nothing here is score-revealing, so it renders openly. The team's logo
// lives in the game masthead (see GameView), not here.
export function TeamInfo({
  feed,
  side,
  manager,
  uniform,
  scorebookWeather,
  scorebookWeatherLoading,
  oppPitcherLine,
  onNext,
  nextLabel,
}) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])

  return (
    <div className="teaminfo">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">{meta.name || 'Team'}</h2>
        <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
      </div>

      <dl className="factgrid">
        <GameFacts
          info={info}
          scorebookWeather={scorebookWeather}
          scorebookWeatherLoading={scorebookWeatherLoading}
        />
        <Fact label="Manager" value={managerFact(manager)} />
        {/* Tonight's uniform, synthesized to a tight summary ("Away Alternate
            Navy Blue") — spoiler-free, but the assignment isn't posted until
            around first pitch, so pregame this reads "—" until a Refresh picks
            it up. Never posted for MiLB. */}
        <Fact label="Uniform" value={uniform} />
      </dl>

      <Umpires officials={officials} />

      <TeamSections feed={feed} side={side} oppPitcherLine={oppPitcherLine} />

      <div className="pagenav">
        <button className="btn btn--next" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

// Both lineup pages condensed onto one sheet — the wide-screen (tablet /
// desktop) replacement for the two TeamInfo pages, swapped in by GameView at
// the WIDE_QUERY breakpoint. The game-level facts and umpires render once up
// top; each club then gets its own column of the team-specific sections
// (manager/uniform, batting order, opposing pitcher, opposing defense).
export function LineupSpread({
  feed,
  managers,
  uniforms,
  scorebookWeather,
  scorebookWeatherLoading,
  starterLines,
  onNext,
}) {
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])

  return (
    <div className="teaminfo teaminfo--spread">
      <dl className="factgrid factgrid--game">
        <GameFacts
          info={info}
          scorebookWeather={scorebookWeather}
          scorebookWeatherLoading={scorebookWeatherLoading}
        />
      </dl>

      <Umpires officials={officials} />

      <div className="teaminfo__duo">
        {['away', 'home'].map((side) => (
          <TeamPanel
            key={side}
            feed={feed}
            side={side}
            manager={managers?.[side]}
            uniform={uniforms?.[side]}
            // Each side FACES the other side's starter.
            oppPitcherLine={starterLines?.[side === 'away' ? 'home' : 'away']}
          />
        ))}
      </div>

      <div className="pagenav">
        <button className="btn btn--next" onClick={onNext}>
          Innings ›
        </button>
      </div>
    </div>
  )
}

// One club's column of the spread: name, its two team facts, then the same
// lineup / opposing-pitcher / opposing-defense sections as the phone page.
function TeamPanel({ feed, side, manager, uniform, oppPitcherLine }) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  return (
    <section className="teampanel">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">{meta.name || 'Team'}</h2>
        <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
      </div>
      <dl className="factgrid">
        <Fact label="Manager" value={managerFact(manager)} />
        <Fact label="Uniform" value={uniform} />
      </dl>
      <TeamSections feed={feed} side={side} oppPitcherLine={oppPitcherLine} />
    </section>
  )
}

// The game-level fill-ins shared by both clubs, in the sheet's order.
function GameFacts({ info, scorebookWeather, scorebookWeatherLoading }) {
  return (
    <>
      <Fact label="Date" value={scorebookDate(info.officialDate)} />
      <Fact label="Ballpark" value={info.venue} />
      <Fact label="First pitch" value={info.firstPitch} />
      <Fact
        label="Weather"
        value={scorebookWeatherLoading ? '…' : scorebookWeather?.text}
      />
      {/* Box weather is only the closed-roof interior reading — show it here
          just as a fallback when the outdoor scorebook weather resolved to
          nothing. When we have real weather, it's redundant (still in the box
          score at the bottom of the game). */}
      {!scorebookWeatherLoading && !scorebookWeather?.text && (
        <Fact label="Box weather" value={info.weather} />
      )}
      <Fact label="Attendance" value={info.attendance} />
    </>
  )
}

function Umpires({ officials }) {
  if (officials.length === 0) return null
  return (
    <section className="umps">
      <h3 className="section__title">Umpires</h3>
      <ul className="umps__list">
        {officials.map((o) => (
          <li key={o.role}>
            <span className="umps__role">{o.role}</span>
            <span className="umps__name">{o.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// The team-specific body shared by the phone page and the spread's panels:
// batting order, the opposing starter, and the opposing defense diamond.
function TeamSections({ feed, side, oppPitcherLine }) {
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const oppPitcher = useMemo(() => selectOpposingPitcher(feed, side), [feed, side])
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])

  return (
    <>
      <section className="lineup">
        <h3 className="section__title">Batting order</h3>
        {lineup.length === 0 ? (
          <p className="hint">Lineup not posted yet.</p>
        ) : (
          <ol className="lineup__list">
            {lineup.map((p) => (
              <li key={p.id} className="lineup__row">
                <span className="lineup__order">{p.order}</span>
                <span className="lineup__name">
                  {p.nameLastFirst.toUpperCase()}
                </span>
                <span className="lineup__jersey">{p.jersey || ''}</span>
                <span className="lineup__pos">{p.position}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="opp">
        <h3 className="section__title">Opposing pitcher</h3>
        {oppPitcher ? (
          <div className="opp__pitcher">
            <span className="opp__name">
              {oppPitcher.nameLastFirst.toUpperCase()}
            </span>
            <span className="opp__jersey">{oppPitcher.jersey || ''}</span>
            <span className="opp__hand">{oppPitcher.hand}</span>
            {/* Season line (aggregates only, never this game's) — the numbers
                you pencil next to the starter while staging. */}
            {oppPitcherLine && (
              <span className="opp__season">
                {[
                  oppPitcherLine.era && `${oppPitcherLine.era} ERA`,
                  `${oppPitcherLine.wins}-${oppPitcherLine.losses}`,
                  `${oppPitcherLine.strikeOuts} K`,
                  oppPitcherLine.inningsPitched &&
                    `${oppPitcherLine.inningsPitched} IP`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
        ) : (
          <p className="hint">Not posted yet.</p>
        )}
      </section>

      {oppDefense.length > 0 && (
        <section className="opp">
          <h3 className="section__title">Opposing defense</h3>
          {/* Drawn like the sheet's bottom-left diamond: surnames on writing
              lines at their positions. The defense belongs to the OTHER side. */}
          <DefenseDiamond defense={oppDefense} />
        </section>
      )}
    </>
  )
}

// The manager fill-in: surname-first name with the uniform number inked in
// seam red, like every lineup row. Null (→ the Fact's "—") until resolved.
function managerFact(manager) {
  if (!manager) return null
  return (
    <span className="fact__person">
      {manager.lastFirst.toUpperCase()}
      {manager.jersey ? (
        <span className="fact__jersey">{manager.jersey}</span>
      ) : null}
      {manager.interim ? <span className="fact__note">interim</span> : null}
    </span>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value || <span className="fact__na">—</span>}</dd>
    </div>
  )
}
