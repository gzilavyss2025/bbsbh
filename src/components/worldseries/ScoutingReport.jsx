import { loadCareerMatchups, starterMatchupsFor } from '../../api/careerMatchups.js'
import { loadNineKeys } from '../../api/nineKeys.js'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
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
//   gamePk        the game the edges read: nextGamePk()
//   plateUmpire   { id, name } from fetchPlateUmpires, or null (game day)
const BAR_H = 68 // the sticky jump bar's height, the scroll-margin of each card

// Adding a card: one entry in scouting.js, one here.
const CARD = {
  'nine-keys': ({ nineKeys, clubIds, season }) => <SeriesNineKeys data={nineKeys} clubs={clubIds.map((id) => ({ id }))} season={season} />,
  'matchup-edges': ({ edges }) => <MatchupEdges edges={edges} variant="faceoff" />,
  'umpire-edge': ({ plateUmpire, umpire }) => <UmpireEdge name={plateUmpire.name} lean={umpire?.lean ?? null} />,
}

export function ScoutingReport({ clubIds, slateDate, dayType, gamePk, plateUmpire = null }) {
  const season = Number(slateDate.slice(0, 4))
  const { data: nineKeys } = useAsync(() => loadNineKeys(), [])
  const { data: career } = useAsync(loadCareerMatchups, [])
  const { data: umpire } = useAsync(
    () => (plateUmpire?.id ? loadUmpire(plateUmpire.id, { seasonYear: season }).catch(() => null) : null),
    [plateUmpire?.id, season],
  )
  const edges = matchupEdges(clubIds.map((id) => starterMatchupsFor(career, gamePk, id)))
  const [a, b] = clubIds.map((id) => nineKeys?.current?.teams?.find((t) => t.teamId === id))
  const hasNineKeys = Boolean(a && b && nineKeys.current.season === season && nineKeys.keys?.length)
  const cards = scoutingModel({ dayType, nineKeys: hasNineKeys, edges, plateUmpire })
  if (!cards.length) return null
  const ctx = { nineKeys, clubIds, season, edges, plateUmpire, umpire }
  const names = clubIds.map((id) => teamClubNameShort(id)).filter(Boolean).join(' and ')
  return (
    <Stack gap="loose" className="ww-scout">
      <SectionHead look="band" house as="h2" note={names}>
        Scouting report
      </SectionHead>
      <HubTabBar
        variant="anchor"
        tabs={cards.map((c) => ({ key: `ww-scout-${c.id}`, label: c.label }))}
        ariaLabel="Scouting report cards"
        className="ww-scout__jump"
        offset={BAR_H}
        badges={false}
      />
      <Grid min={340} gap="loose">
        {cards.map((c) => (
          <section key={c.id} id={`ww-scout-${c.id}`} className="ww-scout__card" aria-label={c.label}>
            {CARD[c.id](ctx)}
          </section>
        ))}
      </Grid>
    </Stack>
  )
}
