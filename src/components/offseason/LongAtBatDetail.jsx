import { useEffect, useMemo, useRef, useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { findLongAtBat } from '../../api/notebook.js'
import { getJson } from '../../api/statsapi.js'
import { StrikeZone } from '../scoring/StrikeZone.jsx'
import { pitchCardInfo } from '../../api/playbyplay/pitchInfo.js'
import { fallbackFigureUrls } from '../../api/uniforms.js'
import { BatterFallbackContext } from '../logo/uniformContexts.js'
import { HeaderBug } from '../gamehud/HeaderBug.jsx'
import { PitchScene } from '../playbyplay/pitcherCard/PitchScene.jsx'
import { atBatScenePitches, atBatZone } from '../../lib/pitcherCard/atBat.js'
import { Button } from '../ui/control/Button.jsx'
import { teamPrimaryColor } from '../../lib/teams.js'
import { motionIsReduced } from '../../hooks/preferences/motionIsReduced.js'
import { lastName, ord } from '../../lib/explorers/copy.js'

const PITCH_MS = 650

// The at-bat said the way a beat writer would on its last pitch: who won it, on which pitch.
// A walk or strikeout says it all; anything else is followed by the feed's own call.
export function atBatLine(row, event) {
  const b = lastName(row.batter.name)
  const p = lastName(row.pitcher.name)
  const n = ord(row.pitches)
  const e = event ?? ''
  if (/walk/i.test(e)) return `${b} outlasted ${p} and walked on the ${n} pitch.`
  if (/strikeout/i.test(e)) return `${p} finally got ${b} on the ${n} pitch.`
  if (/hit by pitch/i.test(e)) return `${b} was hit on the ${n} pitch.`
  if (/error|interference/i.test(e)) return `${b} reached on the ${n} pitch.`
  const hit = { Single: 'singled', Double: 'doubled', Triple: 'tripled', 'Home Run': 'homered' }[e]
  if (hit) return `${b} ${hit} on the ${n} pitch.`
  return `${p} won it on the ${n} pitch.`
}
const SAYS_IT_ALL = /walk|strikeout/i

// The longest at-bats card's picked at-bat (LongAtBats.jsx): Gameday's scorebug
// and the zone with its replay. Its own chunk, loaded lazily: the zone, the
// pitch scene and the scorebug are about 16 kB gzip the home page's first load
// does not need, and nothing here draws before its play-by-play read anyway.

// The longest at-bat's pitches on the Gameday zone. The census file keeps no
// at-bat index, so the game's play-by-play is read and the plate appearance
// found by its batter, pitcher and length. Nothing until it arrives.
// One request per at-bat: the scorebug and the zone both ask for it.
const atBats = new Map()
function fetchAtBat(row) {
  const k = `${row.pk}-${row.batter.id}-${row.pitcher.id}-${row.pitches}`
  if (!atBats.has(k)) atBats.set(k, readAtBat(row))
  return atBats.get(k)
}
// Only the fields this card reads (the pitch card, the scorebug, the result): about 42%
// of the full play-by-play (610 KB -> 352 KB a game, measured on the 2026 top eight). The
// pitch list, count and calls come back identical to the untrimmed feed on those games.
// statsapi's `fields=` matches key names at any depth, so every name on a path is listed.
const AT_BAT_FIELDS = [
  'allPlays', 'about', 'halfInning', 'inning', 'atBatIndex', 'isTopInning', 'result', 'event', 'eventType',
  'description', 'awayScore', 'homeScore', 'count', 'balls', 'strikes', 'outs', 'matchup', 'batter', 'pitcher',
  'id', 'fullName', 'batSide', 'pitchHand', 'code', 'postOnFirst', 'postOnSecond', 'postOnThird', 'playEvents',
  'isPitch', 'pitchNumber', 'playId', 'details', 'call', 'type', 'pitchData', 'coordinates', 'pX', 'pZ', 'aX',
  'aY', 'aZ', 'vX', 'vY', 'vZ', 'x0', 'y0', 'z0', 'pfxX', 'pfxZ', 'strikeZoneTop', 'strikeZoneBottom',
  'startSpeed', 'endSpeed', 'extension', 'breaks', 'breakHorizontal', 'breakVerticalInduced', 'spinRate',
  'hitData', 'coordX', 'coordY', 'launchAngle', 'launchSpeed', 'totalDistance', 'trajectory', 'reviewDetails',
  'isOverturned', 'inProgress', 'reviewType', 'challengeTeamId', 'player',
].join(',')

async function readAtBat(row) {
  const feed = await getJson(`/api/v1/game/${row.pk}/playByPlay?fields=${AT_BAT_FIELDS}`).catch(() => null)
  const play = findLongAtBat(feed?.allPlays, row)
  if (!play) return null
  // The game as the at-bat began: the play before it carries the score, and,
  // in the same half, the outs and the runners.
  const at = feed.allPlays.indexOf(play)
  const prev = feed.allPlays[at - 1]
  const same = prev && prev.about?.inning === play.about?.inning && prev.about?.halfInning === play.about?.halfInning
  const bug = {
    away: prev?.result?.awayScore ?? 0,
    home: prev?.result?.homeScore ?? 0,
    inning: play.about?.inning,
    top: play.about?.halfInning === 'top',
    outs: same ? prev.count?.outs ?? 0 : 0,
    bases: same ? ['postOnFirst', 'postOnSecond', 'postOnThird'].map((k) => !!prev.matchup?.[k]) : [false, false, false],
  }
  return { bug, result: play.result?.description ?? null, event: play.result?.event ?? null, pitchDetails: pitchCardInfo(feed, play).pitchDetails, batSide: play.matchup?.batSide?.code ?? 'R', pitchHand: play.matchup?.pitchHand?.code ?? 'R' }
}

// Gameday's own scorebug, set to the game as the at-bat began.
export function Scorebug({ row }) {
  const { data } = useAsync(() => fetchAtBat(row), [row.pk, row.batter.id, row.pitches])
  const b = data?.bug
  if (!b) return null
  const [first, second, third] = b.bases
  return (
    <div className="seasonnote__bug">
      <HeaderBug
        season={row.date?.slice(0, 4)}
        awayName={row.away.abbr}
        homeName={row.home.abbr}
        awayTeamId={row.away.id}
        homeTeamId={row.home.id}
        awayRuns={b.away}
        homeRuns={b.home}
        inning={b.inning}
        half={b.top ? 'top' : 'bottom'}
        batter={null}
        pitcher={null}
        bases={{ first, second, third }}
        outs={b.outs}
      />
    </div>
  )
}

// The zone, a card for whichever pitch dot the pointer is on, and how the
// at-bat ended under it.
export function AtBatZone({ row }) {
  const { data } = useAsync(() => fetchAtBat(row), [row.pk, row.batter.id, row.pitches])
  const [tip, setTip] = useState(null)
  // The pitch-tracking replay: null shows the zone, an object plays the at-bat
  // through PitchScene's at-bat look (a new object replays it).
  const [play, setPlay] = useState(null)
  const scene = useMemo(() => (data ? atBatScenePitches(data.pitchDetails, 'hitter', data.batSide) : []), [data])
  // The ride: the pitches land one at a time; the strip under the zone scrubs them.
  const total = data?.pitchDetails.length ?? 0
  const [ride, setRide] = useState({ at: 0, paused: false, run: 0 })
  const laneRef = useRef(null)
  const at = Math.min(ride.at, Math.max(0, total - 1))
  // Under reduced motion the ride doesn't play: the whole at-bat shows until a pitch is picked.
  const shownAt = motionIsReduced() && !ride.paused ? Math.max(0, total - 1) : at
  const atEnd = at >= total - 1
  // The timer stops at the last pitch rather than ticking on unchanged.
  useEffect(() => {
    if (!total || ride.paused || atEnd || motionIsReduced()) return undefined
    const t = setInterval(() => setRide((r) => (r.at >= total - 1 ? r : { ...r, at: r.at + 1 })), PITCH_MS)
    return () => clearInterval(t)
  }, [total, ride.paused, ride.run, atEnd])
  // Keep the pitch being shown in view as the lane scrolls (the ride, a drag, the arrow keys).
  useEffect(() => {
    const lane = laneRef.current
    const mark = lane?.children[shownAt]
    if (!lane || !mark) return
    const left = mark.offsetLeft - lane.clientWidth / 2 + mark.offsetWidth / 2
    lane.scrollTo({ left, behavior: motionIsReduced() ? 'auto' : 'smooth' })
  }, [shownAt])
  if (!data) return null
  const goTo = (i) => setRide((r) => ({ ...r, at: Math.max(0, Math.min(total - 1, i)), paused: true }))
  // The mark nearest the pointer's x, so a drag scrubs whatever the lane has scrolled to.
  const scrubAt = (e) => {
    const marks = [...(laneRef.current?.children ?? [])]
    let best = 0
    let d = Infinity
    marks.forEach((m, i) => {
      const b = m.getBoundingClientRect()
      const dd = Math.abs(b.left + b.width / 2 - e.clientX)
      if (dd < d) { d = dd; best = i }
    })
    goTo(best)
  }
  const now = data.pitchDetails[shownAt]
  const done = shownAt >= total - 1
  const playing = !ride.paused && !done && !motionIsReduced()
  const side = row.batter.teamId === row.away?.id ? 'away' : 'home'
  const figures = fallbackFigureUrls(row.batter.teamId, side, data.batSide === 'L' ? 'left' : 'right')
  const onMove = (e) => {
    const no = Number(e.target.closest('g')?.querySelector('.strikezone__num')?.textContent)
    const p = no ? data.pitchDetails.find((d) => d.no === no) : null
    if (!p) return setTip(null)
    const box = e.currentTarget.getBoundingClientRect()
    setTip({ p, x: e.clientX - box.left, y: e.clientY - box.top })
  }
  return (
    <div className="seasonnote__zonecol">
      <div className="seasonnote__zonewrap" onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
        {play ? (
          <div className="seasonnote__scene">
            <PitchScene
              pitches={scene}
              lefty={data.pitchHand === 'L'}
              name={row.pitcher.name}
              zone={atBatZone(data.pitchDetails)}
              atBat={scene.length}
              play={play}
            />
          </div>
        ) : (
          <BatterFallbackContext.Provider value={figures}>
            <StrikeZone pitchDetails={data.pitchDetails.slice(0, shownAt + 1)} batSide={data.batSide} className="seasonnote__zone" margin={0.6} />
          </BatterFallbackContext.Provider>
        )}
        {scene.length > 0 && (
          <Button
            size="control"
            skin="ink"
            className="seasonnote__play"
            onClick={() => setPlay(play ? null : { all: true })}
          >
            {play ? 'Zone' : '▶ Play'}
          </Button>
        )}
        {tip && (
          <div className="seasonnote__tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <span className={`pitchlist__num pitchlist__num--${tip.p.cat}`}>{tip.p.no}</span>
            <div>
              <p className="seasonnote__tiptype">{tip.p.type || 'Pitch'}</p>
              <p className="seasonnote__tipmeta">
                {tip.p.mph != null ? `${tip.p.mph} MPH · ` : ''}
                {tip.p.callDesc}
              </p>
              {tip.p.balls != null && (
                <p className="seasonnote__tipmeta">
                  Count {tip.p.balls}-{tip.p.strikes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {/* The pitch log: one mark per pitch in the zone's colours; tap, drag or arrow to scrub. */}
      <div
        className="seasonnote__strip"
        role="slider"
        tabIndex={0}
        aria-label="Pitches of the at-bat"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={shownAt + 1}
        aria-valuetext={now ? `Pitch ${now.no}, ${now.callDesc}` : ''}
        onKeyDown={(e) => {
          const d = { ArrowRight: 1, ArrowLeft: -1, Home: -total, End: total }[e.key]
          if (d == null) return
          e.preventDefault()
          goTo(shownAt + d)
        }}
        onPointerDown={(e) => {
          if (e.target.closest('button')) return
          e.currentTarget.setPointerCapture?.(e.pointerId)
          scrubAt(e)
        }}
        onPointerMove={(e) => e.buttons && scrubAt(e)}
      >
        {/* The marks scroll in their own lane; the two controls stay pinned at the end. */}
        <div className="seasonnote__lane" ref={laneRef}>
        {data.pitchDetails.map((p, i) => (
          <span
            key={p.no}
            className={`pitchlist__num pitchlist__num--${p.cat} seasonnote__mark${i < shownAt ? ' is-past' : i === shownAt ? ' is-now' : ''}`}
          >
            {p.no}
          </span>
        ))}
        </div>
        <span className="seasonnote__stripctl">
          {/* Playing: pause. Paused or finished: play, from the top when at the last pitch. */}
          <button
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => setRide((r) => (playing ? { ...r, paused: true } : { at: done ? 0 : r.at, paused: false, run: r.run + 1 }))}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button type="button" aria-label="Replay the at-bat" onClick={() => setRide((r) => ({ at: 0, paused: false, run: r.run + 1 }))}>
            ↺
          </button>
        </span>
      </div>
      {now && (
        <div
          className="seasonnote__result seasonnote__result--club"
          // A club may colour a card that identifies the club (ADR-0030's addendum): the batter's.
          style={{ '--side-club': teamPrimaryColor(row.batter.teamId) || 'var(--surface-stamped-ink)' }}
        >
          <p className="t-label t-label--bold seasonnote__what">
            Pitch {now.no} of {total}
            {now.balls != null ? ` · ${now.balls}-${now.strikes}` : ''}
          </p>
          <p className="seasonnote__resulttext">
            {done
              ? `${atBatLine(row, data.event)}${SAYS_IT_ALL.test(data.event ?? '') || !data.result ? '' : ` ${data.result}`}`
              : `${now.callDesc || 'Pitch'}${now.type ? ` · ${now.type}` : ''}${now.mph != null ? ` · ${now.mph} mph` : ''}`}
          </p>
        </div>
      )}
    </div>
  )
}
