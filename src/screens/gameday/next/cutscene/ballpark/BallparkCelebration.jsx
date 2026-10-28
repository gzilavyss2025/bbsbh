import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { HOME_RUN_ART, STADIUM_URL, prepareArt, preparedArt } from './assets.js'
import { HOME_RUN, advanceTime, momentAt } from './choreography.js'
import { HEIGHT, WIDTH, drawBallpark } from './drawBallpark.js'
import '../../../../../styles/gameday-next/ballpark.css'

// Standalone reviewable cutscene, not mounted on a scoring surface. `time` is a
// controlled frozen frame for scrubbing/strips; omit it for a one-shot playback.
// A new event supplies an authored `track` rather than branching on player data.
// Replay remounts the scene (a new `run`), so a keyboard press hands focus to the
// new Skip through this flag; a scene that ends with Skip focused moves it to Replay.
let focusSkipOnMount = false

export function BallparkCelebration({
  headline = 'Home run', name = '', helmet, trim, track = HOME_RUN,
  character = HOME_RUN_ART, backdrop = STADIUM_URL,
  time, playing = false, rate = 1, reduced = false, onTime, onDone, onSkip, onReplay, onError,
}) {
  const canvas = useRef(null), host = useRef(null), skip = useRef(null), again = useRef(null), skipFocused = useRef(false)
  const artKey = `${JSON.stringify(character)}:${backdrop}:${helmet ?? ''}:${trim ?? ''}`
  const [loaded, setLoaded] = useState(() => {
    const ready = helmet && trim ? preparedArt(helmet, trim, character, backdrop) : null
    return ready ? { key: artKey, art: ready, failed: false } : null
  })
  const art = loaded?.key === artKey ? loaded.art : null
  const failed = loaded?.key === artKey && loaded.failed
  const [moment, setMoment] = useState(() => momentAt(time ?? 0, track))
  const [lessMotion, setLessMotion] = useState(motionIsReduced)
  const callbacks = useRef({ onTime, onDone, onError })
  const playhead = useRef(time ?? 0), completed = useRef(false)
  useEffect(() => { callbacks.current = { onTime, onDone, onError } }, [onTime, onDone, onError])
  const showSkip = !!onSkip, showReplay = !!onReplay && !!art && !reduced && !lessMotion
  useEffect(() => {
    if (showSkip && focusSkipOnMount) { focusSkipOnMount = false; skip.current?.focus() }
  }, [showSkip])
  useEffect(() => {
    if (showReplay && skipFocused.current && document.activeElement === document.body) again.current?.focus()
    skipFocused.current = false
  }, [showReplay])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setLessMotion(motionIsReduced())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    query.addEventListener('change', update)
    return () => { query.removeEventListener('change', update); observer.disconnect() }
  }, [])
  useEffect(() => {
    let cancelled = false
    const style = getComputedStyle(host.current)
    prepareArt(helmet || style.getPropertyValue('--stage-kit-navy').trim(), trim || style.getPropertyValue('--stage-kit-trim').trim(), character, backdrop)
      .then((next) => { if (!cancelled) setLoaded({ key: artKey, art: next, failed: false }) })
      .catch((error) => {
        if (!cancelled) { setLoaded({ key: artKey, art: null, failed: true }); callbacks.current.onError?.(error) }
      })
    return () => { cancelled = true }
  }, [helmet, trim, character, backdrop, artKey])
  useEffect(() => {
    if (!art) {
      if (failed && playing) callbacks.current.onDone?.()
      return undefined
    }
    const g = canvas.current.getContext('2d')
    const style = getComputedStyle(host.current)
    const colors = { outline: style.getPropertyValue('--stage-outline').trim(), chalk: style.getPropertyValue('--stage-chalk').trim() }
    const still = reduced || lessMotion
    let id = 0, previous = null
    if (time != null) { playhead.current = time; completed.current = false }
    const paint = (t) => {
      const m = drawBallpark(g, art, t, { track, still, colors })
      setMoment((before) => before.frame === m.frame && before.caption === m.caption && before.ended === m.ended ? before : m)
    }
    const finish = () => {
      if (!completed.current) { completed.current = true; callbacks.current.onDone?.() }
    }
    if (still) {
      paint(track.duration)
      if (playing) { callbacks.current.onTime?.(track.duration); finish() }
      return undefined
    }
    paint(playhead.current)
    if (!playing || time != null) return undefined
    // Pause while the tab is hidden, including its first returning frame. The
    // animation clock starts after decode; network time cannot eat the action.
    const tick = (now) => {
      if (document.hidden) previous = null
      else {
        const delta = previous == null ? 0 : (now - previous) / 1000
        playhead.current = advanceTime(playhead.current, delta, rate, track)
        previous = now
        paint(playhead.current)
        callbacks.current.onTime?.(playhead.current)
      }
      if (playhead.current >= track.duration) finish()
      else id = requestAnimationFrame(tick)
    }
    const visibility = () => { previous = null }
    document.addEventListener('visibilitychange', visibility)
    id = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', visibility) }
  }, [art, failed, time, playing, rate, track, reduced, lessMotion])
  return (
    <div ref={host} className="ballpark" data-frame={moment.frame} data-ready={!!art}>
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="ballpark__canvas" role="img" aria-label={`${headline}${name ? ` — ${name}` : ''}`} />
      <div className="ballpark__shade" aria-hidden="true" />
      <div className="ballpark__caption" aria-hidden="true" data-shown={moment.caption || reduced || lessMotion}>
        <p className="ballpark__headline">{headline}</p>
        {name && <p className="ballpark__name">{name}</p>}
      </div>
      {!art && <p className="ballpark__loading" role="status">{failed ? 'Celebration art could not load.' : 'Loading celebration…'}</p>}
      {showSkip && <Button ref={skip} skin="ghost" className="ballpark__skip" onClick={onSkip}
        onFocus={() => { skipFocused.current = true }} onBlur={(e) => { if (e.relatedTarget) skipFocused.current = false }}>Skip</Button>}
      {showReplay && <Button ref={again} skin="ghost" className="ballpark__replay"
        onClick={(e) => { focusSkipOnMount = document.activeElement === e.currentTarget; onReplay() }}>Replay</Button>}
    </div>
  )
}
