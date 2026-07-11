// Pure builder for the play-by-play "call-out" notes — the season-context lines
// (leader / streak / situational-record) shown on an at-bat card. Reads only an
// atbat entry (see computeHalfInningFeed) plus a precomputed callouts bundle
// (see api/callouts.js) and returns an ordered list of notes the card renders.
// Kept pure + separate so the trigger rules and wording are checkable and
// PlayByPlay.jsx stays a view. Empty when there's no bundle (MiLB /
// un-generated game), so the card renders exactly as before.
//
// Each note is `{ text, personId, side, oppSide, kind, score, dedupeKey }` —
// `personId` (nullable) is who the note is ABOUT, for a headshot; `side`/
// `oppSide` ('away'|'home') name whose club(s) the note concerns, for a
// team-logo fallback when there's no single person. `kind` names the note's
// family, `score` is its 0–100 worthiness (see noteScore below and
// docs/callouts.md for the rubric), and `dedupeKey` identifies "the same fact,
// restated" across plays so the box-score roll-up keeps only the most-current
// wording (a count note updates as the game adds to it — the roll-up should
// show the LAST number, not one card per occurrence). PlayByPlay's at-bat card
// only ever reads `.text`; the box score's Insights roll-up
// (computeGameCalloutNotes below) uses the identity fields to draw a
// headshot/logo card per note and `score` to rank them.
//
// TWO TENSES, ONE RULE (see ADR-0014): a note rendered on a play card inside
// the innings view may fold in only what the reader has already revealed —
// counts through THAT play ("that's No. 16 this season"), never the game's
// outcome. Result-aware wording ("moved to 18-2", "just the 2nd loss in 7
// games when he goes deep") exists ONLY in the box-score roll-up, where the
// whole game sits behind a single seal and the final score is already exposed
// by the time any note text renders.

import {
  firstRunPlay,
  firstPAIndexByBatter,
  timesFacingPitcher,
  NON_PA_EVENT_TYPES,
} from './playbyplay.js'
import { personNameParts } from './select.js'

// Marquee hit leader category keys, shared with gen-callouts.mjs (imported there).
export const HIT_CATEGORY_KEYS = ['hr', 'triples', 'doubles', 'bb_b', 'sb', 'hbp']

// Which season leader category each PA result eventType can trigger, and how the
// note reads. Marquee set only — derived from HIT_CATEGORY_KEYS above.
const HIT_TRIGGERS = {
  home_run: { cat: 'hr', phrase: 'home runs' },
  triple: { cat: 'triples', phrase: 'triples' },
  double: { cat: 'doubles', phrase: 'doubles' },
  walk: { cat: 'bb_b', phrase: 'walks' },
  intent_walk: { cat: 'bb_b', phrase: 'walks' },
  hit_by_pitch: { cat: 'hbp', phrase: 'times hit by a pitch' },
}
const STRIKEOUT_EVENTS = new Set(['strikeout', 'strikeout_double_play'])
const SB_EVENTS = new Set(['stolen_base_2b', 'stolen_base_3b', 'stolen_base_home'])
const CS_EVENTS = new Set([
  'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
])

// PA results that reach base for the on-base streak — the same three families
// the precompute's streak counter reads (hits + walks + HBP, see
// gen-callouts.mjs's hitterEnrich), so a live extension can never disagree
// with the entering number's own definition of "reached".
const ON_BASE_EVENTS = new Set([
  'single', 'double', 'triple', 'home_run',
  'walk', 'intent_walk', 'hit_by_pitch',
])

const otherSide = (side) => (side === 'away' ? 'home' : 'away')

// --- worthiness ---------------------------------------------------------------
// Every note carries a 0–100 `score` = a per-family base + a magnitude bonus,
// the callouts counterpart to the three stars' WPA ranking (ADR-0013): the
// box score's Insights card sorts by it and shows only the top few up front,
// and the pre-half strip (prehalf-callouts.js) uses it to cap itself. Bases
// encode how rare/dramatic the family is; bonuses reward how far past its own
// floor this instance landed. The full rubric — every family, its trigger,
// its gate, and its score — is docs/callouts.md; tune it there and here
// together.
const SCORE_BASE = {
  leadReversal: 85,
  birthdayStats: 60,
  birthday: 55,
  homerRec: 55,
  onBaseEnded: 50,
  onBaseExtended: 45,
  onBaseRiding: 40,
  leadHeld: 40,
  starterRec: 40,
  vsTeam: 40,
  leader: 35,
  sbStreak: 35,
  runsScored: 35,
  runsAllowed: 35,
  comeback: 30,
  scoringFirst: 30,
  inningRunDiff: 30,
  risp: 25,
  platoon: 25,
  tto: 15,
}
const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)))
// How far a W-L record sits from .500, 0–0.5 — the lopsidedness bonus scale.
const skew = (w, l) => (w + l > 0 ? Math.abs(w / (w + l) - 0.5) : 0)

// 'W-L' -> { w, l, total, pct } | null. The precompute writes records both as
// display strings (the older families) and as {w,l} objects (the newer,
// fold-tonight's-result-in families) — this bridges the string ones into math.
export function parseRecord(rec) {
  const m = /^(\d+)-(\d+)$/.exec(rec ?? '')
  if (!m) return null
  const w = Number(m[1])
  const l = Number(m[2])
  const total = w + l
  return { w, l, total, pct: total > 0 ? w / total : 0 }
}

