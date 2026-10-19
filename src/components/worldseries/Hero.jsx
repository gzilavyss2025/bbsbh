import { teamLocationName, teamClubNameShort } from '../../lib/teams.js'
import { gamePath, logbookNewPath, umpirePath } from '../../lib/route.js'
import { useRouteLink } from '../../lib/nav.js'
import { timeOfDay } from '../../lib/dates.js'
import { Pips } from '../bracket/bracketParts.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Button } from '../ui/control/Button.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { ScheduleStrip } from './ScheduleStrip.jsx'

// The hero: "Tonight" on a game day, "Off day" on an off day. Headline, park
// and first pitch, one row per club (logo, short name, regular-season record,
// pips), the sealed score control on a game day, the schedule strip on a phone,
// and the doors to the game. Pips show the state heading INTO the slate date
// (ADR-0087). Today's runs reach this file only through the ledger model, which
// holds them back unless `live`.
function ClubRow({ slot, record, winsNeeded, runs }) {
  const { club } = slot
  return (
    <li className="ww-hero__club">
      <TeamLogo teamId={club.id} name={club.name} size={40} />
      <Stack gap="tight" className="ww-hero__clubname">
        <span className="ww-hero__short">{teamClubNameShort(club.id) ?? club.name}</span>
        {record && <span className="ww-hero__record">{record}</span>}
      </Stack>
      {runs != null && <span className="ww-hero__runs">{runs}</span>}
      <Pips winsNeeded={winsNeeded} wins={slot.wins} size="lg" />
    </li>
  )
}

export function Hero({ mode, model, game, records, slateDate, live, wide, played = [], umpire = null, onRevealScores }) {
  const link = useRouteLink()
  const { series, dayType, gameNumber } = mode
  const gameDay = dayType === 'game'
  const abbr = Object.fromEntries(series.slots.map((s) => [s.club.id, s.club.abbreviation]))
  const recordOf = (id) => (records[id]?.wins != null ? `${records[id].wins}–${records[id].losses}` : '')

  const headline = gameDay
    ? `Game ${gameNumber}`
    : game?.homeId
      ? `To ${teamLocationName(game.homeId) ?? abbr[game.homeId] ?? 'next park'}`
      : gameNumber
        ? `Game ${gameNumber} next`
        : 'Off day'
  const first = game?.gameDate ? timeOfDay(Date.parse(game.gameDate)) : ''
  const venue = game ? [game.venue?.name, first || 'TBD'].filter(Boolean).join(' · ') : ''

  const todayIdx = model.columns.findIndex((c) => c.kind === 'game' && c.state === 'today')
  const runsOf = (rowIdx) => {
    const cell = todayIdx >= 0 ? model.rows[rowIdx]?.cells[todayIdx] : null
    return cell?.kind === 'runs' ? cell.value : null
  }

  const path = (section) => (game?.awayId ? gamePath(slateDate, abbr[game.awayId], abbr[game.homeId], section) : null)
  const lineups = gameDay ? path('lineup1') : null
  const innings = gameDay ? path('top1') : null
  const preview = !gameDay && gameNumber ? path('preview') : null
  // Wide off day: one Stamp door per played game here (phone has them in Played).
  const stamps = wide && !gameDay ? played : []

  return (
    <Card frame="stamped" label={gameDay ? 'Tonight' : 'Off day'} count={`World Series · ${series.slots.map((s) => s.wins).join('–')}`} className="ww-hero">
      <h3 className="ww-hero__headline">{headline}</h3>
      {venue && <p className="ww-hero__venue">{venue}</p>}
      <Stack as="ul" gap="snug" className="ww-hero__clubs">
        {series.slots.map((slot, i) => (
          <ClubRow key={slot.club.id} slot={slot} record={recordOf(slot.club.id)} winsNeeded={series.winsNeeded} runs={runsOf(i)} />
        ))}
      </Stack>
      {/* Without a reveal handler (the home slate no longer offers the pass)
          the seal is a plain statement, never a button that does nothing. */}
      {gameDay && !live && (onRevealScores ? (
        <Button block hint="Tap to reveal" onClick={onRevealScores} className="ww-hero__seal">
          Score sealed
        </Button>
      ) : (
        <p className="ww-hero__seal ww-hero__sealnote">Score sealed</p>
      ))}
      {!wide && <ScheduleStrip columns={model.columns} />}
      {(lineups || preview || stamps.length > 0) && (
        <Cluster gap="base" className="ww-hero__actions">
          {lineups && <Door {...link(lineups)}>Lineups</Door>}
          {innings && <Door {...link(innings)}>Innings</Door>}
          {wide && gameDay && umpire && <Door {...link(umpirePath(umpire.id, umpire.name))}>Plate umpire</Door>}
          {stamps.map((r) => (
            <Door key={r.gamePk} {...link(logbookNewPath(r.gamePk))}>{`Stamp G${r.gameNumber}`}</Door>
          ))}
          {preview && <Door {...link(preview)}>{`G${gameNumber} preview`}</Door>}
        </Cluster>
      )}
    </Card>
  )
}
