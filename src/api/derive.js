// Derived per-inning stats — Pitches, Whiffs, First-Pitch Strikes — computed
// from play-by-play. These are NOT pre-totaled anywhere in the API, so we walk
// feed.liveData.plays.allPlays and bucket pitch events by inning + half.
//
// This is score-revealing-adjacent detail, so like linescore.js it must only
// be called on reveal. Computing the whole map is a single pass; the caller
// memoizes the result and only triggers it when a derived box is uncovered.

// Pitch call codes and non-PA event types are shared with the play-by-play
// module (both reveal-only) so the two can never drift on the feed shape.
import { NON_PA_EVENT_TYPES, WHIFF_CODES, pitchCallCode } from './playbyplay.js'

// First-pitch-strike convention: the first pitch counts as a strike unless it
// is a ball, ball in dirt, intentional ball, pitchout, or hit-by-pitch.
// Called/swinging strikes, fouls, and balls put in play all count. ('*B' is
// the API's "Ball - Ball In Dirt" — a genuine ball; missing it counted a
// first-pitch 55-footer as a strike.)
const NON_STRIKE_CODES = new Set(['B', '*B', 'I', 'P', 'H'])

function key(inning, half) {
  return `${inning}-${half}` // half is 'top' | 'bottom'
}

// Returns a map: "inning-half" -> { pitches, whiffs, firstPitchStrikes,
// plateAppearances }. Computed fresh from the passed feed; the caller must
// rebuild it when the feed changes (a live Refresh) rather than caching it
// across feeds, or the live inning's stats go stale.
export function computeDerivedByInning(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const map = {}

  const bucket = (k) =>
    (map[k] ??= {
      pitches: 0,
      whiffs: 0,
      firstPitchStrikes: 0,
      plateAppearances: 0,
      // Statcast-flavored superlatives for the half — the game-notes numbers
      // ("Miz threw 104.5"). null when the feed carries no tracking data
      // (common at MiLB levels); callers hide the stat rather than show 0.
      maxVelo: null, // fastest pitch, mph
      maxVeloType: '', // its pitch type ("Four-Seam Fastball")
      hardestHit: null, // top exit velocity, mph
      longestHit: null, // longest tracked batted ball, ft
    })

  for (const play of plays) {
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    if (!inning || !half) continue
    const b = bucket(key(inning, half))

    const events = play.playEvents ?? []
    const pitches = events.filter((e) => e.isPitch)

    if (pitches.length === 0) continue

    // A baserunning-only play (inning-ending caught stealing mid-count, wild
    // pitch...) is not a plate appearance — the batter restarts as his own
    // later play, so counting both would double him in the PA and first-pitch
    // denominators. Its PITCHES still count: they were genuinely thrown and
    // are not re-listed in the resumed at-bat.
    const isPA = !NON_PA_EVENT_TYPES.has(play.result?.eventType)
    if (isPA) b.plateAppearances += 1
    b.pitches += pitches.length

    for (const e of pitches) {
      const code = pitchCallCode(e)
      if (code && WHIFF_CODES.has(code)) b.whiffs += 1

      const velo = e.pitchData?.startSpeed
      if (typeof velo === 'number' && velo > (b.maxVelo ?? -Infinity)) {
        b.maxVelo = velo
        b.maxVeloType = e.details?.type?.description ?? ''
      }
      const ev = e.hitData?.launchSpeed
      if (typeof ev === 'number' && ev > (b.hardestHit ?? -Infinity)) {
        b.hardestHit = ev
      }
      const dist = e.hitData?.totalDistance
      if (typeof dist === 'number' && dist > (b.longestHit ?? -Infinity)) {
        b.longestHit = dist
      }
    }

    // First pitch of the plate appearance (skipped for non-PA plays — their
    // pitches belong to an at-bat that gets its own play later).
    if (isPA) {
      const first = pitches.find((e) => e.pitchNumber === 1) ?? pitches[0]
      const firstCode = pitchCallCode(first)
      if (firstCode && !NON_STRIKE_CODES.has(firstCode)) {
        b.firstPitchStrikes += 1
      }
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
      maxVelo: null,
      maxVeloType: '',
      hardestHit: null,
      longestHit: null,
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
