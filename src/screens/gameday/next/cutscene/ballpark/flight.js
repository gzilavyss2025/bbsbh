// Illustrative ball flight for an authored catch, not a measured game path.
// Coordinates are fractions of the scene. At contact the glove takes over:
// the ball is never drawn again after the authored catch beat.
export function ballAt(time, flight) {
  if (!flight || time < flight.startAt || time >= flight.catchAt) return null
  const p = (time - flight.startAt) / (flight.catchAt - flight.startAt)
  return {
    x: flight.from[0] + (flight.to[0] - flight.from[0]) * p,
    y: flight.from[1] + (flight.to[1] - flight.from[1]) * p + Math.sin(Math.PI * p) * flight.arc,
  }
}
