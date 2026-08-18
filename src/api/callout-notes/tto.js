// The pre-half strip's "times through the order" cards — split out of
// ../callout-notes.js. Entering-tense, CALLER-GATED (prehalf-callouts.js):
// both builders read plate appearances from the batting side's PREVIOUS
// halves, so the caller must not invoke them until those halves are
// revealed. See ../callout-notes.js's header for the two-tenses rule
// (ADR-0014).

import { NON_PA_EVENT_TYPES } from '../playbyplay.js'
import { personNameParts, selectPrePitchChanges } from '../select.js'
import { otherSide, ordinal, isNum, clampScore, magnitudeOf, SCORE_BASE } from './shared.js'

// --- times-through-the-order --------------------------------------------------
// "Batters see Imanaga a 3rd time this inning — they're hitting .444 off him
// the 3rd time through this season (.242 the 1st time)" — the pre-half strip's
// persistent card for the half where the order turns over on the starter,
// replacing the old per-play note that repeated the same fact on every card of
// the half. The season split comes from the bundle's playLog-derived
// starterRecords[pid].tto (probable starters only — see gen-callouts.mjs);
// without one the card still fires as the plain trip fact.
//
// CALLER-GATED like buildLeadingAfterNote: it reads plate appearances from
// this side's PREVIOUS halves to count who has faced the pitcher how often, so
// the caller (prehalf-callouts.js) must not invoke it until those halves are
// revealed. It also reads the STAGED half's own pre-pitch changes AND its
// leadoff batter via plain feed plays — safe here for the same reason: the
// caller already restricts this to halfIndex(inning, half) <= revealedThrough
// + 1, the exact condition ADR-0003/0010's caller-gated selectors require, and
// neither who's leading off nor who's on the mound is score-revealing. Fires
// only while the side's own STARTER is still pitching entering the staged
// half — the pitcher of record from the side's previous halves must still be
// the one taking the mound now, not someone a between-innings pitching change
// swapped in — since a reliever's 3rd trip is vanishingly rare and the
// bundle's split belongs to starters anyway.
//
// The trip count is keyed to the batter ACTUALLY leading off the staged half,
// not the side's most-exposed batter to date: with uneven inning lengths, the
// batter who has faced the pitcher the most times overall is often skipped
// over in a short inning, so crediting his trip count to a half he isn't even
// due up in previously produced an inflated, off-batter trip number (e.g.
// "3rd time" the half after only the leadoff man's 2nd look, because some
// other spot in the order happened to bat in three separate quick innings).
// Shared trip-detection for the pre-half order-turnover cards below: which
// pitcher a batting side is entering the staged half against, and how many
// times the batter DUE UP LEADOFF has already seen him — the trip about to
// begin. Returns { pitcherId, trip } with trip >= 2, or null when the order
// hasn't turned over yet, the starter is gone (a reliever entered mid-game or a
// between-innings change swapped him out), or the half hasn't started. Trips
// count DISTINCT innings faced, not raw PAs — a batter who bats around twice in
// one big inning is still one trip. CALLER-GATED: reads this side's previous
// halves' plays (revealed material), so callers must restrict it to
// halfIndex(inning, half) <= revealedThrough + 1.
function enteringStarterTrip(feed, inning, half) {
  let firstPitcher = null
  let lastPitcher = null
  const inningsFaced = new Map() // `${batterId}-${pitcherId}` -> Set(innings faced)
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const about = p.about ?? {}
    // Same half TYPE only (this side batting), strictly before this inning.
    if (about.halfInning !== half || !(about.inning < inning)) continue
    if (NON_PA_EVENT_TYPES.has(p.result?.eventType)) continue
    const bid = p.matchup?.batter?.id
    const pid = p.matchup?.pitcher?.id
    if (bid == null || pid == null) continue
    if (firstPitcher == null) firstPitcher = pid
    lastPitcher = pid
    const key = `${bid}-${pid}`
    if (!inningsFaced.has(key)) inningsFaced.set(key, new Set())
    inningsFaced.get(key).add(about.inning)
  }
  if (lastPitcher == null || lastPitcher !== firstPitcher) return null

  // The pitcher actually entering the staged half — a between-innings change
  // shows up as a leading pitching_substitution on the half's own first play.
  // If it swapped in someone other than the side's last pitcher, the starter
  // is gone and these cards must not fire (crediting a departed pitcher).
  const sub = selectPrePitchChanges(feed, inning, half)
    .filter((c) => c.eventType === 'pitching_substitution')
    .pop()
  if (sub && sub.pitcher.id !== lastPitcher) return null

  // The batter actually due up first in the staged half — the order "turning
  // over" is defined by his trip count, not whoever has faced the pitcher the
  // most times across the whole game so far.
  const leadoff = (feed?.liveData?.plays?.allPlays ?? []).find(
    (p) => p.about?.inning === inning && p.about?.halfInning === half,
  )?.matchup?.batter?.id
  if (leadoff == null) return null // the half hasn't actually started yet

  const priorTrips = inningsFaced.get(`${leadoff}-${lastPitcher}`)?.size ?? 0
  if (priorTrips < 1) return null // the leadoff hitter hasn't seen him before
  return { pitcherId: lastPitcher, trip: priorTrips + 1 }
}

