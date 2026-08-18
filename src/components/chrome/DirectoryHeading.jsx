// One visual vocabulary for the directory headings in the site menu, footer,
// and /more page. The drawings are deliberately simple line marks: they read
// at caption size and feel printed into the scorebook instead of imported from
// an unrelated icon set.
export function DirectoryHeading({ group, as: Heading = 'h2' }) {
  return (
    <Heading className="dirhd">
      <span className={`dirglyph dirglyph--${group.id}`} aria-hidden="true">
        <DirectoryGlyph name={group.id} />
      </span>
      <span className="dirhd__label">{group.label}</span>
      <span className="dirhd__rule" aria-hidden="true" />
    </Heading>
  )
}

function DirectoryGlyph({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    focusable: 'false',
  }

  switch (name) {
    case 'this-season':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M4 9h16" />
          <path d="m12 11 3 3-3 3-3-3 3-3Z" />
        </svg>
      )
    case 'prospects':
      return (
        <svg {...common}>
          <path d="M4.5 18.5 10 13l3 3 6.5-8" />
          <path d="M15.5 8h4v4" />
          <circle cx="5" cy="18.5" r="1.5" />
          <circle cx="10" cy="13" r="1.5" />
        </svg>
      )
    case 'history':
      return (
        <svg {...common}>
          <path d="M3.5 5.5h5.2c1.8 0 3.3 1.1 3.3 2.5v12c0-1.4-1.5-2.5-3.3-2.5H3.5v-12Z" />
          <path d="M20.5 5.5h-5.2C13.5 5.5 12 6.6 12 8v12c0-1.4 1.5-2.5 3.3-2.5h5.2v-12Z" />
          <path d="M6.5 9h2.7M6.5 12h2.7M14.8 9h2.7M14.8 12h2.7" />
        </svg>
      )
    case 'yours':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="2" />
          <path d="M5.5 16c.5-2 1.5-3 3-3s2.5 1 3 3M14.5 9h3M14.5 12h3M14.5 15h2" />
        </svg>
      )
    case 'guides':
      return (
        <svg {...common}>
          <path d="M3.5 5.5h5.2c1.8 0 3.3 1.1 3.3 2.5v12c0-1.4-1.5-2.5-3.3-2.5H3.5v-12Z" />
          <path d="M20.5 5.5h-5.2C13.5 5.5 12 6.6 12 8v12c0-1.4 1.5-2.5 3.3-2.5h5.2v-12Z" />
          <path d="M6.5 9h2.7M6.5 12h2.7M14.8 9h2.7M14.8 12h2.7" />
          <path d="m16 16 2.5-2.5" />
        </svg>
      )
    case 'tools':
    default:
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M3.5 8.5h17M7 6.5h.01M9.5 6.5h.01" />
          <path d="M8 12v4M11 12v4M14 12v4M17 12v4" />
        </svg>
      )
  }
}
