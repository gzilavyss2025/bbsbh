import '../../../../styles/worldseries/roster.css'
import { useState } from 'react'
import { loadRosterLine } from '../../../../api/scout/rosterStats.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { headerThemeFor, headerThemeStyle } from '../../../../lib/headerTheme.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { lineGroups, rosterSections, statLine } from '../../../../lib/postseason/worldseries/scouting/roster.js'
import { playerPath } from '../../../../lib/route.js'
import { teamClubNameShort } from '../../../../lib/teams.js'
import { Headshot } from '../../../player/Headshot.jsx'
import { Button } from '../../../ui/control/Button.jsx'
import { Door } from '../../../ui/control/Door.jsx'
import { Segmented } from '../../../ui/control/Segmented.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { StatCell, StatStrip } from '../../../ui/frame/StatStrip.jsx'
import { Grid } from '../../../ui/layout/Grid.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'
import { ClubMark } from './ClubMark.jsx'

// ROSTER (#2316, direction A "Inline expand", Gary 2026-10-22): each Series club's roster by position
// group, hitters left and pitchers right (one column on a phone). A tap on a row opens that player's
// line under it; rows open on their own. One stat-set toggle serves the whole card.
// `rosters` is loadSeriesRosters' { [teamId]: { positionPlayers, pitchers, declared, starters } }.
// Open surface (ADR-0034): no seal, and every read ends the day before the slate date
// (api/scout/rosterStats.js). Imports no reveal-only module.
const SETS = [
  { value: 'P', label: 'Postseason' },
  { value: 'R', label: 'Regular season' },
  { value: 'C', label: 'Career' },
]
const EMPTY = { P: 'No postseason games yet', R: 'No regular-season games yet', C: 'No major-league games yet' }
// The groups open on arrival, as the mock draws them.
const OPEN = ['infielders', 'starters']
const GROUP_NAME = { hitting: 'Hitting', pitching: 'Pitching' }

function Line({ player, set, slateDate }) {
  const groups = lineGroups(player.position)
  const { data, error } = useAsync(() => loadRosterLine(player.id, { set, groups, slateDate }), [player.id, set, slateDate, player.position])
  const link = useRouteLink()
  const lines = data ? groups.map((g) => ({ g, line: statLine(data[g], g) })).filter((x) => x.line) : []
  const label = SETS.find((s) => s.value === set).label
  return (
    <Stack gap="snug" className="ww-roster__panel" role="region" aria-label={`${player.name}, ${label}`}>
      {error ? (
        <p className="ww-roster__note" role="status">Could not load this line.</p>
      ) : !data ? (
        <p className="ww-roster__note">Loading</p>
      ) : !lines.length ? (
        <p className="ww-roster__note">{EMPTY[set]}</p>
      ) : (
        lines.map(({ g, line }) => (
          <Stack gap="tight" key={g}>
            {lines.length > 1 && <h5 className="ww-roster__kind">{GROUP_NAME[g]}</h5>}
            <StatStrip className="ww-roster__strip">
              {line.cells.map((c) => (
                <StatCell key={c.label} label={c.label} value={c.value} lead={c.lead} />
              ))}
            </StatStrip>
          </Stack>
        ))
      )}
      <Door {...link(playerPath(player.id, { name: player.name }))} className="ww-roster__door">
        Player page
      </Door>
    </Stack>
  )
}

function Row({ player, clubId, set, slateDate }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={open ? 'ww-roster__item ww-roster__item--open' : 'ww-roster__item'}>
      <Button skin="ghost" block icon="›" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="ww-roster__row">
        <span className="ww-roster__line">
          <span className="ww-roster__num ww-roster__jersey">{player.jersey}</span>
          <Headshot personId={player.id} name={player.name} teamId={clubId} className="ww-roster__shot" />
          <span className="ww-roster__name">{player.name}</span>
          <span className="ww-roster__pos">{player.position}</span>
        </span>
      </Button>
      {open && <Line player={player} set={set} slateDate={slateDate} />}
    </li>
  )
}

function Group({ section, clubId, set, slateDate }) {
  const [open, setOpen] = useState(OPEN.includes(section.id))
  return (
    <section aria-label={section.label}>
      <Button block aria-expanded={open} onClick={() => setOpen((o) => !o)} className="ww-roster__head">
        {section.label}
      </Button>
      {open && (
        <ul className="ww-roster__list">
          {section.players.map((p) => (
            <Row key={p.id} player={p} clubId={clubId} set={set} slateDate={slateDate} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function Roster({ rosters, clubIds, slateDate }) {
  const clubs = clubIds.filter((id) => rosters[id])
  // Until a tap picks one, the first club in the sides order (away) shows.
  const [picked, setPicked] = useState(null)
  const [set, setSet] = useState('P')
  const club = rosters[picked] ? picked : clubs[0]
  const roster = rosters[club]
  const size = (id) => rosters[id].positionPlayers.length + rosters[id].pitchers.length
  const sections = rosterSections(roster, roster.starters).filter((s) => s.players.length)
  return (
    <Card frame="stamped" label="Roster" labelAs="h3" count={roster.declared ? 'Series roster' : 'Current roster'} className="ww-roster">
      <Stack gap="base">
        <Segmented
          fill
          label="Club"
          value={club}
          onChange={setPicked}
          className="ww-roster__clubs"
          options={clubs.map((id) => ({
            value: id,
            label: (
              <>
                <ClubMark teamId={id} name={teamClubNameShort(id)} selected={id === club} />
                {teamClubNameShort(id)}
              </>
            ),
            count: size(id),
            // The club's own bar colours (Identity Lab, main jersey): the selected tab wears them.
            style: headerThemeStyle(headerThemeFor(id, 'main')),
          }))}
        />
        <Segmented fill label="Stat set" value={set} onChange={setSet} className="ww-roster__sets" options={SETS} />
        {!roster.declared && (
          <p className="ww-roster__note ww-roster__undeclared">
            The {teamClubNameShort(club)} have not named their Series roster yet. Clubs name 26 players by the morning of
            Game 1. This is their current roster.
          </p>
        )}
        <Grid min={300} gap="loose" fit>
          {['hit', 'pitch'].map((side) => (
            <Stack gap="snug" key={side}>
              {sections
                .filter((s) => s.side === side)
                .map((s) => (
                  <Group key={`${club}-${s.id}`} section={s} clubId={club} set={set} slateDate={slateDate} />
                ))}
            </Stack>
          ))}
        </Grid>
      </Stack>
    </Card>
  )
}
