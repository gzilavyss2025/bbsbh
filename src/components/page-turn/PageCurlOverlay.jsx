import { useId } from 'react'

// The purely decorative curl visual for a forward inning-page turn — never
// real content. Draws a curved leading edge (not the spike's flat rotateY
// fold), a backside sliver, a highlight along the curl, a self-shadow under
// it, and a contact shadow it casts on the page beneath. Every part starts
// at opacity 0 with `data-turn-part` markers; InningPageTurn.jsx finds them
// by that attribute and drives the actual motion via WAAPI, animating only
// `transform`/`opacity` — never path data (no path morphing) and never
// anything a screen reader or a text search could find (aria-hidden, no
// text nodes, pointer-events: none so it can never intercept a tap).
//
// Geometry is a rough, tasteful first pass (curved control points bulging in
// from the right edge) — exact curvature/timing is expected to be tuned
// against a real device, same as the CSS token choices in index.css.
export function PageCurlOverlay() {
  const uid = useId()
  const highlightId = `${uid}-highlight`
  const selfShadowId = `${uid}-self-shadow`
  const contactShadowBlurId = `${uid}-contact-shadow-blur`

  return (
    <svg
      className="pagecurl"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={highlightId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={selfShadowId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <filter id={contactShadowBlurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Contact shadow the curling page casts on the page beneath it. */}
      <rect
        data-turn-part="contact-shadow"
        x="0"
        y="0"
        width="14"
        height="100"
        fill="#000"
        opacity="0"
        filter={`url(#${contactShadowBlurId})`}
      />

      {/* The backside sliver — a flat, muted fill standing in for the page's
          reverse side. Purely decorative: never a second copy of any
          revealed/sealed content (ADR-0024). */}
      <path
        data-turn-part="backside"
        d="M 100 0 L 88 0 C 82 22, 82 78, 88 100 L 100 100 Z"
        fill="var(--paper-1)"
        opacity="0"
      />

      {/* The curved leading edge itself (highlight) and the self-shadow just
          behind it — together they're the "curl". */}
      <path
        data-turn-part="fold"
        d="M 100 0 C 92 22, 92 78, 100 100 L 92 100 C 84 78, 84 22, 92 0 Z"
        fill={`url(#${highlightId})`}
        opacity="0"
      />
      <path
        data-turn-part="self-shadow"
        d="M 92 0 C 84 22, 84 78, 92 100 L 84 100 C 78 78, 78 22, 84 0 Z"
        fill={`url(#${selfShadowId})`}
        opacity="0"
      />
    </svg>
  )
}
