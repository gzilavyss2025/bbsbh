// Derived per-inning stats — Pitches, Whiffs, First-Pitch Strikes — computed
// from play-by-play. These are NOT pre-totaled anywhere in the API, so we walk
// feed.liveData.plays.allPlays and bucket pitch events by inning + half.
//
// This is score-revealing-adjacent detail, so like linescore.js it must only
// be called on reveal. Computing the whole map is a single pass; the caller
// memoizes the result and only triggers it when a derived box is uncovered.

// MLB pitch call codes. A "whiff" is a swing-and-miss.
const WHIFF_CODES = new Set(['S', 'W']) // swinging strike, swinging strike (blocked)

// First-pitch-strike convention: the first pitch counts as a strike unless it
// is a ball, intentional ball, pitchout, or hit-by-pitch. Called/swinging
// strikes, fouls, and balls put in play all count.
const NON_STRIKE_CODES = new Set(['B', 'I', 'P', 'H'])

function key(inning, half) {
  return `${inning}-${half}` // half is 'top' | 'bottom'
}

// Returns a map: "inning-half" -> { pitches, whiffs, firstPitchStrikes,
// plateAppearances, lob }. `lob` here is derived and can be cross-checked
// against the linescore's leftOnBase as a sanity check.
export function computeDerivedByInning(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const map = {}

  const bucket = (k) =>
    (map[k] ??= {
      pitches: 0,
      whiffs: 0,
      firstPitchStrikes: 0,
      plateAppearances: 0,
    })

  for (const play of plays) {
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    if (!inning || !half) continue
    const b = bucket(key(inning, half))

    const events = play.playEvents ?? []
    const pitches = events.filter((e) => e.isPitch)

    if (pitches.length === 0) continue
    b.plateAppearances += 1
    b.pitches += pitches.length

    for (const e of pitches) {
      const code = e.details?.call?.code ?? e.details?.code
      if (code && WHIFF_CODES.has(code)) b.whiffs += 1
    }

    // First pitch of the plate appearance.
    const first = pitches.find((e) => e.pitchNumber === 1) ?? pitches[0]
    const firstCode = first?.details?.call?.code ?? first?.details?.code
    if (firstCode && !NON_STRIKE_CODES.has(firstCode)) {
      b.firstPitchStrikes += 1
    }
  }

  return map
}

// Convenience accessor for one inning-half; returns zeros if that half has no
// recorded pitches yet.
export function revealDerived(derivedMap, inningNum, half /* 'top'|'bottom' */) {
  return (
    derivedMap[key(inningNum, half)] ?? {
      pitches: 0,
      whiffs: 0,
      firstPitchStrikes: 0,
      plateAppearances: 0,
    }
  )
}

// Rolling (cumulative) pitch count for a pitching side through the given
// inning. The pitching side maps to the half: the home pitcher works the top
// half, the away pitcher the bottom. Sums pitches for that same half across
// innings 1..inningNum.
export function rollingPitches(derivedMap, inningNum, half) {
  let total = 0
  for (let n = 1; n <= inningNum; n++) {
    total += derivedMap[key(n, half)]?.pitches ?? 0
  }
  return total
}
