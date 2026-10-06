import { PlayerLink } from '../player/PlayerLink.jsx'

// Names, each a link to the player's page, with the year beside it. History about
// people only (ADR-0100): it takes no game and no score, and it fetches nothing.
export function PeopleList({ people }) {
  return people.map((x, i) => (
    <span key={x.personId}>
      {i > 0 && ', '}
      <PlayerLink id={x.personId} name={x.name}>{x.name}</PlayerLink>
      {x.year ? ` (${x.year})` : ''}
    </span>
  ))
}