// An entering {w, l} record restated with tonight's result folded in — the
// box-score-only voice ("moved to 18-2"; "just the 2nd loss in 7 games…").
// `team` is the club's display name, `when` the situation clause ("when he
// goes deep", "when scoring first", "in his starts"). The "just the Nth"
// framing only reads right when tonight's result cut against a genuinely
// lopsided record, so it kicks in only while the updated minority side stays
// strictly under RARE_SHARE of the total.
const RARE_SHARE = 1 / 3
export function foldedRecordText(w, l, won, team, when) {
  const nw = won ? w + 1 : w
  const nl = won ? l : l + 1
  const total = nw + nl
  const rec = `${nw}-${nl}`
  if (won && nw / total < RARE_SHARE) {
    return `Just the ${ordinal(nw)} win in ${total} games for the ${team} ${when} (now ${rec})`
  }
  if (!won && nl / total < RARE_SHARE) {
    return `Just the ${ordinal(nl)} loss in ${total} games for the ${team} ${when} (now ${rec})`
  }
  return `The ${team} ${won ? 'moved' : 'dropped'} to ${rec} ${when}`
}

// Whether the feed is a decided, finished game — the gate every result-aware
// (box-score-only) note checks before folding tonight in. A suspended tie or
// a postponed shell reports no winner and stays in entering-tense.
export function gameResult(feed) {
  const isFinal = feed?.gameData?.status?.abstractGameState === 'Final'
  const a = feed?.liveData?.linescore?.teams?.away?.runs
  const h = feed?.liveData?.linescore?.teams?.home?.runs
  const decided = typeof a === 'number' && typeof h === 'number' && a !== h
  return {
    final: isFinal && decided,
    winnerSide: isFinal && decided ? (a > h ? 'away' : 'home') : null,
  }
}

// --- in-game progress ----------------------------------------------------------
// One pass over the whole feed producing, for each play, the cumulative
// in-game counts the note builders fold into their entering numbers — so a
// card can read "that's No. 16 this season" instead of last night's 15.
// Snapshots are THROUGH the play, inclusive, so a note on a revealed card
// only ever counts plays the reader has also revealed. REVEAL-ONLY, same rule
// as the other whole-feed walks here (results give away hits/runs).
//
// Returns { byPlay: Map(atBatIndex -> snapshot), reached: Set(batterId) }:
//   snapshot = {
//     cats: { hr/triples/doubles/bb_b/hbp: n } — the play's own batter's counts,
//     reachedBefore / reachedHere — his on-base state (streak extension),
//     pitcherK — the play's pitcher's strikeouts so far,
//     sb: Map(runnerId -> { n, caughtBefore }) — steals credited on THIS play,
//   }
// `reached` is every batter who got aboard at any point (the roll-up's
// streak-ended check). Steals are counted off each play's own playEvents —
// the same path the SB leader note triggers on — so the two can't disagree;
// a steal logged as its own top-level play (no playEvents entry) is simply
// not folded in, an undercount never an overclaim.
export function computeCalloutProgress(feed) {
  const byPlay = new Map()
  const catByBatter = new Map() // batterId -> { [cat]: n }
  const reached = new Set()
  const kByPitcher = new Map()
  const sbByRunner = new Map()
  const caughtRunners = new Set()

  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const idx = play.about?.atBatIndex
    const batterId = play.matchup?.batter?.id
    const pitcherId = play.matchup?.pitcher?.id
    const eventType = play.result?.eventType ?? null
    const isPA = !NON_PA_EVENT_TYPES.has(eventType)

    const reachedBefore = batterId != null && reached.has(batterId)
    const reachedHere = batterId != null && isPA && ON_BASE_EVENTS.has(eventType)

    if (batterId != null && isPA) {
      const trig = HIT_TRIGGERS[eventType]
      if (trig) {
        const cats = catByBatter.get(batterId) ?? {}
        cats[trig.cat] = (cats[trig.cat] ?? 0) + 1
        catByBatter.set(batterId, cats)
      }
      if (reachedHere) reached.add(batterId)
    }
    if (pitcherId != null && STRIKEOUT_EVENTS.has(eventType)) {
      kByPitcher.set(pitcherId, (kByPitcher.get(pitcherId) ?? 0) + 1)
    }

    const sbHere = new Map()
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) continue
      const et = e.details?.eventType
      const rid = e.player?.id
      if (rid == null) continue
      if (SB_EVENTS.has(et)) {
        const caughtBefore = caughtRunners.has(rid)
        const n = (sbByRunner.get(rid) ?? 0) + 1
        sbByRunner.set(rid, n)
        sbHere.set(rid, { n, caughtBefore })
      } else if (CS_EVENTS.has(et)) {
        caughtRunners.add(rid)
      }
    }

    if (idx == null) continue
    byPlay.set(idx, {
      cats: batterId != null ? { ...(catByBatter.get(batterId) ?? {}) } : {},
      reachedBefore,
      reachedHere,
      pitcherK: pitcherId != null ? kByPitcher.get(pitcherId) ?? 0 : 0,
      sb: sbHere,
    })
  }
  return { byPlay, reached }
}

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
const VS_TEAM_ROLLUP_MAX = 3 // most vs-opponent notes the box-score roll-up shows

const isNum = Number.isFinite
const pct = (rate) => `${Math.round(rate * 100)}%`

