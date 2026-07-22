import {
  loadPostseasonLeaders,
  BATTING_CATEGORIES,
  PITCHING_CATEGORIES,
} from '../api/postseasonLeaders.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { SectionTitle } from '../components/SectionTitle.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { TeamLeaders } from '../components/TeamLeaders.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'
import { teamClubNameShort, favoriteAccentColor } from '../lib/teams.js'

// One franchise leaderboard (Titles/Pennants/Appearances) — rank, logo, club
// name, count. A team-keyed leaderboard, so it doesn't reuse TeamLeaders
// (built around a PLAYER-keyed pool); the batting/pitching sections below do.
// `favoriteTeamId` gets the same --fav-accent highlight as the rest of the
// app (AwardsHistoryPage, TeamLeaders) — a fan's own franchise jumps out of
// the rank list.
function TeamCountBoard({ title, entries, favoriteTeamId }) {
  if (!entries.length) return null
  return (
    <section className="psleaders__teamboard">
      <SectionTitle title={title} />
      <ol className="psleaders__teamlist">
        {entries.map((e, i) => {
          const isFavorite = favoriteTeamId != null && e.teamId === favoriteTeamId
          const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(e.teamId) } : undefined
          return (
            <li
              key={e.teamId}
              className={`psleaders__teamrow${isFavorite ? ' psleaders__teamrow--fav' : ''}`}
              style={favStyle}
            >
              <span className="psleaders__rank">{i + 1}</span>
              <TeamLink id={e.teamId} className="psleaders__teamlink">
                <TeamLogo teamId={e.teamId} name={teamClubNameShort(e.teamId)} size={22} />
                <span className="psleaders__teamname">{teamClubNameShort(e.teamId)}</span>
              </TeamLink>
              <span className="psleaders__count">{e.count}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// Players who've won a Series MVP (LCS or World Series) more than once since
// 2000 — a free byproduct of postseason-history.json's own per-series mvp
// field, no extra fetch. Filtered to repeat winners at generation time
// (gen-postseason-leaders.mjs) so this reads as a highlight reel, not a long
// tail of everyone who's won it exactly once.
function MvpAwardsBoard({ entries, favoriteTeamId }) {
  if (!entries.length) return null
  return (
    <section className="psleaders__teamboard">
      <SectionTitle title="Multiple Series MVP Awards" />
      <ol className="psleaders__mvplist">
        {entries.map((e, i) => {
          const isFavorite = favoriteTeamId != null && e.teamId === favoriteTeamId
          const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(e.teamId) } : undefined
          return (
            <li
              key={e.playerId}
              className={`psleaders__mvprow${isFavorite ? ' psleaders__mvprow--fav' : ''}`}
              style={favStyle}
            >
              <span className="psleaders__rank">{i + 1}</span>
              <Headshot personId={e.playerId} name={e.name} teamId={e.teamId} className="psleaders__mvpshot" />
              <span className="psleaders__mvpwho">
                <PlayerLink id={e.playerId} className="psleaders__mvpname">
                  {e.name}
                </PlayerLink>
                {e.position && <span className="psleaders__mvppos">{e.position}</span>}
              </span>
              <span className="psleaders__count">{e.count}×</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// Postseason Leaders: since-2000 career postseason leaderboards. Three tiers,
// cheapest first:
//   1. Franchise leaders (titles/pennants/appearances) and repeat Series MVP
//      winners — both derived straight from postseason-history.json, which
//      the bracket page already fetches; no new data need.
//   2. Batting/pitching career leaderboards — need per-game boxscore stat
//      lines gen-postseason-history.mjs never fetches, so
//      gen-postseason-leaders.mjs sweeps every postseason game's boxscore
//      once into the shared SQLite layer (docs/adr/0021) and exports
//      pre-ranked top-10 rows per category (same "bake the ranking at
//      generation time" convention as minors-leaders.json). AVG/ERA carry a
//      minimum-AB/IP qualifier so a single pinch-hit or mop-up inning can't
//      top a rate-stat board.
// Reuses TeamLeaders (precomputed path) for the batting/pitching sections —
// same Featured-leader/chasers layout as the Team/League Leaders pages, so a
// player-keyed leaderboard shows a headshot + team logo, not a bespoke rank
// list — but a plain rank list for the franchise/MVP boards, which are
// TEAM-keyed and single-category (no featured-card treatment fits there).
// Every number is a season(s)-old counting/rate stat carrying no LIVE game's
// spoiler risk (same footing as Awards History/WAR) — no SealBox needed.
export function PostseasonLeadersPage() {
  useDocumentTitle('Postseason Leaders')
  const { favoriteTeamId } = useFavoriteTeam()
  const { loading, error, data } = useAsync(() => loadPostseasonLeaders(), [])

  const teams = data?.teams ?? { titles: [], pennants: [], appearances: [] }
  const mvpAwards = data?.mvpAwards ?? []
  const batting = data?.batting ?? {}
  const pitching = data?.pitching ?? {}
  const hasTeamLeaders = teams.titles.length > 0 || teams.pennants.length > 0 || teams.appearances.length > 0
  const hasBatting = Object.values(batting).some((v) => v?.length > 0)
  const hasPitching = Object.values(pitching).some((v) => v?.length > 0)
  const hasAnything = hasTeamLeaders || mvpAwards.length > 0 || hasBatting || hasPitching

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Postseason Leaders</h1>
      </header>
      {data?.since && <p className="hint psleaders__subtitle">Since {data.since}</p>}
      <p className="hint psleaders__subtitle">Your favorite team, and players who played for it, are highlighted below.</p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={hasAnything}
        errorMessage="Couldn’t load Postseason Leaders. Try again."
        emptyMessage="No postseason leaders are available right now."
        emptyProse
      />

      {hasTeamLeaders && (
        <div className="psleaders__teamsrow">
          <TeamCountBoard title="Most World Series Titles" entries={teams.titles} favoriteTeamId={favoriteTeamId} />
          <TeamCountBoard title="Most Pennants" entries={teams.pennants} favoriteTeamId={favoriteTeamId} />
          <TeamCountBoard
            title="Most Postseason Appearances"
            entries={teams.appearances}
            favoriteTeamId={favoriteTeamId}
          />
        </div>
      )}

      <MvpAwardsBoard entries={mvpAwards} favoriteTeamId={favoriteTeamId} />

      {hasBatting && (
        <TeamLeaders
          pool={[]}
          precomputed={batting}
          categories={BATTING_CATEGORIES}
          limit={10}
          title="Batting leaders"
          showTeamAbbr={false}
          favoriteTeamId={favoriteTeamId}
        />
      )}

      {hasPitching && (
        <TeamLeaders
          pool={[]}
          precomputed={pitching}
          categories={PITCHING_CATEGORIES}
          limit={10}
          title="Pitching leaders"
          showTeamAbbr={false}
          favoriteTeamId={favoriteTeamId}
        />
      )}

      <ReportFooter />
    </div>
  )
}
