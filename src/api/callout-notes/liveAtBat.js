// The LIVE, entering-tense per-at-bat callout builder — split out of
// ../callout-notes.js. `buildCallouts` is the module's PlayByPlay.jsx-facing
// entry point: it may fold in only what the reader has already revealed
// through the play it's building for, never the game's outcome. See
// ../callout-notes.js's header for the full two-tenses rule (ADR-0014).

import { FOUL_CODES, FOUL_ENDS_AB_CODES, pitchDotCategory } from '../playbyplay.js'
import { dayWordFor } from '../select.js'
import { HIT_TRIGGERS, STRIKEOUT_EVENTS, SB_EVENTS, otherSide, isNum, clampScore, skewBonus, magnitudeOf, SCORE_BASE, parseRecord } from './shared.js'
import { buildVsTeamNote } from './vsTeamNote.js'
// The league-rank clause the scoring-first cards append (rank.js). Additive —
// no rank in the bundle leaves the sentence exactly as it reads today.
import { withRank } from './rank.js'
import { ELITE_VELO_MPH } from '../pitchArsenal.js'

// Fouls in one at-bat, from its ordered pitch call codes alone. The strike
// count is re-simulated from the codes (called/whiff/foul all add a strike, a
// foul never pushes past two), so a two-strike foul — the AB-extending spoil —
// needs no play-event count fields. The fouls that end the at-bat instead of
// extending it are excluded, same rule as derive.js/gen-fouls.mjs.
//
// Every kind of strike has to add one here, which is why this reads
// pitchDotCategory rather than naming codes: listing only C/S/W left a missed
// bunt, an automatic strike and a swinging strike on a pitchout adding nothing,
// so a foul that followed one of them was scored a strike short of the count it
// was really taken at.
export function foulCountsFromCodes(codes) {
  let strikes = 0
  let fouls = 0
  let twoStrikeFouls = 0
  for (const code of codes ?? []) {
    if (!code) continue
    const cat = pitchDotCategory(code)
    if (FOUL_CODES.has(code)) {
      fouls += 1
      if (strikes === 2 && !FOUL_ENDS_AB_CODES.has(code)) twoStrikeFouls += 1
      if (strikes < 2) strikes += 1
    } else if (cat === 'called' || cat === 'whiff') {
      strikes += 1
    }
  }
  return { fouls, twoStrikeFouls }
}

// Floors for the marathon-at-bat card: enough fouls that the battle IS the
// story, and how many two-strike fouls earn the historical-odds line.
const MARATHON_FOULS = 6
const MARATHON_PRIOR_2K = 3

// --- scoring-first noteworthiness ----------------------------------------------
// The scoring-first / conceding-first records are full-season, ungated at the
// data layer — and banal for most clubs (the league wins roughly two-thirds of
// the games it scores first in). A card only earns its spot when the club's
// own record sits a real distance from that league norm, in either direction:
// a .78 front-runner and a .50 shrug-it-off club are both stories; a .66 club
// is just Tuesday.
const SCORING_FIRST_NORM = 0.66
export const SCORING_FIRST_MIN_GAMES = 10
const SCORING_FIRST_DEV = 0.08
function scoringFirstNote(bundle, side, opponentScored) {
  const key = opponentScored ? 'opponentScoringFirst' : 'scoringFirst'
  const rec = parseRecord(bundle?.teamRecords?.[side]?.[key])
  const teamName = bundle?.[side]?.name
  if (!rec || rec.total < SCORING_FIRST_MIN_GAMES || !teamName) return null
  const norm = opponentScored ? 1 - SCORING_FIRST_NORM : SCORING_FIRST_NORM
  const dev = Math.abs(rec.pct - norm)
  if (dev < SCORING_FIRST_DEV) return null
  const when = opponentScored ? 'when the opponent scores first' : 'when scoring first'
  return {
    text: withRank(`The ${teamName} are ${rec.w}-${rec.l} ${when}`, bundle, side, key),
    personId: null,
    side,
    kind: opponentScored ? 'oppScoringFirst' : 'scoringFirst',
    dedupeKey: `${opponentScored ? 'oppScoringFirst' : 'scoringFirst'}-${side}`,
    score: clampScore(SCORE_BASE.scoringFirst + magnitudeOf(dev - SCORING_FIRST_DEV, 0.22)),
    rec: { w: rec.w, l: rec.l },
    when,
  }
}

