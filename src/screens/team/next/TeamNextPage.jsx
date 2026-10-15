import { useCallback, useEffect, useState } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { holdSectionInView } from '../../../hooks/scroll/holdSectionInView.js'
import { TEAM_TAB_BAND } from '../../../lib/route.js'
import { AsyncGate } from '../../../components/ui/AsyncGate.jsx'
import { HubTabBar } from '../../../components/chrome/HubTabBar.jsx'
import { TeamHubShell } from '../TeamHubShell.jsx'
import { loadTeamIdentity } from '../loadTeamIdentity.js'
import { hiddenTeamSections } from '../data/shared.js'
import { Band } from './Band.jsx'
import { BANDS } from './bands.js'
import { forgetLoads, SHARED } from './once.js'
import '../../../styles/team-next/page.css'

// The one-scroll team page (ADR-0082, #1107, row 3), hidden at /team/{id}/next until the
// swap: TeamHubShell, a jump bar, and seven band slots. Each band mounts its module only
// when it comes near, so the first screen costs the first band. A band the club cannot
// fill is absent, with no button (hiddenTeamSections). Open surface (ADR-0034): the shell
// wraps everything in LinkScope, which keeps ?d= and ?s= on every door out.
// `tab` is an old tab address ('/team/{id}/next/roster'): the page lands on that tab's band
// once, then the address becomes the bare page, keeping ?d= and ?s=.
// The sticky jump bar's height (68px measured), so a tap lands a band under it.
// Keep in step with `.tnext__band` scroll-margin-top in team-next/page.css.
const BAR_H = 68

export function TeamNextPage({ id, asOf, sportId, tab }) {
  const teamId = Number(id)
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf, SHARED), [teamId, asOf])
  // Band key -> the jump bar's badge, reported by the band once its data is in.
  const [counts, setCounts] = useState({})
  const onCount = useCallback((key, n) => setCounts((c) => (c[key] === n ? c : { ...c, [key]: n })), [])
  useEffect(() => forgetLoads, [])
  const loaded = Boolean(identity.data)
  useEffect(() => {
    if (!tab || !loaded) return undefined
    const key = TEAM_TAB_BAND[tab]
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname.replace(new RegExp(`/${tab}/?$`), '') + window.location.search + `#${key}`,
    )
    const el = document.getElementById(key)
    return el ? holdSectionInView(el) : undefined
  }, [tab, loaded])
  const gate = AsyncGate({
    loading: identity.loading,
    error: identity.error,
    data: identity.data,
    screenClass: 'team-hub',
    noun: 'team',
    onBack: () => window.history.back(),
  })
  if (gate) return gate

  const { team, record, manager } = identity.data
  const hidden = hiddenTeamSections(team)
  const bands = BANDS.filter((b) => !hidden.has(b.key))
  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="next"
      bar={
        <HubTabBar
          variant="anchor"
          tabs={bands.map((b) => ({ key: b.key, label: b.label, count: counts[b.key] }))}
          ariaLabel="Team sections"
          className="tnext__jump"
          offset={BAR_H}
          hold
        />
      }
    >
      {bands.map((b) => (
        <Band key={b.key} band={b} team={team} asOf={asOf} sportId={sportId} onCount={onCount} />
      ))}
    </TeamHubShell>
  )
}