function buildVsTeamNote(vsTeam, personId, teamId, hitterLines, oppName) {
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

// --- scoring-first noteworthiness ----------------------------------------------
// The scoring-first / conceding-first records are full-season, ungated at the
// data layer — and banal for most clubs (the league wins roughly two-thirds of
// the games it scores first in). A card only earns its spot when the club's
// own record sits a real distance from that league norm, in either direction:
// a .78 front-runner and a .50 shrug-it-off club are both stories; a .66 club
// is just Tuesday.
const SCORING_FIRST_NORM = 0.66
const SCORING_FIRST_MIN_GAMES = 10
const SCORING_FIRST_DEV = 0.08
function scoringFirstNote(recStr, side, teamName, opponentScored) {
  const rec = parseRecord(recStr)
  if (!rec || rec.total < SCORING_FIRST_MIN_GAMES || !teamName) return null
  const norm = opponentScored ? 1 - SCORING_FIRST_NORM : SCORING_FIRST_NORM
  const dev = Math.abs(rec.pct - norm)
  if (dev < SCORING_FIRST_DEV) return null
  const when = opponentScored ? 'when the opponent scores first' : 'when scoring first'
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} ${when}`,
    personId: null,
    side,
    kind: opponentScored ? 'oppScoringFirst' : 'scoringFirst',
    dedupeKey: `${opponentScored ? 'oppScoringFirst' : 'scoringFirst'}-${side}`,
    score: clampScore(SCORE_BASE.scoringFirst + 100 * dev),
    rec: { w: rec.w, l: rec.l },
    when,
  }
}

export function buildCallouts(
  entry,
  { bundle, firstRun, firstPA, battingSide, vsTeam, timesFacing, progress } = {},
) {
  if (!bundle) return []
  const notes = []
  const {
    leaders = {},
    pitcherLeaders = {},
    streaks = {},
    homerRecords = {},
    situational = {},
    teamRecords = {},
  } = bundle
  const snap = entry.atBatIndex != null ? progress?.byPlay?.get(entry.atBatIndex) : null

  // The batter leads his club in the category this plate appearance added to.
  // The entering count folds in what he's done TONIGHT through this play (see
  // computeCalloutProgress), so the card's number includes the double it sits
  // under — "that's No. 16", not last night's 15.
  const trig = HIT_TRIGGERS[entry.eventType]
  if (trig) {
    const L = leaders[entry.batterId]
    const v = L?.cats?.[trig.cat]
    if (v != null) {
      const entering = Number(v)
      const inGame = snap?.cats?.[trig.cat] ?? 0
      const total = isNum(entering) && inGame > 0 ? entering + inGame : null
      notes.push({
        text:
          total != null
            ? `Leads the ${L.team} in ${trig.phrase} — that's No. ${total} this season`
            : `Leads the ${L.team} in ${trig.phrase} (${v})`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'leader',
        dedupeKey: `leader-${trig.cat}-${entry.batterId}`,
        score: clampScore(SCORE_BASE.leader + Math.min(15, (total ?? entering ?? 0) / 4)),
      })
    }
  }

  // He homered, and the club has a lopsided record in games he does. Entering
  // record only — tonight's result is unknowable from inside a revealed half
  // (the box-score roll-up rewrites this into the folded, result-aware form).
  if (entry.eventType === 'home_run') {
    const rec = parseRecord(homerRecords[entry.batterId])
    const team = bundle[battingSide]?.name
    if (rec && team) {
      notes.push({
        text: `Entering tonight, the ${team} are ${rec.w}-${rec.l} when he goes deep`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'homerRec',
        dedupeKey: `homerRec-${entry.batterId}`,
        score: clampScore(SCORE_BASE.homerRec + 40 * skew(rec.w, rec.l)),
        rec: { w: rec.w, l: rec.l },
      })
    }
  }

  // The pitcher — on the card of the batter he just struck out — leads his club
  // in strikeouts. Count updated through this play, same as the hit leaders.
  if (STRIKEOUT_EVENTS.has(entry.eventType) && entry.pitcher) {
    const P = pitcherLeaders[entry.pitcher.id]
    const v = P?.cats?.so_p
    if (v != null) {
      const entering = Number(v)
      const inGame = snap?.pitcherK ?? 0
      const total = isNum(entering) && inGame > 0 ? entering + inGame : null
      notes.push({
        text:
          total != null
            ? `${entry.pitcher.last || 'He'} leads the ${P.team} in strikeouts — that's No. ${total} this season`
            : `${entry.pitcher.last || 'He'} leads the ${P.team} in strikeouts (${v})`,
        personId: entry.pitcher.id,
        side: otherSide(battingSide),
        kind: 'leader',
        dedupeKey: `leaderK-${entry.pitcher.id}`,
        score: clampScore(SCORE_BASE.leader + Math.min(15, (total ?? entering ?? 0) / 12)),
      })
    }
  }

  // A steal narrated on this card — keyed on the RUNNER (who may not be the
  // batter), from the baserunning note's own runner id. Both the team-leader
  // count and his no-caught run fold in tonight's steals through this play.
  for (const bn of entry.baserunningNotes ?? []) {
    if (!SB_EVENTS.has(bn.eventType) || bn.runnerId == null) continue
    const sbSnap = snap?.sb?.get(bn.runnerId)
    const L = leaders[bn.runnerId]
    const v = L?.cats?.sb
    if (v != null) {
      const entering = Number(v)
      const total = isNum(entering) && sbSnap ? entering + sbSnap.n : null
      notes.push({
        text:
          total != null
            ? `Leads the ${L.team} in steals — that's No. ${total} this season`
            : `Leads the ${L.team} in steals (${v})`,
        personId: bn.runnerId,
        side: battingSide,
        kind: 'leader',
        dedupeKey: `leaderSb-${bn.runnerId}`,
        score: clampScore(SCORE_BASE.leader + Math.min(15, (total ?? entering ?? 0) / 4)),
      })
    }
    const run = streaks[bn.runnerId]?.stolenBase
    if (run && sbSnap && !sbSnap.caughtBefore) {
      notes.push({
        text: `That's ${run + sbSnap.n} straight steals without being caught`,
        personId: bn.runnerId,
        side: battingSide,
        kind: 'sbStreak',
        dedupeKey: `sbstreak-${bn.runnerId}`,
        score: clampScore(SCORE_BASE.sbStreak + Math.min(10, run + sbSnap.n - 4)),
      })
    }
  }

  // His on-base streak, updated live: the play where he FIRST gets aboard
  // tonight extends it ("to 15 straight games") wherever in the game that
  // happens; until then his first PA card carries the entering number. The
  // two share a dedupeKey so the roll-up keeps whichever came last.
  const s = streaks[entry.batterId]
  if (s?.onBase && snap?.reachedHere && !snap.reachedBefore) {
    notes.push({
      text: `Extends his on-base streak to ${s.onBase + 1} straight games`,
      personId: entry.batterId,
      side: battingSide,
      kind: 'onBaseExtended',
      dedupeKey: `onbase-${entry.batterId}`,
      score: clampScore(SCORE_BASE.onBaseExtended + Math.min(15, s.onBase + 1 - 8)),
    })
  }

  // Coming into today — a streak, shown once per game (on his first PA).
  const isFirstPA = firstPA && entry.atBatIndex != null && firstPA.get(entry.batterId) === entry.atBatIndex
  if (isFirstPA) {
    if (s?.onBase && !(snap?.reachedHere || snap?.reachedBefore)) {
      notes.push({
        text: `Riding a ${s.onBase}-game on-base streak`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'onBaseRiding',
        dedupeKey: `onbase-${entry.batterId}`,
        score: clampScore(SCORE_BASE.onBaseRiding + Math.min(15, s.onBase - 8)),
      })
    }
    if (s?.stolenBase) {
      notes.push({
        text: `Has stolen ${s.stolenBase} straight without being caught`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'sbStreak',
        dedupeKey: `sbstreak-${entry.batterId}`,
        score: clampScore(SCORE_BASE.sbStreak + Math.min(10, s.stolenBase - 4)),
      })
    }

    // Season situational splits (RISP, vs-L/vs-R) — also shown once, on his
    // first PA, same as the streaks above: these describe the season, not
    // whatever's actually on base (or who's on the mound) for this specific
    // at-bat, so there's no per-play base-state tracking to gate them on.
    const sit = situational[entry.batterId]
    if (sit?.risp) {
      notes.push({
        text: `Hitting ${sit.risp.avg} with RISP this season`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'risp',
        dedupeKey: `risp-${entry.batterId}`,
        score: clampScore(SCORE_BASE.risp),
      })
    }
    const platoon = entry.pitcher?.hand === 'L' ? sit?.vl : entry.pitcher?.hand === 'R' ? sit?.vr : null
    if (platoon) {
      const arm = entry.pitcher.hand === 'L' ? 'lefties' : 'righties'
      notes.push({
        text: `Hitting ${platoon.avg} (${platoon.ops} OPS) against ${arm} this year`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'platoon',
        dedupeKey: `platoon-${entry.batterId}`,
        score: clampScore(SCORE_BASE.platoon),
      })
    }

    // His birthday — precomputed against the slate's own date (see
    // gen-callouts.mjs's isBirthdayOn), so no date math happens client-side.
    if (bundle.birthdays?.includes(entry.batterId)) {
      notes.push({
        text: `Celebrating his birthday today`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'birthday',
        dedupeKey: `bday-${entry.batterId}`,
        score: clampScore(SCORE_BASE.birthday),
      })

      // …and how he's historically hit ON his birthday (see gen-callouts.mjs's
      // birthdayLine) — a career line summed across every birthday he's played,
      // present only when it cleared the sample floors there.
      const bday = bundle.birthdayStats?.[entry.batterId]
      if (bday) {
        const hrPart = bday.hr > 0 ? `, ${bday.hr} HR` : ''
        notes.push({
          text: `Career ${bday.avg} on his birthday (${bday.h}-for-${bday.ab}${hrPart})`,
          personId: entry.batterId,
          side: battingSide,
          kind: 'birthdayStats',
          dedupeKey: `bdaystats-${entry.batterId}`,
          score: clampScore(SCORE_BASE.birthdayStats),
        })
      }
    }

    // His history against tonight's opponent, when it's actually notable for
    // him (see buildVsTeamNote) — `score` folds in how far past its own
    // threshold the angle landed, which also ranks the box-score roll-up's
    // family cap.
    const oppTeamId = bundle[otherSide(battingSide)]?.teamId
    const oppName = bundle[otherSide(battingSide)]?.name
    const vsNote =
      oppTeamId != null && oppName
        ? buildVsTeamNote(vsTeam, entry.batterId, oppTeamId, bundle.hitterLines, oppName)
        : null
    if (vsNote) {
      notes.push({
        text: vsNote.text,
        personId: entry.batterId,
        side: battingSide,
        kind: 'vsTeam',
        dedupeKey: `vsteam-${entry.batterId}`,
        score: clampScore(SCORE_BASE.vsTeam + Math.min(15, (vsNote.strength - 1) * 15)),
      })
    }
  }

  // Times-through-the-order: his 3rd (or later) look at this same pitcher
  // tonight — the point where the "TTO penalty" kicks in (see
  // api/playbyplay.js's timesFacingPitcher).
  const trip = timesFacing?.get(entry.atBatIndex)
  if (trip >= 3) {
    notes.push({
      text: `Seeing ${entry.pitcher?.last || 'him'} for the ${ordinal(trip)} time tonight`,
      personId: entry.pitcher?.id ?? null,
      side: otherSide(battingSide),
      kind: 'tto',
      score: clampScore(SCORE_BASE.tto),
    })
  }

  // This play scored the game's first run — two SEPARATE cards, one per club:
  // the scorer's record when scoring first, and the conceder's record when
  // the opponent does. Each gated on its own distance from the league norm
  // (see scoringFirstNote) — a banal record earns neither card.
  if (firstRun && firstRun.atBatIndex != null && entry.atBatIndex === firstRun.atBatIndex) {
    const side = firstRun.side
    const other = otherSide(side)
    const scored = scoringFirstNote(
      teamRecords[side]?.scoringFirst, side, bundle[side]?.name, false,
    )
    if (scored) notes.push(scored)
    const conceded = scoringFirstNote(
      teamRecords[other]?.opponentScoringFirst, other, bundle[other]?.name, true,
    )
    if (conceded) notes.push(conceded)
  }

  return notes
}

