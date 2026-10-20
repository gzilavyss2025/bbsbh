import { useEffect, useMemo, useRef, useState } from 'react'
import { CAREER_MATCHUPS_FALLBACK, loadCareerMatchups, starterMatchupsFor } from '../../api/careerMatchups.js'
import { CLUB_DEFENSE_FALLBACK, loadClubDefenseRunning } from '../../api/clubDefenseRunning.js'
import { NINE_KEYS_FALLBACK, loadNineKeys } from '../../api/nineKeys.js'
import { loadPitchByPitch } from '../../api/scout/pitchByPitch.js'
import { loadParkFit, loadPlatoon } from '../../api/scout/seriesFit.js'
import { fetchMeetings } from '../../api/postseason/meetings.js'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { nineKeysTeams } from '../../lib/postseason/keysVerdict.js'
import { matchupEdges } from '../../lib/postseason/primer/matchupEdges.js'
import { failedCards, failedLine } from '../../lib/postseason/worldseries/scouting/failedCards.js'
import { gloveLegsModel } from '../../lib/postseason/worldseries/scouting/gloveLegs.js'
import { parkFitModel } from '../../lib/postseason/worldseries/scouting/parkFit.js'
import { platoonModel } from '../../lib/postseason/worldseries/scouting/platoon.js'
import { MILWAUKEE_VENUE_ID, clubOrder, scoutingModel } from '../../lib/postseason/worldseries/scouting/scouting.js'
import { resolveBallparkLayout } from '../../lib/ballpark/layout/resolveLayout.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { HubTabBar } from '../chrome/HubTabBar.jsx'
import { MatchupEdges } from '../postseason/edges/MatchupEdges.jsx'
import { UmpireEdge } from '../postseason/edges/UmpireEdge.jsx'
import { SeriesNineKeys } from '../postseason/SeriesNineKeys.jsx'
import { FilmRoom } from './cards/scouting/FilmRoom.jsx'
import { GloveLegs } from './cards/scouting/GloveLegs.jsx'
import { ParkFit } from './cards/scouting/ParkFit.jsx'
import { PitchByPitch } from './cards/scouting/PitchByPitch.jsx'
import { Platoon } from './cards/scouting/Platoon.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Grid } from '../ui/layout/Grid.jsx'
import { Stack } from '../ui/layout/Stack.jsx'

// THE SCOUTING REPORT (#2316, slice 1): a navy band head, a sticky jump bar, and the
// cards that have data for this day type. The list and its order are
// lib/postseason/worldseries/scouting/scouting.js; this file only loads each card's data and
// draws it. A card with no data is not drawn, and its button is not either. Every
// read is an open surface (ADR-0034); nothing here reads today's game.
//
//   clubIds       the two Series clubs
//   sides         [away, home] of the focus game, the order Tale of the tape draws and every card follows (default: clubIds)
//   slateDate     YYYY-MM-DD
//   dayType       'off' | 'game' (mode.js)
//   gamePk        the game the edges read: the home's focus game (today's on a game day,
//                 the next one on an off day), the same one the umpire is read for
//   plateUmpire   { id, name } from fetchPlateUmpires, or null (game day)
//   game          the focus game's upcoming row (api/postseason/upcoming.js): venue and probables, or null
// Adding a card: one entry in scouting.js, one here.
const CARD = {
  'nine-keys': ({ nineKeys, sides, season }) => <SeriesNineKeys data={nineKeys} clubs={sides.map((id) => ({ id }))} season={season} labelAs="h3" />,
  'glove-legs': ({ gloveLegs, sides }) => <GloveLegs rows={gloveLegs} clubIds={sides} />,
  'matchup-edges': ({ edges }) => <MatchupEdges edges={edges} variant="faceoff" />,
  'film-room': ({ meetings, dayType, noteClub }) => <FilmRoom meetings={meetings} compact={dayType === 'game'} clubId={noteClub} />,
  'pitch-by-pitch': ({ pitchByPitch, noteClub, clubIds, gameNumber }) => (
    <PitchByPitch data={pitchByPitch} clubId={noteClub} oppId={clubIds.find((id) => id !== noteClub)} gameNumber={gameNumber} />
  ),
  platoon: ({ platoon }) => <Platoon blocks={platoon} />,
  'park-fit': ({ parkFit, parkLayout, sides }) => <ParkFit model={parkFit} layout={parkLayout} clubIds={sides} />,
  'umpire-edge': ({ plateUmpire, umpire }) => <UmpireEdge name={plateUmpire.name} lean={umpire?.lean ?? null} />,
}

