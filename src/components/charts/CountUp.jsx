import { createContext, useContext, useEffect, useState } from 'react'
import { motionIsReduced } from '../../hooks/preferences/motionIsReduced.js'

// How long the opened ball-flight card's ball takes to land, in ms (BallFlight.jsx sets it): every
// CountUp inside ticks up over the same time, so the numbers finish as the ball arrives (Gary,
// 2026-10-29). Null (the default) draws the figure as it is, with no count.
export const FlightClock = createContext(null)

// A figure that counts up from zero to `value`, keeping its written form: ".120" counts as .000 to
// .120, "58.0" keeps one decimal, "12°" keeps its degree mark. Text that holds no number (a dash)
// draws as it is. Ease-out, so it slows into the final figure; none under reduced motion.
export function CountUp({ value }) {
  const ms = useContext(FlightClock)
  const text = String(value ?? '')
  const m = /^(\D*?)(\d*)(\.?)(\d*)(.*)$/.exec(text)
  const target = m && (m[2] || m[4]) ? Number(`${m[2] || '0'}.${m[4] || '0'}`) : null
  const animate = Boolean(ms) && target != null && !motionIsReduced()
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!animate) return undefined
    let raf
    const start = performance.now()
    const tick = (now) => {
      const k = Math.min(1, (now - start) / ms)
      setT(1 - (1 - k) ** 3)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, ms, target])
  if (!animate || t >= 1) return text
  const [, pre, int, dot, dec, post] = m
  const shown = (target * t).toFixed(dec.length)
  // A rate written without its leading zero (".120") stays without it while it counts.
  return `${pre}${int ? shown : shown.replace(/^0/, '')}${dot && !dec ? '.' : ''}${post}`
}
