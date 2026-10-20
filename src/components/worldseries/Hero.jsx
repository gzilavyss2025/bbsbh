import '../../styles/worldseries/hero.css'
import { useEffect, useState } from 'react'
import { fetchGameClips } from '../../api/postseason/worldSeriesHome.js'
import { useAsync } from '../../hooks/useAsync.js'
import { firstPitchText, monthDayShort } from '../../lib/dates.js'
import { actionPhotoUrl } from '../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'
import { useRouteLink } from '../../lib/nav.js'
import { seriesMark } from '../../lib/postseason/seriesMarks.js'
import { calendarDays, clipSources, playerClip, slabPlayer, withFormatDates } from '../../lib/postseason/worldseries/hero.js'
import { ledgerModel } from '../../lib/postseason/worldseries/ledger.js'
import { gamePath, logbookNewPath, umpirePath } from '../../lib/route.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { Pips } from '../bracket/bracketParts.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { SeriesMark } from '../postseason/SeriesMark.jsx'
import { Button } from '../ui/control/Button.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { ScheduleStrip } from './ScheduleStrip.jsx'

// THE HERO: the "Overview" card that leads the World Series home (the versus
// design, Gary 2026-10-20). Top: both clubs' marks with their pips (the state
// heading INTO the slate date, ADR-0087) and the Series mark between. Then the
// split: one ink slab per club, meeting on a slanted seam, each with a hitter
// (slabPlayer) over his washed action photo. Then each hitter's line and play
// button, the clubs' wordmarks, the calendar, and one door to the next game.
//
// No score: the hero builds its own ledger columns with no runs handed in, so
// it holds no run at all and a game day has no score slot (ADR-0116). An
// if-needed game's date comes from the Series format (withFormatDates), never
// from the schedule row bracket.js hides. Clips come only from games dated before the slate date
// (fetchGameClips). The split opens on hover or on a press of the door, as the
// slate card's tiles do (gamecard/versus.css); the arrival plays once a session.
const ARRIVED_KEY = 'bbsbh:ws-hero-arrived'

function firstThisSession() {
  try {
    return window.sessionStorage.getItem(ARRIVED_KEY) == null
  } catch {
    return false
  }
}

// The player's action photo, washed into the slab. Invisible until it loads and gone on an
// error (a 404 means no photo), so a slab never shows a broken image (HeroActionPhoto's rule).
function Wash({ personId }) {
  const [state, setState] = useState('wait')
  const src = actionPhotoUrl(personId)
  if (!src || state === 'gone') return null
  return (
    <img
      className={`ww-hero__wash${state === 'ready' ? ' is-ready' : ''}`}
      src={src}
      alt=""
      crossOrigin={HEADSHOT_CROSS_ORIGIN}
      decoding="async"
      onLoad={() => setState('ready')}
      onError={() => setState('gone')}
    />
  )
}

function Slab({ side, clubId, player }) {
  return (
    <div className={`ww-hero__slab ww-hero__slab--${side}`}>
      {player ? (
        <>
          <Wash key={player.id} personId={player.id} />
          <Headshot personId={player.id} name={player.name} teamId={clubId} tint={false} hideFallback className="ww-hero__cut" />
        </>
      ) : (
        <TeamLogo teamId={clubId} name={teamClubNameShort(clubId) ?? ''} variant="mono" size={88} className="ww-hero__mono" />
      )}
    </div>
  )
}

function Who({ side, player, clip, onPlay }) {
  if (!player) return <div />
  const ops = Number.isFinite(Number.parseFloat(player.ops)) ? player.ops : '—'
  const figures = (
    <span className="ww-hero__figs">
      <span className="ww-hero__ops">{`${ops} OPS`}</span>
      <span className="ww-hero__pa">{[player.pos, `${player.pa} PA`].filter(Boolean).join(' · ')}</span>
    </span>
  )
  const play = clip && (
    <Button skin="ink" icon="▶" aria-label={`Play a ${player.name} postseason highlight`} className="ww-hero__play" onClick={onPlay} />
  )
  return (
    <Stack gap="snug" className={`ww-hero__who ww-hero__who--${side}`}>
      <span className="ww-hero__name">{player.name}</span>
      <Cluster gap="snug" className="ww-hero__line">
        {side === 'away' ? (
          <>
            {play}
            {figures}
          </>
        ) : (
          <>
            {figures}
            {play}
          </>
        )}
      </Cluster>
    </Stack>
  )
}

function ClubHead({ side, slot, winsNeeded }) {
  const { club } = slot
  const name = teamClubNameShort(club.id) ?? club.name
  return (
    <Stack gap="snug" className={`ww-hero__club ww-hero__club--${side}`}>
      <TeamLogo teamId={club.id} name={name} size={40} />
      <Pips winsNeeded={winsNeeded} wins={slot.wins} size="lg" />
      <span className="sr-only">{`${name}: ${slot.wins} of ${winsNeeded} wins`}</span>
    </Stack>
  )
}