export function ScoutingReport({ clubIds, sides: sidesProp, slateDate, dayType, gamePk, gameNumber = null, plateUmpire = null, game = null }) {
  const season = Number(slateDate.slice(0, 4))
  const { data: nineKeys, error: nineKeysError } = useAsync(() => loadNineKeys(), [])
  const { data: career, error: careerError } = useAsync(() => loadCareerMatchups(), [])
  const { data: umpire, error: umpireError } = useAsync(
    () => (plateUmpire?.id ? loadUmpire(plateUmpire.id, { seasonYear: season }) : null),
    [plateUmpire?.id, season],
  )
  const [clubA, clubB] = clubIds
  // Every card draws the clubs away then home, the Tale of the tape order.
  const sides = clubOrder(clubIds, sidesProp)
  const { favoriteTeamId } = useFavoriteTeam()
  // Past regular-season meetings, cut off the day before the slate date (api/postseason/meetings.js).
  const { data: meetings, error: meetingsError } = useAsync((signal) => fetchMeetings({ clubA, clubB, slateDate }, { signal }), [clubA, clubB, slateDate])
  // The starter of the favorite club (the Brewers by default) against the other club's regulars.
  const noteClub = clubIds.includes(favoriteTeamId) ? favoriteTeamId : clubA
  const { data: pitchByPitch, error: pitchError } = useAsync(
    () => (gamePk ? loadPitchByPitch({ clubId: noteClub, oppId: clubIds.find((id) => id !== noteClub), gamePk, slateDate }) : null),
    [gamePk, noteClub, clubA, clubB, slateDate],
  )
  const edges = useMemo(
    () => matchupEdges(sides.map((id) => starterMatchupsFor(career, gamePk, id))),
    [career, gamePk, sides[0], sides[1]],
  )
  const hasNineKeys = Boolean(nineKeysTeams(nineKeys, sides.map((id) => ({ id })), season))
  const { data: defense, error: defenseError } = useAsync(() => loadClubDefenseRunning(), [])
  const gloveLegs = useMemo(() => gloveLegsModel(defense, { clubA: sides[0], clubB: sides[1], season }), [defense, sides[0], sides[1], season])
  // Platoon: regular-season OPS by pitcher hand; the tint follows the focus game's probables.
  const { data: opsByClub, error: platoonError } = useAsync(() => loadPlatoon({ clubIds, season }), [clubA, clubB, season])
  const platoon = useMemo(
    () => platoonModel(opsByClub, { clubA: sides[0], clubB: sides[1], game, gameNumber }),
    [opsByClub, sides[0], sides[1], game, gameNumber],
  )
  // Park fit: always Milwaukee's field (the park of Games 1, 2, 6 and 7; the other club's park is not
  // on file for Games 3 to 5). On a game day the card shows only when tonight's park is Milwaukee, and
  // the spray read waits for that answer. The loaders key on the stable clubIds (their data is keyed by
  // club id); only the models read `sides`, which WorldSeriesHome reorders once the park resolves.
  const venueId = game?.venue?.id ?? null
  const parkLayout = useMemo(() => resolveBallparkLayout({ venueId: MILWAUKEE_VENUE_ID, gameDate: slateDate }), [slateDate])
  const wantPark = Boolean(parkLayout) && (dayType !== 'game' || venueId === MILWAUKEE_VENUE_ID)
  const { data: balls, error: parkError } = useAsync(() => (wantPark ? loadParkFit({ clubIds, slateDate }) : null), [clubA, clubB, slateDate, wantPark])
  const parkFit = useMemo(() => (wantPark ? parkFitModel(balls, { clubA: sides[0], clubB: sides[1] }) : null), [balls, wantPark, sides[0], sides[1]])
  const cards = scoutingModel({ dayType, nineKeys: hasNineKeys, gloveLegs, edges, pitchByPitch, plateUmpire, meetings, platoon, parkFit, venueId })
  // A failed read is not an empty one: name the cards whose load failed (the card itself still drops).
  const failed = failedLine(
    failedCards([
      { label: 'Nine keys', failed: nineKeys === NINE_KEYS_FALLBACK || nineKeysError },
      { label: 'Glove and legs', failed: defense === CLUB_DEFENSE_FALLBACK || defenseError },
      { label: 'Matchup edges', failed: career === CAREER_MATCHUPS_FALLBACK || careerError },
      { label: 'Pitch by pitch', error: pitchError },
      { label: 'Platoon', error: platoonError },
      { label: 'Park fit', error: parkError },
      { label: 'Film room', error: meetingsError },
      { label: 'Umpire edge', error: umpireError },
    ]),
  )
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
  if (!shown && !failed) return null
  // Every card dropped but a read failed: the band and the line, so a failure is not read as an empty season.
  if (!shown) return <Stack gap="loose" className="ww-scout"><SectionHead look="band" house as="h2">Scouting report</SectionHead><p className="ww-scout__failed" role="status">{failed}</p></Stack>
  const ctx = { noteClub, gameNumber, pitchByPitch, dayType, meetings, nineKeys, gloveLegs, sides, clubIds, season, edges, plateUmpire, umpire, platoon, parkFit, parkLayout }
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
      {failed && <p className="ww-scout__failed" role="status">{failed}</p>}
      <Grid min={340} gap="loose">
        {cards.map((c) => (
          <div key={c.id} id={`ww-scout-${c.id}`} className={c.id === 'film-room' ? 'ww-scout__card ww-scout__card--wide' : 'ww-scout__card'}>
            {CARD[c.id](ctx)}
          </div>
        ))}
      </Grid>
    </Stack>
  )
}
