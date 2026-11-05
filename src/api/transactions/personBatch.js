import { getJson } from '../statsapi.js'
import { chunk } from '../../lib/math/number.js'

// The wire's career/bio read (playerFacts.js), batched: callers in one tick share one
// people?personIds= call (25 a call), each getting `{ people: [person] }`. A failed or
// malformed chunk, a bad id and a player the feed omits read singly, so a miss rejects (and is
// retried) as his 404 did and no caller is left waiting.
const HYDRATE = 'transactions,draft,stats(group=[hitting,pitching],type=[yearByYear,career],sportId=1)' // paths checked on 676051 + 673357, 2026-11-05
let queue = new Map() // id -> [[resolve, reject], ...]
const readOne = (id) => getJson(`/api/v1/people/${id}?hydrate=${HYDRATE}`)
export function fetchPersonBatched(id) {
  const n = Number(id)
  // Anything but a whole id under 1e10 400s the whole batch (checked live).
  if (!Number.isInteger(n) || n <= 0 || n >= 1e10) return readOne(id)
  return new Promise((resolve, reject) => {
    if (!queue.size) setTimeout(flushPeople, 0)
    queue.set(n, [...(queue.get(n) ?? []), [resolve, reject]])
  })
}
function flushPeople() {
  const batch = queue
  queue = new Map()
  const settle = (id, read) => read.then((d) => batch.get(id).forEach(([ok]) => ok(d)), (e) => batch.get(id).forEach(([, no]) => no(e)))
  for (const ids of chunk([...batch.keys()], 25)) {
    getJson(`/api/v1/people?personIds=${ids.join(',')}&hydrate=${HYDRATE}`)
      .then((data) => ids.map((id) => [id, data.people.filter((p) => p.id === id)]))
      .then(
        (found) => found.forEach(([id, people]) => settle(id, people.length ? Promise.resolve({ people }) : readOne(id))),
        () => ids.forEach((id) => settle(id, readOne(id))),
      )
  }
}
