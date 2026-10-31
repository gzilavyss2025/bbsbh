import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNearView } from '../../../hooks/scroll/useNearView.js'
import { useInViewOnce } from '../../../hooks/scroll/useInViewOnce.js'
import { riseClass, viewKey } from '../../../lib/motion/inViewOnce.js'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SlotBoundary } from './SlotBoundary.js'

// Runs once the module has mounted. A module that rendered nothing has no data. A module
// that shows content (nothing inside it says aria-busy) is ready: the slot drops its
// height hold. It sits beside the module inside its Suspense boundary, so it commits with it.
function Probe({ bodyRef, onEmpty, onReady }) {
  useEffect(() => {
    const body = bodyRef.current
    if (!body?.firstChild) {
      onEmpty()
      return undefined
    }
    if (typeof MutationObserver === 'undefined') {
      onReady()
      return undefined
    }
    const watch = new MutationObserver(() => check())
    const check = () => {
      if (body.querySelector('[aria-busy="true"]')) return
      watch.disconnect()
      onReady()
    }
    watch.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] })
    check()
    return () => watch.disconnect()
  }, [bodyRef, onEmpty, onReady])
  return null
}

// One slot of the new player page (#1884): a stamped Card with its name tab and
// count tag, around a module that loads when the slot comes near. The module owns
// its data; the slot owns the card, the hide-when-empty rule and the height hold.
// Until the module shows content the card holds `inst.minH` (sections.js) and
// shows no text, so the page does not jump. The body rises in the first time the
// card comes into view. The page tells the jump bar through `onEmpty`.
export function Slot({ inst, bio, asOf, season, onEmpty, stamp = 0, order = 0 }) {
  const [nearRef, near] = useNearView()
  const [viewRef, phase] = useInViewOnce(viewKey(bio.id, inst.key))
  const [Module] = useState(() => lazy(inst.load))
  const [count, setCount] = useState()
  const [held, setHeld] = useState(true)
  const bodyRef = useRef(null)
  // The jump bar's stamp (decision 3): the card stamps in once for each landing on its
  // section. `stamped` is the landing whose stamp has played; the class stays off until
  // the next one. State is derived in render, never set in an effect.
  const [stamped, setStamped] = useState(0)
  const stamping = stamp > 0 && stamp !== stamped
  const [report] = useState(() => () => onEmpty(inst.key))
  const [ready] = useState(() => () => setHeld(false))
  const [phone, wide] = inst.minH ?? [0, 0]
  return (
    <Card
      frame="stamped"
      label={inst.label}
      count={count}
      ref={(el) => {
        nearRef.current = el
        viewRef.current = el
      }}
      className={`pnext__slot${held ? ' pnext__slot--hold' : ''}`}
      aria-busy={held || undefined}
      stampIn={stamping}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'card-stamp-in') setStamped(stamp)
      }}
      style={{
        '--slot-hold': `${phone}px`,
        '--slot-hold-wide': `${wide}px`,
        ...(stamping ? { '--stamp-delay': `calc(var(--stagger-step) * ${order})` } : null),
      }}
      data-pair={inst.pair}
    >
      {near && (
        <SlotBoundary slotKey={inst.key} onFail={report}>
          <Suspense fallback={null}>
            <div ref={bodyRef} className={held ? undefined : riseClass(phase) || undefined}>
              <Module
                bio={bio}
                role={inst.role}
                asOf={asOf}
                season={season}
                section={inst.section}
                onEmpty={report}
                onCount={setCount}
              />
            </div>
            <Probe bodyRef={bodyRef} onEmpty={report} onReady={ready} />
          </Suspense>
        </SlotBoundary>
      )}
    </Card>
  )
}
