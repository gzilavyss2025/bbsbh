// Derived per-inning stats — Pitches, Whiffs, First-Pitch Strikes — computed
// from play-by-play. These are NOT pre-totaled anywhere in the API, so we walk
// feed.liveData.plays.allPlays and bucket pitch events by inning + half.
//
// This is score-revealing-adjacent detail, so like linescore.js it must only
// be called on reveal. Computing the whole map is a single pass; the caller
// memoizes the result and only triggers it when a derived box is uncovered.

// Pitch call codes and non-PA event types are shared with the play-by-play
// module (both reveal-only) so the two can never drift on the feed shape.
import { NON_PA_EVENT_TYPES, WHIFF_CODES, FOUL_CODES, pitchCallCode } from './playbyplay.js'
// Per-half LOB rides along from the linescore (also reveal-only).
import { revealInning } from './linescore.js'

// First-pitch-strike convention: the first pitch counts as a strike unless it
// is a ball, ball in dirt, intentional ball, pitchout, or hit-by-pitch.
// Called/swinging strikes, fouls, and balls put in play all count. ('*B' is
// the API's "Ball - Ball In Dirt" — a genuine ball; missing it counted a
// first-pitch 55-footer as a strike.)
const NON_STRIKE_CODES = new Set(['B', '*B', 'I', 'P', 'H'])

// Plate half-width + ball radius, in feet — the same zone-geometry constants
// as api/umpireFavor.js's missEdge (deliberately duplicated rather than
// imported, mirroring how scripts/gen-umpire-accuracy.mjs already keeps its
// own copy of this exact check — see that file's header). Used only to COUNT
// a called pitch the ump got backwards (ball called strike or vice versa);
// umpireFavor.js's version additionally scores the run-expectancy swing of
// its single worst one.
const HALF_PLATE = 8.5 / 12
const BALL_R = 1.45 / 12

