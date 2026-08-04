import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { teamTabPath } from '../lib/route.js'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLeaders } from '../components/TeamLeaders.jsx'
import { TeamScoreCard } from '../components/TeamScoreCard.jsx'
import { TeamTransactionsCard } from '../components/TeamTransactionsCard.jsx'
import { ChevronLink } from '../components/ChevronLink.jsx'
import { FEATURED_CATEGORIES } from '../api/teamLeaders.js'
import { TeamHubShell } from './team/TeamHubShell.jsx'
import { loadOverview } from './team/data/loadOverview.js'
import { StandingsCard } from './team/modules/StandingsCard.jsx'
import { LastTenGames } from './team/modules/LastTenGames.jsx'
import { RosterProjection } from './team/modules/RosterProjection.jsx'

// How many rows each preview shows. A preview is a DOOR, not a smaller
// duplicate — every one of these ends in a link to the tab that holds the whole
// thing, and none of them is the last word on anything.
const PREVIEW_LEADER_CATEGORIES = 3
const PREVIEW_TRANSACTIONS = 3

// The door itself: one text link under a preview, built from the same shared
// ChevronLink TeamLeaders' own built-in door uses (reused as-is below rather
// than doubled up). It is a link, not a card — the tab bar, the shelf row and
// the Org index tile remain the only new chrome this rebuild introduces (see
// the PRD's non-negotiable 4).
function PreviewDoor({ label, onClick }) {
  return (
    <div className="thub-door">
      <ChevronLink onClick={onClick}>{label}</ChevronLink>
    </div>
  )
}

// The Overview — the team hub's front door at the bare `/team/{id}`, and the
// tab the other five hang off (see .scratch/team-page-ia/PRD.md).
//
// It used to be the whole team page: twenty modules in identical cards, one
// uninterrupted scroll, every one of them fetched before first paint. Now it is
// a summary — six previews, each a door into the tab that owns its subject —
// and its loader buys only what those previews render. Anything you are tempted
// to add here in full belongs in a tab; anything a tab already shows in full
// belongs here at most as a preview.
export function TeamPage({ id, asOf, sportId }) {
  const teamId = Number(id)
  const navigate = useNav()
  const { loading, error, data } = useAsync(() => loadOverview(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()
  // Every door goes through teamTabPath -> linkQuery, so a dated link's `?d=`
  // (the spoiler cutoff) and `?s=` survive the jump. A door that dropped them
  // would show a visitor mid-scoring stats past the half-inning they've reached
  // — a spoiler bug, not a cosmetic one (PRD non-negotiable 1).
  const go = (tab) => navigate(teamTabPath(teamId, tab, { d: asOf, s: sportId }))

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  const {
    team,
    record,
    manager,
    isMilb,
    standings,
    divisionPostseasonOdds,
    seasonScore,
    teamScore,
    leagueGradeScores,
    leagueSeasonScores,
    leagueSurpriseScores,
    leagueFormScores,
    recentGames,
    seasonGames,
    lineupDefense,
    leaderPool,
    injuredIds,
    transactionsPage,
  } = data

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="overview"
    >
      {/* Standing — the club's row plus the team above and below it. The
          Postseason Odds pill still opens the whole division's snapshot: that
          modal is the Overview's, not the Numbers tab's. */}
      {standings.length > 0 && (
        <>
          <StandingsCard
            team={team}
            standings={standings}
            asOf={asOf}
            divisionPostseasonOdds={divisionPostseasonOdds}
            preview
          />
          <PreviewDoor label="Full standings" onClick={() => go('numbers')} />
        </>
      )}

      {/* Form — the season grade and form rails, in full. This is the page's
          headline, and the one preview that isn't a smaller version of
          something: nothing further lives behind it, so its door just carries
          on to the rest of the club's numbers. */}
      {teamScore?.season?.score != null && (
        <>
          <TeamScoreCard
            snapshot={teamScore}
            surprise={seasonScore}
            teamId={team.id}
            leagueGradeScores={leagueGradeScores}
            leagueSeasonScores={leagueSeasonScores}
            leagueSurpriseScores={leagueSurpriseScores}
            leagueFormScores={leagueFormScores}
          />
          <PreviewDoor label="Season numbers" onClick={() => go('numbers')} />
        </>
      )}

      {/* Last 10 — the true last ten, newest last, matching the Games tab's own
          reading direction. Scrolling back past them to Opening Day is that
          tab's job, and is the only thing this preview holds back. */}
      {recentGames.length > 0 && (
        <>
          <LastTenGames
            teamId={team.id}
            asOf={asOf}
            recentGames={recentGames}
            seasonGames={seasonGames}
            preview
          />
          <PreviewDoor label="Season schedule" onClick={() => go('games')} />
        </>
      )}

      {/* Lineup — the preferred-lineup diamond only. The bench, both pitching
          staffs, the 40-man and the injured list are the Roster tab's. */}
      {lineupDefense.length > 0 && (
        <>
          <RosterProjection rosterLineup={lineupDefense} injuredIds={injuredIds} isMilb={isMilb} preview />
          <PreviewDoor label="Full roster" onClick={() => go('roster')} />
        </>
      )}

      {/* Leaders — three featured categories. Its own "See all ›" is the door
          (to Numbers, which carries the full featured set and its own link on
          to /team/{id}/leaders), so this preview needs no PreviewDoor. */}
      <TeamLeaders
        pool={leaderPool}
        categories={FEATURED_CATEGORIES.slice(0, PREVIEW_LEADER_CATEGORIES)}
        onSeeAll={() => go('numbers')}
        showTeamAbbr={false}
        injuredIds={injuredIds}
        horizontal
      />

      {/* Latest moves — the three most recent transaction stories, paging off
          (see TeamTransactionsCard's `limit`). */}
      {transactionsPage.days.length > 0 && (
        <>
          <TeamTransactionsCard
            key={`${team.id}-${asOf ?? ''}`}
            teamId={team.id}
            asOf={asOf}
            initialDays={transactionsPage.days}
            initialCursor={transactionsPage.cursor}
            initialHasMore={transactionsPage.hasMore}
            limit={PREVIEW_TRANSACTIONS}
          />
          <PreviewDoor label="All transactions" onClick={() => go('games')} />
        </>
      )}
    </TeamHubShell>
  )
}
