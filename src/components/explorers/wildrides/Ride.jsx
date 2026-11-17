import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Headshot } from '../../player/Headshot.jsx'
import { HeaderBug } from '../../gamehud/HeaderBug.jsx'
import { ScrollCue } from '../../../screens/gameday/next/ScrollCue.jsx'
import { teamPrimaryColor } from '../../../lib/teams.js'
import { decodeState } from '../../../lib/wildrides/ride.js'
import { consequence } from '../../../lib/wildrides/story.js'
import { abbr, club, ord } from '../../../lib/explorers/copy.js'
import { Field, playBall, showCall } from './Field.jsx'
import { W, H, PX, PY, pathOf, monthDay } from './draw.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'

// THE RIDE: the win-probability line draws itself and pauses at each of the six biggest
// swings; the scorebug follows the dot play by play; the plate shows the swing as the feed
// called it, and the park plays the ball. Press and drag (or arrow keys) to scrub.

export function Ride({ game, chips, games, shape }) {
  const stat = shape.stat(game)
  const n = game.line.length
  const beatIdx = useMemo(() => game.beats.map((b) => Math.min(n - 1, b.idx)), [game, n])
  const [at, setAt] = useState(0)
  const [shown, setShown] = useState(0)
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0)
  const hold = useRef(0)
  const ballToken = useRef(0)
  const fieldRef = useRef(null)
  const state = useRef({ at: 0, shown: 0 })

  useEffect(() => {
    if (paused) return
    let raf
    let last = performance.now()
    const tick = (t) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(250, t - last)
      last = t
      if (t < hold.current) return
      const s = state.current
      if (s.at >= n - 1 && s.shown >= game.beats.length) return cancelAnimationFrame(raf)
      // about 4 seconds of line from first pitch to final out, plus the beat pauses
      s.at = Math.min(n - 1, s.at + (motionIsReduced() ? n : (dt * n) / 4000))
      if (s.shown < game.beats.length && beatIdx[s.shown] <= s.at) {
        s.at = beatIdx[s.shown]
        const b = game.beats[s.shown]
        s.shown++
        hold.current = Infinity
        const token = ++ballToken.current
        // a scrub or jump while this ball flies bumps the token, so its landing can't pause the new spot
        playBall(fieldRef.current, b, () => {
          if (token === ballToken.current) hold.current = performance.now() + (b.decider ? 900 : 350)
        })
        setShown(s.shown)
      }
      setAt(s.at)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, run, game])

  // Ride again: back to first pitch, and the loop (keyed on `run`) starts over.
  const replay = () => {
    ballToken.current++
    state.current = { at: 0, shown: 0 }
    hold.current = 0
    setAt(0)
    setShown(0)
    setPaused(false)
    setRun((r) => r + 1)
  }
  // Put the dot on play k: the pins, scorebug and plate follow; a ball in flight is dropped.
  const seek = (k) => {
    const sh = beatIdx.filter((bi) => bi <= k).length
    state.current = { at: k, shown: sh }
    ballToken.current++
    hold.current = 0
    setAt(k)
    setShown(sh)
    if (sh) showCall(fieldRef.current, game.beats[sh - 1])
  }
  // Scrubbing: press and drag along the chart; the ride pauses and the dot follows the finger.
  const scrubTo = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = -PX + ((e.clientX - r.left) / r.width) * (W + 2 * PX)
    seek(Math.max(0, Math.min(n - 1, Math.round((x / W) * (n - 1)))))
  }
  const scrubStart = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setPaused(true)
    scrubTo(e)
  }
  const scrubMove = (e) => {
    if (e.buttons) scrubTo(e)
  }
  // The keyboard's scrub: arrows step a play, Page keys an inning's worth, Home/End the ends.
  const scrubKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, PageUp: 6, PageDown: -6 }[e.key]
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : step != null ? Math.round(state.current.at) + step : null
    if (to == null) return
    e.preventDefault()
    setPaused(true)
    seek(Math.max(0, Math.min(n - 1, to)))
  }
  const jump = (i) => {
    ballToken.current++
    state.current = { at: Math.max(0, beatIdx[i] - 1), shown: i }
    hold.current = 0
    setShown(i)
    setAt(state.current.at)
    setPaused(false)
    // a finished ride's loop has stopped: start it again from the jumped-to play
    setRun((r) => r + 1)
  }

  const homeC = teamPrimaryColor(game.home) || 'var(--text-heading)'
  const awayC = teamPrimaryColor(game.away) || 'var(--text-caption)'
  const areaOf = (line, upto) => upto < 2 ? '' : `${pathOf(line, W, H, upto)}L${(((upto - 1) * W) / (n - 1)).toFixed(1)},${H / 2}L0,${H / 2}Z`
  // Where each inning starts on the line, from the per-play states (point k is the game after play k).
  const innings = useMemo(() => {
    const out = []
    ;(game.states ?? []).forEach((v, j) => {
      const inn = decodeState(v).inning
      const x = ((j + 1) * W) / (n - 1)
      if (!out.length || out.at(-1).inning !== inn) {
        if (out.length) out.at(-1).x1 = x
        out.push({ inning: inn, x0: out.length ? x : 0, x1: W })
      }
    })
    return out
  }, [game, n])
  // The scorebug follows the dot: the game after the play at this point on the line.
  const live = decodeState(game.states?.[Math.floor(at) - 1])
  const k = Math.floor(at)
  const done = at >= n - 1 && shown >= game.beats.length


  return (
    <article className="wr-card">
      {chips}
      <div className="wr-grid">
        <div className="wr-left">
          <div className="wr-top">
            <span className="wr-big">{stat.n}</span>
            <span className="wr-eyebrow">{stat.label}</span>
            <span className="wr-date">{monthDay(game.date)}, {game.date.slice(0, 4)} ›</span>
          </div>
          {games}
        </div>

        <div className="wr-right">
          <h2 className="wr-headline">{game.headline}.</h2>
          {/* Gameday's own scorebug (the one the longest at-bats card borrows), set to the game after this beat. */}
          <Bug
            game={game}
            away={done ? game.score[0] : live.away}
            home={done ? game.score[1] : live.home}
            inning={live.inning}
            top={live.top}
            outs={done ? 0 : live.outs}
            b1={!done && live.bases.first}
            b2={!done && live.bases.second}
            b3={!done && live.bases.third}
            final={done}
          />
          {/* A tug of war: the line splits the field at even odds, and each side fills in its own club's
              colour, so who was winning reads at a glance. Innings run along the foot. */}
          <div className="wr-stage" style={{ '--home-c': homeC, '--away-c': awayC }}>
            <div className="wr-stagehead">
              <span className="wr-side wr-side--home"><TeamLogo teamId={game.home} size={18} /> {club(game.home)} ahead</span>
              <div className="wr-ctl">
                <button onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
                <button onClick={replay} aria-label="Ride again">↺</button>
              </div>
            </div>
            <span className="wr-side wr-side--away"><TeamLogo teamId={game.away} size={18} /> {club(game.away)} ahead</span>
            <svg viewBox={`${-PX} ${-PY} ${W + 2 * PX} ${H + 2 * PY}`} className="wr-ride" onPointerDown={scrubStart} onPointerMove={scrubMove} onKeyDown={scrubKey} tabIndex={0} role="slider" aria-label="Win probability through the game. Drag, or use the arrow keys, to scrub." aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={Math.floor(at)} aria-valuetext={`${live.top ? "Top" : "Bottom"} of the ${ord(live.inning)}, ${abbr(game.away)} ${live.away}, ${abbr(game.home)} ${live.home}`}>
              <defs>
                <clipPath id={`wr-top-${game.gamePk}`}><rect x="0" y="0" width={W} height={H / 2} /></clipPath>
                <clipPath id={`wr-bot-${game.gamePk}`}><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath>
              </defs>
              {innings.map((t, i) => (
                <rect key={t.inning} x={t.x0} y="0" width={t.x1 - t.x0} height={H} className={`wr-band${i % 2 ? ' is-odd' : ''}${t.inning > 9 ? ' is-extra' : ''}`} />
              ))}
              <path d={areaOf(game.line, k + 1)} clipPath={`url(#wr-top-${game.gamePk})`} className="wr-area wr-area--home" />
              <path d={areaOf(game.line, k + 1)} clipPath={`url(#wr-bot-${game.gamePk})`} className="wr-area wr-area--away" />
              <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="wr-mid" />
              <path d={pathOf(game.line, W, H)} className="wr-ghost" />
              <path d={pathOf(game.line, W, H, k + 1)} className="wr-live" />
              <circle cx={(k * W) / (n - 1)} cy={(1 - (game.line[Math.min(k, n - 1)] ?? 50) / 100) * H} r="6" className="wr-dot" />
              {game.beats.slice(0, shown).map((b, i) => {
                const x = (beatIdx[i] * W) / (n - 1)
                const y = (1 - game.line[beatIdx[i]] / 100) * H
                // the number sits off the line, away from the middle, so neighbours don't collide
                const ty = y < H / 2 ? y - 16 : y + 24
                return (
                  <g
                    key={i}
                    className={`wr-pin${b.decider ? ' is-decider' : ''}${i === shown - 1 ? ' is-now' : ''}`}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                    onClick={(e) => {
                      e.stopPropagation()
                      jump(i)
                    }}
                  >
                    <circle cx={x} cy={y} r={b.decider ? 7 : 5} />
                    <text x={x} y={ty} textAnchor="middle">{i + 1}</text>
                  </g>
                )
              })}
            </svg>
            <div className="wr-axis">
              {innings.map((t) => (
                <span key={t.inning} style={{ left: `${(((t.x0 + t.x1) / 2 + PX) / (W + 2 * PX)) * 100}%` }} className={t.inning > 9 ? 'is-extra' : ''}>
                  {t.inning}
                </span>
              ))}
            </div>
          </div>
          <Plate game={game} shown={shown} fieldRef={fieldRef} />
        </div>
      </div>
    </article>
  )
}


