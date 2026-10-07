import { bornNear } from '../../api/history/birthplaces.js'
import { useAsync } from '../../hooks/useAsync.js'
import { parkPoint, pickPeople } from '../../lib/history/pick.js'
import { PeopleList } from './PeopleList.jsx'
import '../../styles/history/history.css'

// "Born near the park" on the game preview: players born within NEAR_MILES (50) of
// the park, by map distance (ADR-0106). The park's point comes from the feed's
// venue.location, which the preview already holds. No point, or no one near it,
// renders no line at all.
// History about people (ADR-0100): nothing here reads a game, a score or a season.
export function BornNearPark({ location }) {
  const point = parkPoint(location)
  const { data } = useAsync(
    async () => {
      if (!point) return null
      const near = await bornNear(point)
      const people = pickPeople(near.people, 4)
      return people.length ? { people, credit: near.credit } : null
    },
    [point?.lat, point?.lon],
  )
  if (!data) return null
  return (
    <div className="onthisday__rows">
      <p className="onthisday__row">
        <span className="onthisday__label">Born near the park</span>
        <span><PeopleList people={data.people} /></span>
      </p>
      {data.credit?.length > 0 && <p className="onthisday__credit">{data.credit.join(' ')}</p>}
    </div>
  )
}
