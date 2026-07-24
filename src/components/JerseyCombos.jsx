import { useRef } from 'react'
import { TeamTreatmentMark } from './TeamTreatmentMark.jsx'
import { SectionTitle } from './SectionTitle.jsx'

// A horizontal, touch-draggable strip of one club's logo/jersey combinations —
// every jersey in its uniform catalog, each shown as the logo TREATMENT it's
// worn with (the same tinted "main logo card" tile the slate cards and Team
// Color Lab use, via TeamTreatmentMark) over the jersey's name, with the
// club's record in the games it actually wore that jersey underneath. A jersey
// maps to exactly one logo, but several jerseys can share one (Home White and
// Road Grey are both the Main mark), so a logo repeats down the strip once per
// jersey assigned to it — see buildJerseyCombos (src/api/uniforms.js).
//
// Touch drag is native (overflow-x + momentum scrolling); useDragScroll adds
// click-and-drag panning for a mouse so the strip works the same on desktop.
// Spoiler-free: uniform choices plus a record the standings already show.

// A W-L record as "45–30" (en dash), or an em dash when the club hasn't been
// seen in a posted jersey yet (no attributable game) so an unworn/newly-added
// jersey reads as "no games" rather than a misleading 0–0.
function recordLabel({ wins, losses }) {
  return wins + losses === 0 ? '—' : `${wins}–${losses}`
}

// Click-and-drag horizontal panning for a pointer (mouse/trackpad). Touch and
// trackpad-swipe already scroll the overflow container natively, so this only
// arms on a real drag: it grabs the scroller on pointerdown, pans by the
// pointer delta, and suppresses the click that would otherwise fire on a card
// if the pointer actually moved (a plain click still selects text/links).
function useDragScroll() {
  const ref = useRef(null)
  const state = useRef({ down: false, moved: false, startX: 0, startLeft: 0 })

  const onPointerDown = (e) => {
    // Left button / touch only; let the browser own everything else.
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (e.pointerType !== 'mouse') return // native touch scrolling handles this
    const el = ref.current
    if (!el) return
    state.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft }
  }
  const onPointerMove = (e) => {
    const s = state.current
    const el = ref.current
    if (!s.down || !el) return
    const dx = e.clientX - s.startX
    if (Math.abs(dx) > 3) s.moved = true
    if (s.moved) {
      el.scrollLeft = s.startLeft - dx
      el.setPointerCapture?.(e.pointerId)
    }
  }
  const endDrag = () => {
    state.current.down = false
  }
  const onClickCapture = (e) => {
    // Swallow the click that ends a genuine drag so a card underneath the
    // cursor doesn't also register a tap.
    if (state.current.moved) {
      e.stopPropagation()
      e.preventDefault()
      state.current.moved = false
    }
  }

  return {
    ref,
    dragging: state,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
    },
  }
}

export function JerseyCombos({ combos, teamId, teamName }) {
  const { ref, handlers } = useDragScroll()
  if (!combos?.length) return null
  return (
    <>
      <SectionTitle title="Logos & jerseys" note="record by jersey" />
      <div className="jerseystrip" ref={ref} {...handlers}>
        {combos.map((c) => (
          <div key={c.code ?? c.name} className="jerseycombo">
            <TeamTreatmentMark
              teamId={teamId}
              name={teamName}
              treatment={c.treatment}
              size={56}
              block="jerseycombo__logobox"
            />
            <span className="jerseycombo__name">{c.name}</span>
            <span className="jerseycombo__rec mono">{recordLabel(c)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