// The scorebug, redrawn only when what it shows changes (the ride re-renders every frame).
const Bug = memo(function Bug({ game, away, home, inning, top, outs, b1, b2, b3, final }) {
  return (
    <div className="seasonnote__bug">
      <HeaderBug
        season={game.date.slice(0, 4)}
        awayName={abbr(game.away)}
        homeName={abbr(game.home)}
        awayTeamId={game.away}
        homeTeamId={game.home}
        awayRuns={away}
        homeRuns={home}
        inning={inning}
        half={top ? 'top' : 'bottom'}
        batter={null}
        pitcher={null}
        final={final}
        bases={{ first: b1, second: b2, third: b3 }}
        outs={outs}
      />
    </div>
  )
})

// The swing plate: the house At bat panel (the batting club's colour, its mono mark, the batter
// as a cutout) with the feed's call of the play and the park. Redrawn per swing, not per frame.
const Plate = memo(function Plate({ game, shown, fieldRef }) {
  const b = shown ? game.beats[shown - 1] : null
  const team = b ? (b.top ? game.away : game.home) : game.home
  return (
    <div
      className={`wr-plate${b ? '' : ' is-waiting'}`}
      aria-hidden={!b}
      // A club may colour a card that identifies the club (ADR-0030's addendum): the batting side's.
      style={{ '--side-club': teamPrimaryColor(team) || 'var(--surface-stamped-ink)' }}
    >
      <TeamLogo teamId={team} size={120} variant="mono" className="wr-plate-mark" />
      {b ? (
        <Headshot personId={b.batter.id} name={b.batter.name} teamId={team} className="wr-cap-face" />
      ) : (
        <TeamLogo teamId={game.home} size={44} />
      )}
      <div className="wr-plate-text">
        <span className="wr-plate-kicker">
          {b ? `${b.top ? 'Top' : 'Bottom'} of the ${ord(b.inning)} · ${consequence(b, game)}` : 'First pitch'}
        </span>
        {/* The play as the feed called it, word for word. */}
        <ScrollCue label="More of the play below" className="wr-plate-scroll">
          <p className="wr-plate-play">{b ? b.desc : ''}</p>
        </ScrollCue>
      </div>
      <div className="wr-inset">
        <Field ref={fieldRef} game={game} />
      </div>
    </div>
  )
})
