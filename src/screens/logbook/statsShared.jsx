import { useNav } from '../../lib/nav.js'
import { gamePath } from '../../lib/route.js'

// Small pieces shared between LogbookStatsPage.jsx and RetrospectiveSections.jsx
// — split out rather than duplicated so the two can't drift, and rather than
// having the sections file import the page (which imports it back), which
// would be circular.

const FULL_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function dateLabel(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? FULL_DATE.format(new Date(year, month - 1, day)) : ''
}

export function SectionHead({ eyebrow, title, note }) {
  return (
    <header className="logbookstats__sectionhead">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {note && <p className="logbookstats__prose">{note}</p>}
    </header>
  )
}

// "MIL 6, STL 2" — the away@home score line the ported moments/performances
// cards use, read from the same `facts` this page already fetches. Empty
// (renders nothing extra) when a game's facts haven't resolved yet.
export function gameTitle(game) {
  if (!game) return ''
  return `${game.away.abbreviation} ${game.away.runs}, ${game.home.abbreviation} ${game.home.runs}`
}

// A stamped game's own box score, from this page's already-fetched `facts` —
// the ported sections' equivalent of FirstScorebookPage's ScorebookGameLink,
// reading THIS page's facts shape (api/logbook.js's stampGameFacts) instead
// of that page's frozen archive.
export function LogbookGameLink({ gamePk, facts, className = '', children }) {
  const navigate = useNav()
  const game = facts?.[gamePk]
  return (
    <button
      type="button"
      className={className}
      disabled={!game}
      onClick={() => game && navigate(gamePath(game.date, game.away.abbreviation, game.home.abbreviation, 'boxscore', game.gameNumber))}
    >
      {children}
    </button>
  )
}
