import { useEffect, useState } from 'react'
import { fetchTeam } from '../api/team.js'
import { loadLeaderPool, LEADER_SCOPES, scopeMeta, isMilbScope, isMultiLevelScope } from '../api/leaders.js'
import { fetchMinorsLeaders } from '../api/minorsLeaders.js'
import { fetchTopProspects } from '../api/prospects.js'
import { ALL_CATEGORIES } from '../api/teamLeaders.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useNav, useRouteLink } from '../lib/nav.js'
import { LinkScope } from '../lib/nav.jsx'
import { leadersPath, outliersPath } from '../lib/route.js'
import { armBoardIn, disarmBoardIn } from '../lib/motion/boardIn.js'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsOfBanner } from '../components/seal/AsOfBanner.jsx'
import { BackBtn } from '../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../components/ui/AsyncGate.jsx'
import { EmptyState } from '../components/ui/state/EmptyState.jsx'
import { TeamLeaders } from '../components/teamstats/TeamLeaders.jsx'
import { Door } from '../components/ui/control/Door.jsx'
import { TeamFilterStrip } from '../components/team/TeamFilterStrip.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { isoToday } from '../lib/dates.js'

// The league / level / org leaderboards, reusing the same TeamLeaders component
// + descriptors as the team page — only the POOL changes (see api/leaders.js).
// Season aggregates, no seals (same stance as TeamLeadersPage).
//
// For a MiLB scope the prospect snapshot is loaded so each ranked farmhand gets
// his prospect pill; for the org scope the club identity is loaded for the
// header and each row is level-badged (a multi-level pool). The larger pools
// pass qualifier='leader-relative' so a small-sample rate line can't top a list.
async function loadLeaders(scope, orgId, asOf) {
  const season = Number((asOf || isoToday()).slice(0, 4))
  // The all-minors board is served pre-ranked from a static file (too heavy to
  // rank live — see api/minorsLeaders.js); every other scope ranks a live pool.
  if (scope === 'minors') {
    const [{ leaders }, snapshot] = await Promise.all([fetchMinorsLeaders(), fetchTopProspects()])
    return { precomputed: leaders, snapshot, org: null }
  }
  const [pool, snapshot, org] = await Promise.all([
    loadLeaderPool(scope, orgId, season),
    isMilbScope(scope) ? fetchTopProspects() : Promise.resolve(null),
    scope === 'org' ? fetchTeam(orgId) : Promise.resolve(null),
  ])
  // Org scope needs a resolvable club; everything else is a fixed scope.
  if (scope === 'org' && !org) return null
  return { pool, snapshot, org }
}

// The MLB/AL/NL/AAA/AA/A+/A switcher — reuses the slate level-toggle look
// (`.levelnav`). Each button deep-links to its scope, carrying the as-of
// cutoff. On the org scope none is active (it isn't one of these fixed scopes),
// but the switcher still lets the user jump back out to a league/level.
function ScopeNav({ scope, asOf, sportId, navigate }) {
  return (
    <div className="levelnav leaders__scope" aria-label="Leaders scope">
      {LEADER_SCOPES.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={scope === s.key}
          className={`levelnav__btn ${scope === s.key ? 'is-active' : ''}`}
          onClick={() => {
            // A tap to ANOTHER scope fades the new board in (motion/board-in.css); the same
            // scope again remounts nothing, so it must not leave the flag armed.
            if (scope !== s.key) armBoardIn()
            navigate(leadersPath(s.key, { d: asOf, s: sportId }))
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

export function LeadersPage({ scope = 'mlb', orgId, asOf, sportId }) {
  const navigate = useNav()
  const routeLink = useRouteLink()
  const { favoriteTeamId } = useFavoriteTeam()
  const [filterTeamId, setFilterTeamId] = useState(null)
  const { loading, error, data } = useAsync(
    () => loadLeaders(scope, orgId, asOf),
    [scope, orgId, asOf],
  )

  // A scope tap armed the board's fade-in; once the load settles with no board to spend it
  // (an error, an empty scope), disarm it so a board on another page does not play it.
  useEffect(() => {
    const board = data && (data.precomputed ? Object.keys(data.precomputed).length : data.pool.length)
    if (!loading && !board) disarmBoardIn()
  }, [loading, data])

  const org = data?.org
  const title = org ? `${org.name} · Organization leaders` : scopeMeta(scope)?.title ?? 'Leaders'
  useDocumentTitle(data ? title : null)

  const back = () => window.history.back()
  const gate = AsyncGate({ loading, error, data, screenClass: 'screen', noun: 'leaders', onBack: back })
  if (gate) return gate

  const { pool, snapshot, precomputed } = data
  const isOrg = scope === 'org'
  const hasLeaders = precomputed ? Object.keys(precomputed).length > 0 : pool.length > 0
  // The team filter picks one club to highlight across the whole board,
  // overriding the ordinary favorite-team highlight while active — same
  // "MLB" default + supersede convention as the All-Star Rosters page's
  // TeamFilterStrip. Not offered on the org scope: every row already plays
  // for the one club the page is about, so there's no "stranger" to filter
  // out from.
  const effectiveTeamId = isOrg ? null : filterTeamId ?? favoriteTeamId
  const filtering = !isOrg && filterTeamId != null

  return (
    <LinkScope asOf={asOf} sportId={sportId ?? null}>
      <div className="screen">
        <SiteHeader />
        <AsOfBanner asOf={asOf} sportId={sportId} />
        <BackBtn onClick={back} />

        <header className="topbar leaders__head">
          {isOrg && org && (
            <div className="leaders__org">
              <TeamLogo teamId={org.id} name={org.name} size={40} />
              <div>
                <h1 className="topbar__title">{org.name}</h1>
                <p className="leaders__note">Organization leaders · all levels</p>
              </div>
            </div>
          )}
          {!isOrg && <h1 className="topbar__title">{title}</h1>}
        </header>

        <ScopeNav scope={scope} asOf={asOf} sportId={sportId} navigate={navigate} />
        {scope === 'mlb' && (
          <Door {...routeLink(outliersPath({ d: asOf }))}>Who is standing out, hot and cold</Door>
        )}

        {!isOrg && (
          <TeamFilterStrip
            selectedTeamId={filterTeamId}
            onSelect={setFilterTeamId}
            ariaLabel="Highlight a team's leaders"
          />
        )}

        {!hasLeaders ? (
          <EmptyState>
            No leaders to show here yet — season stats aren’t posted for this scope.
          </EmptyState>
        ) : (
          <TeamLeaders
            pool={pool}
            precomputed={precomputed}
            categories={ALL_CATEGORIES}
            limit={10}
            title="Leaders"
            showLevel={isMultiLevelScope(scope)}
            prospectSnapshot={snapshot}
            qualifier="leader-relative"
            favoriteTeamId={effectiveTeamId}
            filtering={filtering}
          />
        )}

        <ReportFooter />
      </div>
    </LinkScope>
  )
}
