// Per-pitch classification (call code -> dot category -> ladder side) and the
// per-plate-appearance pitch-card/matchup-pitcher shaping built on top of it.
// WHIFF_CODES/FOUL_CODES/pitchCallCode are shared with derive.js (reveal-only)
// and pitchDotCategory/pitchCallCode with gen-fouls.mjs's season foul sweep —
// see ../playbyplay.js's barrel and src/api/CLAUDE.md. Split (ADR-0038,
// check-file-size.mjs) out of src/api/playbyplay.js.

import { personNameParts } from '../select.js'
import { challengeForPlay } from '../challenges.js'

// Swinging strike, swinging strike (blocked). Shared with derive.js.
export const WHIFF_CODES = new Set(['S', 'W'])
// Foul, foul bunt, foul tip. Shared with derive.js's per-half foul counters
// and scripts/gen-fouls.mjs (the season foul sweep) so the code set never
// drifts between the live and precomputed foul tallies.
export const FOUL_CODES = new Set(['F', 'L', 'T'])
const INPLAY_CODES = new Set(['D', 'X', 'E']) // in play: no out / out(s) / run(s)

// A pitch event's call code, wherever this feed variant put it. Shared with
// derive.js so the two never drift on the feed shape.
export function pitchCallCode(e) {
  return e?.details?.call?.code ?? e?.details?.code
}

// Classifies one pitch call code into the five dots the card renders.
// Unrecognized codes fall back to 'ball' rather than throwing.
export function pitchDotCategory(code) {
  if (code === 'C') return 'called'
  if (WHIFF_CODES.has(code)) return 'whiff'
  if (FOUL_CODES.has(code)) return 'foul'
  if (INPLAY_CODES.has(code)) return 'inplay'
  return 'ball'
}

// The two-column pitch ladder (see PlayByPlay.jsx) sorts each pitch into a
// ball column or a strike column, keeping its 1-based place in the at-bat.
// Anything that isn't a plain ball is a strike for column purposes (called,
// swinging, foul), and a ball put in play shows as an 'X' rather than a
// number. Returns { side: 'ball' | 'strike', label } per pitch, in order.
export function pitchLadder(codes) {
  return codes.map((code, i) => {
    const cat = pitchDotCategory(code)
    if (cat === 'ball') return { side: 'ball', label: String(i + 1) }
    if (cat === 'inplay') return { side: 'strike', label: 'X' }
    return { side: 'strike', label: String(i + 1) }
  })
}

// Whether a plate appearance's pitch detail carries plottable plate-crossing
// locations — true only if at least one pitch has numeric pX/pZ AND a batter
// zone (strikeZoneTop/Bottom) to scale against. False at MiLB parks with no
// tracking, so callers can drop the strike-zone diagram entirely.
export function hasPitchLocations(pitchDetails) {
  return (pitchDetails ?? []).some(
    (p) =>
      typeof p.px === 'number' &&
      typeof p.pz === 'number' &&
      typeof p.szTop === 'number' &&
      typeof p.szBottom === 'number',
  )
}

// The pitch-sequence fields an at-bat card renders, shared by a real plate
// appearance's card and an INTERRUPTED at-bat's card (a top-level baserunning
// play that carries the pitches thrown to whoever was mid-count when the half
// ended on the bases — see the main loop). Per-pitch detail feeds the
// strike-zone diagram: plate-crossing location (pX/pZ) against the batter's
// own zone (strikeZoneTop/Bottom), plus velo and pitch type for the sequence
// list. All Statcast-ish, so every field is null-guarded — at MiLB parks with
// no tracking pX/pZ are simply absent and StrikeZone renders nothing (same
// degrade as derive.js).
// `feed` is only needed for challengeForPlay's team-id lookup (challenges.js)
// — everything else here reads straight off `play`.
export function pitchCardInfo(feed, play) {
  const pitchEvents = (play.playEvents ?? []).filter((e) => e.isPitch)
  const pitches = pitchEvents.map(pitchCallCode)
  // At most one challenge per play (challengeForPlay's own contract) — pinned
  // to a pitchNumber, matched against each pitch's own `no` below so only
  // that one pitch's row carries it.
  const challenge = challengeForPlay(feed, play)
  const pitchDetails = pitchEvents.map((e, i) => {
    const code = pitchCallCode(e)
    const pd = e.pitchData ?? {}
    const co = pd.coordinates ?? {}
    const no = e.pitchNumber ?? i + 1
    return {
      no,
      code,
      cat: pitchDotCategory(code),
      px: typeof co.pX === 'number' ? co.pX : null,
      pz: typeof co.pZ === 'number' ? co.pZ : null,
      szTop: typeof pd.strikeZoneTop === 'number' ? pd.strikeZoneTop : null,
      szBottom: typeof pd.strikeZoneBottom === 'number' ? pd.strikeZoneBottom : null,
      mph: typeof pd.startSpeed === 'number' ? pd.startSpeed : null,
      type: e.details?.type?.description ?? '',
      callDesc: e.details?.call?.description ?? '',
      challenge: challenge?.pitchNumber === no ? challenge : null,
    }
  })
  return { pitchEvents, pitches, pitchDetails }
}

// The pitcher a plate appearance faced (for the strike-zone panel's "vs"
// header) — his name parts off gameData, same shape as the batter. `hand`
// ('L'/'R', bio fact not a result) feeds the platoon-split call-out (see
// api/callout-notes.js), same field pitchers.js already reads.
export function matchupPitcher(feed, play) {
  const pitcherId = play.matchup?.pitcher?.id
  if (pitcherId == null) return null
  const person = feed?.gameData?.players?.[`ID${pitcherId}`] ?? {}
  return { id: pitcherId, ...personNameParts(person), hand: person.pitchHand?.code ?? '' }
}
