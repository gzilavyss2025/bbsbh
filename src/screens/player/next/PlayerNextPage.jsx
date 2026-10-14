import { useEffect, useState } from 'react'
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
import { OverviewExtras } from './top/OverviewExtras.jsx'
import { jumpSections, rolesOf, seedEmpty, shownSections, slotInstances } from './sections.js'
import '../../../styles/player-next/page.css'

// The player page (#1884, docs/player-redesign.md), at /player/{id} since the swap
// (#1898): hero, fact strip, stat tiles, jump bar, and one slot per module. An open
// surface (ADR-0034): nothing here is sealed or gated. Both loaders mount together,
// because they share playerContext only while in flight.
// `tab` is an old tab address ('/player/{id}/stats'): the page scrolls to that tab's
// section once, when it has loaded, so an old link lands where it pointed.
const TAB_SECTION = { stats: 'season', history: 'history' }
const tabSection = (tab, roles) =>
  tab === 'analytics' ? (roles.includes('hitting') ? 'plate-approach' : 'pitches') : TAB_SECTION[tab]

function PlayerNextBody({ id, asOf, sportId, tab }) {
  const core = useAsync(() => loadPlayerCore(id, asOf), [id, asOf])
  const overview = useAsync(() => loadPlayerOverview(id, asOf), [id, asOf])
  useDocumentTitle(core.data?.bio.fullName || null)
  useEffect(() => {
    if (!tab || !core.data || !overview.data) return
    const el = document.getElementById(tabSection(tab, rolesOf(core.data.bio, overview.data.blocks)))
    // The landing is done once: the address becomes the bare page (keeping ?d= and ?s=),
    // so Back or a reload does not scroll the reader away from where they were.
    window.history.replaceState(window.history.state, '', window.location.pathname.replace(/\/(stats|analytics|history)(\/[^/]*)?\/?$/, '') + window.location.search)
    if (!el) return
    if (typeof ResizeObserver === 'undefined') return el.scrollIntoView()
    // The observer fires once on observe(), which is the first scroll. Slots above the
    // section load as they come near and grow, which pushes it down: hold it at the top
    // until the reader moves, or until its own module empties it off the page.
    // ponytail: a fixed 4 s hold; a slot that loads later than that can still push it.
    const hold = new ResizeObserver(() => (el.isConnected ? el.scrollIntoView() : stop()))
    hold.observe(el.parentElement)
    const MOVES = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    const stop = () => {
      hold.disconnect()
      for (const e of MOVES) window.removeEventListener(e, stop)
    }
    for (const e of MOVES) window.addEventListener(e, stop, { passive: true })
    const timer = setTimeout(stop, 4000)
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [tab, core.data, overview.data])
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
  // What the loaded data shows empty, then what the modules have reported.
  const gone = { ...seedEmpty(instances, blocks), ...empty }
  const sections = shownSections(jumpSections(core.data.bio, blocks), instances, gone)
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
            <OverviewExtras blocks={blocks} />
          </Stack>
          <HubTabBar variant="anchor" tabs={sections} ariaLabel="Page sections" />
          {sections
            .filter((s) => s.key !== 'overview')
            .map((s) => (
              <Stack key={s.key} as="section" gap="section" id={s.key} className="pnext__section">
                {instances
                  .filter((i) => i.section === s.key && !gone[i.key])
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

// Keyed on the player and the cutoff, so a slot's reported-empty state never carries over
// to the next player (App.jsx renders this with no key of its own).
export function PlayerNextPage(props) {
  return <PlayerNextBody key={`${props.id}:${props.asOf ?? ''}`} {...props} />
}
