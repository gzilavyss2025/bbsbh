import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/chrome/AsyncGate.jsx'
import { CareerTimeline } from '../../components/CareerTimeline.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadMinors } from './data/loadMinors.js'
import { hiddenTeamTabs } from './data/shared.js'
import { AffiliatesCard } from './modules/AffiliatesCard.jsx'
import { ProspectsCard } from './modules/ProspectsCard.jsx'

// The Minors tab (formerly "Org"): affiliation history (MiLB only, leads the
// tab), then affiliates and org-wide prospects — a plain reading order, no
// index grid (that pattern's gone now that every section renders in full
// rather than behind a jump-tile). loadTeamIdentity supplies the shared
// header (team/record/manager, same three cheap requests every tab pays);
// loadMinors.js supplies everything below it. Jersey combos live on the
// Numbers tab, below Team Leaders — see loadNumbers.js.
export function MinorsTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  const minors = useAsync(() => loadMinors(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const loading = identity.loading || minors.loading
  const error = identity.error || minors.error
  const data = identity.data && minors.data ? identity.data : null

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  const { isMilb, affiliateCards, prospects, affiliationHistory } = minors.data

  const showAffiliates = affiliateCards.length > 0
  const showProspects = prospects.length > 0
  const showHistory = isMilb && affiliationHistory.length > 0

  return (
    <TeamHubShell
      team={data.team}
      record={data.record}
      manager={data.manager}
      asOf={asOf}
      sportId={sportId}
      active="minors"
      hiddenTabs={hiddenTeamTabs(data.team)}
    >
      {showHistory && <CareerTimeline entries={affiliationHistory} title="Affiliation history" />}

      {showAffiliates && <AffiliatesCard affiliates={affiliateCards} />}

      {showProspects && (
        // showAllProspects locked true: the tab has room for the whole org
        // list, so this drops ProspectsCard's ten-row preview cap and its
        // "Show all" button (which only renders when showAllProspects is
        // false) without editing the shared module.
        <ProspectsCard prospects={prospects} showAllProspects onShowAll={() => {}} />
      )}
    </TeamHubShell>
  )
}
