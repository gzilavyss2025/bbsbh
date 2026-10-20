import { LeaguePennant } from '../../../../components/honors/LeaguePennant.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'

// A club's league pennants, newest first, in a swipe row under the Franchise history card.
// Each pennant is drawn with the name, club label and abbreviation of ITS year (the 1955
// Brooklyn Dodgers), from the verified rows in src/api/leaguePennants.js. The art decides
// the mark: a covered era keeps its abbreviation, any other season takes the one-color
// mark (docs/pennants.md). Open and spoiler-free: finished seasons, no game. MLB only,
// and a club with none (the Mariners) draws nothing.
//
// `cardProps`: the one-scroll page's stamped frame and name tab (props for Card).
export function PennantWall({ pennants, cardProps }) {
  if (!pennants?.length) return null
  return (
    <Card {...cardProps} count={`${pennants.length} since 1903`} className="pennantwall">
      <ol className="pennantwall__track" aria-label="League pennants, newest first">
        {pennants.map((p) => (
          <li key={p.season} className="pennantwall__slide">
            <LeaguePennant
              teamId={p.teamId}
              season={p.season}
              league={p.league}
              teamName={p.name}
              clubLabel={p.club}
              abbreviation={p.abbr}
              variant="compact"
              width={84}
            />
          </li>
        ))}
      </ol>
    </Card>
  )
}
