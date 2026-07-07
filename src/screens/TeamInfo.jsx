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
  scorebookWeather,
  scorebookWeatherLoading,
  oppPitcherLine,
  onNext,
  nextLabel,
}) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const oppPitcher = useMemo(() => selectOpposingPitcher(feed, side), [feed, side])
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])

  return (
    <div className="teaminfo">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">{meta.name || 'Team'}</h2>
        <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
      </div>

      <dl className="factgrid">
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
        <Fact
          label="Manager"
          value={
            manager ? (
              <span className="fact__person">
                {manager.lastFirst.toUpperCase()}
                {manager.jersey ? (
                  <span className="fact__jersey">{manager.jersey}</span>
                ) : null}
                {manager.interim ? (
                  <span className="fact__note">interim</span>
                ) : null}
              </span>
            ) : null
          }
        />
      </dl>

      {officials.length > 0 && (
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
      )}

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
          <DefenseDiamond
            defense={oppDefense}
            side={side === 'away' ? 'home' : 'away'}
          />
        </section>
      )}

      <div className="pagenav">
        <button className="btn btn--next" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
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
