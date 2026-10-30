import '../../styles/worldseries/hero.css'
import '../../styles/worldseries/decided.css'
import { useEffect, useRef, useState } from 'react'
import { fetchTeamHighlights } from '../../api/gamehighlights.js'
import { fetchSpotlightPool } from '../../api/postseason/worldseries/spotlightPool.js'
import { useAsync } from '../../hooks/useAsync.js'
import { firstPitchText, monthDayShort } from '../../lib/dates.js'
import { actionPhotoUrl } from '../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'
import { useRouteLink } from '../../lib/nav.js'
import { seriesMark } from '../../lib/postseason/seriesMarks.js'
import { calendarDays, decidedHero, monthsOf, nextGamePath, slabPlayers, spotlightAt, spotlightCount, spotlightRoster, storedClip, withFormatDates } from '../../lib/postseason/worldseries/hero.js'
import { ledgerModel } from '../../lib/postseason/worldseries/ledger.js'
import { logbookNewPath, umpirePath } from '../../lib/route.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { Pips } from '../bracket/bracketParts.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { SeriesMark } from '../postseason/SeriesMark.jsx'
import { Button } from '../ui/control/Button.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Key } from '../ui/frame/Key.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { ScheduleStrip } from './ScheduleStrip.jsx'

// Championship Matchup: the approved World Series overview. The next game's
// date is the centre of the stage, between two player layers; the calendar
// leads into its one preview/lineups door. Names, images, figures and clips
// follow the spotlight player's identity, never text baked into the artwork. A tap on the art
// walks both clubs' whole rosters (spotlightRoster).
//
// No score: the hero builds its own ledger columns with no runs handed in, so
// it holds no run at all and a game day has no score slot (ADR-0116). An
// if-needed game's date comes from the Series format (withFormatDates), never
// from the schedule row bracket.js hides. Clips come from the clubs' stored highlight files, from
// games dated before the slate date (storedClip). The slate card's split/scale and the existing one-session
// arrival are reused; the next-game card (or, on a page with no slate, its door) remains usable throughout.
const ARRIVED_KEY = 'bbsbh:ws-hero-arrived'

// A tap on the art: the two slabs and the spotlight under them slide out (FLIP_OUT_MS), the next
// players swap in and slide back (FLIP_IN_MS). Both match the durations in hero.css. With reduced
// motion the swap is immediate.
const FLIP_OUT_MS = 140
const FLIP_IN_MS = 380

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
  return (
    <Stack gap="tight" className={`ww-hero__who ww-hero__who--${side}`}>
      <span className="ww-hero__name">{player.name}</span>
      <span className="ww-hero__figs">{player.figs}</span>
      {clip && (
        <Button skin="ghost" icon="▸" aria-label={`Watch highlight: ${player.name}, ${monthDayShort(clip.date)}`} className="ww-hero__play" onClick={onPlay}>
          Watch highlight
        </Button>
      )}
    </Stack>
  )
}

function ClubHead({ side, slot, winsNeeded }) {
  const { club } = slot
  const name = teamClubNameShort(club.id) ?? club.name
  return (
    <Stack gap="snug" className={`ww-hero__club ww-hero__club--${side}`}>
      <TeamLogo teamId={club.id} name={name} variant="mono" size={40} eager />
      <span className="ww-hero__clubname">{name}</span>
      <Pips winsNeeded={winsNeeded} wins={slot.wins} size="lg" />
      <span className="sr-only">{`${name}: ${slot.wins} of ${winsNeeded} wins`}</span>
    </Stack>
  )
}

