// Replays the last N consecutive timecodes of a game: fetch diffPatch for each pair of STORED timecodes,
// apply it with patch.mjs, and compare the result with the snapshot MLB serves for the same timecode.
// When diffPatch answers with a whole feed (a fallback), also checks whether that body equals the
// snapshot for its OWN metaData.timeStamp.
//   node replay-check.mjs <gamePk> [steps]
// Note: this uses stored-to-stored pairs. A live poller asks for "from my stamp up to now", which
// behaves differently (see findings.md). Prints counts, kinds, error messages and booleans only. No values.
import { isDeepStrictEqual } from 'node:util'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { applyPatch } from './patch.mjs'
import { timecodeMs } from './shape.mjs'

const pk = Number(process.argv[2])
const steps = Number(process.argv[3] || 40)
const base = `/api/v1.1/game/${pk}/feed/live`
const ts = await getJson(`${base}/timestamps`)
const use = ts.slice(-steps - 1)
let doc = await getJson(`${base}?timecode=${use[0]}`)
const tally = { patches: 0, mergeEqual: 0, mergeDiffers: 0, applyErrors: 0, wholeFeedBodies: 0, otherBodies: 0, inconclusive: 0 }
const errs = {}
for (let j = 1; j < use.length; j++) {
  const body = await getJson(`${base}/diffPatch?language=en&startTimecode=${use[j - 1]}&endTimecode=${use[j]}`)
  const want = await getJson(`${base}?timecode=${use[j]}`)
  if (want.metaData.timeStamp !== use[j]) {
    // the served snapshot has another stamp: nothing to compare, restart the chain from it
    tally.inconclusive++
    doc = want
    continue
  }
  if (Array.isArray(body) && body.every((x) => Array.isArray(x?.diff))) {
    tally.patches++
    try {
      let next = doc
      for (const p of body) next = applyPatch(next, p.diff)
      doc = next
    } catch (e) {
      tally.applyErrors++
      errs[e.message] = (errs[e.message] || 0) + 1
      doc = want
      continue
    }
    if (isDeepStrictEqual(doc, want)) tally.mergeEqual++
    else {
      tally.mergeDiffers++
      doc = want
    }
  } else if (body && body.gamePk === pk && body.metaData) {
    tally.wholeFeedBodies++
    const own = await getJson(`${base}?timecode=${body.metaData.timeStamp}`)
    const same = own.metaData.timeStamp === body.metaData.timeStamp
    console.log('whole-feed body at step', j, JSON.stringify({
      gapSec: (timecodeMs(use[j]) - timecodeMs(use[j - 1])) / 1000,
      bodyStampMinusEndSec: (timecodeMs(body.metaData.timeStamp) - timecodeMs(use[j])) / 1000,
      equalsSnapshotAtOwnStamp: same ? isDeepStrictEqual(body, own) : 'inconclusive (other stamp served)',
    }))
    doc = want
  } else {
    tally.otherBodies++
    doc = want
  }
}
console.log(JSON.stringify({ pk, steps: use.length - 1, tally, errs }))
