// "Hits like" — nearest neighbours in STATCAST SKILL space: which other hitters
// make the same quality of contact, control the zone the same way, and run the
// same. The batting-side analog of src/lib/pitcherSimilarity.js, and shaped the
// same way: pure and self-contained (no fetch, no DOM), driven entirely by the
// season percentile map public/data/savant-percentiles.json already carries —
// see src/api/savantPercentiles.js for the reader and
// scripts/gen-savant-percentiles.mjs for the nightly sweep behind it.
//
// WHY RUNTIME, NOT A PRECOMPUTE. Same reasoning as the arsenal card: the pool
// is a few hundred qualified bats with five numbers each, and the player page
// has already loaded the file for its own percentile radar. One pass over that
// is microseconds; a precomputed neighbour table would be a new generator and a
// new static file to buy nothing.
//
// WHAT "SIMILAR" MEANS HERE, and what it deliberately isn't. This compares the
// SKILLS a hitter shows — how hard he hits it, how often he barrels it, how
// well he lays off, how fast he runs — not the results those skills produce.
// Two bats with the same swing and different batting lines are neighbours here,
// which is the literal reading of "hits like" and the thing a scorekeeper can
// see from his seat.
//
// That is why xwOBA is NOT in the space even though the same file carries it,
// and even though the radar plots it. xwOBA is a SUMMARY of the contact-quality
// metrics already here — measured on this file's own pool it correlates .94
// with exit velo, .78 with barrel rate, and hard-hit rate correlates .80 with
// barrel rate — so adding it would weight the contact block twice over and let
// it outvote discipline and speed, which are close to independent of it
// (|r| ≤ .13 against every contact metric). It would also quietly turn the
// card's claim from a skills statement into an outcomes one.
//
// NO HANDEDNESS FILTER, unlike the pitcher version. There the filter is
// load-bearing: a lefty's ball moves the other way and the platoon math
// inverts, so a mixed-hand list reads as a bug. Nothing here inverts with
// batting side — contact quality, plate discipline and sprint speed mean the
// same thing from either box, and a lefty and a righty who both hit it 110 and
// never chase genuinely do hit alike. Filtering on bat side would halve the
// pool for nothing.

// The five metrics the comparison runs on, in savant-percentiles.json's own
// keys. All are PERCENTILES, 0-100, and all are pre-flipped by Savant so
// higher is always better — chase included, where the good direction is a low
// raw rate (see savantPercentiles.js's BATTER_METRICS). That pre-flip is what
// lets one absolute difference serve every metric without a per-key sign.
export const PROFILE_KEYS = ['ev', 'hardHit', 'brl', 'chase', 'sprintSpeed']

// How many of the five have to be on file before a hitter is comparable at all.
//
// The same floor in spirit as radarSpokes' three-of-five: a shape drawn from
// two corners misleads rather than informs, and a "hits like" claim built on
// two metrics overclaims worse, because it is asserting a resemblance rather
// than just drawing one. Four of five keeps a hitter who is under Savant's
// sample floor on exactly one board while refusing the pairs that would be
// decided by whichever two numbers happened to survive.
//
// It costs nothing measurable on the real file: of 559 bat entries this
// season, 250 carry all five and 309 carry exactly ONE — sprint speed, whose
// leaderboard has a far looser qualifier than the batted-ball ones. Not a
// single entry sits at four, three or two, so the floor cleanly separates
// "qualified hitter" from "sprint-speed stub" and never splits a real case.
const MIN_KNOWN_METRICS = 4

// Distance → 0-100 match score, for display only. Deliberately NOT a
// percentile or a probability — the card labels it as a match and never as
// "x% likely to be the same hitter".
//
// The SLOPE is the whole calibration, and a bare complement (slope 1) is far
// too compressed to use: measured over the 250 qualified bats in this season's
// file, a random pair sits 33.5 percentile points apart per metric on average,
// so `1 - distance` would score two unrelated hitters 67 — a number that reads
// like a real resemblance. 2.5 was chosen from those measured distributions:
//
//   • nearest neighbour: median distance .064 → match 84 (p05 .034 → 92,
//     p90 .088 → 78). A typical closest comparison lands in the 80s, which is
//     the band the card wants — confident, not perfect.
//   • random pair: median .316 → match 21, mean .335 → match 16. Clearly under
//     the floor below, which is the property that matters.
//
// It also lands the scale on two statable anchors rather than arbitrary ones:
// a mean gap of 20 percentile points across the metrics scores exactly 50, and
// 40 points — wider than the average random pair of qualified hitters — scores
// 0. Clamped at both ends because a bad enough pair goes negative otherwise.
const MATCH_SLOPE = 2.5

export function matchScore(distance) {
  if (distance == null) return null
  return Math.max(0, Math.min(100, Math.round((1 - MATCH_SLOPE * distance) * 100)))
}

