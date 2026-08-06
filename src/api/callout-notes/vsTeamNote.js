// The vs-opponent career note builder — split out of ../callout-notes.js. See
// that file's header for the two-tenses rule (ADR-0014) this whole directory
// implements; this family is entering-tense only (a career fact, not
// tonight's result), fired from liveAtBat.js's buildCallouts on a batter's
// first PA of the game.

import { isNum } from './shared.js'

// --- the vs-opponent career note ---------------------------------------------
// A hitter's career line against one club, from the separately-fetched
// vs-team-splits file (api/vsTeamSplits.js) — read directly here rather than
// through that module's vsTeamSplitsFor, which also builds the player-page's
// opponent-selector strip that this per-PA note has no use for. `car` is a
// CAREER total (see gen-vs-team-splits.mjs), not season-only, so the note
// always reads "career", never "this year".
//
// This note earned a reputation for noise (a bare "Career .278 against the
// Tigers" on nearly every batter), so it's deliberately the strictest family
// here. Three rules:
//   1. A real sample — VS_TEAM_MIN_AB at-bats across VS_TEAM_MIN_GAMES games —
//      or the "career" line is a coincidence, not a fact.
//   2. A baseline is REQUIRED: without gen-callouts.mjs's `hitterLines` (his
//      own season + whole-career totals — see hitterEnrich) there's no way to
//      tell unusual from ordinary, so no note at all (this also silences the
//      family entirely when a stale bundle predates hitterLines, rather than
//      degrading to the old unfiltered firehose).
//   3. It only fires on a specific, notable ANGLE, and the note's text carries
//      the sample size and the baseline it beat, so the reader can judge it:
//        - AVG:  vs-club average ≥ AVG_DEVIATION_THRESHOLD away from EVERY
//                baseline he has (season and career), all in the same
//                direction — a hitter who's simply been better than usual
//                across the board doesn't get an "against the Cubs" framing.
//        - HR:   an outsized share of his career homers have come against this
//                club (share of HR ≥ HR_SHARE_RATIO × share of AB).
//        - XBH:  his hits against them go for extra bases far above his career
//                rate.
//        - BB:   they walk him far above his career rate.
//      One note per hitter — the strongest angle wins, ranked by how far past
//      its own threshold it landed (`strength`, folded into the note's
//      worthiness score, which the box-score roll-up's family cap sorts by).
// The rate angles read `pa`/`bb`/`xbh` fields that gen-vs-team-splits.mjs and
// hitterEnrich only started writing together with this gate — a data file
// predating them simply never fires those angles.
const VS_TEAM_MIN_GAMES = 5
const VS_TEAM_MIN_AB = 25
const AVG_DEVIATION_THRESHOLD = 0.06
const HR_MIN = 4 // HR against the club
const HR_SHARE_RATIO = 2 // share of career HR ≥ 2× share of career AB
const XBH_MIN = 8 // extra-base hits against the club
const XBH_RATE_RATIO = 1.75 // share of hits going XB ≥ 1.75× career share
const BB_MIN = 8 // walks against the club
const BB_MIN_PA = 40 // walk rate needs PA, not AB, underneath it
const BB_RATE_RATIO = 1.8
export const VS_TEAM_ROLLUP_MAX = 3 // most vs-opponent notes the box-score roll-up shows

const pct = (rate) => `${Math.round(rate * 100)}%`

export function buildVsTeamNote(vsTeam, personId, teamId, hitterLines, oppName) {
  const car = vsTeam?.players?.[personId]?.vs?.[String(teamId)]?.car
  if (!car || !(car.g >= VS_TEAM_MIN_GAMES) || !(car.ab >= VS_TEAM_MIN_AB)) return null
  const season = hitterLines?.[personId]?.season ?? null
  const career = hitterLines?.[personId]?.career ?? null
  if (!season && !career) return null

  // "(13-for-35, 9 games)" — the sample every variant carries. `h` predates
  // the rate fields, but guard it the same way for the same stale-file reason.
  const sample = isNum(car.h) ? `${car.h}-for-${car.ab}, ${car.g} games` : `${car.ab} AB, ${car.g} games`
  const candidates = []

  // AVG — far from every baseline he has, all in the same direction.
  const vsAvg = Number(car.avg)
  const deltas = [season, career]
    .map((l) => (l ? vsAvg - Number(l.avg) : null))
    .filter((d) => isNum(d))
  if (
    isNum(vsAvg) &&
    deltas.length &&
    deltas.every((d) => Math.abs(d) >= AVG_DEVIATION_THRESHOLD) &&
    new Set(deltas.map(Math.sign)).size === 1
  ) {
    const against = career ? `a ${career.avg} hitter overall` : `hitting ${season.avg} this season`
    candidates.push({
      text: `Career ${car.avg} against the ${oppName} (${sample}) — ${against}`,
      strength: Math.min(...deltas.map(Math.abs)) / AVG_DEVIATION_THRESHOLD,
    })
  }

  // The rate angles are hot-side only and judged against his CAREER line (the
  // honest apples-to-apples for a career vs-club split).
  if (career) {
    // HR — an outsized share of his career homers have come off this club.
    // (career.hr >= car.hr also guards a stale-file mismatch where the two
    // sources were generated on different nights — never "6 of his 5".)
    if (isNum(car.hr) && car.hr >= HR_MIN && career.hr >= car.hr && career.ab > 0) {
      const ratio = car.hr / career.hr / (car.ab / career.ab)
      if (ratio >= HR_SHARE_RATIO) {
        candidates.push({
          text: `${car.hr} of his ${career.hr} career HR have come against the ${oppName}`,
          strength: ratio / HR_SHARE_RATIO,
        })
      }
    }

    // XBH — his hits against them go for extra bases well above his norm.
    if (isNum(car.xbh) && car.xbh >= XBH_MIN && car.h > 0 && isNum(career.xbh) && career.h > 0) {
      const careerRate = career.xbh / career.h
      const ratio = careerRate > 0 ? car.xbh / car.h / careerRate : 0
      if (ratio >= XBH_RATE_RATIO) {
        candidates.push({
          text: `${car.xbh} of his ${car.h} hits against the ${oppName} have gone for extra bases (${pct(careerRate)} career)`,
          strength: ratio / XBH_RATE_RATIO,
        })
      }
    }

    // BB — they put him on far above his career walk rate.
    if (isNum(car.bb) && car.bb >= BB_MIN && car.pa >= BB_MIN_PA && isNum(career.bb) && career.pa > 0) {
      const vsRate = car.bb / car.pa
      const careerRate = career.bb / career.pa
      const ratio = careerRate > 0 ? vsRate / careerRate : 0
      if (ratio >= BB_RATE_RATIO) {
        candidates.push({
          text: `Has walked in ${pct(vsRate)} of his PA against the ${oppName} (${pct(careerRate)} career)`,
          strength: ratio / BB_RATE_RATIO,
        })
      }
    }
  }

  if (!candidates.length) return null
  return candidates.reduce((best, c) => (c.strength > best.strength ? c : best))
}
