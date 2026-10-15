// The at-bat replay's step model: the ball-strike count after each pitch and
// the runners on the bases before and after the plate appearance. Pure, so
// `npm test` can pin it (test/replay-steps.test.js).
//
// It reads `pitchDetails` and the card's `basesBefore`/`basesAfter`, which exist
// only on a revealed at-bat card, so it carries the same seal as the zone plot.
// Nothing here may be called from a spoiler-free surface.
//
// KEYED BY THE PITCH'S OWN NUMBER `no`, not by a scene index. The scene drops a
// pitch with no tracking, so its indexes skip; a count read by index would land
// on the wrong pitch. An automatic call moves the count with no pitch, so each
// pitch's count comes from its own event (pitchInfo.js), never from its place.

const ZERO = { balls: 0, strikes: 0 }

// `scene` is atBatScenePitches' list; its last pitch is when the runners move.
// Returns null when the feed sent no count at all (the strip is then not drawn).
export function replaySteps(pitchDetails, scene, basesBefore, basesAfter) {
  const steps = (pitchDetails ?? [])
    .filter((p) => typeof p.balls === 'number' && typeof p.strikes === 'number')
    .map((p) => ({ no: p.no, balls: p.balls, strikes: p.strikes }))
  const lastNo = scene?.length ? scene[scene.length - 1].no : null
  const bases = Array.isArray(basesBefore) && Array.isArray(basesAfter) ? { before: basesBefore, after: basesAfter } : null
  return steps.length || bases ? { steps, lastNo, bases } : null
}

// The count to show for pitch `no`: before it lands, the count the previous
// pitch left (0-0 for the first); once it lands, its own.
export function countAt(model, no, landed) {
  if (!model || model.steps.length === 0) return null
  const own = model.steps.find((s) => s.no === no)
  if (landed) return own ?? null
  const before = model.steps.filter((s) => s.no < no).at(-1)
  return before ?? ZERO
}

// The bases to show: the runners as the at-bat found them, until its last
// pitch has landed.
export function basesAt(model, no, landed) {
  if (!model?.bases) return null
  return landed && no === model.lastNo ? model.bases.after : model.bases.before
}