// Whether a called pitch (ball or strike) was called incorrectly against its
// own tracked plate location + the batter's strike zone. Null when the pitch
// wasn't a ball/strike call (swing, foul, in play) or the feed carries no
// tracking data for it — same MiLB degrade as the rest of this module.
function isMissedCall(e) {
  const code = pitchCallCode(e)
  const strikeCall = code === 'C'
  const ballCall = code === 'B' || code === '*B'
  if (!strikeCall && !ballCall) return null
  const c = e.pitchData?.coordinates
  const top = e.pitchData?.strikeZoneTop
  const bot = e.pitchData?.strikeZoneBottom
  if (!c || c.pX == null || c.pZ == null || top == null || bot == null) return null
  const inX = Math.abs(c.pX) <= HALF_PLATE + BALL_R
  const inZ = c.pZ <= top + BALL_R && c.pZ >= bot - BALL_R
  const actualStrike = inX && inZ
  return actualStrike !== strikeCall
}

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
      fouls: 0,
      // Fouls hit AT two strikes (the at-bat-extending kind) — a different,
      // more telling count than raw fouls. See .scratch/metric-engines/.
      twoStrikeFouls: 0,
      firstPitchStrikes: 0,
      plateAppearances: 0,
      // A called ball/strike the tracked pitch location disagreed with (a
      // ball called a strike, or vice versa). null until the first tracked
      // called pitch this half — absent entirely at untracked MiLB parks, so
      // callers hide the stat rather than show a false 0 (see maxVelo below).
      missedCalls: null,
      // Statcast-flavored superlatives for the half — the game-notes numbers
      // ("Miz threw 104.5"). null when the feed carries no tracking data
      // (common at MiLB levels); callers hide the stat rather than show 0.
      maxVelo: null, // fastest pitch, mph
      maxVeloType: '', // its pitch type ("Four-Seam Fastball")
      maxVeloPlayer: '', // the pitcher who threw it
      maxVeloPlayerId: null, // his personId — the box score's Insights card headshot
      hardestHit: null, // top exit velocity, mph
      hardestHitPlayer: '', // the batter who hit it
      hardestHitPlayerId: null,
      longestHit: null, // longest tracked batted ball, ft
      longestHitPlayer: '', // the batter who hit it
      longestHitPlayerId: null,
    })

  // A pitch event's `count` is the count AFTER that pitch (same off-by-one
  // gen-run-expectancy.mjs documents), so the pre-pitch strike count is
  // carried forward pitch to pitch — and across a non-PA play into the same
  // batter's resumed at-bat, whose count continues.
  let carryBatter = null
  let carryStrikes = 0

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

    const batterId = play.matchup?.batter?.id ?? null
    let preStrikes = batterId != null && batterId === carryBatter ? carryStrikes : 0

    for (const e of pitches) {
      const code = pitchCallCode(e)
      if (code && WHIFF_CODES.has(code)) b.whiffs += 1
      if (code && FOUL_CODES.has(code)) {
        b.fouls += 1
        // A two-strike foul TIP ('T') is caught for strike three — it ends
        // the at-bat rather than extending it, so it stays out of the
        // AB-extending counter (mirrors gen-fouls.mjs).
        if (preStrikes === 2 && code !== 'T') b.twoStrikeFouls += 1
      }
      preStrikes = e.count?.strikes ?? preStrikes

      const missed = isMissedCall(e)
      if (missed != null) b.missedCalls = (b.missedCalls ?? 0) + (missed ? 1 : 0)

      const velo = e.pitchData?.startSpeed
      if (typeof velo === 'number' && velo > (b.maxVelo ?? -Infinity)) {
        b.maxVelo = velo
        b.maxVeloType = e.details?.type?.description ?? ''
        b.maxVeloPlayer = play.matchup?.pitcher?.fullName ?? ''
        b.maxVeloPlayerId = play.matchup?.pitcher?.id ?? null
      }
      const ev = e.hitData?.launchSpeed
      if (typeof ev === 'number' && ev > (b.hardestHit ?? -Infinity)) {
        b.hardestHit = ev
        b.hardestHitPlayer = play.matchup?.batter?.fullName ?? ''
        b.hardestHitPlayerId = play.matchup?.batter?.id ?? null
      }
      const dist = e.hitData?.totalDistance
      if (typeof dist === 'number' && dist > (b.longestHit ?? -Infinity)) {
        b.longestHit = dist
        b.longestHitPlayer = play.matchup?.batter?.fullName ?? ''
        b.longestHitPlayerId = play.matchup?.batter?.id ?? null
      }
    }

    // A non-PA play's batter resumes with his count intact in a later play;
    // a completed PA resets the carry.
    if (!isPA) {
      carryBatter = batterId
      carryStrikes = preStrikes
    } else {
      carryBatter = null
      carryStrikes = 0
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
      fouls: 0,
      twoStrikeFouls: 0,
      firstPitchStrikes: 0,
      plateAppearances: 0,
      missedCalls: null,
      maxVelo: null,
      maxVeloType: '',
      maxVeloPlayer: '',
      maxVeloPlayerId: null,
      hardestHit: null,
      hardestHitPlayer: '',
      hardestHitPlayerId: null,
      longestHit: null,
      longestHitPlayer: '',
      longestHitPlayerId: null,
    }
  )
}

