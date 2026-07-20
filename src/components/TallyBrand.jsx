import { useId } from 'react'

// Tally's identity is built from the same modular gaps as a printed scorecard.
// The wordmark ships as a pre-rendered PNG (public/brand/tally-wordmark.png)
// rather than an inline SVG mask — the mask version rendered fine in a live
// browser but came out garbled ("TAILLY") through the OG-image Playwright
// rasterizer, so a baked raster is the one asset that reads correctly
// everywhere it's used, including scripts/og-image.html.
const WORDMARK_ASPECT = 1851 / 458 // native public/brand/tally-wordmark.png size

export function TallyWordmark({ height = 20, title = 'Tally', ...rest }) {
  return (
    <img
      src="/brand/tally-wordmark.png"
      width={Math.round(height * WORDMARK_ASPECT)}
      height={height}
      alt={title}
      {...rest}
    />
  )
}

// The full lockup — baseball mark to the left of the wordmark, sized so the
// mark reads at roughly 1.3x the wordmark's cap height (a plain equal-height
// pairing left the mark looking undersized next to the wordmark's own
// baked-in padding). The mark carries no accessible name of its own — the
// wordmark's alt text is the pairing's one label — and hides on a narrow
// phone via .tally-lockup (see index.css), leaving just the mark as the
// compact home button.
export function TallyLockup({ height = 22, className = '', title = 'Tally', ...rest }) {
  return (
    <span className={`tally-lockup ${className}`.trim()} {...rest}>
      <TallyBaseballMark
        size={Math.round(height * 1.3)}
        title=""
        aria-hidden="true"
        className="tally-lockup__mark"
      />
      <TallyWordmark height={height} title={title} className="tally-lockup__wordmark" />
    </span>
  )
}

export function TallyBaseballMark({ size = 24, title = 'Tally Baseball', ...rest }) {
  const gradientId = `tally-mark-clay-${useId().replace(/:/g, '')}`

  return (
    <svg width={size} height={size} viewBox="0 0 320 320" role="img" aria-label={title} {...rest}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.88" y2="1">
          <stop offset="0" stopColor="#B93F31" />
          <stop offset="0.52" stopColor="#B43C2E" />
          <stop offset="1" stopColor="#AE392D" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="32" fill={`url(#${gradientId})`} />
      <g fill="#F7EEE2">
        <rect x="47" y="52" width="87" height="83" rx="6" />
        <rect x="188" y="52" width="87" height="83" rx="6" />
        <rect x="47" y="190" width="87" height="83" rx="6" />
        <rect x="188" y="190" width="87" height="83" rx="6" />
      </g>
      <circle cx="161" cy="164" r="82" fill={`url(#${gradientId})`} />
      <circle cx="161" cy="164" r="63" fill="#F7EEE2" />
      <g fill="none" stroke={`url(#${gradientId})`} strokeWidth="10" strokeLinecap="round">
        <path d="M117 121C146 141 146 187 117 207" />
        <path d="M205 121C176 141 176 187 205 207" />
      </g>
    </svg>
  )
}
