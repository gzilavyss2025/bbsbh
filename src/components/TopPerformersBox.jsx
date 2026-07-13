import { useEffect, useState } from 'react'
import { computeTopPerformers } from '../api/topPerformers.js'
import { useAsync } from '../hooks/useAsync.js'
import { leagueLogoUrl } from '../lib/teams.js'
import { useNav } from '../lib/nav.js'
import { LinkScope } from '../lib/nav.jsx'
import { SealBox } from './SealBox.jsx'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { Loader } from './Loader.jsx'

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

// The game a performance came from, as a plain score line ("MIL 10, STL 2")
// linking to that game's (already-sealed) box score — not a PlayerLink/
// TeamLink, so it navigates directly rather than through LinkScope.
function GameScoreLink({ game }) {
  const navigate = useNav()
  if (!game) return null
  return (
    <button
      type="button"
      className="plink topperf__score"
      onClick={() => navigate(game.boxScorePath)}
    >
      {game.awayAbbr} {game.awayScore}, {game.homeAbbr} {game.homeScore}
    </button>
  )
}

function PerformerRow({ entry }) {
  return (
    <li className="topperf__row">
      <Headshot personId={entry.id} name={entry.name} teamId={entry.parentOrgId ?? entry.teamId} className="topperf__shot" />
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
        <GameScoreLink game={entry.game} />
      </div>
    </li>
  )
}

// Mounted only after reveal → the useAsync fetch fan-out fires on reveal,
// never before.
function TopPerformersPanel({ games, prospects, dateStr, sportId }) {
  const { loading, error, data, reload } = useAsync(
    () => computeTopPerformers({ games, prospects, dateStr }),
    [games, prospects, dateStr],
  )

  if (loading) {
    return (
      <Loader
        size="inline"
        message="Crunching win probability across this day’s games…"
      />
    )
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
  // The "TOP PERFORMERS" banner rides above the seal so the day's leaderboard
  // announces itself while still sealed, then steps aside the moment it's
  // revealed (the revealed panel carries its own Top Batters/Top Pitchers
  // headings). Reset when the date/level changes, since that reseals the box.
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [dateStr, sportId])

  return (
    <div className="topperfbox">
      {!revealed && <h2 className="topperf__banner">Top Performers</h2>}
      <SealBox
        key={`${dateStr}-${sportId}`}
        label="Tap to reveal today's top performers"
        onReveal={() => setRevealed(true)}
        compact
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
