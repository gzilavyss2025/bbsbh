import { useCallback, useEffect, useRef, useState } from 'react'
import '../../../styles/gameday-next/scroll.css'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'

// A box whose words scroll inside it when they run past it (the checkpoint's game notes, the hero's play),
// so nothing is cut off with an ellipsis. While more is below, a chevron at the box's foot bounces (still
// under Motion: Reduced); a tap on it scrolls most of a box down. It hides at the end. `label` names the
// chevron for a screen reader ("More notes below").
export function ScrollCue({ label, className = '', children }) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)
  const check = useCallback(() => {
    const el = ref.current
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2)
  }, [])
  useEffect(() => {
    check()
    // The box and its words both: a font step inside changes the height without resizing the box.
    const ro = new ResizeObserver(check)
    if (ref.current) {
      ro.observe(ref.current)
      for (const c of ref.current.children) ro.observe(c)
    }
    return () => ro.disconnect()
  }, [check, children])
  const down = () => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.8, behavior: motionIsReduced() ? 'auto' : 'smooth' })
  return (
    <div className={['gdscroll', more && 'has-more', className].filter(Boolean).join(' ')}>
      <div ref={ref} className="gdscroll__in" onScroll={check}>{children}</div>
      {more && <button type="button" className="gdscroll__more" aria-label={label} onClick={down}><span aria-hidden="true" /></button>}
    </div>
  )
}
