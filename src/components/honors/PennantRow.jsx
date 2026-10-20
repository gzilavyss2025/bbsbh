import { WIDE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery.js'
import { LeaguePennant } from './LeaguePennant.jsx'

// A swipe row of league pennants, for any page that lists several. Compact on a phone (a short
// row), full on a wide screen (club, mark, year and league title). `pennants` are rows of
// api/history/leaguePennants.js with the club's `teamId`; the caller orders them and decides
// which ones are verified (docs/pennants.md).
export function PennantRow({ pennants, label }) {
  const wide = useMediaQuery(WIDE_QUERY)
  return (
    <ol className="pennantrow" aria-label={label}>
      {pennants.map((p) => (
        <li key={`${p.season}-${p.teamId}`} className="pennantrow__slide">
          <LeaguePennant
            teamId={p.teamId}
            season={p.season}
            league={p.league}
            teamName={p.name}
            clubLabel={p.club}
            abbreviation={p.abbr}
            variant={wide ? 'full' : 'compact'}
            width={wide ? 150 : 64}
          />
        </li>
      ))}
    </ol>
  )
}
