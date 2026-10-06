import { birthplaceKey, birthplaceShard, fetchBirthplaceShard } from '../../api/history/birthplaces.js'
import { useAsync } from '../../hooks/useAsync.js'
import { parkPlace, pickPeople } from '../../lib/history/pick.js'
import { PeopleList } from './PeopleList.jsx'
import '../../styles/history/history.css'

// "Born near the park" on the game preview: players born in the park's own city.
// The city comes from the feed's venue.location, which the preview already holds.
// Exact city and state (US) or city and country; no match renders no line at all.
// History about people (ADR-0100): nothing here reads a game, a score or a season.
export function BornNearPark({ location }) {
  const place = parkPlace(location)
  const key = place && birthplaceKey(...place)
  const { data } = useAsync(
    async () => {
      if (!key) return null
      const shard = await fetchBirthplaceShard(birthplaceShard(key))
      const people = pickPeople(shard?.places?.[key], 4)
      return people.length ? { people, credit: shard.credit } : null
    },
    [key],
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
