import { useState } from 'react'
import { loadPlayerCore } from '../../../api/player/core.js'
import { loadPlayerOverview } from '../../../api/player/overview.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle.js'
import { LinkScope } from '../../../lib/nav.jsx'
import { AsyncGate } from '../../../components/ui/AsyncGate.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import { SiteHeader } from '../../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../../components/chrome/BackBtn.jsx'
import { HubTabBar } from '../../../components/chrome/HubTabBar.jsx'
import { AsOfBanner } from '../../../components/seal/AsOfBanner.jsx'
import { PlayerNextHero } from './PlayerNextHero.jsx'
import { PlayerNextTiles } from './PlayerNextTiles.jsx'
import { Slot } from './Slot.jsx'
import { jumpSections, rolesOf, shownSections, slotInstances } from './sections.js'
import '../../../styles/player-next/page.css'

// The new player page (#1884, docs/player-redesign.md), at /player/{id}?look=new
// beside the live page: hero, fact strip, stat tiles, jump bar, and one empty
// slot per section for the module issues to fill. An open surface (ADR-0034):
// nothing here is sealed or gated. Both loaders mount together, as PlayerPage
// does, because they share playerContext only while in flight.
export function PlayerNextPage({ id, asOf, sportId }) {
  const core = useAsync(() => loadPlayerCore(id, asOf), [id, asOf])
  const overview = useAsync(() => loadPlayerOverview(id, asOf), [id, asOf])
  useDocumentTitle(core.data?.bio.fullName || null)
  // Instance key -> true once that slot's module has said it has no data.
  const [empty, setEmpty] = useState({})
  const back = () => window.history.back()
  const gate = AsyncGate({
    loading: core.loading || overview.loading,
    error: core.error || overview.error,
    data: core.data && overview.data ? true : null,
    screenClass: 'playernext',
    noun: 'player',
    onBack: back,
  })
  if (gate) return gate

  const { blocks } = overview.data
  const instances = slotInstances(rolesOf(core.data.bio, blocks))
  const sections = shownSections(jumpSections(core.data.bio, blocks), instances, empty)
  const markEmpty = (key) => setEmpty((e) => (e[key] ? e : { ...e, [key]: true }))
  const rows = blocks.filter((b) => b.tiles.length)
  return (
    <LinkScope asOf={asOf} sportId={core.data.sportId ?? sportId ?? null}>
      <div className="screen playernext">
        <SiteHeader />
        <BackBtn onClick={back} />
        <Stack gap="section" className="pnext__page">
          <Stack gap="section" id="overview">
            <PlayerNextHero core={core.data} />
            {rows.map((b) => (
              <PlayerNextTiles
                key={b.group}
                block={b}
                playerId={core.data.bio.id}
                season={core.data.season}
                label={blocks.length > 1 ? b.title : undefined}
              />
            ))}
          </Stack>
          <HubTabBar variant="anchor" tabs={sections} ariaLabel="Page sections" />
          {sections
            .filter((s) => s.key !== 'overview')
            .map((s) => (
              <Stack key={s.key} as="section" gap="section" id={s.key} className="pnext__section">
                {instances
                  .filter((i) => i.section === s.key && !empty[i.key])
                  .map((i) => (
                    <Slot key={i.key} inst={i} bio={core.data.bio} asOf={asOf} season={core.data.season} onEmpty={markEmpty} />
                  ))}
              </Stack>
            ))}
        </Stack>
        <AsOfBanner asOf={asOf} sportId={sportId} />
      </div>
    </LinkScope>
  )
}
