import { useId } from 'react'

// Tally's identity is built from the same modular gaps as a printed scorecard.
// The full wordmark is the primary signature; the sport mark is reserved for
// square/tiny contexts such as the PWA icon, favicon, and footer.
export function TallyWordmark({ height = 20, color = 'var(--clay)', title = 'Tally', ...rest }) {
  const maskId = `tally-wordmark-${useId().replace(/:/g, '')}`

  return (
    <svg width={height * 3} height={height} viewBox="0 0 480 160" role="img" aria-label={title} {...rest}>
      <defs>
        <mask id={maskId}>
          <g fill="white">
            <rect x="0" y="0" width="88" height="42" rx="5" />
            <rect x="32" y="48" width="24" height="112" rx="4" />
            <path fillRule="evenodd" d="M128 0h44l34 160h-31l-10-50h-32l-10 50H92L128 0Zm22 61-13 13 13 13 13-13-13-13Z" />
            <path d="M218 0h28v132h58v28h-86V0Z" />
            <path d="M310 0h28v132h58v28h-86V0Z" />
            <path d="M400 0h30l17 54L464 0h16l-20 76v84h-27V76L400 0Z" />
          </g>
          <g fill="black">
            <rect x="116" y="42" width="70" height="6" />
            <rect x="218" y="42" width="28" height="6" />
            <rect x="310" y="42" width="28" height="6" />
            <rect x="432" y="70" width="29" height="6" />
          </g>
        </mask>
      </defs>
      <rect width="480" height="160" fill={color} mask={`url(#${maskId})`} />
    </svg>
  )
}

export function TallyBaseballMark({ size = 24, background = 'var(--clay)', paper = 'var(--paper-2)', rounded = true, title = 'Tally Baseball', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={title} {...rest}>
      <rect width="120" height="120" rx={rounded ? 18 : 0} fill={background} />
      <g fill="none" stroke={paper} strokeWidth="10" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M20 45V20h25" />
        <path d="M75 20h25v25" />
        <path d="M20 75v25h25" />
        <path d="M75 100h25V75" />
      </g>
      <circle cx="60" cy="60" r="25" fill={paper} />
      <g fill="none" stroke={background} strokeWidth="5" strokeLinecap="round">
        <path d="M49 39c-8 11-8 31 0 42" />
        <path d="M71 39c8 11 8 31 0 42" />
      </g>
    </svg>
  )
}
