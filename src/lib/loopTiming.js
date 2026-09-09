// A stopwatch on the scoring loop — how many seconds a plate appearance
// actually takes, measured on a real game instead of guessed at.
//
// WHY THIS EXISTS. The Express Lane PRD rests on one inequality: staging
// delivers a plate appearance every ~25 seconds, and "nobody scores one faster
// than that." Every downstream decision — no staging trigger, a one-half
// pre-roll, treating "the film is behind" as a rare degraded minute — follows
// from it. The staging side of that inequality is measured to three significant
// figures. The scoring side was asserted. This module measures the scoring side.
//
// It records nothing but POSITION AND TIME: which half, which at-bat, and the
// clock. No score, no result, no event type, no velocity. That is deliberate
// and it is what keeps this spoiler-inert — the half-index is the same class of
// value `bbsbh:reveal:{gamePk}` already persists (CLAUDE.md: "only that
// half-index, never a score"), and an at-bat index is a position in a half the
// scorer has already reached and written down. What kind of play each one was
// gets joined afterwards from the public feed by (gamePk, half, ab), off the
// device, so the instrument itself never has to read a reveal-only field.
//
// NOT ANALYTICS. Nothing here is sent anywhere. `src/lib/analytics.js` is the
// Vercel telemetry choke point and it promises, in its own header, that it never
// carries a game-identifying value; this module carries a gamePk and therefore
// must never be routed into it. These marks live in localStorage on one device
// and are read back by one page, `/loop-timing`.
//
// TEMPORARY. This is a measuring instrument for one open question, not a
// product feature. When the question is answered, delete the module, its test,
// its route, and the one call site. React-free and dependency-free so the maths
// can be pinned by the unit suite (test/loop-timing.test.js).

export const LOOP_TIMING_PREFIX = 'bbsbh:looptiming:'

// Beyond two minutes between two at-bats you did not score slowly — you got up,
// answered somebody, or put the phone down. Those gaps are real life and they
// would drag a mean around, so they are counted separately and excluded from the
// distribution rather than silently averaged in.
export const AWAY_GAP_MS = 120_000

// What the PRD says Result-mode staging costs per plate appearance, at the
// measured ~2.1 Mbps ceiling. The number this measurement is a test of.
export const STAGING_BUDGET_S = 25

// A half rarely runs past a dozen batters, a game past ~90 plate appearances.
// The cap is a guard against an unbounded key, not a baseball claim.
export const MAX_MARKS = 400

export function loopTimingKey(gamePk) {
  return `${LOOP_TIMING_PREFIX}${gamePk}`
}

// A mark is {h: halfIndex, a: atBatIndex, t: epoch ms}. Short keys because this
// is written on every advance and read as raw JSON.
function normalizeMark(mark) {
  if (!mark || typeof mark !== 'object') return null
  const { h, a, t } = mark
  if (!Number.isInteger(h) || h < 0) return null
  if (!Number.isInteger(a) || a < 0) return null
  if (!Number.isFinite(t) || t <= 0) return null
  return { h, a, t }
}

// Anything the reader cannot recognize as exactly that shape is dropped rather
// than kept, so a hand-edited or half-written value cannot reach the maths.
export function readMarks(raw) {
  if (typeof raw !== 'string' || !raw) return []
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.map(normalizeMark).filter(Boolean)
}

// Stepping back and forward over the same at-bat must not manufacture a fast
// interval, so a mark replaces the existing one for that (half, at-bat) rather
// than appending a second. Kept in clock order, which is the order intervals
// are read in.
export function appendMark(marks, mark, max = MAX_MARKS) {
  const next = normalizeMark(mark)
  if (!next) return marks
  const kept = marks.filter((m) => !(m.h === next.h && m.a === next.a))
  kept.push(next)
  kept.sort((x, y) => x.t - y.t)
  return kept.length > max ? kept.slice(kept.length - max) : kept
}

// The gaps between consecutive marks, split into the ones that are somebody
// scoring and the ones that are somebody living their life.
export function intervals(marks, awayGapMs = AWAY_GAP_MS) {
  const ordered = [...marks].sort((x, y) => x.t - y.t)
  const scoring = []
  let away = 0
  for (let i = 1; i < ordered.length; i++) {
    const gap = ordered[i].t - ordered[i - 1].t
    if (gap <= 0) continue
    if (gap > awayGapMs) away++
    else scoring.push(gap)
  }
  return { scoring, away }
}

// Nearest-rank percentile. The tail is the point of this whole measurement — a
// mean would hide exactly the fast stretch that empties the staging buffer — so
// the readout leads with p20 and the median, not the average.
export function percentile(sorted, p) {
  if (!sorted.length) return null
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]
}

export function summarize(marks, { awayGapMs = AWAY_GAP_MS, budgetS = STAGING_BUDGET_S } = {}) {
  const { scoring, away } = intervals(marks, awayGapMs)
  const sorted = [...scoring].sort((x, y) => x - y)
  const s = (ms) => (ms == null ? null : Math.round((ms / 1000) * 10) / 10)
  const median = percentile(sorted, 50)
  const p20 = percentile(sorted, 20)
  // How much of the scoring the staging queue would fall behind on: the share of
  // plate appearances consumed faster than a clip arrives.
  const fasterThanBudget = sorted.filter((ms) => ms / 1000 < budgetS).length
  return {
    marks: marks.length,
    intervals: sorted.length,
    awayGaps: away,
    medianS: s(median),
    p20S: s(p20),
    p80S: s(percentile(sorted, 80)),
    fastestS: s(sorted[0] ?? null),
    slowestS: s(sorted[sorted.length - 1] ?? null),
    budgetS,
    shareFasterThanBudget: sorted.length ? Math.round((fasterThanBudget / sorted.length) * 100) : null,
    // The verdict the PRD needs, stated against the median rather than the mean.
    // `null` until there is enough of a sample to mean anything.
    outrunsScorer: sorted.length < 10 || median == null ? null : median / 1000 >= budgetS,
  }
}

// --- the one side-effecting pair, kept at the bottom and thin on purpose ---
//
// Both degrade to doing nothing: private mode, storage-disabled, a full quota, or
// a hand-mangled value must never break the tap that scores a plate appearance.
// Same shape as mergeReceiptFlag.js. The `bbsbh:` prefix means these marks are
// swept by the erase-my-data path (src/lib/account/localData.js) for free.

export function loadMarks(gamePk) {
  if (gamePk == null) return []
  try {
    return readMarks(window.localStorage.getItem(loopTimingKey(gamePk)))
  } catch {
    return []
  }
}

// Called from the advance handler. Returns the marks it wrote, or [] if storage
// is unavailable — the caller ignores it either way.
export function markAdvance(gamePk, halfIdx, atBatIdx, now = Date.now()) {
  if (gamePk == null) return []
  try {
    const key = loopTimingKey(gamePk)
    const next = appendMark(readMarks(window.localStorage.getItem(key)), {
      h: halfIdx,
      a: atBatIdx,
      t: now,
    })
    window.localStorage.setItem(key, JSON.stringify(next))
    return next
  } catch {
    return []
  }
}

// Every game this device has timed, newest first — what the readout lists.
export function timedGames() {
  try {
    const out = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(LOOP_TIMING_PREFIX)) continue
      const marks = readMarks(window.localStorage.getItem(key))
      if (!marks.length) continue
      out.push({ gamePk: key.slice(LOOP_TIMING_PREFIX.length), marks })
    }
    return out.sort((x, y) => y.marks[y.marks.length - 1].t - x.marks[x.marks.length - 1].t)
  } catch {
    return []
  }
}
