import { useEffect, useRef, useState } from 'react'
import { useNav } from '../../lib/nav.js'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { countLabel, currentSection, holdStep, scrollLeftToShow } from '../../lib/jumpbar/spy.js'
import { motionIsReduced } from '../../hooks/preferences/motionIsReduced.js'

// The tab bar under a hub's pinned identity header. ONE control, two shapes —
// the team hub's tabs (screens/team/TeamTabBar.jsx) and the player page's jump
// bar (variant="anchor", below) — so the two can never drift into two
// different-looking strips. It owns the markup and the `.teamtabs` classes
// (styles/46-consent-modal.css) and nothing else; each caller supplies its own
// tab list and its own path builder.
//
// Every tab is a REAL route (a path builder -> useNav -> pushState), not local
// state: the URL changes, browser back/forward step through tabs, and any tab is
// shareable. That is also what keeps each tab loading only its own data.
//
// The control is deliberately NOT club-coloured, on either hub. `.teamtabs__btn`
// inks its active tab from `--accent-primary`, the app's own navy, even on a page
// whose header wears a club's triad — ADR-0030's rule that a club may colour a
// card that identifies the club, never a CONTROL.
//
// Labels are written in ordinary sentence case; the ALL-CAPS invariant does the
// uppercasing in CSS (see the block comment in src/styles/01-base.css).
//
// `variant="anchor"` is the JUMP BAR (#1883, docs/player-redesign.md section 3):
// the same control on a one-scroll page, where each button scrolls to a section
// and the section in view marks its button current. See JumpBar below.
export function HubTabBar(props) {
  return props.variant === 'anchor' ? <JumpBar {...props} /> : <RouteTabBar {...props} />
}

