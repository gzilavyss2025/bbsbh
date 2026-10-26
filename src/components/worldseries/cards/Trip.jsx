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
const PAD = 8
// The fence's points in the diagram's units, home plate at the foot of a SIZE box.
const polygon = (dist) => {
  const scale = (SIZE * 0.9) / 420
  return fencePoints(dist).map((p) => [SIZE / 2 + p.x * scale, SIZE - 10 - p.y * scale])
}
const asPoints = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ')

// Only the outfield arc is drawn, so the view is cropped to the two fences (a square box left more
// than half the card empty) and the drawing takes the card's width.
function Fences({ from, to }) {
  const a = polygon(from.dist)
  const b = polygon(to.dist)
  // A park with a distance missing yields NaN points: draw nothing rather than an invalid view box.
  if (![...a, ...b].every((p) => p.every(Number.isFinite))) return null
  const xs = [...a, ...b].map((p) => p[0])
  const ys = [...a, ...b].map((p) => p[1])
  const x0 = Math.min(...xs) - PAD
  const y0 = Math.min(...ys) - PAD
  const w = Math.max(...xs) - Math.min(...xs) + 2 * PAD
  const h = Math.max(...ys) - Math.min(...ys) + 2 * PAD
  return (
    <svg className="ww-trip__fences" viewBox={`${x0} ${y0} ${w} ${h}`} role="img" aria-label={`Outfield fences: ${from.name} and ${to.name}`}>
      <polygon className="ww-trip__fence ww-trip__fence--from" points={asPoints(a)} />
      <polygon className="ww-trip__fence ww-trip__fence--to" points={asPoints(b)} />
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
