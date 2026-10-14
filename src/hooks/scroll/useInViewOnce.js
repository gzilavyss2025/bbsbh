import { useEffect, useRef, useState } from 'react'
import { motionIsReduced } from '../preferences/motionIsReduced.js'
import { firstPhase, markSeen } from '../../lib/motion/inViewOnce.js'

// How much of the block must show before its entrance plays: a tenth, so a tall
// card starts as its top edge clears the fold. No rootMargin: the entrance plays
// where the reader can see it, never before.
export const IN_VIEW_THRESHOLD = 0.1

const canObserve = () => typeof IntersectionObserver !== 'undefined'
const startFor = (key) => ({ key, phase: firstPhase(key, { canObserve: canObserve(), reduced: motionIsReduced() }) })

// [ref, phase] for one block on the player page (#2073). Put `ref` on the element
// that wears the entrance class, and pick the class from `phase` ('rest', 'wait'
// or 'play'; riseClass() in lib/motion/inViewOnce.js maps the shared rise).
// `key` is viewKey(playerId, slotKey). The rule and its reasons are in
// lib/motion/inViewOnce.js and docs/motion.md, "The one-shot gate".
export function useInViewOnce(key) {
  const ref = useRef(null)
  const [held, setHeld] = useState(() => startFor(key))

  // A new key (another player on the same mounted page) starts over. State
  // adjusted during render, the same escape hatch hooks/motion/useBecameTrue.js
  // uses, so the committed DOM never carries the old key's phase.
  let { phase } = held
  if (held.key !== key) {
    const next = startFor(key)
    phase = next.phase
    setHeld(next)
  }

  useEffect(() => {
    if (phase !== 'wait') return undefined
    const node = ref.current
    if (!node) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        markSeen(key)
        setHeld({ key, phase: 'play' })
      },
      { threshold: IN_VIEW_THRESHOLD },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [key, phase])

  return [ref, phase]
}