function RouteTabBar({ tabs, active, ariaLabel, pathFor }) {
  const navigate = useNav()

  return (
    <nav className="teamtabs" aria-label={ariaLabel}>
      <div className="teamtabs__row">
        {tabs.map((t) => {
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              type="button"
              className={`teamtabs__btn ${isActive ? 'is-active' : ''}`.trim()}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => !isActive && navigate(pathFor(t.key))}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// A section counts as current once its top is this far past the line.
const SLACK = 24
// How long the tap's own scroll may pause before the scroll-spy takes over.
const HOLD_MS = 250

// The tap's hold on the mark, read and renewed by the scroll-spy. A helper
// outside the component: the React compiler lint rejects Date.now() inline.
const holdFor = () => ({ until: Date.now() + HOLD_MS })

// THE JUMP BAR. Square buttons with a count badge; the current one is ink.
// Under 740px it is one row that scrolls sideways; at 740px and up it wraps in
// a bordered box (styles/system/jumpbar/jumpbar.css).
//
//   tabs        [{ key, label, count }] in page order. `key` is the id of the
//               section element. `count` is a number, a string, or absent (the
//               badge shows a dot). A section with no data gets NO entry: the
//               caller filters the list, this control never hides a button.
//   ariaLabel   the nav's name.
//   scrollRoot  optional ref to the element that scrolls. Absent, the window.
//   offset      optional px of sticky chrome over the scroll area's top edge.
//               A tap lands the section this far down; the spy reads the line
//               there too.
//   className   optional namespace for the caller (for example, sticky).
//
// Three rules hold it together:
// 1. The bar scrolls ITSELF to keep the current button in view. On a tab bar
//    the current tab is where the reader tapped. Here it moves when the page
//    scrolls, so it can sit off the end of a bar nobody touched.
// 2. A tap marks its button at once and holds the mark while its own smooth
//    scroll runs past the other sections. The hold ends when the scroll stops;
//    the next scroll the reader makes hands the mark back to the spy.
// 3. Every listener attaches on mount, never in a tap. A window listener that
//    a tap attached would catch that same tap as it bubbles.
//
// The colours are the app's own (ADR-0030): ink, paper and --accent-tint.
function JumpBar({ tabs, ariaLabel, scrollRoot, offset = 0, className = '' }) {
  const [current, setCurrent] = useState(tabs[0]?.key ?? null)
  const navRef = useRef(null)
  const btnRefs = useRef(new Map())
  const holdRef = useRef(null)
  const spyRef = useRef(null)
  const [barWidth, setBarWidth] = useState(0)
  const keys = tabs.map((t) => t.key).join('|')

  // The scroll-spy. Measured on a frame, at most once a frame.
  useEffect(() => {
    const root = scrollRoot?.current ?? null
    const target = root ?? window
    const list = keys ? keys.split('|') : []
    let frame = 0
    let retry = 0
    const measure = () => {
      frame = 0
      const step = holdStep(holdRef.current, Date.now(), HOLD_MS)
      holdRef.current = step.hold
      if (!step.measure) {
        // Come back once the hold ends: the last scroll frame is the last event.
        clearTimeout(retry)
        retry = setTimeout(onScroll, step.retryIn)
        return
      }
      const rootTop = root ? root.getBoundingClientRect().top : 0
      const sections = []
      for (const key of list) {
        const el = document.getElementById(key)
        if (el) sections.push({ key, top: el.getBoundingClientRect().top - rootTop })
      }
      const scroller = root ?? document.scrollingElement
      const height = root ? root.clientHeight : window.innerHeight
      const atEnd = scroller.scrollHeight > height && scroller.scrollTop + height >= scroller.scrollHeight - 2
      const next = currentSection(sections, { line: offset + SLACK, atEnd })
      if (next) setCurrent(next)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    spyRef.current = onScroll
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      clearTimeout(retry)
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [keys, scrollRoot, offset])

  // The bar's own width, so rule 1 runs again when a resize or a rotation makes it overflow.
  useEffect(() => {
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => setBarWidth(nav.clientWidth))
    ro.observe(nav)
    return () => ro.disconnect()
  }, [])

  // Rule 1: keep the current button in view inside a bar that scrolls sideways.
  useEffect(() => {
    const nav = navRef.current
    const btn = btnRefs.current.get(current)
    if (!nav || !btn || nav.scrollWidth <= nav.clientWidth) return
    const left = scrollLeftToShow({
      scrollLeft: nav.scrollLeft,
      width: nav.clientWidth,
      itemLeft: btn.offsetLeft,
      itemWidth: btn.offsetWidth,
      pad: 16,
    })
    if (left !== nav.scrollLeft) nav.scrollTo({ left, behavior: motionIsReduced() ? 'auto' : 'smooth' })
  }, [current, barWidth])

  const jump = (key) => {
    const el = document.getElementById(key)
    if (!el) return
    setCurrent(key)
    holdRef.current = holdFor()
    // A tap that scrolls nowhere fires no scroll event: ask the spy to measure once the hold ends.
    spyRef.current?.()
    const behavior = motionIsReduced() ? 'auto' : 'smooth'
    const root = scrollRoot?.current
    if (root) {
      const top = root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - offset
      root.scrollTo({ top, behavior })
    } else {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior })
    }
  }

  return (
    <nav ref={navRef} className={`jumpbar ${className}`.trim()} aria-label={ariaLabel}>
      <Cluster gap="snug" className="jumpbar__row">
        {tabs.map((t) => {
          const isCurrent = t.key === current
          const count = countLabel(t.count)
          return (
            <button
              key={t.key}
              ref={(el) => {
                if (el) btnRefs.current.set(t.key, el)
                else btnRefs.current.delete(t.key)
              }}
              type="button"
              className={`jumpbar__item ${isCurrent ? 'is-current' : ''}`.trim()}
              aria-current={isCurrent ? 'location' : undefined}
              onClick={() => jump(t.key)}
            >
              <span>{t.label}</span>{' '}
              {count != null ? (
                <span className="jumpbar__count">{count}</span>
              ) : (
                <span className="jumpbar__count" aria-hidden="true">·</span>
              )}
            </button>
          )
        })}
      </Cluster>
    </nav>
  )
}
