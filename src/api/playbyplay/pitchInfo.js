// Per-pitch classification (call code -> dot category -> ladder side) and the
// per-plate-appearance pitch-card/matchup-pitcher shaping built on top of it.
// WHIFF_CODES/FOUL_CODES/pitchCallCode are shared with derive.js (reveal-only)
// and pitchDotCategory/pitchCallCode with gen-fouls.mjs's season foul sweep —
// see ../playbyplay.js's barrel and src/api/CLAUDE.md. Split (ADR-0038,
// check-file-size.mjs) out of src/api/playbyplay.js.

import { personNameParts } from '../select.js'
import { challengeForPlay } from '../challenges.js'

// THE CODE TABLE. Every call code MLB itself publishes at
// https://statsapi.mlb.com/api/v1/pitchCodes, sorted into the categories this
// app draws with. The table is closed and small, so it is enumerated here in
// full rather than guessed at: a code in none of the sets below falls to the
// 'ball' branch of pitchDotCategory, and a STRIKE that lands there draws its
// mark in the wrong lane of the ladder — a strikeout that appears to have taken
// two strikes. That is what a missed bunt ('M') did (gamePk 823751, top 7:
// Austin Martin bunts foul, misses a bunt, then swings through strike three,
// and his card drew one ball and two strikes). test/pitch-codes.test.js pins
// the whole table against MLB's own strikeStatus/ballStatus flags.

// Strikes taken without a swing: the umpire's call, and the automatic strikes
// he awards on a violation. 'K' is the feed's own "Strike - Unknown".
const CALLED_STRIKE_CODES = new Set(['C', 'K', 'A', 'AB', 'AC'])
// He swung and missed: swinging, swinging (blocked), missed bunt, swinging on a
// pitchout. Shared with derive.js's Whiffs total and scripts/gen-fouls.mjs.
// Matches MLB's own swingMissStatus flag except for the two foul TIPS ('T',
// 'O'), which it also flags but which this app counts as fouls — the catcher
// caught them, and at two strikes they end the at-bat (see FOUL_ENDS_AB_CODES).
export const WHIFF_CODES = new Set(['S', 'W', 'M', 'Q'])
// Foul, foul bunt, foul tip, bunt foul tip, foul on a pitchout. Shared with
// derive.js's per-half foul counters and scripts/gen-fouls.mjs (the season foul
// sweep) so the code set never drifts between the live and precomputed tallies.
export const FOUL_CODES = new Set(['F', 'L', 'T', 'O', 'R'])
// The fouls that END a plate appearance at two strikes rather than extending
// it: a foul TIP is caught for strike three, and a batter who bunts foul with
// two strikes is out by rule (5.09(a)(4)). Every counter that measures the
// AB-EXTENDING foul — the spoil — has to exclude these.
export const FOUL_ENDS_AB_CODES = new Set(['T', 'L', 'O'])
// In play: no out / out(s) / run(s), each in a plain and a pitchout flavor.
const INPLAY_CODES = new Set(['D', 'X', 'E', 'J', 'Y', 'Z'])
// Balls, thrown ('B', '*B', 'H', 'I', 'P') and awarded ('V…'). Exported so
// derive.js's first-pitch-strike convention reads this one list instead of
// keeping a second copy of it.
export const BALL_CODES = new Set(['B', '*B', 'H', 'I', 'P', 'V', 'VB', 'VC', 'VP', 'VS'])
// The calls that move the count with NO pitch thrown: a pitch-timer or
// batter-timeout violation, a shift violation, and the balls that finish an
// intentional walk. The feed marks each `isPitch: false` and spends no pitch
// number on it (verified against gamePks 823430, 824481 and 823517), so they
// reach a card only because pitchCardInfo asks for them by name — and they are
// counted as a pitch by nobody.
const AUTOMATIC_CODES = new Set(['A', 'AB', 'AC', 'V', 'VB', 'VC', 'VP', 'VS'])

// A pitch event's call code, wherever this feed variant put it. Shared with
// derive.js so the two never drift on the feed shape.
export function pitchCallCode(e) {
  return e?.details?.call?.code ?? e?.details?.code
}

// Classifies one call code into the five dots the card renders. An automatic
// strike shares the called-strike dot (the umpire put it on the count either
// way) and an automatic ball the ball dot, so adding them cost no new color.
// A code MLB has not published yet falls back to 'ball' rather than throwing.
export function pitchDotCategory(code) {
  if (CALLED_STRIKE_CODES.has(code)) return 'called'
  if (WHIFF_CODES.has(code)) return 'whiff'
  if (FOUL_CODES.has(code)) return 'foul'
  if (INPLAY_CODES.has(code)) return 'inplay'
  return 'ball'
}

// The two-column pitch ladder (see PlayByPlay.jsx) sorts each entry into a ball
// column or a strike column. Anything that isn't a ball is a strike for column
// purposes (called, swinging, foul), and a ball put in play shows as an 'X'
// rather than a number. Returns { side: 'ball' | 'strike', label } per entry,
// in order.
//
// A label is the entry's PITCH number, so it matches the numbered dots on the
// same at-bat's strike-zone plot. Automatic calls therefore can't be numbered:
// MLB spends no pitch number on one, and taking a number here would renumber
// every pitch after it. They are marked 'A' instead, the same way an in-play
// ball is marked 'X'.
export function pitchLadder(codes) {
  let thrown = 0
  return codes.map((code) => {
    const cat = pitchDotCategory(code)
    const side = cat === 'ball' ? 'ball' : 'strike'
    if (AUTOMATIC_CODES.has(code)) return { side, label: 'A' }
    thrown += 1
    return { side, label: cat === 'inplay' ? 'X' : String(thrown) }
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
  // Two lists, and the split matters. `pitches` is the COUNT — every call that
  // moved it, including the automatic ones the feed flags `isPitch: false`
  // (without them the ladder drew a strikeout on two strikes; gamePk 823430,
  // top 7, Brady House). `pitchEvents`/`pitchDetails` are the pitches actually
  // THROWN, which is what the strike-zone plot and the numbered pitch list are
  // about — an automatic call carries no location, velo, type or playId and
  // takes no row there.
  const events = play.playEvents ?? []
  const pitches = events.filter((e) => e.isPitch || AUTOMATIC_CODES.has(pitchCallCode(e))).map(pitchCallCode)
  const pitchEvents = events.filter((e) => e.isPitch)
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
// api/callout-notes.js), same field pitchers.js already reads. `jersey` comes
// off the PITCHING side's own boxscore roster — the play's `about.halfInning`
// says which ('top' bats away, so home pitches, and vice versa) — same
// `jerseyNumber ?? primaryNumber` fallback resolveBatter uses for the batter.
export function matchupPitcher(feed, play) {
  const pitcherId = play.matchup?.pitcher?.id
  if (pitcherId == null) return null
  const person = feed?.gameData?.players?.[`ID${pitcherId}`] ?? {}
  const pitchingSide = play.about?.halfInning === 'top' ? 'home' : 'away'
  const box = feed?.liveData?.boxscore?.teams?.[pitchingSide]?.players?.[`ID${pitcherId}`] ?? {}
  return {
    id: pitcherId,
    ...personNameParts(person),
    hand: person.pitchHand?.code ?? '',
    jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
  }
}
