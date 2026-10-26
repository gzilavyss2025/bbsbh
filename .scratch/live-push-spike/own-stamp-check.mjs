// Is a plain /feed/live body equal to the snapshot MLB serves for its own metaData.timeStamp?
// (If yes, a full feed is a safe base for the next diffPatch.)
//   node own-stamp-check.mjs <gamePk> [samples]
// Each sample is one of: equal; differs (the snapshot has the SAME stamp and other content);
// inconclusive (the server answered with another stamp: it serves the closest EARLIER stored snapshot
// when none exists for the stamp asked). Prints counts only. No values.
import { isDeepStrictEqual } from 'node:util'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const pk = Number(process.argv[2])
const samples = Number(process.argv[3] || 6)
const base = `/api/v1.1/game/${pk}/feed/live`
const out = { equal: 0, differs: 0, inconclusive: 0 }
for (let i = 0; i < samples; i++) {
  const full = await getJson(base)
  const own = await getJson(`${base}?timecode=${full.metaData.timeStamp}`)
  if (own.metaData.timeStamp !== full.metaData.timeStamp) out.inconclusive++
  else if (isDeepStrictEqual(full, own)) out.equal++
  else out.differs++
  await new Promise((r) => setTimeout(r, 4000))
}
console.log(JSON.stringify({ pk, samples, ...out }))
