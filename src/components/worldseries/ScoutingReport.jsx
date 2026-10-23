import { useEffect, useMemo, useRef, useState } from 'react'
import { CAREER_MATCHUPS_FALLBACK, loadCareerMatchups, starterMatchupsFor } from '../../api/careerMatchups.js'
import { CLUB_DEFENSE_FALLBACK, loadClubDefenseRunning } from '../../api/clubDefenseRunning.js'
import { NINE_KEYS_FALLBACK, loadNineKeys } from '../../api/nineKeys.js'
import { loadPitchByPitch } from '../../api/scout/pitchByPitch.js'
import { loadSeriesRosters } from '../../api/scout/rosterStats.js'
import { loadHomeVenues, loadParkFit, loadPlatoon } from '../../api/scout/seriesFit.js'
import { fetchMeetings } from '../../api/postseason/meetings.js'
import { rosterReadDate } from '../../api/postseason/roster.js'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { nineKeysTeams } from '../../lib/postseason/keysVerdict.js'
import { edgesState } from '../../lib/postseason/worldseries/scouting/edgesState.js'
import { matchupEdges } from '../../lib/postseason/primer/matchupEdges.js'
import { failedCards, failedLine } from '../../lib/postseason/worldseries/scouting/failedCards.js'
import { gloveLegsModel } from '../../lib/postseason/worldseries/scouting/gloveLegs.js'
import { fitParks, parkFitModel } from '../../lib/postseason/worldseries/scouting/parkFit.js'
import { platoonModel } from '../../lib/postseason/worldseries/scouting/platoon.js'
import { clubOrder, scoutingModel } from '../../lib/postseason/worldseries/scouting/scouting.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { HubTabBar } from '../chrome/HubTabBar.jsx'
import { MatchupCard, MatchupEdges } from '../postseason/edges/MatchupEdges.jsx'
import { UmpireEdge } from '../postseason/edges/UmpireEdge.jsx'
import { NineKeys } from './cards/scouting/NineKeys.jsx'
import { FilmRoom } from './cards/scouting/FilmRoom.jsx'
import { GloveLegs } from './cards/scouting/GloveLegs.jsx'
import { ParkFit } from './cards/scouting/ParkFit.jsx'
import { PitchByPitch } from './cards/scouting/PitchByPitch.jsx'
import { Platoon } from './cards/scouting/Platoon.jsx'
import { Roster } from './cards/scouting/Roster.jsx'
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
//   series        the bracket's World Series ({ games, playsOnCutoff }): the Roster card reads its rosters on its dates
//   omit          card ids to leave out (the live series page draws those elsewhere), default none
//   jumpBar       false leaves out the band's own sticky bar (the live series page has one bar for its groups)
//   onShown       called with whether the report draws anything (cards or a failed-load line)
// Adding a card: one entry in scouting.js, one here.
const CARD = {
  'nine-keys': ({ nineKeys, sides, season }) => <NineKeys data={nineKeys} clubIds={sides} season={season} />,
  'glove-legs': ({ gloveLegs, sides }) => <GloveLegs rows={gloveLegs} clubIds={sides} />,
  roster: ({ rosters, sides, slateDate }) => <Roster rosters={rosters} clubIds={sides} slateDate={slateDate} />,
  'matchup-edges': ({ edges, edgesState: state }) =>
    state === 'none' ? (
      <MatchupCard>
        <p className="ww-fit__note">No standout matchups for this game.</p>
      </MatchupCard>
    ) : (
      <MatchupEdges edges={edges} variant="faceoff" />
    ),
  'film-room': ({ meetings, dayType, noteClub }) => <FilmRoom meetings={meetings} compact={dayType === 'game'} clubId={noteClub} />,
  'pitch-by-pitch': ({ pitchByPitch, noteClub, clubIds, gameNumber }) => (
    <PitchByPitch data={pitchByPitch} clubId={noteClub} oppId={clubIds.find((id) => id !== noteClub)} gameNumber={gameNumber} />
  ),
  platoon: ({ platoon }) => <Platoon blocks={platoon} />,
  'park-fit': ({ parkFit, parks, sides }) => <ParkFit model={parkFit} parks={parks} clubIds={sides} />,
  'umpire-edge': ({ plateUmpire, umpire }) => <UmpireEdge name={plateUmpire.name} lean={umpire?.lean ?? null} />,
}

// Cards that take the whole row.
const WIDE = ['film-room', 'roster']