export function Hero({ mode, game, slateDate, wide, played = [], umpire = null, splitsByClub = null, clubGames = null, gameCard = null, gameCardPending = false }) {
  const link = useRouteLink()
  const { series, dayType, gameNumber } = mode
  const gameDay = dayType === 'game'
  const season = Number(slateDate.slice(0, 4))
  const abbr = Object.fromEntries(series.slots.map((s) => [s.club.id, s.club.abbreviation]))

  // Away on the left, home on the right, as on the slate card; the bracket's order without a game.
  const slotOf = Object.fromEntries(series.slots.map((s) => [s.club.id, s]))
  const order = game?.awayId && slotOf[game.awayId] && slotOf[game.homeId] ? [game.awayId, game.homeId] : series.slots.map((s) => s.club.id)
  const started = (series.games ?? []).length > 0
  // The tap walks each club's whole roster: the pool (roster and club-wide lines) loads beside the page,
  // and until it lands the slabs cycle the hot-bat hitters, who lead the same list.
  const pool = useAsync(() => Promise.all(order.map((id) => fetchSpotlightPool(id, series, slateDate))), [order.join(','), slateDate])
  const lists = order.map((id, i) => {
    const options = { clubId: id, season, started }
    const full = pool.data?.[i]?.roster ? spotlightRoster({ ...pool.data[i], hitP: splitsByClub?.[id] }, options) : []
    return full.length ? full : slabPlayers(splitsByClub?.[id], options)
  })
  const count = spotlightCount(lists)
  const [step, setStep] = useState(0)
  const [flip, setFlip] = useState(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const at = step % Math.max(count, 1)
  const players = spotlightAt(lists, at)
  const nextNames = spotlightAt(lists, (at + 1) % Math.max(count, 1)).filter(Boolean).map((p) => p.name).join(' and ')
  const nextPlayers = () => {
    if (flip) return
    const go = () => setStep((n) => (n + 1) % count)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return go()
    setFlip('out')
    timers.current = [
      setTimeout(() => { go(); setFlip('in') }, FLIP_OUT_MS),
      setTimeout(() => setFlip(null), FLIP_OUT_MS + FLIP_IN_MS),
    ]
  }

  // Highlights come from the clubs' stored files (the nightly gen-highlights.mjs), so every
  // player the tap can show has his own and no /content read waits on the page. A Series postseason
  // clip wins; a player with none gets his newest this season.
  const highlights = useAsync(() => Promise.all(order.map((id) => fetchTeamHighlights(id))), [order.join(',')])
  const gamePks = new Set(order.flatMap((id) => (clubGames?.[id] ?? []).map((g) => g.gamePk)))
  const clips = players.map((p) => storedClip(highlights.data, p, { slateDate, gamePks }))
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
    upcoming: withFormatDates(series.games, series.upcoming, slateDate),
    slateDate,
  })
  // A game day's Next is today's game, the one the lineups door opens.
  // A game already played opens its lineups page from its cell (Gary, 2026-10-28), as a decided Series' cells do.
  const playedOf = new Map((series.games ?? []).map((g) => [g.gameNumber, g]))
  const days = calendarDays(columns, slateDate).map((day) => {
    const d = gameDay ? { ...day, next: day.today && day.kind === 'game' } : day
    return d.kind === 'game' && d.date && d.date < slateDate ? { ...d, path: nextGamePath(playedOf.get(d.gameNumber), d.date, abbr, 'lineup1') } : d
  })
  const nextDay = days.find((d) => (gameDay ? d.next : d.gameNumber === gameNumber))
  const path = (section) => nextGamePath(game, slateDate, abbr, section)
  // A game day's door needs no game number (a resumed game can lack one); a preview names its game.
  const nextPath = gameDay ? path('lineup1') : gameNumber ? path('preview') : null
  const nextName = gameDay ? (gameNumber ? `Game ${gameNumber} lineups` : 'Lineups') : `Game ${gameNumber} preview`
  const when = [nextDay?.date && `${nextDay.weekday} ${monthDayShort(nextDay.date)}`, game && firstPitchText(game.gameDate, game.startTimeTBD)]
  const months = monthsOf(days)
  // Wide off day: one Stamp door per played game here (the phone has them in Played).
  const stamps = wide && !gameDay ? played : []
  const mark = seriesMark({ season, round: 'worldseries' })

  return (
    <Card frame="stamped" label="Overview" stampIn={arrive} className={`ww-hero${arrive ? ' ww-hero--arrive' : ''}`} data-flip={flip ?? undefined}>
      <Stack gap="base">
        <div className="ww-hero__matchup">
          <div className="ww-hero__stage">
            <div className="ww-hero__split">
              <Slab side="away" clubId={order[0]} player={players[0]} />
              <Slab side="home" clubId={order[1]} player={players[1]} />
            </div>
            <div className="ww-hero__top">
              <ClubHead side="away" slot={slotOf[order[0]]} winsNeeded={series.winsNeeded} />
              <Stack gap="snug" className="ww-hero__crest">
                {mark ? <SeriesMark mark={mark} height={48} /> : <span className="ww-hero__words">World Series</span>}
                <span className="ww-hero__format">Best of seven</span>
              </Stack>
              <ClubHead side="home" slot={slotOf[order[1]]} winsNeeded={series.winsNeeded} />
            </div>
            <Stack gap="snug" className="ww-hero__focus">
              <span className="ww-hero__game">{gameNumber ? `Game ${gameNumber}` : 'World Series'}</span>
              {when[0] && <span className="ww-hero__date">{when[0]}</span>}
              {when[1] && <span className="ww-hero__time">{when[1]}</span>}
            </Stack>
            {count > 1 && (
              <>
                <button type="button" className="ww-hero__flip" onClick={nextPlayers} aria-label={`Show the next players: ${nextNames}`} />
                <span className="ww-hero__pager" aria-hidden="true">{`${at + 1} / ${count}`}</span>
              </>
            )}
          </div>
          <Stack gap="snug" className="ww-hero__spotlight" aria-live="polite">
            <Cluster gap="snug" className="ww-hero__spotlightlabel">Postseason spotlight</Cluster>
            <div className="ww-hero__pair">
              <Who side="away" player={players[0]} clip={clips[0]} onPlay={() => setOpen(clips[0])} />
              <Who side="home" player={players[1]} clip={clips[1]} onPlay={() => setOpen(clips[1])} />
            </div>
          </Stack>
        </div>
        <Stack gap="snug">
          <Cluster gap="base" rowGap="tight" align="baseline">
            <span className="ww-hero__month">{months}</span>
            <span className="ww-hero__schedulelabel">Series schedule</span>
            {days.some((d) => d.maybe) && <Key className="ww-hero__key" items={[{ label: 'If needed', mark: <span className="ww-hero__maybeswatch" aria-hidden="true" /> }]} />}
          </Cluster>
          <ScheduleStrip days={days} />
        </Stack>
        {/* The slate's own card for the next game replaces the door when the page hands one in
            (WorldSeriesHome); a page with no slate keeps the door. */}
        {gameCard}
        {!gameCard && !gameCardPending && nextPath && (
          <Door {...link(nextPath)} className="ww-hero__next">
            <span className="ww-hero__nexttext">
              <span className="ww-hero__nextname">{nextName}</span>
              <span className="ww-hero__nextwhen">{[`${teamClubNameShort(order[0])} at ${teamClubNameShort(order[1])}`, ...when].filter(Boolean).join(' · ')}</span>
            </span>
          </Door>
        )}
        {((wide && gameDay && umpire) || stamps.length > 0) && (
          <Cluster gap="base" className="ww-hero__doors">
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

// A decided Series (#2562; layout A, Gary 2026-10-27): this card replaces the result banner. It names
// the winner, carries the trophy, ends on final pips and a strip whose game cells show who won each
// one (decidedHero). Nothing is ahead, so there is no Next, no door and no "Best of seven". The
// Series MVP is the only player drawn (`mvp`, the finished page's); a side with none, or a page with
// no MVP known, keeps its club's mono mark. With an MVP, his cut-out stands on his club's side and his
// action photo fills the other side, where his tag, name, club and line from this Series (`stats`,
// mvpStatLine's [label, figure] pairs) sit at the foot of the stage. There is no MVP card.
const SIDES = ['away', 'home']

// `washBehind` (the home slate): the action photo sits behind the MVP's cut-out, not across the stage.
// `photo`: a Series photo URL that takes the MVP's side in place of the cut-out; `stripe`, two
// colours [outer, inner], edges it with a three-band club stripe.
export function DecidedHero({ mode, mvp = null, stats = [], washBehind = false, photo = null, stripe = null, markHeight = 32, scheduleTitle = null }) {
  // No face on file (an MVP from before MLB's photo archive): both sides fall back to the clubs' mono
  // marks, as SeriesMvpCard did, and his name and line still sit on the stage.
  const [noPhoto, setNoPhoto] = useState(false)
  const { series } = mode
  const hero = decidedHero(series, mvp)
  if (!hero) return null
  const ids = series.slots.map((s) => s.club.id)
  const slotOf = Object.fromEntries(series.slots.map((s) => [s.club.id, s]))
  const dates = series.games.map((g) => g.date).filter(Boolean)
  const mark = seriesMark({ season: Number(dates[0]?.slice(0, 4)), round: 'worldseries' })
  const mvpAt = hero.players.findIndex(Boolean)
  return (
    <Card frame="stamped" label="Overview" className={`ww-hero ww-hero--decided${mvpAt >= 0 ? ' ww-hero--mvp' : ''}`}>
      <Stack gap="base">
        <div className="ww-hero__matchup">
          <div className="ww-hero__stage">
            <div className="ww-hero__split">
              {mvpAt < 0 || noPhoto ? (
                <>
                  <Slab side="away" clubId={ids[0]} player={null} />
                  <Slab side="home" clubId={ids[1]} player={null} />
                </>
              ) : (
                SIDES.map((side, i) => (
                  <div key={side} className={`ww-hero__slab ww-hero__slab--${side}${i === mvpAt ? '' : ' ww-hero__slab--action'}`}>
                    {i === mvpAt ? (
                      photo ? (
                        <>
                          <img src={photo} alt="" className="ww-hero__photo" decoding="async" />
                          {stripe && <span className="ww-hero__stripe" aria-hidden="true" style={{ '--stripe-out': stripe[0], '--stripe-in': stripe[1] }} />}
                        </>
                      ) : <>
                        {washBehind && <Wash key={mvp.playerId} personId={mvp.playerId} />}
                        <Headshot personId={mvp.playerId} name={mvp.name} teamId={mvp.teamId} tint={false} hideFallback onFallback={(kind) => setNoPhoto(kind != null)} className="ww-hero__cut" />
                      </>
                    ) : (
                      !washBehind && <Wash key={mvp.playerId} personId={mvp.playerId} />
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="ww-hero__top">
              <ClubHead side="away" slot={slotOf[ids[0]]} winsNeeded={series.winsNeeded ?? 4} />
              <Stack gap="snug" className="ww-hero__crest">
                <img src="/brand/world-series-trophy.png" alt="" aria-hidden="true" className="ww-hero__trophy" />
                {mark ? <SeriesMark mark={mark} height={markHeight} /> : <span className="ww-hero__words">World Series</span>}
              </Stack>
              <ClubHead side="home" slot={slotOf[ids[1]]} winsNeeded={series.winsNeeded ?? 4} />
            </div>
            <Stack gap="snug" className="ww-hero__focus">
              <h2 className="ww-hero__game ww-hero__result">{`${teamClubNameShort(hero.winnerId)} win in ${hero.gamesPlayed}`}</h2>
            </Stack>
          </div>
          {mvpAt >= 0 && (
            <section className={`ww-hero__mvp ww-hero__mvp--${SIDES[1 - mvpAt]}`} aria-label="Series MVP">
              <span className="ww-hero__mvptag">Series MVP</span>
              <Cluster gap="snug" align="baseline">
                <PlayerLink id={mvp.playerId} className="ww-hero__mvpname">{mvp.name}</PlayerLink>
                <span className="ww-hero__mvpclub">{teamClubNameShort(mvp.teamId)}</span>
              </Cluster>
              {stats.length > 0 && (
                <dl className="ww-hero__mvpstats">
                  {stats.map(([k, v]) => (
                    <div key={k} className="ww-hero__mvpstat">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}
        </div>
        <Stack gap="snug">
          <Cluster gap="base" rowGap="tight" align="baseline">
            <span className="ww-hero__month">{scheduleTitle ?? monthsOf(hero.days)}</span>
            {!scheduleTitle && <span className="ww-hero__schedulelabel">Series schedule</span>}
          </Cluster>
          <ScheduleStrip days={hero.days} />
        </Stack>
      </Stack>
    </Card>
  )
}
