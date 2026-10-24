// Replays the last N consecutive timecodes of a game: fetch diffPatch for each pair,
// apply it with patch.mjs, and compare the result with the snapshot MLB serves for the
// same timecode. When diffPatch answers with a whole feed (a fallback), also checks
// whether that body equals the snapshot for its OWN metaData.timeStamp.
//   node replay-check.mjs <gamePk> [steps]
// Prints counts, response kinds, error messages and booleans only. No values.
import { isDeepStrictEqual } from 'node:util'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { applyPatch } from './patch.mjs'
const pk = Number(process.argv[2]); const n = Number(process.argv[3] || 40)
const base = `/api/v1.1/game/${pk}/feed/live`
const ts = await getJson(`${base}/timestamps`)
const use = ts.slice(-n - 1)
let doc = await getJson(`${base}?timecode=${use[0]}`)
const tally = { array: 0, full: 0, other: 0, applyErr: 0, equal: 0, notEqual: 0 }
const errs = {}
for (let j = 1; j < use.length; j++) {
  const body = await getJson(`${base}/diffPatch?language=en&startTimecode=${use[j - 1]}&endTimecode=${use[j]}`)
  let kind
  if (Array.isArray(body)) kind = 'array'
  else if (body && body.gamePk === pk) kind = 'full'
  else kind = 'other'
  tally[kind]++
  const want = await getJson(`${base}?timecode=${use[j]}`)
  if (kind === 'array') {
    try {
      let next = doc
      for (const p of body) next = applyPatch(next, p.diff)
      doc = next
    } catch (e) {
      tally.applyErr++; errs[e.message] = (errs[e.message] || 0) + 1
      doc = want // resync like the capture does
      continue
    }
  } else if (kind === 'full') {
    const own = await getJson(`${base}?timecode=${body.metaData.timeStamp}`)
    const tcms = (t) => Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(9, 11), +t.slice(11, 13), +t.slice(13, 15))
    console.log('full-fallback at step', j, JSON.stringify({ gapSec: (tcms(use[j]) - tcms(use[j - 1])) / 1000, bodyStampMinusEndSec: (tcms(body.metaData.timeStamp) - tcms(use[j])) / 1000, bodyEqualsSnapshotAtOwnStamp: isDeepStrictEqual(body, own), isLatestStamp: body.metaData.timeStamp === ts[ts.length - 1] }))
    doc = body
  }
  if (isDeepStrictEqual(doc, want)) tally.equal++; else { tally.notEqual++; doc = want }
}
console.log(JSON.stringify({ pk, steps: use.length - 1, tally, errs }))
