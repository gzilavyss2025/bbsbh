import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { playerPath } from '../../../../lib/route.js'
import { seasonRuns } from '../../../../components/team/ladder/layout.js'
import { hofHeading } from './peopleView.js'

// The club's Hall of Famers in two labelled groups (#2784, store #2597): the plaques that name the
// club, then everyone else who played here, with his seasons here. A group with no one is left out;
// a club with neither draws nothing.
export function HallOfFame({ team, hof, names }) {
  const link = useRouteLink()
  const inducted = hof?.inductedAs ?? []
  const also = hof?.alsoPlayed ?? []
  if (!inducted.length && !also.length) return null
  const row = (p, here) => (
    <li key={p.id} className="frpeople__row">
      <span>
        <a className="plink" {...link(playerPath(p.id, { name: p.name }))}>
          {p.name}
        </a>
        {here && <span className="frpeople__sub t-label">Here {here}</span>}
      </span>
      <span className="frpeople__fig">{p.year}</span>
    </li>
  )
  return (
    <Card frame="stamped" label="Hall of Famers" labelAs="h3" count={String(inducted.length + also.length)} className="frpeople">
      {inducted.length > 0 && (
        <>
          <h4 className="frpeople__group t-label t-label--bold">{hofHeading(team.name, names)}</h4>
          <ul className="frpeople__list">{inducted.map((p) => row(p, null))}</ul>
        </>
      )}
      {also.length > 0 && (
        <>
          <h4 className="frpeople__group t-label t-label--bold">Also played here</h4>
          <ul className="frpeople__list">{also.map((p) => row(p, seasonRuns(p.seasons)))}</ul>
        </>
      )}
    </Card>
  )
}
