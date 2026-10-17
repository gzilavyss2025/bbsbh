import { fetchTripVenue } from '../../../api/postseason/worldSeriesHome.js'
import { fetchOutdoorWeather } from '../../../api/weather.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { fencePoints, tripTiles } from '../../../lib/postseason/worldseries/trip.js'
import { Card } from '../../ui/frame/Card.jsx'
import { Key } from '../../ui/frame/Key.jsx'
import { StatCell, StatStrip } from '../../ui/frame/StatStrip.jsx'

// THE TRIP (off day, when the next game is in the other club's park): miles,
// the clock change, the next park's roof and seats (and, wide, the weather for
// an open-air park), and the two outfield fences drawn over each other: the park
// just played in dashed, the next park solid. Geography only: no result is read.
// Hidden when either park fails to load or both games share a park.
const SIZE = 220
const polygon = (dist) => {
  const pts = fencePoints(dist)
  const scale = (SIZE * 0.9) / 420
  return pts.map((p) => `${SIZE / 2 + p.x * scale},${SIZE - 10 - p.y * scale}`).join(' ')
}

function Fences({ from, to }) {
  return (
    <svg className="ww-trip__fences" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Outfield fences: ${from.name} and ${to.name}`}>
      <polygon className="ww-trip__fence ww-trip__fence--from" points={polygon(from.dist)} />
      <polygon className="ww-trip__fence ww-trip__fence--to" points={polygon(to.dist)} />
    </svg>
  )
}

export function Trip({ fromVenueId, toVenueId, firstPitch, wide }) {
  const { data } = useAsync(async () => {
    if (!fromVenueId || !toVenueId || fromVenueId === toVenueId) return null
    const [from, to] = await Promise.all([fetchTripVenue(fromVenueId), fetchTripVenue(toVenueId)])
    if (!from || !to) return null
    const weather = to.roof === 'Open' ? await fetchOutdoorWeather({ lat: to.lat, lon: to.lon, whenISO: firstPitch || undefined }) : null
    return { from, to, weather }
  }, [fromVenueId, toVenueId, firstPitch])
  if (!data) return null
  const { from, to, weather } = data
  const t = tripTiles(from, to)
  const key = [
    { label: from.name, mark: <span className="ww-swatch ww-swatch--from" aria-hidden="true" /> },
    { label: to.name, mark: <span className="ww-swatch ww-swatch--to" aria-hidden="true" /> },
  ]
  return (
    <Card frame="stamped" label="The trip" className="ww-trip">
      <StatStrip>
        <StatCell label="Distance" value={t.distance} />
        <StatCell label="Clock" value={t.clock} />
        <StatCell label="Roof" value={t.roof} />
        <StatCell label="Seats" value={t.seats} />
        {wide && weather?.tempF != null && <StatCell label="Weather" value={`${Math.round(weather.tempF)}°`} />}
      </StatStrip>
      {from.dist && to.dist && <Fences from={from} to={to} />}
      <Key items={key} className="ww-trip__key" />
    </Card>
  )
}