// Whole-game Statcast superlatives — the fastest pitch, hardest-hit ball, and
// longest ball across every half-inning, for the box score's Insights card.
// Same reveal-only rule as the rest of this module: the whole game is already
// behind the box score's SealBox by the time this is called, so aggregating
// every half here doesn't leak anything the seal wasn't already covering.
// `derivedMap` lets a caller that already built the per-inning map (the box
// score builds one for the By-inning digest too) pass it in rather than have
// this re-walk the whole play-by-play a second time.
export function computeGameSuperlatives(feed, derivedMap) {
  const map = derivedMap ?? computeDerivedByInning(feed)
  const best = {
    maxVelo: null,
    maxVeloType: '',
    maxVeloPlayer: '',
    maxVeloPlayerId: null,
    hardestHit: null,
    hardestHitPlayer: '',
    hardestHitPlayerId: null,
    longestHit: null,
    longestHitPlayer: '',
    longestHitPlayerId: null,
  }
  for (const b of Object.values(map)) {
    if (b.maxVelo != null && b.maxVelo > (best.maxVelo ?? -Infinity)) {
      best.maxVelo = b.maxVelo
      best.maxVeloType = b.maxVeloType
      best.maxVeloPlayer = b.maxVeloPlayer
      best.maxVeloPlayerId = b.maxVeloPlayerId
    }
    if (b.hardestHit != null && b.hardestHit > (best.hardestHit ?? -Infinity)) {
      best.hardestHit = b.hardestHit
      best.hardestHitPlayer = b.hardestHitPlayer
      best.hardestHitPlayerId = b.hardestHitPlayerId
    }
    if (b.longestHit != null && b.longestHit > (best.longestHit ?? -Infinity)) {
      best.longestHit = b.longestHit
      best.longestHitPlayer = b.longestHitPlayer
      best.longestHitPlayerId = b.longestHitPlayerId
    }
  }
  return best
}

// A per-half-inning tally for the box score's "By inning" digest: pitches
// thrown, whiffs (swing-and-miss), and runners left on base, one entry per
// played half in order. Unlike the Statcast superlatives above, every figure
// here comes from plain play-by-play (pitch call codes + the linescore's LOB),
// so it survives at MiLB parks with no ball-tracking. Reveal-only, like the
// rest of this module — the whole box score is already behind its seal.
export function computeInningDigest(feed, derivedMap) {
  const derived = derivedMap ?? computeDerivedByInning(feed)
  const innings = feed?.liveData?.linescore?.innings ?? []
  const rows = []
  for (const inn of innings) {
    const num = inn.num
    if (num == null) continue
    // A half was played only if the linescore carries that side's sub-object
    // (a walk-off skips the home half of the last inning).
    if (inn.away != null) {
      const d = derived[`${num}-top`]
      rows.push({
        inning: num,
        half: 'top',
        side: 'away',
        pitches: d?.pitches ?? 0,
        whiffs: d?.whiffs ?? 0,
        fouls: d?.fouls ?? 0,
        lob: revealInning(feed, num, 'away')?.leftOnBase ?? 0,
      })
    }
    if (inn.home != null) {
      const d = derived[`${num}-bottom`]
      rows.push({
        inning: num,
        half: 'bottom',
        side: 'home',
        pitches: d?.pitches ?? 0,
        whiffs: d?.whiffs ?? 0,
        fouls: d?.fouls ?? 0,
        lob: revealInning(feed, num, 'home')?.leftOnBase ?? 0,
      })
    }
  }
  return rows
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

// Cumulative missed-call count through the half being viewed — unlike
// rollingPitches above (one pitcher's side only), a blown ball/strike call
// belongs to the plate umpire regardless of which team is pitching, so this
// sums BOTH halves of every earlier inning plus the top half of the current
// one, adding its bottom half too only when `half` itself is 'bottom'. Since
// a half only renders this card once revealed, and reveal only ever advances
// one half at a time, every half this sums over is already something the
// user has revealed — same footing as challenges.js/umpireFavor.js's
// cumulative-through-the-reached-half figures. Null (not 0) until at least
// one summed half has tracking data, so an all-MiLB game hides the stat
// instead of showing a false 0 — same convention as missedCalls itself.
export function rollingMissedCalls(derivedMap, inningNum, half) {
  let total = null
  for (let n = 1; n <= inningNum; n++) {
    const halves = n < inningNum || half === 'bottom' ? ['top', 'bottom'] : ['top']
    for (const h of halves) {
      const mc = derivedMap[key(n, h)]?.missedCalls
      if (mc != null) total = (total ?? 0) + mc
    }
  }
  return total
}