const TTO_MIN_AB = 20 // 3rd-trip sample floor before the card cites its AVG
export function buildThirdTimeThroughNote(feed, bundle, inning, half) {
  const battingSide = half === 'top' ? 'away' : 'home'
  const pitchingSide = otherSide(battingSide)
  const found = enteringStarterTrip(feed, inning, half)
  if (!found || found.trip < 3) return null // the order hasn't turned over twice yet
  const lastPitcher = found.pitcherId
  const trip = found.trip // the look the top of the order is now getting
  const { last } = personNameParts(feed?.gameData?.players?.[`ID${lastPitcher}`] ?? {})
  const who = last || 'the starter'
  const tto = bundle?.starterRecords?.[lastPitcher]?.tto
  const t1 = tto?.[1]
  const t3 = tto?.[3]
  // The season split is specifically "the 3rd time through" — only cite it on
  // an actual 3rd trip; a 4th+ trip gets the plain fact, not a stale citation.
  if (trip === 3 && t1?.avg && t3?.avg && t3.ab >= TTO_MIN_AB) {
    const diff = Math.abs(Number(t3.avg) - Number(t1.avg))
    return {
      text: `Batters see ${who} a ${ordinal(trip)} time this inning — they're hitting ${t3.avg} off him the 3rd time through this season (${t1.avg} the 1st time)`,
      personId: lastPitcher,
      side: pitchingSide,
      kind: 'tto',
      dedupeKey: `tto-${pitchingSide}-${lastPitcher}`,
      score: clampScore(SCORE_BASE.ttoSplit + magnitudeOf(diff * 100, 15)),
    }
  }
  return {
    text: `The order turns over — batters see ${who} a ${ordinal(trip)} time this inning`,
    personId: lastPitcher,
    side: pitchingSide,
    kind: 'tto',
    dedupeKey: `tto-${pitchingSide}-${lastPitcher}`,
    score: clampScore(SCORE_BASE.tto),
  }
}

// "Batters make Peralta work more each time through this season — 3.8 pitches
// per PA the 1st time, 4.6 the 2nd, 5.3 the 3rd" — the grind-escalation sibling
// of the times-through card, from the same playLog-derived split (each trip
// bucket's pitches-per-PA, `tto[trip].ppa`; see gen-callouts.mjs). Fires ONCE,
// entering the half where the order first turns over a 2nd time (trip === 2), so
// it never shares a strip with the 3rd-time AVG card above. Same caller-gate as
// that card (enteringStarterTrip reads previous halves). Only when the pace
// genuinely climbs — each trip needs a real PA sample and the 2nd time has to
// cost at least TTO_PITCHES_MIN_STEP more pitches than the 1st, or it's not a
// "wearing him down" story.
const TTO_PITCHES_MIN_PA = 40
const TTO_PITCHES_MIN_STEP = 0.4
export function buildTtoPitchesNote(feed, bundle, inning, half) {
  const battingSide = half === 'top' ? 'away' : 'home'
  const pitchingSide = otherSide(battingSide)
  const found = enteringStarterTrip(feed, inning, half)
  if (!found || found.trip !== 2) return null // introduced as the order first flips
  const pitcherId = found.pitcherId
  const tto = bundle?.starterRecords?.[pitcherId]?.tto
  const t1 = tto?.[1]
  const t2 = tto?.[2]
  if (!t1 || !t2 || !isNum(t1.ppa) || !isNum(t2.ppa)) return null
  if (!(t1.pa >= TTO_PITCHES_MIN_PA) || !(t2.pa >= TTO_PITCHES_MIN_PA)) return null
  if (!(t2.ppa - t1.ppa >= TTO_PITCHES_MIN_STEP)) return null // must actually escalate

  // Fold the 3rd trip into the progression only when it keeps climbing and has
  // its own real sample — otherwise the two-trip version tells the story clean.
  const t3 = tto?.[3]
  const includeT3 = t3 && isNum(t3.ppa) && t3.pa >= TTO_PITCHES_MIN_PA && t3.ppa >= t2.ppa
  const { last } = personNameParts(feed?.gameData?.players?.[`ID${pitcherId}`] ?? {})
  const who = last || 'the starter'
  const tail = includeT3
    ? `${t1.ppa} pitches per PA the 1st time through, ${t2.ppa} the 2nd, ${t3.ppa} the 3rd`
    : `${t1.ppa} pitches per PA the 1st time through, ${t2.ppa} the 2nd`
  const step = (includeT3 ? t3.ppa : t2.ppa) - t1.ppa
  return {
    text: `Batters make ${who} work more each time through this season — ${tail}`,
    personId: pitcherId,
    side: pitchingSide,
    kind: 'ttoPitches',
    dedupeKey: `ttoPitches-${pitchingSide}-${pitcherId}`,
    score: clampScore(SCORE_BASE.ttoPitches + magnitudeOf(step * 10, 15)),
  }
}
