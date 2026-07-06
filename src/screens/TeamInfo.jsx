import { useMemo } from 'react'
import {
  selectLineup,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
} from '../api/select.js'

// Away/home info + lineup page. Nothing here is score-revealing — lineups,
// umpires, venue and weather are all spoiler-safe — so it renders openly.
export function TeamInfo({ feed, side, manager, onNext, nextLabel }) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])

  return (
    <div className="teaminfo">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">{meta.name || 'Team'}</h2>
        <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
      </div>

      <dl className="factgrid">
        <Fact label="Manager" value={manager} />
        <Fact
          label="Probable"
          value={
            meta.probablePitcher
              ? `${meta.probablePitcher.name}${
                  meta.probablePitcher.hand ? ` (${meta.probablePitcher.hand}HP)` : ''
                }`
              : null
          }
        />
        <Fact label="Venue" value={info.venue} />
        <Fact label="Weather" value={info.weather} />
        <Fact label="Wind" value={info.wind} />
        <Fact label="First pitch" value={info.firstPitch} />
        <Fact label="Attendance" value={info.attendance} />
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
                <span className="lineup__jersey">
                  {p.jersey ? `#${p.jersey}` : ''}
                </span>
                <span className="lineup__name">{p.name}</span>
                <span className="lineup__pos">{p.position}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <button className="btn btn--next" onClick={onNext}>
        {nextLabel}
      </button>
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
