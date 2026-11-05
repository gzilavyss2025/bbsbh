import { getJson } from '../statsapi.js'

const HYDRATE = 'transactions,draft,stats(group=[hitting,pitching],type=[yearByYear,career],sportId=1)'

// The career/bio read, batched: every move that asks within one short tick (a
// page of rows coming near view) shares one people?personIds= call. Each caller
// gets `{ people: [person] }`, the shape a single read answered; `[]` when the
// feed returns no such player. Hydrate paths checked on 676051 + 673357, 2026-11-05.
const BATCH_MS = 40
const BATCH_MAX = 25
let queue = new Map() // id -> [[resolve, reject], ...]
export function fetchPerson(id) {
  id = Number(id)
  return new Promise((resolve, reject) => {
    if (!queue.size) setTimeout(flushPeople, BATCH_MS)
    queue.set(id, [...(queue.get(id) ?? []), [resolve, reject]])
  })
}
function flushPeople() {
  const batch = queue
  queue = new Map()
  const ids = [...batch.keys()]
  for (let i = 0; i < ids.length; i += BATCH_MAX) {
    const chunk = ids.slice(i, i + BATCH_MAX)
    getJson(`/api/v1/people?personIds=${chunk.join(',')}&hydrate=${HYDRATE}`).then(
      (data) => chunk.forEach((id) => batch.get(id).forEach(([ok]) => ok({ people: (data?.people ?? []).filter((p) => p.id === id) }))),
      (err) => chunk.forEach((id) => batch.get(id).forEach(([, no]) => no(err))),
    )
  }
}
