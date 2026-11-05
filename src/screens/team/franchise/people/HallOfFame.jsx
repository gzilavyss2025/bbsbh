import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { playerPath } from '../../../../lib/route.js'
import { yearRuns } from './peopleView.js'

// The club's Hall of Famers in two labelled groups (#2784, store #2597): the plaques that name the
// club, then everyone else who played here, with his seasons here. A group with no one is left out;
// a club with neither draws nothing.
export function HallOfFame({ team, hof }) {
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
    <Card frame="stamped" label="Hall of Famers" count={String(inducted.length + also.length)} className="frpeople">
      {inducted.length > 0 && (
        <>
          <h3 className="frpeople__group">Inducted as {team.name}</h3>
          <ul className="frpeople__list">{inducted.map((p) => row(p, null))}</ul>
        </>
      )}
      {also.length > 0 && (
        <>
          <h3 className="frpeople__group">Also played here</h3>
          <ul className="frpeople__list">{also.map((p) => row(p, yearRuns(p.seasons)))}</ul>
        </>
      )}
    </Card>
  )
}