// Ordinal wording ("6th", "9th", "3rd"...) — shared by the checkpoint notes
// (inning number), the folded-record phrasing ("the 2nd loss"), and the
// times-through-the-order note above (trip number).
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Cumulative runs each side has scored through each inning, stopping at the
// first inning whose bottom half never happened (a walk-off, or a truncated/
// suspended game) — "through inning N" isn't well-defined past that point.
// Shared by every whole-game, checkpoint-based note below, and by the
// pre-half strip's "leading after the 8th" note (prehalf-callouts.js), whose
// caller-gating contract is what keeps THAT read spoiler-safe.
export function cumulativeInnings(feed) {
  let cumAway = 0
  let cumHome = 0
  const rows = [] // { inning, cumAway, cumHome }
  for (const inn of feed?.liveData?.linescore?.innings ?? []) {
    const aR = inn.away?.runs
    const hR = inn.home?.runs
    if (typeof aR !== 'number' || typeof hR !== 'number') break
    cumAway += aR
    cumHome += hR
    rows.push({ inning: inn.num, cumAway, cumHome })
  }
  return rows
}

// Checkpoints to look for a blown/held lead at, LATEST first — a team that led
// after both the 7th and the 8th only gets the more dramatic (later) note, not
// both. Mirrors gen-callouts.mjs's LEAD_CHECKPOINTS.
const LEAD_CHECKPOINTS = [9, 8, 7, 6]

