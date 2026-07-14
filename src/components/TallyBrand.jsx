import { useId } from 'react'

// Tally's identity is built from the same modular gaps as a printed scorecard.
// The full wordmark is the primary signature; the sport mark is reserved for
// square/tiny contexts such as the PWA icon, favicon, and footer.
export function TallyWordmark({ height = 20, color = 'var(--clay)', title = 'Tally', ...rest }) {
  const maskId = `tally-wordmark-${useId().replace(/:/g, '')}`

  return (
    <svg width={Math.round(height * 3.08)} height={height} viewBox="0 0 492 160" role="img" aria-label={title} {...rest}>
      <defs>
        <mask id={maskId}>
          <g fill="white">
            <rect x="0" y="0" width="88" height="42" rx="5" />
            <rect x="32" y="48" width="24" height="112" rx="4" />
            <path fillRule="evenodd" d="M128 0h44l34 160h-31l-10-50h-32l-10 50H92L128 0Zm22 61-13 13 13 13 13-13-13-13Zm-10 55-8 44h36l-9-44h-19Z" />
            <rect x="218" y="0" width="28" height="160" rx="4" />
            <path d="M262 0h28v132h58v28h-86V0Z" />
            <path d="M354 0h28v132h58v28h-86V0Z" />
            <path d="M412 0h30l17 54L476 0h16l-20 76v84h-27V76L412 0Z" />
          </g>
          <g fill="black">
            <rect x="116" y="42" width="70" height="6" />
            <rect x="218" y="42" width="28" height="6" />
            <rect x="262" y="42" width="28" height="6" />
            <rect x="354" y="42" width="28" height="6" />
            <rect x="444" y="70" width="29" height="6" />
          </g>
        </mask>
      </defs>
      <rect width="492" height="160" fill={color} mask={`url(#${maskId})`} />
    </svg>
  )
}

export function TallyBaseballMark({ size = 24, background = 'var(--clay)', paper = 'var(--paper-2)', rounded = true, title = 'Tally Baseball', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={title} {...rest}>
      <rect width="120" height="120" rx={rounded ? 18 : 0} fill={background} />
      <g fill={paper}>
        <path d="M18 18h31v17L35 49H18V18Z" />
        <path d="M71 18h31v31H85L71 35V18Z" />
        <path d="M18 71h17l14 14v17H18V71Z" />
        <path d="M85 71h17v31H71V85l14-14Z" />
        <circle cx="60" cy="60" r="27" />
      </g>
      <g fill="none" stroke={background} strokeWidth="5" strokeLinecap="round">
        <path d="M48 38c-8 10-8 34 0 44" />
        <path d="M72 38c8 10 8 34 0 44" />
      </g>
    </svg>
  )
}
