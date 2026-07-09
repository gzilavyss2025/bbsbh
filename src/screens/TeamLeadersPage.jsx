import { fetchTeam } from '../api/team.js'
import { ALL_CATEGORIES } from '../api/teamLeaders.js'
import { loadCombinedPoolForTeams } from '../api/statsLevels.js'
import { SPORT_LABEL } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { LinkScope } from '../lib/nav.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLeaders } from '../components/TeamLeaders.jsx'

const DASH = '—'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// The full per-category leaderboard for a team, on its own page (the team page
// shows only a featured cross-section and links here via "See all ›"). Reuses
// the same TeamLeaders component + descriptors, just with the full ALL_CATEGORIES
// list and a deeper per-category limit. The pool comes from the club's season
// stats (roster-independent), not its current roster, so a player traded away,
// released, or promoted off the club still ranks — scoped to only the stats he
// accumulated while there (see loadCombinedPoolForTeams).
async function loadTeamLeaders(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const season = Number((asOf || isoToday()).slice(0, 4))
  return {
    team,
    sportId: team.sport?.id ?? 1,
    pool: await loadCombinedPoolForTeams([{ id }], season),
  }
}

export function TeamLeadersPage({ id, asOf, sportId }) {
  const teamId = Number(id)
  const { loading, error, data } = useAsync(() => loadTeamLeaders(teamId, asOf), [teamId, asOf])
  useDocumentTitle(data?.team ? `${data.team.name} · Team Leaders` : null)
  const back = () => window.history.back()

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  const { team } = data
  const isMilb = (team.sport?.id ?? 1) !== 1

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen team-hub">
        <SiteHeader />
        <BackBtn onClick={back} />

        <header className="team-hub__id">
          <div className="team-hub__logo">
            <TeamLogo teamId={team.id} name={team.name} size={64} />
          </div>
          <div>
            <div className="team-hub__namerow">
              <h1>{team.name}</h1>
              {isMilb && (
                <span className="team-hub__level">{SPORT_LABEL[team.sport?.id] ?? DASH}</span>
              )}
            </div>
            <p className="team-hub__rec">
              <span className="team-hub__div">Team leaders</span>
            </p>
          </div>
        </header>

        <TeamLeaders pool={data.pool} categories={ALL_CATEGORIES} limit={10} />
      </div>
    </LinkScope>
  )
}
