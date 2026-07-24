import { useId } from 'react'

// One complete outlined drawing: TAL1 comes from the approved 900-weight font
// geometry and measured kerning, followed by the custom continuous Y and the
// scorer's asterisk. No live text remains, so every letter rasterizes together
// at header, page-bar, and footer sizes.
const WORDMARK_ASPECT = 244 / 96

export function TallyWordmark({ height = 20, title = 'Tally', className = '', ...rest }) {
  return (
    <svg
      width={Math.round(height * WORDMARK_ASPECT)}
      height={height}
      viewBox="0 0 244 96"
      role="img"
      aria-label={title}
      className={`tally-wordmark ${className}`.trim()}
      {...rest}
    >
      <g fill="currentColor">
        <path
          d="M269 0V1336H12V1600H826V1336H569V0Z"
          transform="translate(1 83) scale(.047 -.047)"
        />
        <path
          d="M20 0 242 1600H714L936 0H628L594 334H362L328 0ZM390 598H566L530 952L506 1336H450L426 952Z"
          transform="translate(35.109 83) scale(.047 -.047)"
        />
        <path
          d="M80 0V1600H380V264H774V0Z"
          transform="translate(79.293 83) scale(.047 -.047)"
        />
        <path
          d="M168 0V1336H66L60 1442L232 1600H468V0Z"
          transform="translate(116.337 83) scale(.047 -.047)"
        />
        <path d="M147 8h17l9 31 9-31h17l-18 49v26h-16V57Z" />
      </g>
      <g transform="translate(216 23) scale(1.1)" fill="currentColor">
        <path d="M-2-11H2V11H-2Z" />
        <path d="m-10.502-3.769 2.004-3.462 19 11-2.004 3.462Z" />
        <path d="m-8.498 7.231-2.004-3.462 19-11 2.004 3.462Z" />
      </g>
    </svg>
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