// Which side led after each completed inning — 'away' | 'home' | null (tied),
// keyed by inning number. Shared by the reversal + lead-held notes below.
function leaderAfterInnings(feed) {
  const leaderAt = {}
  for (const row of cumulativeInnings(feed)) {
    leaderAt[row.inning] = row.cumAway > row.cumHome ? 'away' : row.cumHome > row.cumAway ? 'home' : null
  }
  return leaderAt
}

// "The Orioles were 43-0 when leading after the 8th — until tonight" — a
// club's season-long record when leading after a given inning is normally
// lopsided toward winning (see gen-callouts.mjs's leadAfterRecord), so THIS
// game reversing one of those checkpoints — led after inning N, lost anyway —
// is worth flagging on its own, distinct from every per-play note above.
// Retroactive by nature: it can only be known once the whole game (in
// particular its final score) is in hand, so — like the rest of this box
// score's Insights card — it's safe to compute inside the reveal because the
// SealBox has already exposed the final score by then. Reads the lopsided-only
// `leadAfter` strings (the precompute's floor IS this note's gate).
export function buildLeadReversalNote(feed, bundle) {
  if (!bundle) return null
  const finalAway = feed?.liveData?.linescore?.teams?.away?.runs
  const finalHome = feed?.liveData?.linescore?.teams?.home?.runs
  if (typeof finalAway !== 'number' || typeof finalHome !== 'number' || finalAway === finalHome) {
    return null
  }
  const winnerSide = finalAway > finalHome ? 'away' : 'home'
  const leaderAt = leaderAfterInnings(feed)

  for (const n of LEAD_CHECKPOINTS) {
    const leadingSide = leaderAt[n]
    if (!leadingSide || leadingSide === winnerSide) continue // led and won — not a reversal
    const recStr = bundle.teamRecords?.[leadingSide]?.leadAfter?.[n]
    const rec = parseRecord(recStr)
    const teamName = bundle[leadingSide]?.name
    if (!rec || !teamName) continue
    return {
      text: `The ${teamName} were ${rec.w}-${rec.l} when leading after the ${ordinal(n)} — until tonight`,
      personId: null,
      side: leadingSide,
      oppSide: winnerSide,
      kind: 'leadReversal',
      score: clampScore(SCORE_BASE.leadReversal + 20 * skew(rec.w, rec.l)),
    }
  }
  return null
}

