import { fetchTeam } from '../api/team.js'
import { loadLeaderPool, LEADER_SCOPES, scopeMeta, isMilbScope, isMultiLevelScope } from '../api/leaders.js'
import { fetchMinorsLeaders } from '../api/minorsLeaders.js'
import { fetchTopProspects } from '../api/prospects.js'
import { ALL_CATEGORIES } from '../api/teamLeaders.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { LinkScope } from '../lib/nav.jsx'
import { leadersPath } from '../lib/route.js'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLeaders } from '../components/TeamLeaders.jsx'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// The league / level / org leaderboards, reusing the same TeamLeaders component
// + descriptors as the team page — only the POOL changes (see api/leaders.js).
// Spoiler-free: season aggregates, no seals (same stance as TeamLeadersPage).
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
// (`.levelnav`). Each button deep-links to its scope, carrying the spoiler
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
          onClick={() => navigate(leadersPath(s.key, { d: asOf, s: sportId }))}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

export function LeadersPage({ scope = 'mlb', orgId, asOf, sportId }) {
  const navigate = useNav()
  const { loading, error, data } = useAsync(
    () => loadLeaders(scope, orgId, asOf),
    [scope, orgId, asOf],
  )

  const org = data?.org
  const title = org ? `${org.name} · Organization leaders` : scopeMeta(scope)?.title ?? 'Leaders'
  useDocumentTitle(data ? title : null)

  const back = () => window.history.back()
  const gate = AsyncGate({ loading, error, data, screenClass: 'screen', noun: 'leaders', onBack: back })
  if (gate) return gate

  const { pool, snapshot, precomputed } = data
  const isOrg = scope === 'org'
  const hasLeaders = precomputed ? Object.keys(precomputed).length > 0 : pool.length > 0

  return (
    <LinkScope asOf={asOf} sportId={sportId ?? null}>
      <div className="screen">
        <SiteHeader />
        <BackBtn onClick={back} />

        <header className="topbar leaders__head">
          {isOrg && org && (
            <div className="leaders__org">
              <TeamLogo teamId={org.id} name={org.name} size={40} />
              <div>
                <h1 className="topbar__title">{org.name}</h1>
                <p className="leaders__sub">Organization leaders · all levels</p>
              </div>
            </div>
          )}
          {!isOrg && <h1 className="topbar__title">{title}</h1>}
        </header>

        <ScopeNav scope={scope} asOf={asOf} sportId={sportId} navigate={navigate} />

        {!hasLeaders ? (
          <p className="hint hint--prose">
            No leaders to show here yet — season stats aren’t posted for this scope.
          </p>
        ) : (
          <TeamLeaders
            pool={pool}
            precomputed={precomputed}
            categories={ALL_CATEGORIES}
            limit={10}
            title="Leaders"
            showTeamLogo
            showLevel={isMultiLevelScope(scope)}
            prospectSnapshot={snapshot}
            qualifier="leader-relative"
          />
        )}
      </div>
    </LinkScope>
  )
}
