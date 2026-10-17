// The trip between two Series parks (#1906, slice 7). Pure.
//
//   park: { name, lat, lon, offset (UTC hours), roof, seats, dist:{lf,lc,cf,rc,rf} }
//
// Distance is the great-circle miles park to park (milesBetween); the clock is
// the time-zone change in whole hours; roof and seats are the next park's. No
// game result is read: a trip is geography.
import { milesBetween } from '../../../api/history/birthplaces.js'

export function tripTiles(from, to) {
  const miles = Math.round(milesBetween({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }))
  const hours = Math.round((to.offset ?? 0) - (from.offset ?? 0))
  return {
    distance: `${miles.toLocaleString('en-US')} mi`,
    clock: hours === 0 ? 'None' : `${hours > 0 ? '+' : '−'}${Math.abs(hours)} h`,
    roof: to.roof || '—',
    seats: to.seats ? to.seats.toLocaleString('en-US') : '—',
  }
}

// An outfield fence as a polygon around home plate (0,0): the five posted
// distances (feet) at -45, -22.5, 0, 22.5 and 45 degrees from dead centre, y up
// the field. Joined by straight lines when no measured outline is on hand.
export function fencePoints(dist) {
  if (!dist) return []
  const angles = [-45, -22.5, 0, 22.5, 45]
  const feet = [dist.lf, dist.lc, dist.cf, dist.rc, dist.rf]
  return angles.map((a, i) => {
    const rad = (a * Math.PI) / 180
    return { x: Math.sin(rad) * feet[i], y: Math.cos(rad) * feet[i] }
  })
}