export function ScoutingReport({ clubIds, sides: sidesProp, slateDate, dayType, gamePk, gameNumber = null, plateUmpire = null, game = null, series = null, omit = [], jumpBar = true, onShown }) {
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
  // A row for the game in either club's side, even when no hitter clears a threshold.
  const edgesRow = sides.some((id) => starterMatchupsFor(career, gamePk, id))
  const hasNineKeys = Boolean(nineKeysTeams(nineKeys, sides.map((id) => ({ id })), season))
  const { data: defense, error: defenseError } = useAsync(() => loadClubDefenseRunning(), [])
  const gloveLegs = useMemo(() => gloveLegsModel(defense, { clubA: sides[0], clubB: sides[1], season }), [defense, sides[0], sides[1], season])
  // Platoon: regular-season OPS by pitcher hand; the tint follows the focus game's probables.
  const { data: opsByClub, error: platoonError } = useAsync(() => loadPlatoon({ clubIds, season }), [clubA, clubB, season])
  const platoon = useMemo(
    () => platoonModel(opsByClub, { clubA: sides[0], clubB: sides[1], game, gameNumber }),
    [opsByClub, sides[0], sides[1], game, gameNumber],
  )
  // Park fit: both clubs' home parks, overlaid (fitParks), on every day type. The loaders key on the
  // stable clubIds (their data is keyed by club id); only the models read `sides`, which WorldSeriesHome
  // reorders once the park resolves. A park with no layout drops out; with none, the card drops.
  const [sideA, sideB] = sides
  const { data: venueByClub, error: venueError } = useAsync(() => loadHomeVenues(clubIds), [clubA, clubB])
  const parks = useMemo(
    () => (venueByClub ? fitParks({ sides: [sideA, sideB], venueByClub, game, slateDate }) : []),
    [venueByClub, sideA, sideB, game, slateDate],
  )
  // The spray read is the heavy one: skip it when no park has a layout (the card drops anyway).
  const hasParks = parks.length > 0
  const { data: balls, error: parkError } = useAsync(
    () => (hasParks ? loadParkFit({ clubIds, slateDate }) : null),
    [clubA, clubB, slateDate, hasParks],
  )
  const parkFit = useMemo(
    () => (hasParks ? parkFitModel(balls, { clubA: sideA, clubB: sideB, layouts: parks.map((p) => p.layout) }) : null),
    [balls, parks, hasParks, sideA, sideB],
  )
  // Roster: each club's Series roster (the current one before the club names it), starters marked.
  const { data: rosters, error: rosterError } = useAsync(
    () => (series ? loadSeriesRosters(clubIds, series, slateDate) : null),
    // The read date is what the series decides (it plays today or not); the object itself is not stable.
    [clubA, clubB, rosterReadDate(series, slateDate), series?.games?.length, slateDate],
  )
  const hasRoster = Boolean(rosters && Object.keys(rosters).length)
  const cards = scoutingModel({ dayType, nineKeys: hasNineKeys, gloveLegs, roster: hasRoster, edges, edgesRow, pitchByPitch, plateUmpire, meetings, platoon, parkFit }).filter((c) => !omit.includes(c.id))
  // A failed read is not an empty one: name the cards whose load failed (the card itself still drops).
  const failed = failedLine(
    failedCards(
      [
        { label: 'Nine keys', failed: nineKeys === NINE_KEYS_FALLBACK || nineKeysError, id: 'nine-keys' },
        { label: 'Glove and legs', failed: defense === CLUB_DEFENSE_FALLBACK || defenseError },
        { label: 'Roster', error: rosterError },
        { label: 'Matchup edges', failed: career === CAREER_MATCHUPS_FALLBACK || careerError },
        { label: 'Pitch by pitch', error: pitchError },
        { label: 'Platoon', error: platoonError },
        { label: 'Park fit', error: parkError ?? venueError },
        { label: 'Film room', error: meetingsError, id: 'film-room' },
        { label: 'Umpire edge', error: umpireError },
      ].filter((r) => !omit.includes(r.id)),
    ),
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
    const read = () => setOffset(probe.offsetHeight + (bar?.offsetHeight ?? 0))
    const ro = new ResizeObserver(read)
    ro.observe(probe)
    if (bar) ro.observe(bar)
    return () => ro.disconnect()
  }, [shown])
  const drawn = shown || Boolean(failed)
  useEffect(() => {
    onShown?.(drawn)
  }, [drawn, onShown])
  if (!shown && !failed) return null
  // Every card dropped but a read failed: the band and the line, so a failure is not read as an empty season.
  if (!shown) return <Stack gap="loose" className="ww-scout"><SectionHead look="band" house as="h2">Scouting report</SectionHead><p className="ww-scout__failed" role="status">{failed}</p></Stack>
  const ctx = { rosters, slateDate, noteClub, gameNumber, pitchByPitch, dayType, meetings, nineKeys, gloveLegs, sides, clubIds, season, edges, edgesState: edgesState({ edges, hasRow: edgesRow }), plateUmpire, umpire, platoon, parkFit, parks }
  const names = clubIds.map((id) => teamClubNameShort(id)).filter(Boolean).join(' and ')
  return (
    <Stack gap="loose" className="ww-scout" ref={rootRef} style={{ '--ww-scout-offset': `${offset}px` }}>
      <span className="ww-scout__probe" aria-hidden="true" />
      <SectionHead look="band" house as="h2" note={names}>
        Scouting report
      </SectionHead>
      {jumpBar && (
        <HubTabBar
          variant="anchor"
          tabs={cards.map((c) => ({ key: `ww-scout-${c.id}`, label: c.label }))}
          ariaLabel="Scouting report cards"
          className="ww-scout__jump"
          offset={offset}
          badges={false}
        />
      )}
      {failed && <p className="ww-scout__failed" role="status">{failed}</p>}
      <Grid min={340} gap="loose">
        {cards.map((c) => (
          <div key={c.id} id={`ww-scout-${c.id}`} className={WIDE.includes(c.id) ? 'ww-scout__card ww-scout__card--wide' : 'ww-scout__card'}>
            {CARD[c.id](ctx)}
          </div>
        ))}
      </Grid>
    </Stack>
  )
}