export function buildCallouts(
  entry,
  { bundle, firstRun, firstPA, firstRispPA, battingSide, vsTeam, progress } = {},
) {
  if (!bundle) return []
  const notes = []
  const {
    leaders = {},
    pitcherLeaders = {},
    streaks = {},
    homerRecords = {},
    situational = {},
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
        // cat/inGame/total feed the box-score roll-up's narrative rewrite
        // ("Doubled twice tonight — now 16 on the season…"), same idea as
        // `rec` on the record notes.
        cat: trig.cat,
        inGame,
        total,
        dedupeKey: `leader-${trig.cat}-${entry.batterId}`,
        score: clampScore(SCORE_BASE.leader + magnitudeOf((total ?? entering ?? 0) / 4, 15)),
      })
    }
  }

  // A marathon at-bat — he fouled off a pile of pitches in this one trip.
  // Reads only the revealed play's own pitch codes (play cards carry
  // `pitches`; the roll-up's thinner entries don't, so this family is a
  // play-card exclusive — the moment IS the story). The historical odds line
  // (SABR BRJ 2018, Retrosheet 1945-2015: two-strike counts reached by
  // fouling produce a .291 hit probability vs .102 otherwise) is only earned
  // by a real two-strike fight, not six first-pitch-swing spoils.
  if (entry.pitches?.length) {
    const { fouls, twoStrikeFouls } = foulCountsFromCodes(entry.pitches)
    if (fouls >= MARATHON_FOULS) {
      const prior =
        twoStrikeFouls >= MARATHON_PRIOR_2K
          ? ' — hitters who battle to two strikes on fouls like this have hit .291 across baseball history (.102 for everyone else)'
          : ''
      notes.push({
        text: `Fouled off ${fouls} pitches in that ${entry.pitches.length}-pitch at-bat${prior}`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'marathonAb',
        dedupeKey: `marathon-${entry.atBatIndex}`,
        score: clampScore(SCORE_BASE.marathonAb + magnitudeOf(fouls - MARATHON_FOULS, 5)),
      })
    }
  }

  // A single pitch that's a new season-high velocity, or clears the elite bar
  // outright — regardless of pitch-type variety (veloVariety, the Margin
  // Notes sibling, only fires on 2+ distinct types this game; this fires on
  // ONE blistering pitch alone). Reads progress.js's per-play `newPeakVelo`
  // (this game's own running peak, revealed plays only) against
  // bundle.starterRecords' season-high on file (gen-callouts.mjs's join off
  // gen-pitch-arsenal.mjs's own sweep). Fires once per pitcher per game — a
  // later, harder pitch the same game restates it via the shared dedupeKey.
  if (snap?.newPeakVelo && entry.pitcher) {
    const { mph, type } = snap.newPeakVelo
    const seasonMaxVelo = bundle.starterRecords?.[entry.pitcher.id]?.centuryClub?.seasonMaxVelo
    const isSeasonHigh = seasonMaxVelo != null && mph > seasonMaxVelo
    const isElite = mph >= ELITE_VELO_MPH
    if (isSeasonHigh || isElite) {
      const who = entry.pitcher.last || 'He'
      const text = isSeasonHigh
        ? `New season high for ${who} — ${mph.toFixed(1)} mph, topping his previous best of ${seasonMaxVelo.toFixed(1)}`
        : `${who} touched ${mph.toFixed(1)} mph${type ? ` on a ${type.toLowerCase()}` : ''} — one of the hardest pitches he's thrown all season`
      notes.push({
        text,
        personId: entry.pitcher.id,
        side: otherSide(battingSide),
        kind: 'veloPeak',
        // mph/isSeasonHigh feed the box-score roll-up's folded restatement.
        mph,
        isSeasonHigh,
        dedupeKey: `veloPeak-${entry.pitcher.id}`,
        score: clampScore(SCORE_BASE.veloPeak + magnitudeOf(mph - ELITE_VELO_MPH, 5)),
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
        text: `Entering ${dayWordFor(bundle.dayNight)}, the ${team} are ${rec.w}-${rec.l} when he goes deep`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'homerRec',
        dedupeKey: `homerRec-${entry.batterId}`,
        score: clampScore(SCORE_BASE.homerRec + skewBonus(rec.w, rec.l)),
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
        cat: 'so_p',
        inGame,
        total,
        dedupeKey: `leaderK-${entry.pitcher.id}`,
        score: clampScore(SCORE_BASE.leader + magnitudeOf((total ?? entering ?? 0) / 12, 15)),
      })
    }
  }

  // A steal narrated on this card — keyed on the RUNNER (who may not be the
  // batter), from the baserunning note's own runner id. Both the team-leader
  // count and his no-caught run fold in tonight's steals through this play.
  //
  // Both texts NAME him, the same way the pitcher's strikeout note just above
  // names the pitcher, and for the same reason: the play card renders a bare
  // sentence under the BATTER's name (PlayByPlay.jsx hands CalloutNote only
  // `text` — unlike Margin Notes and the box score's Insights card, which draw
  // `personId`'s headshot and name beside the note). An unattributed "Leads
  // the Mets in steals" sitting under whoever happened to be at the plate
  // reads as HIS, and a steal call-out is by definition never about him. The
  // roll-up rewrites both of these into its own attributed wording, so the
  // name here only ever reaches the play card.
  //
  // Once per RUNNER, not once per steal event: a runner who takes both 2nd and
  // 3rd during one plate appearance leaves two SB notes on the same card
  // (verified against gamePk 826849's top 1st, Cody Miller stealing 2nd then
  // 3rd on Machado's at-bat), and `sbSnap.n` is already this play's whole
  // steal count for him — so a second pass can only re-render the identical
  // sentence. The roll-up's dedupeKey catches that on the box score; the play
  // card has no dedupe of its own.
  const sbSeen = new Set()
  for (const bn of entry.baserunningNotes ?? []) {
    if (!SB_EVENTS.has(bn.eventType) || bn.runnerId == null) continue
    if (sbSeen.has(bn.runnerId)) continue
    sbSeen.add(bn.runnerId)
    const sbSnap = snap?.sb?.get(bn.runnerId)
    // Falls back to a role word, never to "He" — a bare pronoun under the
    // batter's own name is the very ambiguity this exists to remove.
    const who = bn.runnerLast || 'The runner'
    const L = leaders[bn.runnerId]
    const v = L?.cats?.sb
    if (v != null) {
      const entering = Number(v)
      const total = isNum(entering) && sbSnap ? entering + sbSnap.n : null
      notes.push({
        text:
          total != null
            ? `${who} leads the ${L.team} in steals — that's No. ${total} this season`
            : `${who} leads the ${L.team} in steals (${v})`,
        personId: bn.runnerId,
        side: battingSide,
        kind: 'leader',
        cat: 'sb',
        inGame: sbSnap?.n ?? 0,
        total,
        dedupeKey: `leaderSb-${bn.runnerId}`,
        score: clampScore(SCORE_BASE.leader + magnitudeOf((total ?? entering ?? 0) / 4, 15)),
      })
    }
    const run = streaks[bn.runnerId]?.stolenBase
    if (run && sbSnap && !sbSnap.caughtBefore) {
      notes.push({
        text: `${who} has now stolen ${run + sbSnap.n} straight without being caught`,
        personId: bn.runnerId,
        side: battingSide,
        kind: 'sbStreak',
        run, // the entering streak, for the roll-up's narrative rewrite
        dedupeKey: `sbstreak-${bn.runnerId}`,
        score: clampScore(SCORE_BASE.sbStreak + magnitudeOf(run + sbSnap.n - 4, 10)),
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
      streak: s.onBase + 1,
      start: s.onBaseStart ?? null, // when the run began, for the roll-up's prose
      dedupeKey: `onbase-${entry.batterId}`,
      score: clampScore(SCORE_BASE.onBaseExtended + magnitudeOf(s.onBase + 1 - 8, 15)),
    })
  }

  // Season situational splits (RISP, vs-L/vs-R), read once up front — RISP
  // gates on its OWN first-live-situation index below (a season rate is a
  // non sequitur on a bases-empty PA), while vs-L/vs-R stays on the general
  // first-PA gate right below (a pitcher's throwing hand is live on every
  // single PA, so there's no "irrelevant situation" case to gate out).
  const sit = situational[entry.batterId]

  // He's actually facing a runner in scoring position for the first time
  // this game — see firstRispPAIndexByBatter (playbyplay.js) for why this
  // is its own gate rather than riding the general first-PA one below.
  const isFirstRispPA =
    firstRispPA && entry.atBatIndex != null && firstRispPA.get(entry.batterId) === entry.atBatIndex
  if (isFirstRispPA && sit?.risp) {
    notes.push({
      text: `Hitting ${sit.risp.avg} with RISP this season`,
      personId: entry.batterId,
      side: battingSide,
      kind: 'risp',
      dedupeKey: `risp-${entry.batterId}`,
      score: clampScore(SCORE_BASE.risp),
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
        score: clampScore(SCORE_BASE.onBaseRiding + magnitudeOf(s.onBase - 8, 15)),
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

    // A league-elite pitch-spoiler stepping in (top-10 fouls per game, from
    // the nightly foul sweep joined in gen-callouts.mjs). Entering fact only;
    // the box-score roll-up restates it with tonight's own foul count.
    const spoiler = bundle.foulSpoilers?.[entry.batterId]
    if (spoiler) {
      const rankWord = spoiler.rank === 1 ? "MLB's top pitch-spoiler" : `MLB's No. ${spoiler.rank} pitch-spoiler`
      notes.push({
        text: `${rankWord} — ${spoiler.perGame} foul balls a game this season`,
        personId: entry.batterId,
        side: battingSide,
        kind: 'foulSpoiler',
        dedupeKey: `foulspoiler-${entry.batterId}`,
        score: clampScore(SCORE_BASE.foulSpoiler + magnitudeOf(11 - spoiler.rank, 10)),
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
        score: clampScore(SCORE_BASE.vsTeam + magnitudeOf(vsNote.strength - 1, 1)),
      })
    }
  }

  // (The old per-play times-through-the-order note lived here — it repeated on
  // every card of the half, so it's now the pre-half strip's single persistent
  // card instead: see buildThirdTimeThroughNote below.)

  // This play scored the game's first run — two SEPARATE cards, one per club:
  // the scorer's record when scoring first, and the conceder's record when
  // the opponent does. Each gated on its own distance from the league norm
  // (see scoringFirstNote) — a banal record earns neither card.
  if (firstRun && firstRun.atBatIndex != null && entry.atBatIndex === firstRun.atBatIndex) {
    const side = firstRun.side
    const other = otherSide(side)
    const scored = scoringFirstNote(bundle, side, false)
    if (scored) notes.push(scored)
    const conceded = scoringFirstNote(bundle, other, true)
    if (conceded) notes.push(conceded)
  }

  return notes
}
