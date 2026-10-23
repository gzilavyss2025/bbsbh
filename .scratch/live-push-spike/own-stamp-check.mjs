// Is a plain /feed/live body equal to the snapshot MLB serves for its own metaData.timeStamp?
// (If yes, a full feed is a safe base for the next diffPatch.)
//   node own-stamp-check.mjs <gamePk>
// Prints two counts. No values.
import { isDeepStrictEqual } from 'node:util'
import { getJson } from '../../scripts/lib/statsapi.mjs'
const pk = Number(process.argv[2])
const base = `/api/v1.1/game/${pk}/feed/live`
let eq = 0, ne = 0
for (let i = 0; i < 6; i++) {
  const full = await getJson(base)
  const own = await getJson(`${base}?timecode=${full.metaData.timeStamp}`)
  isDeepStrictEqual(full, own) ? eq++ : ne++
  await new Promise((r) => setTimeout(r, 4000))
}
console.log(JSON.stringify({ pk, plainFullEqualsOwnStamp: eq, notEqual: ne }))
