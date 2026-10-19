import { useEffect, useMemo, useRef, useState } from 'react'
import { loadCareerMatchups, starterMatchupsFor } from '../../api/careerMatchups.js'
import { loadNineKeys } from '../../api/nineKeys.js'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { nineKeysTeams } from '../../lib/postseason/keysVerdict.js'
import { matchupEdges } from '../../lib/postseason/primer/matchupEdges.js'
import { scoutingModel } from '../../lib/postseason/worldseries/scouting.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { HubTabBar } from '../chrome/HubTabBar.jsx'
import { MatchupEdges } from '../postseason/edges/MatchupEdges.jsx'
import { UmpireEdge } from '../postseason/edges/UmpireEdge.jsx'
import { SeriesNineKeys } from '../postseason/SeriesNineKeys.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Grid } from '../ui/layout/Grid.jsx'
import { Stack } from '../ui/layout/Stack.jsx'

// THE SCOUTING REPORT (#2316, slice 1): a navy band head, a sticky jump bar, and the
// cards that have data for this day type. The list and its order are
// lib/postseason/worldseries/scouting.js; this file only loads each card's data and
// draws it. A card with no data is not drawn, and its button is not either. Every
// read is an open surface (ADR-0034); nothing here reads today's game.
//
//   clubIds       the two Series clubs
//   slateDate     YYYY-MM-DD
//   dayType       'off' | 'game' (mode.js)
//   gamePk        the game the edges read: the home's focus game (today's on a game day,
//                 the next one on an off day), the same one the umpire is read for
//   plateUmpire   { id, name } from fetchPlateUmpires, or null (game day)
// Adding a card: one entry in scouting.js, one here.
const CARD = {
  'nine-keys': ({ nineKeys, clubIds, season }) => <SeriesNineKeys data={nineKeys} clubs={clubIds.map((id) => ({ id }))} season={season} />,
  'matchup-edges': ({ edges }) => <MatchupEdges edges={edges} variant="faceoff" />,
  'umpire-edge': ({ plateUmpire, umpire }) => <UmpireEdge name={plateUmpire.name} lean={umpire?.lean ?? null} />,
}

export function ScoutingReport({ clubIds, slateDate, dayType, gamePk, plateUmpire = null }) {
  const season = Number(slateDate.slice(0, 4))
  const { data: nineKeys } = useAsync(() => loadNineKeys(), [])
  const { data: career } = useAsync(() => loadCareerMatchups(), [])
  const { data: umpire } = useAsync(
    () => (plateUmpire?.id ? loadUmpire(plateUmpire.id, { seasonYear: season }).catch(() => null) : null),
    [plateUmpire?.id, season],
  )
  const [clubA, clubB] = clubIds
  const edges = useMemo(
    () => matchupEdges([clubA, clubB].map((id) => starterMatchupsFor(career, gamePk, id))),
    [career, gamePk, clubA, clubB],
  )
  const hasNineKeys = Boolean(nineKeysTeams(nineKeys, clubIds.map((id) => ({ id })), season))
  const cards = scoutingModel({ dayType, nineKeys: hasNineKeys, edges, plateUmpire })
  // The sticky chrome over a card: the slate's own bar (the probe reads --slate-bar-h) plus this
  // jump bar. One measured number feeds the bar's scroll offset and each card's scroll-margin.
  const rootRef = useRef(null)
  const [offset, setOffset] = useState(0)
  const shown = cards.length > 0
  useEffect(() => {
    const root = rootRef.current
    if (!shown || !root || typeof ResizeObserver === 'undefined') return undefined
    const probe = root.querySelector('.ww-scout__probe')
    const bar = root.querySelector('.jumpbar')
    const read = () => setOffset(probe.offsetHeight + bar.offsetHeight)
    const ro = new ResizeObserver(read)
    ro.observe(probe)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [shown])
  if (!shown) return null
  const ctx = { nineKeys, clubIds, season, edges, plateUmpire, umpire }
  const names = clubIds.map((id) => teamClubNameShort(id)).filter(Boolean).join(' and ')
  return (
    <Stack gap="loose" className="ww-scout" ref={rootRef} style={{ '--ww-scout-offset': `${offset}px` }}>
      <span className="ww-scout__probe" aria-hidden="true" />
      <SectionHead look="band" house as="h2" note={names}>
        Scouting report
      </SectionHead>
      <HubTabBar
        variant="anchor"
        tabs={cards.map((c) => ({ key: `ww-scout-${c.id}`, label: c.label }))}
        ariaLabel="Scouting report cards"
        className="ww-scout__jump"
        offset={offset}
        badges={false}
      />
      <Grid min={340} gap="loose">
        {cards.map((c) => (
          <div key={c.id} id={`ww-scout-${c.id}`} className="ww-scout__card">
            {CARD[c.id](ctx)}
          </div>
        ))}
      </Grid>
    </Stack>
  )
}