// The worst match still worth calling a comparison — the same 50 the arsenal
// card uses, and for the same reason, though it lands on a different fact.
// Here it means an average gap of 20 percentile points on every metric: at
// that spread the two hitters are a decile-and-a-half apart on contact, on
// discipline and on speed, and printing that pairing under the words "hits
// like" asserts something the data doesn't support.
//
// HONEST NOTE ON HOW OFTEN IT BITES, since the measurement contradicted the
// prior it was set against. This space is dense — the three contact metrics
// correlate .78-.94 with each other, so five columns behave like about three
// independent ones and 250 hitters pack into it tightly. At a full-season pool
// NO qualified hitter fails to find three neighbours over 50. Nor does the
// archetype it was expected to catch: a bottom-decile-power, 99th-percentile-
// speed profile probed against the real file finds its closest match at .048
// (match 88), because the league is full of slap-hitting burners. The floor is
// still doing real work, just at the other end of the season — subsampling the
// pool to the size it has in April, 5% of hitters get a short list at 40
// comparables and a third of them do at 20. Raising it to catch full-season
// profiles too (65 clips 1.6%, 70 clips 4.4%) would mean calling a 14-point
// mean gap "not a comparison", which is a claim the data doesn't support
// either. So: a guard against a thin pool and an edge profile, not a routine
// filter. Anyone re-tuning it should re-measure the pool size first.
export const MIN_MATCH = 50

// One hitter's percentile map (savant-percentiles.json's `bat` entry) reduced
// to the subset of PROFILE_KEYS actually on file. Null when he's under the
// floor above — callers treat that as "not comparable", not as an empty
// profile, exactly as a null arsenalVector works on the pitching side.
export function profileVector(pct) {
  if (!pct) return null
  const vec = {}
  for (const key of PROFILE_KEYS) {
    if (Number.isFinite(pct[key])) vec[key] = pct[key]
  }
  return Object.keys(vec).length >= MIN_KNOWN_METRICS ? vec : null
}

// 0 (identical profile) .. 1 (opposite on every metric): the mean absolute
// percentile gap over the metrics BOTH hitters have on file, rescaled to 0-1.
//
// A MEAN and not a sum, so a pair compared on four metrics is on the same scale
// as a pair compared on five and the two can be ranked against each other. The
// shared set is re-checked against MIN_KNOWN_METRICS rather than trusted from
// the vectors: two hitters can each clear the floor on four metrics and still
// share only three, and that pair is exactly the overclaim the floor exists to
// refuse. Null then — no distance, rather than a confident small number.
//
// Symmetric by construction (|a-b| is), so unlike the arsenal version this
// needs no key-ordering trick — PROFILE_KEYS is a fixed literal, so both
// directions sum the same terms in the same order.
export function profileDistance(a, b) {
  if (!a || !b) return null
  const shared = PROFILE_KEYS.filter((key) => Number.isFinite(a[key]) && Number.isFinite(b[key]))
  if (shared.length < MIN_KNOWN_METRICS) return null
  let sum = 0
  for (const key of shared) sum += Math.abs(a[key] - b[key]) / 100
  return sum / shared.length
}

// The card itself: the `limit` closest bats to `personId` in the pool.
//
// `pool` is a list of {personId, pct} — the caller (src/api/savantPercentiles.js)
// is what knows how savant-percentiles.json is shaped, so this stays a pure
// ranking over whatever pool it's handed and can be tested with three
// hand-written hitters. Names and clubs are deliberately NOT in the pool shape:
// that file carries percentiles only, and the card resolves identities itself.
//
// Returns [] whenever it can't answer — subject absent, or under the metric
// floor — so the card simply doesn't render.
export function similarHitters(pool, personId, { limit = 3 } = {}) {
  const subject = pool.find((p) => String(p.personId) === String(personId))
  if (!subject) return []
  const subjectVec = profileVector(subject.pct)
  if (!subjectVec) return []

  const scored = []
  for (const cand of pool) {
    if (String(cand.personId) === String(personId)) continue
    const vec = profileVector(cand.pct)
    if (!vec) continue
    const distance = profileDistance(subjectVec, vec)
    if (distance == null) continue
    scored.push({ personId: cand.personId, distance, match: matchScore(distance) })
  }
  // Ties broken by personId so the list is stable run to run rather than
  // reordering on whatever order the source file happened to serialise in.
  // Percentiles are whole numbers, so exact ties are common here in a way they
  // never are among arsenal shares — this tie-break earns its keep.
  scored.sort((a, b) => a.distance - b.distance || String(a.personId).localeCompare(String(b.personId)))
  return scored.filter((p) => p.match >= MIN_MATCH).slice(0, limit)
}