// "The Brewers are 17-2 this season when leading after the 8th" — the
// entering-tense companion to buildLeadHeldNote below, built for the pre-half
// strip once the reader has revealed through inning N and is looking at the
// top of N+1. WHO leads tonight is the caller's job (prehalf-callouts.js,
// which owns the revealedThrough gate that makes reading tonight's score
// safe); this builder just phrases the season record for the side it's told.
export function buildLeadingAfterNote(bundle, side, inning) {
  const rec = bundle?.teamRecords?.[side]?.leadAfterFull?.[inning]
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} this season when leading after the ${ordinal(inning)}`,
    personId: null,
    side,
    kind: 'leadAfterLive',
    dedupeKey: `leadAfterLive-${side}-${inning}`,
    score: clampScore(SCORE_BASE.leadHeld + 40 * skew(rec.w, rec.l)),
  }
}

// The winner's mirror image of the reversal above: led after checkpoint N and
// closed it out, so the record moves. "The Brewers moved to 18-2 when leading
// after the 8th." Result-aware, so FINAL-ONLY (see gameResult) — the box
// score's roll-up is the only caller. Latest checkpoint wins, same rule as
// the reversal; reads the ungated `leadAfterFull` tallies so the note fires
// however the record reads (18-2 or 10-9 — post-game, the moved-to fact is
// the point, not a lopsidedness hunt).
export function buildLeadHeldNote(feed, bundle, result) {
  if (!bundle || !result?.final) return null
  const winnerSide = result.winnerSide
  const leaderAt = leaderAfterInnings(feed)
  for (const n of LEAD_CHECKPOINTS) {
    if (leaderAt[n] !== winnerSide) continue
    const rec = bundle.teamRecords?.[winnerSide]?.leadAfterFull?.[n]
    const teamName = bundle[winnerSide]?.name
    if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
    return {
      text: `The ${teamName} moved to ${rec.w + 1}-${rec.l} when leading after the ${ordinal(n)}`,
      personId: null,
      side: winnerSide,
      kind: 'leadHeld',
      score: clampScore(SCORE_BASE.leadHeld + 40 * skew(rec.w, rec.l)),
    }
  }
  return null
}

// These three thresholds/checkpoint lists must match gen-callouts.mjs's
// RUN_SCORED_BUCKETS / RUNS_ALLOWED_THRESHOLD+RUNS_ALLOWED_CHECKPOINTS /
// COMEBACK_DEFICIT — the record was precomputed against those exact numbers,
// so tonight's check has to agree with them (same duplication as
// LEAD_CHECKPOINTS above, which mirrors gen-callouts.mjs for the same reason).
const RUN_SCORED_BUCKETS = [8, 6, 4] // highest first — show the most impressive bucket cleared
const RUNS_ALLOWED_THRESHOLD = 4
const RUNS_ALLOWED_CHECKPOINTS = [8, 7, 6, 5] // latest first, same "most dramatic" rule as LEAD_CHECKPOINTS
const COMEBACK_DEFICIT = 3

// "The Dodgers moved to 33-4 when scoring 8+ runs" — the highest bucket each
// side's own final score actually clears, with tonight folded in when the
// game is decided (entering-tense otherwise — an in-progress box score view).
// No lopsidedness floor at the data layer — the record itself, however it
// reads, is the point.
export function buildRunsScoredNote(feed, bundle, result) {
  if (!bundle) return null
  const finals = {
    away: feed?.liveData?.linescore?.teams?.away?.runs,
    home: feed?.liveData?.linescore?.teams?.home?.runs,
  }
  for (const side of ['away', 'home']) {
    const final = finals[side]
    if (typeof final !== 'number') continue
    for (const n of RUN_SCORED_BUCKETS) {
      if (final < n) continue
      const rec = parseRecord(bundle.teamRecords?.[side]?.runsScored?.[n])
      const teamName = bundle[side]?.name
      if (!rec || !teamName) continue
      const text = result?.final
        ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, `when scoring ${n}+ runs`)
        : `The ${teamName} are ${rec.w}-${rec.l} when scoring ${n}+ runs`
      return {
        text,
        personId: null,
        side,
        oppSide: otherSide(side),
        kind: 'runsScored',
        score: clampScore(SCORE_BASE.runsScored + 40 * skew(rec.w, rec.l)),
      }
    }
  }
  return null
}

// "The Cubs dropped to 3-20 when allowing 4+ runs by the 7th" — symmetric to
// the lead notes but for runs ALLOWED rather than a lead. Checked LATEST
// checkpoint first, same reasoning as LEAD_CHECKPOINTS: a team that blew up
// early AND late only needs the one, more dramatic, note.
export function buildRunsAllowedNote(feed, bundle, result) {
  if (!bundle) return null
  const rows = cumulativeInnings(feed)
  for (const n of RUNS_ALLOWED_CHECKPOINTS) {
    const row = rows.find((r) => r.inning === n)
    if (!row) continue
    for (const side of ['away', 'home']) {
      const allowed = side === 'away' ? row.cumHome : row.cumAway
      if (allowed < RUNS_ALLOWED_THRESHOLD) continue
      const rec = parseRecord(bundle.teamRecords?.[side]?.runsAllowedByInning?.[n])
      const teamName = bundle[side]?.name
      if (!rec || !teamName) continue
      const when = `when allowing ${RUNS_ALLOWED_THRESHOLD}+ runs by the ${ordinal(n)}`
      const text = result?.final
        ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, when)
        : `The ${teamName} are ${rec.w}-${rec.l} ${when}`
      return {
        text,
        personId: null,
        side,
        oppSide: otherSide(side),
        kind: 'runsAllowed',
        score: clampScore(SCORE_BASE.runsAllowed + 40 * skew(rec.w, rec.l)),
      }
    }
  }
  return null
}

// "The Twins moved to 15-23 in games they've trailed by 3+" — fires for
// whichever side actually fell behind by COMEBACK_DEFICIT+ at some point
// tonight, folded with the result when decided. Scored by resilience (the
// win% itself) rather than lopsidedness — losing most games you trail big in
// is just baseball; winning them is the story.
export function buildComebackNote(feed, bundle, result) {
  if (!bundle) return null
  let deficitSide = null
  for (const row of cumulativeInnings(feed)) {
    if (row.cumHome - row.cumAway >= COMEBACK_DEFICIT) deficitSide = 'away'
    else if (row.cumAway - row.cumHome >= COMEBACK_DEFICIT) deficitSide = 'home'
    if (deficitSide) break
  }
  if (!deficitSide) return null
  const rec = parseRecord(bundle.teamRecords?.[deficitSide]?.comeback)
  const teamName = bundle[deficitSide]?.name
  if (!rec || !teamName) return null
  const when = `in games they've trailed by ${COMEBACK_DEFICIT}+`
  const text = result?.final
    ? foldedRecordText(rec.w, rec.l, deficitSide === result.winnerSide, teamName, when)
    : `The ${teamName} are ${rec.w}-${rec.l} ${when}`
  return {
    text,
    personId: null,
    side: deficitSide,
    oppSide: otherSide(deficitSide),
    kind: 'comeback',
    score: clampScore(SCORE_BASE.comeback + 60 * (rec.pct ?? 0)),
  }
}