export function Hero({ mode, game, slateDate, wide, played = [], umpire = null, splitsByClub = null, clubGames = null }) {
  const link = useRouteLink()
  const { series, dayType, gameNumber } = mode
  const gameDay = dayType === 'game'
  const season = Number(slateDate.slice(0, 4))
  const abbr = Object.fromEntries(series.slots.map((s) => [s.club.id, s.club.abbreviation]))

  // Away on the left, home on the right, as on the slate card; the bracket's order without a game.
  const slotOf = Object.fromEntries(series.slots.map((s) => [s.club.id, s]))
  const order = game?.awayId && slotOf[game.awayId] && slotOf[game.homeId] ? [game.awayId, game.homeId] : series.slots.map((s) => s.club.id)
  const started = (series.games ?? []).length > 0
  const players = order.map((id) => slabPlayer(splitsByClub?.[id], { clubId: id, season, started }))

  const sources = clipSources(clubGames, order, slateDate)
  const sourceKey = sources.map((g) => g.gamePk).join(',')
  const clipGames = useAsync(() => (sourceKey ? fetchGameClips(sources, slateDate) : Promise.resolve([])), [sourceKey, slateDate])
  const clips = players.map((p) => (p ? playerClip(clipGames.data, p.id) : null))
  const [open, setOpen] = useState(null)

  const [arrive] = useState(firstThisSession)
  useEffect(() => {
    if (!arrive) return
    try {
      window.sessionStorage.setItem(ARRIVED_KEY, '1')
    } catch {
      // Private mode: the arrival may play again next load, which is harmless.
    }
  }, [arrive])

  const { columns } = ledgerModel({
    clubIds: series.slots.map((s) => s.club.id),
    games: series.games,
    upcoming: withFormatDates(series.games, series.upcoming),
    slateDate,
  })
  const days = calendarDays(columns, slateDate)
  const nextDay = days.find((d) => (gameDay ? d.today && d.kind === 'game' : d.gameNumber === gameNumber))
  const path = (section) => (game?.awayId ? gamePath(slateDate, abbr[game.awayId], abbr[game.homeId], section) : null)
  const nextPath = gameNumber ? path(gameDay ? 'lineup1' : 'preview') : null
  const when = [nextDay?.date && `${nextDay.weekday} ${monthDayShort(nextDay.date)}`, game && firstPitchText(game.gameDate, game.startTimeTBD)]
  const innings = gameDay ? path('top1') : null
  // Wide off day: one Stamp door per played game here (the phone has them in Played).
  const stamps = wide && !gameDay ? played : []
  const mark = seriesMark({ season, round: 'worldseries' })

  return (
    <Card frame="stamped" label="Overview" stampIn={arrive} className={`ww-hero${arrive ? ' ww-hero--arrive' : ''}`}>
      <Stack gap="base">
        <div className="ww-hero__top">
          <ClubHead side="away" slot={slotOf[order[0]]} winsNeeded={series.winsNeeded} />
          {mark ? (
            <SeriesMark mark={mark} height={40} plate className="ww-hero__mark" />
          ) : (
            <span className="ww-hero__words">World Series</span>
          )}
          <ClubHead side="home" slot={slotOf[order[1]]} winsNeeded={series.winsNeeded} />
        </div>
        <div className="ww-hero__pair">
          <div className="ww-hero__split">
            <Slab side="away" clubId={order[0]} player={players[0]} />
            <Slab side="home" clubId={order[1]} player={players[1]} />
          </div>
          <Who side="away" player={players[0]} clip={clips[0]} onPlay={() => setOpen(clips[0])} />
          <Who side="home" player={players[1]} clip={clips[1]} onPlay={() => setOpen(clips[1])} />
          <TeamLogo teamId={order[0]} name={teamClubNameShort(order[0]) ?? ''} variant="wordmark" size={20} className="ww-hero__word ww-hero__word--away" />
          <TeamLogo teamId={order[1]} name={teamClubNameShort(order[1]) ?? ''} variant="wordmark" size={20} className="ww-hero__word ww-hero__word--home" />
        </div>
        <ScheduleStrip days={days} />
        {nextPath && (
          <Door {...link(nextPath)} className="ww-hero__next">
            <span className="ww-hero__nexttext">
              <span className="ww-hero__nextname">{`Game ${gameNumber} ${gameDay ? 'lineups' : 'preview'}`}</span>
              {when.some(Boolean) && <span className="ww-hero__nextwhen">{when.filter(Boolean).join(' · ')}</span>}
            </span>
          </Door>
        )}
        {(innings || (wide && gameDay && umpire) || stamps.length > 0) && (
          <Cluster gap="base" className="ww-hero__doors">
            {innings && <Door {...link(innings)}>Innings</Door>}
            {wide && gameDay && umpire && <Door {...link(umpirePath(umpire.id, umpire.name))}>Plate umpire</Door>}
            {stamps.map((r) => (
              <Door key={r.gamePk} {...link(logbookNewPath(r.gamePk))}>{`Stamp G${r.gameNumber}`}</Door>
            ))}
          </Cluster>
        )}
      </Stack>
      {open && <HighlightSheet item={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
