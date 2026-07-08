import { computeTopPerformers } from '../api/topPerformers.js'
import { useAsync } from '../hooks/useAsync.js'
import { leagueLogoUrl } from '../lib/teams.js'
import { LinkScope } from '../lib/nav.jsx'
import { SealBox } from './SealBox.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// The slate's hidden "kraft box": the day's top 5 batters and top 5 pitchers
// by win-probability added, across every in-progress/final game at the
// current level. Score-revealing (see src/api/topPerformers.js), so the whole
// thing — including the fact it has anything to show — sits behind a SealBox,
// keyed on date+level so switching either reseals it (same remount-to-reseal
// pattern InningViewer uses for its own SealBoxes).

function ProspectPill({ entry }) {
  if (entry.prospectRank) {
    return (
      <span className="prospectpill">
        <img src={leagueLogoUrl()} alt="" className="prospectpill__logo" />
        #{entry.prospectRank} PROSPECT
      </span>
    )
  }
  if (entry.orgProspectRank) {
    return (
      <span className="prospectpill">
        <TeamLogo teamId={entry.parentOrgId} name={entry.teamAbbr} size={12} />
        #{entry.orgProspectRank} PROSPECT
      </span>
    )
  }
  return null
}

function PerformerRow({ entry }) {
  return (
    <li className="topperf__row">
      <Headshot personId={entry.id} name={entry.name} className="topperf__shot" />
      <TeamLogo
        teamId={entry.teamId}
        name={entry.teamAbbr}
        size={20}
        className="topperf__logo"
      />
      <div className="topperf__who">
        <div className="topperf__head">
          <PlayerLink id={entry.id} className="topperf__name">
            {entry.name}
          </PlayerLink>
          {entry.position && <span className="topperf__pos">{entry.position}</span>}
          <ProspectPill entry={entry} />
        </div>
        <div className="topperf__stat">{entry.stat}</div>
      </div>
    </li>
  )
}

// Mounted only after reveal → the useAsync fetch fan-out fires on reveal,
// never before.
function TopPerformersPanel({ games, prospects, dateStr, sportId }) {
  const { loading, error, data, reload } = useAsync(
    () => computeTopPerformers({ games, prospects }),
    [games, prospects],
  )

  if (loading) {
    return <p className="hint topperf__loading">Crunching win probability across this day&apos;s games…</p>
  }
  if (error) {
    return (
      <div className="topperf__state">
        <p className="hint hint--error">Couldn&apos;t load today&apos;s top performers.</p>
        <button type="button" className="btn" onClick={reload}>
          Retry
        </button>
      </div>
    )
  }
  if (!data || (data.batters.length === 0 && data.pitchers.length === 0)) {
    return (
      <p className="hint hint--prose">
        Win probability isn&apos;t available for this day&apos;s games — common at
        minor-league parks.
      </p>
    )
  }

  return (
    <LinkScope asOf={dateStr} sportId={sportId}>
      <div className="topperf__sections">
        {data.batters.length > 0 && (
          <section className="topperf__section">
            <h3 className="topperf__title">Top Batters</h3>
            <ul className="topperf__list">
              {data.batters.map((e) => (
                <PerformerRow key={e.id} entry={e} />
              ))}
            </ul>
          </section>
        )}
        {data.pitchers.length > 0 && (
          <section className="topperf__section">
            <h3 className="topperf__title">Top Pitchers</h3>
            <ul className="topperf__list">
              {data.pitchers.map((e) => (
                <PerformerRow key={e.id} entry={e} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </LinkScope>
  )
}

// `games`: this slate's non-Preview games (each needs a `gamePk`).
// `prospectsData`: the app-wide snapshot (fetchTopProspects(), already fetched
// by GameSelect) — passed down rather than re-fetched.
export function TopPerformersBox({ dateStr, sportId, games, prospectsData }) {
  return (
    <div className="topperfbox">
      <SealBox
        key={`${dateStr}-${sportId}`}
        label="Tap to reveal today's top performers"
      >
        {() => (
          <TopPerformersPanel
            games={games}
            prospects={prospectsData}
            dateStr={dateStr}
            sportId={sportId}
          />
        )}
      </SealBox>
    </div>
  )
}