// --- run differential by inning --------------------------------------------------
// "The Brewers have outscored opponents 38-14 in the 7th this season" — from
// the precompute's per-inning runs-for/against tallies (`inningRuns`). Shared
// by the pre-half strip (entering the inning; prehalf-callouts.js) and the
// box-score roll-up (tonight's half-inning runs folded in via extraF/extraA).
// Noteworthy only past a real sample, a real margin, AND a dominance ratio —
// an 88-80 grind or a 9-2 April blip is neither.
export const INNING_DIFF_MIN_GAMES = 15
const INNING_DIFF_MIN_MARGIN = 12
const INNING_DIFF_RATIO = 2
export function buildInningRunDiffNote(bundle, side, inning, extraF = 0, extraA = 0) {
  const ir = bundle?.teamRecords?.[side]?.inningRuns?.[inning]
  const teamName = bundle?.[side]?.name
  if (!ir || !teamName || !isNum(ir.f) || !isNum(ir.a) || !(ir.g >= INNING_DIFF_MIN_GAMES)) return null
  const f = ir.f + extraF
  const a = ir.a + extraA
  const margin = Math.abs(f - a)
  if (margin < INNING_DIFF_MIN_MARGIN) return null
  if (Math.max(f, a) < INNING_DIFF_RATIO * Math.max(1, Math.min(f, a))) return null
  const folded = extraF > 0 || extraA > 0 ? ', tonight included' : ''
  const text =
    f > a
      ? `The ${teamName} have outscored opponents ${f}-${a} in the ${ordinal(inning)} this season${folded}`
      : `The ${teamName} have been outscored ${a}-${f} in the ${ordinal(inning)} this season${folded}`
  return {
    text,
    personId: null,
    side,
    kind: 'inningRunDiff',
    dedupeKey: `inningRunDiff-${side}-${inning}`,
    score: clampScore(SCORE_BASE.inningRunDiff + Math.min(20, margin / 2)),
    margin,
  }
}

