import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { teamTabPath } from '../lib/route.js'
import { isMlbTeamId } from '../lib/teams.js'
import { AsyncGate } from '../components/ui/AsyncGate.jsx'
import { TeamLeadersLedger } from '../components/teamstats/TeamLeadersLedger.jsx'
import { MilbAlumni } from '../components/teamstats/MilbAlumni.jsx'
import { TeamScoreCard } from '../components/teamstats/TeamScoreCard.jsx'
import { TeamTransactionsCard } from '../components/transactions/TeamTransactionsCard.jsx'
import { ChevronLink } from '../components/ui/ChevronLink.jsx'
import { LEDGER_HITTING, LEDGER_PITCHING } from '../api/teamLeaders.js'
import { TeamHubShell } from './team/TeamHubShell.jsx'
import { loadOverview } from './team/data/loadOverview.js'
import { hiddenTeamTabs } from './team/data/shared.js'
import { StandingsCard } from './team/modules/StandingsCard.jsx'
import { LastTenGames } from './team/modules/TeamGames.jsx'
import { TeamHighlightsRail } from './team/modules/media/TeamHighlightsRail.jsx'
import { TeamPhotosRail } from './team/modules/media/TeamPhotosRail.jsx'
import { RosterProjection } from './team/modules/RosterProjection.jsx'
import { BallparkCard } from './team/modules/ballpark/BallparkCard.jsx'

// How many rows each preview shows. A preview is a DOOR, not a smaller
// duplicate — every one of these ends in a link to the tab that holds the whole
// thing, and none of them is the last word on anything.
// Leaders counts per SIDE, not in total — three batting and three pitching.
const PREVIEW_LEADER_CATEGORIES = 3
const PREVIEW_TRANSACTIONS = 3
// Lighter than the Games tab's own rails on purpose — loadOverview.js's own
// header explains why the front door can't pay for either module in full.
const PREVIEW_HIGHLIGHTS = 6
const PREVIEW_PHOTOS = 6

// The door itself: one text link under a preview, built from the same shared
// ChevronLink TeamLeadersLedger's own built-in door uses (reused as-is below
// rather than doubled up). It is a link, not a card — the tab bar, the shelf row and
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
    photoGames,
    lineupDefense,
    previewStartingPitchers,
    previewCloser,
    leaderPool,
    injuredIds,
    transactionsPage,
    milbAlumni,
    attendance,
  } = data

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="overview"
      hiddenTabs={hiddenTeamTabs(team)}
    >
      {/* Standing — the whole division; divisions are small enough that a
          preview window isn't worth the door. The Postseason Odds pill still
          opens the whole division's snapshot: that modal is the Overview's,
          not the Numbers tab's. */}
      {standings.length > 0 && (
        <StandingsCard
          team={team}
          standings={standings}
          asOf={asOf}
          divisionPostseasonOdds={divisionPostseasonOdds}
        />
      )}

      {/* Ballpark — the diagram alongside its built/roof/capacity + ranked
          dimensions, in full (same content the lineup page's BallparkModal
          shows). No door to another tab: this IS the full detail view. The
          diagram/dimensions half is MLB only (nobody has hand-verified a
          MiLB park's outfield); a MiLB park still gets the photo/name/logo
          half and the owner's gear, minus that section. Renders nothing at
          all when the feed carries no venue name. */}
      <BallparkCard team={team} attendance={attendance} />

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

      {/* Last 10 — the true last ten, newest last. Every game before them is
          the Games tab's grid, and is the only thing this preview holds back.
          Highlights and Photos ride along under it, same "recent games"
          subject and same door out — both capped lighter than the Games
          tab's own rails (see loadOverview.js's header). Photos carries its
          own "Full season" door inside its card head (same reasoning as the
          Leaders preview's built-in "See all"), so only one shared door
          closes this whole group. */}
      {recentGames.length > 0 && (
        <>
          <LastTenGames teamId={team.id} asOf={asOf} recentGames={recentGames} />
          {seasonGames.length > 0 && isMlbTeamId(team.id) && (
            <TeamHighlightsRail
              key={`highlights-${team.id}`}
              teamId={team.id}
              games={seasonGames}
              limit={PREVIEW_HIGHLIGHTS}
            />
          )}
          {photoGames.length > 0 && (
            // `photoGames`, not `seasonGames` — this rail may include a game
            // still in progress (an explicit override; see loadOverview.js).
            <TeamPhotosRail
              key={`photos-${team.id}-${asOf ?? ''}`}
              teamId={team.id}
              games={photoGames}
              limit={PREVIEW_PHOTOS}
            />
          )}
          <PreviewDoor label="Season schedule" onClick={() => go('games')} />
        </>
      )}

      {/* Lineup — the preferred-lineup diamond plus a taste of the pitching
          staff (top 5 Starting Pitchers, the closer). The bench, the full
          Bullpen, the 40-man and the injured list are the Roster tab's. */}
      {lineupDefense.length > 0 && (
        <>
          <RosterProjection
            rosterLineup={lineupDefense}
            previewStartingPitchers={previewStartingPitchers}
            previewCloser={previewCloser}
            injuredIds={injuredIds}
            isMilb={isMilb}
            preview
          />
          <PreviewDoor label="Full roster" onClick={() => go('roster')} />
        </>
      )}

      {/* Leaders — three categories a side, hitting and pitching both. A PREFIX
          of each ledger list rather than the head of one mixed list, which is
          what made this door three hitters and no pitchers. Its own "See all ›"
          is the door (to Numbers, which carries all six a side and its own link
          on to /team/{id}/leaders), so this preview needs no PreviewDoor. */}
      <TeamLeadersLedger
        pool={leaderPool}
        hitting={LEDGER_HITTING.slice(0, PREVIEW_LEADER_CATEGORIES)}
        pitching={LEDGER_PITCHING.slice(0, PREVIEW_LEADER_CATEGORIES)}
        onSeeAll={() => go('numbers')}
        injuredIds={injuredIds}
      />

      {/* Latest moves — the three most recent transaction stories, paging off
          (see TeamTransactionsCard's `limit`). The door goes to the club's own
          roster-move ledger rather than the Games tab: the deck IS on that tab,
          but as its last section, under four others. */}
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
          <PreviewDoor label="All transactions" onClick={() => go('transactions')} />
        </>
      )}

      {/* Made The Show — a farm club's big-league alumni, career-WAR ranked.
          The one card here that is NOT a preview of a tab: nothing else in the
          app holds this, so there is no door to put under it. MiLB only, and
          last on purpose — it is the club's history, under everything about its
          season. */}
      <MilbAlumni players={milbAlumni?.players} minGames={milbAlumni?.minGames} />
    </TeamHubShell>
  )
}
