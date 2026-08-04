import { useRef } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/AsyncGate.jsx'
import { JerseyCombos, MilbUniformStrip } from '../../components/JerseyCombos.jsx'
import { CareerTimeline } from '../../components/CareerTimeline.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { TeamShelf } from './TeamShelf.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadOrg } from './data/loadOrg.js'
import { AffiliatesCard } from './modules/AffiliatesCard.jsx'
import { ProspectsCard } from './modules/ProspectsCard.jsx'

function scrollTo(ref) {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The tile the index grid opens with — a label plus one headline figure,
// scrolling to its own section below rather than navigating anywhere. See
// OrgTab: this is the one tab that opens with a browse-by-tile grid instead
// of a reading order, because affiliates/prospects/jerseys/history genuinely
// are that kind of list (PRD "shape we're building").
function OrgIndexTile({ label, count, onClick }) {
  return (
    <button type="button" className="orgindex__tile" onClick={onClick}>
      <span className="orgindex__count mono">{count}</span>
      <span className="orgindex__label">{label}</span>
    </button>
  )
}

// The Org tab: affiliates, org-wide prospects, jersey combos and (MiLB only)
// affiliation history, behind an index grid. loadTeamIdentity supplies the
// shared header (team/record/manager, same three cheap requests every tab
// pays); loadOrg.js supplies everything below it.
export function OrgTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  const org = useAsync(() => loadOrg(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const affiliatesRef = useRef(null)
  const prospectsRef = useRef(null)
  const jerseysRef = useRef(null)
  const historyRef = useRef(null)

  const loading = identity.loading || org.loading
  const error = identity.error || org.error
  const data = identity.data && org.data ? identity.data : null

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  const { isMilb, affiliateCards, prospects, jerseyCombos, affiliationHistory } = org.data

  // The MiLB jersey strip (MilbUniformStrip) is a fixed Home/Away pair with no
  // uniform feed behind it (see JerseyCombos.jsx) — always 2, not data-driven.
  const jerseyCount = isMilb ? 2 : jerseyCombos.length
  const showAffiliates = affiliateCards.length > 0
  const showProspects = prospects.length > 0
  const showJerseys = isMilb || jerseyCombos.length > 0
  const showHistory = isMilb && affiliationHistory.length > 0

  return (
    <TeamHubShell
      team={data.team}
      record={data.record}
      manager={data.manager}
      asOf={asOf}
      sportId={sportId}
      active="org"
    >
      <div className="orgindex">
        {showAffiliates && (
          <OrgIndexTile label="Affiliates" count={affiliateCards.length} onClick={() => scrollTo(affiliatesRef)} />
        )}
        {showProspects && (
          <OrgIndexTile label="Prospects" count={prospects.length} onClick={() => scrollTo(prospectsRef)} />
        )}
        {showJerseys && (
          <OrgIndexTile label="Jerseys" count={jerseyCount} onClick={() => scrollTo(jerseysRef)} />
        )}
        {showHistory && (
          <OrgIndexTile label="History" count={affiliationHistory.length} onClick={() => scrollTo(historyRef)} />
        )}
      </div>

      {showAffiliates && (
        <div ref={affiliatesRef}>
          <AffiliatesCard affiliates={affiliateCards} />
        </div>
      )}

      {showProspects && (
        <div ref={prospectsRef}>
          {/* showAllProspects locked true: the tab has room for the whole org
              list, so this drops ProspectsCard's ten-row preview cap and its
              "Show all" button (which only renders when showAllProspects is
              false) without editing the shared module. */}
          <ProspectsCard prospects={prospects} showAllProspects onShowAll={() => {}} />
        </div>
      )}

      {showJerseys && (
        <div ref={jerseysRef}>
          <TeamShelf teamId={teamId} title="Jerseys" summary={jerseyCount}>
            {() =>
              isMilb ? (
                <MilbUniformStrip teamId={data.team.id} teamName={data.team.name} />
              ) : (
                <JerseyCombos combos={jerseyCombos} teamId={data.team.id} teamName={data.team.name} />
              )
            }
          </TeamShelf>
        </div>
      )}

      {showHistory && (
        <div ref={historyRef}>
          <TeamShelf teamId={teamId} title="Affiliation history" summary={affiliationHistory.length}>
            {() => <CareerTimeline entries={affiliationHistory} title="Affiliation history" />}
          </TeamShelf>
        </div>
      )}
    </TeamHubShell>
  )
}