// --- starter team record -----------------------------------------------------------
// "The Brewers are 12-5 in his starts this season" — the CLUB's result in a
// pitcher's starts (see gen-callouts.mjs's teamStarts), independent of his
// personal W-L. Entering-tense: the pre-half strip's first-inning card
// (prehalf-callouts.js). The roll-up builds its own folded version below.
export function buildStarterTeamRecordNote(bundle, side, pitcherId) {
  const rec = bundle?.starterRecords?.[pitcherId]?.teamStarts
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} in his starts this season`,
    personId: pitcherId,
    side,
    kind: 'starterRec',
    dedupeKey: `starterRec-${pitcherId}`,
    score: clampScore(SCORE_BASE.starterRec + 40 * skew(rec.w, rec.l)),
  }
}

// The actual starting pitchers, read off each half's first play — the roll-up
// runs post-reveal, so this beats trusting the pre-game probables (a late
// scratch happens). { away, home } pitcher ids, either possibly null.
function actualStarters(feed) {
  let home = null
  let away = null
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const pid = p.matchup?.pitcher?.id
    if (pid == null) continue
    if (p.about?.halfInning === 'top' && home == null) home = pid
    if (p.about?.halfInning === 'bottom' && away == null) away = pid
    if (home != null && away != null) break
  }
  return { home, away }
}

// Every call-out that actually fired somewhere in the game, deduped (latest
// wording wins — a count note's number grows through the game) and enriched
// with each note's headshot/logo identity — the box score's Insights card
// roll-up of the same notes that appear piecemeal on individual at-bat cards
// in the innings view (see buildCallouts above), plus the whole-game-only
// families (lead reversal/held, runs scored/allowed, comeback, starter
// records, inning run differentials, streak endings). Sorted by worthiness
// `score`, most impactful first — the card shows the top few and folds the
// rest behind Show more.
//
// Walks the raw feed directly rather than routing through
// computeHalfInningFeed (one call per half, with its pitch-detail and
// baserunning-advancement passes) since none of that is needed here — just
// each play's own result, batter, pitcher, and any baserunning event it
// carries. REVEAL-ONLY: the whole game is already behind the box score's
// SealBox by the time this is called, same rule as computeGameSuperlatives —
// which is also the ONLY reason the result-aware wording here is safe (see
// the module header's two-tenses rule and ADR-0014). When the game isn't
// decided yet (an in-progress box-score view), gameResult reports non-final
// and every folded variant stays in entering-tense.
// `vsTeam` (the separately-fetched vs-team-splits file, api/vsTeamSplits.js)
// is optional — the career-vs-opponent note simply doesn't fire without it.
export function computeGameCalloutNotes(feed, bundle, vsTeam) {
  if (!bundle) return []

  // A note's `side`/`oppSide` ('away'|'home') resolve to the bundle's own
  // identity for that club — real teamId (for TeamLogo) + display name.
  const identify = (note) => {
    let personName = ''
    if (note.personId != null) {
      const { first, last } = personNameParts(feed?.gameData?.players?.[`ID${note.personId}`] ?? {})
      personName = [first, last].filter(Boolean).join(' ')
    }
    return {
      text: note.text,
      personId: note.personId ?? null,
      personName,
      teamId: note.side ? bundle[note.side]?.teamId ?? null : null,
      teamName: note.side ? bundle[note.side]?.name ?? '' : '',
      oppTeamId: note.oppSide ? bundle[note.oppSide]?.teamId ?? null : null,
      oppTeamName: note.oppSide ? bundle[note.oppSide]?.name ?? '' : '',
      kind: note.kind ?? null,
      score: note.score ?? 0,
    }
  }

  const result = gameResult(feed)
  const firstRun = firstRunPlay(feed)
  const firstPA = firstPAIndexByBatter(feed)
  const timesFacing = timesFacingPitcher(feed)
  const progress = computeCalloutProgress(feed)

  // Dedupe by dedupeKey (falling back to the text itself), LATEST wording
  // winning in place — so "Riding a 14-game on-base streak" gives way to
  // "Extends his on-base streak to 15", and a count note keeps its final
  // number rather than one card per occurrence.
  const byKey = new Map() // key -> index into ordered
  const ordered = []
  const add = (note) => {
    if (!note) return
    const key = note.dedupeKey ?? note.text
    const at = byKey.get(key)
    if (at != null) {
      ordered[at] = note
      return
    }
    byKey.set(key, ordered.length)
    ordered.push(note)
  }

  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const battingSide = play.about?.halfInning === 'top' ? 'away' : 'home'
    const pitcherId = play.matchup?.pitcher?.id
    const pitcherPerson = pitcherId != null ? feed?.gameData?.players?.[`ID${pitcherId}`] ?? {} : {}
    const pitcher =
      pitcherId != null
        ? { id: pitcherId, ...personNameParts(pitcherPerson), hand: pitcherPerson.pitchHand?.code ?? '' }
        : null
    const baserunningNotes = (play.playEvents ?? [])
      .filter((e) => !e.isPitch && NON_PA_EVENT_TYPES.has(e.details?.eventType))
      .map((e) => ({ eventType: e.details.eventType, runnerId: e.player?.id ?? null }))
    const entry = {
      eventType: play.result?.eventType ?? null,
      batterId: play.matchup?.batter?.id,
      atBatIndex: play.about?.atBatIndex ?? null,
      pitcher,
      baserunningNotes,
    }
    for (const note of buildCallouts(entry, {
      bundle, firstRun, firstPA, battingSide, vsTeam, timesFacing, progress,
    })) {
      add(note)
    }
  }

  // Result-aware rewrites of the per-play families that carried their record
  // numbers along (see the two-tenses rule in the module header): once the
  // game is decided, the entering record folds tonight in.
  if (result.final) {
    for (const [i, n] of ordered.entries()) {
      if (!n.rec) continue
      const teamName = n.side ? bundle[n.side]?.name : ''
      if (!teamName) continue
      const won = n.side === result.winnerSide
      const when =
        n.kind === 'homerRec' ? 'when he goes deep' : n.when ?? null
      if (!when) continue
      ordered[i] = { ...n, text: foldedRecordText(n.rec.w, n.rec.l, won, teamName, when) }
    }

    // An on-base streak that got no knock all night is OVER — the flip side
    // of the extends note, only knowable (and only tellable) post-game.
    for (const [idStr, s] of Object.entries(bundle.streaks ?? {})) {
      const id = Number(idStr)
      if (!s?.onBase || !firstPA.has(id) || progress.reached.has(id)) continue
      const battingSide = bundle.away && bundle.home ? sideOfBatter(feed, id) : null
      add({
        text: `His ${s.onBase}-game on-base streak came to an end tonight`,
        personId: id,
        side: battingSide,
        kind: 'onBaseEnded',
        dedupeKey: `onbase-${id}`,
        score: clampScore(SCORE_BASE.onBaseEnded + Math.min(15, s.onBase - 8)),
      })
    }

    // Each club's record in its starter's starts, moved by tonight.
    const starters = actualStarters(feed)
    for (const side of ['away', 'home']) {
      const pid = starters[side]
      const rec = pid != null ? bundle.starterRecords?.[pid]?.teamStarts : null
      const teamName = bundle[side]?.name
      if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
      add({
        text: foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, 'in his starts'),
        personId: pid,
        side,
        kind: 'starterRec',
        dedupeKey: `starterRec-${pid}`,
        score: clampScore(SCORE_BASE.starterRec + 40 * skew(rec.w, rec.l)),
      })
    }
  }

  add(buildLeadReversalNote(feed, bundle))
  add(buildLeadHeldNote(feed, bundle, result))
  add(buildRunsScoredNote(feed, bundle, result))
  add(buildRunsAllowedNote(feed, bundle, result))
  add(buildComebackNote(feed, bundle, result))

  // Each club's single most lopsided inning-differential note (its signature
  // inning), tonight's runs in that inning folded in once decided. One per
  // club — the full per-inning sweep belongs to the pre-half strip, not here.
  const inningsRows = feed?.liveData?.linescore?.innings ?? []
  for (const side of ['away', 'home']) {
    let best = null
    for (let n = 1; n <= 9; n++) {
      const row = result.final ? inningsRows.find((r) => r.num === n) : null
      const myRuns = row ? row[side === 'away' ? 'away' : 'home']?.runs : null
      const oppRuns = row ? row[side === 'away' ? 'home' : 'away']?.runs : null
      const note = buildInningRunDiffNote(
        bundle, side, n,
        typeof myRuns === 'number' ? myRuns : 0,
        typeof oppRuns === 'number' ? oppRuns : 0,
      )
      if (note && (!best || note.margin > best.margin)) best = note
    }
    add(best)
  }

  // A game against a familiar club can clear the vs-opponent gate for a whole
  // lineup's worth of hitters at once, and the roll-up sums BOTH clubs — so
  // this one family is capped to the few most extreme lines (by worthiness
  // score, which folds in how far past its threshold each landed) rather than
  // letting it crowd out the rest of the card. The innings view is untouched:
  // there each note sits alone on the batter's own first-PA card, where
  // volume was never the problem.
  const vsNotes = ordered.filter((n) => n.kind === 'vsTeam')
  let keep = ordered
  if (vsNotes.length > VS_TEAM_ROLLUP_MAX) {
    const top = new Set(
      [...vsNotes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, VS_TEAM_ROLLUP_MAX),
    )
    keep = ordered.filter((n) => n.kind !== 'vsTeam' || top.has(n))
  }

  // Most impactful first — the whole point of the worthiness score. Ties keep
  // first-fired order (sort is stable), so the game's own chronology breaks them.
  return [...keep].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(identify)
}

// Which side a batter hit for tonight, from his first plate appearance — used
// only by the streak-ended note, where the player isn't attached to any one
// play we're already holding.
function sideOfBatter(feed, batterId) {
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    if (p.matchup?.batter?.id === batterId && !NON_PA_EVENT_TYPES.has(p.result?.eventType)) {
      return p.about?.halfInning === 'top' ? 'away' : 'home'
    }
  }
  return null
}
