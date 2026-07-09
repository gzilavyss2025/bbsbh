// Pure builder for the play-by-play "call-out" notes — the season-context lines
// (leader / streak / situational-record) shown on an at-bat card. Reads only an
// atbat entry (see computeHalfInningFeed) plus a precomputed callouts bundle
// (see api/callouts.js) and returns an ordered list of short strings the card
// renders. Kept pure + separate so the trigger rules and wording are checkable
// and PlayByPlay.jsx stays a view. Empty when there's no bundle (MiLB /
// un-generated game), so the card renders exactly as before.

import { firstRunPlay, firstPAIndexByBatter, NON_PA_EVENT_TYPES } from './playbyplay.js'
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

export function buildCallouts(entry, { bundle, firstRun, firstPA, battingSide } = {}) {
  if (!bundle) return []
  const notes = []
  const {
    leaders = {},
    pitcherLeaders = {},
    streaks = {},
    homerRecords = {},
    teamRecords = {},
  } = bundle

  // The batter leads his club in the category this plate appearance added to.
  const trig = HIT_TRIGGERS[entry.eventType]
  if (trig) {
    const L = leaders[entry.batterId]
    const v = L?.cats?.[trig.cat]
    if (v != null) notes.push(`Leads the ${L.team} in ${trig.phrase} (${v})`)
  }

  // He homered, and the club has a lopsided record in games he does.
  if (entry.eventType === 'home_run') {
    const rec = homerRecords[entry.batterId]
    const team = bundle[battingSide]?.name
    if (rec && team) notes.push(`The ${team} are ${rec} when he goes deep`)
  }

  // The pitcher — on the card of the batter he just struck out — leads his club
  // in strikeouts.
  if (STRIKEOUT_EVENTS.has(entry.eventType) && entry.pitcher) {
    const P = pitcherLeaders[entry.pitcher.id]
    const v = P?.cats?.so_p
    if (v != null) {
      notes.push(`${entry.pitcher.last || 'He'} leads the ${P.team} in strikeouts (${v})`)
    }
  }

  // A steal narrated on this card — keyed on the RUNNER (who may not be the
  // batter), from the baserunning note's own runner id.
  for (const bn of entry.baserunningNotes ?? []) {
    if (!SB_EVENTS.has(bn.eventType) || bn.runnerId == null) continue
    const L = leaders[bn.runnerId]
    const v = L?.cats?.sb
    if (v != null) notes.push(`Leads the ${L.team} in steals (${v})`)
  }

  // Coming into today — a streak, shown once per game (on his first PA).
  if (firstPA && entry.atBatIndex != null && firstPA.get(entry.batterId) === entry.atBatIndex) {
    const s = streaks[entry.batterId]
    if (s?.onBase) notes.push(`Riding a ${s.onBase}-game on-base streak`)
    if (s?.stolenBase) notes.push(`Has stolen ${s.stolenBase} straight without being caught`)
  }

  // This play scored the game's first run — the club's record when it does.
  if (firstRun && firstRun.atBatIndex != null && entry.atBatIndex === firstRun.atBatIndex) {
    const side = firstRun.side
    const other = side === 'away' ? 'home' : 'away'
    const scRec = teamRecords[side]?.scoringFirst
    const opRec = teamRecords[other]?.opponentScoringFirst
    const scName = bundle[side]?.name
    const opName = bundle[other]?.name
    if (scRec && scName) {
      let t = `The ${scName} are ${scRec} when scoring first`
      if (opRec && opName) t += ` · ${opName} ${opRec} when the opponent scores first`
      notes.push(t)
    }
  }

  return notes
}

// Every call-out that actually fired somewhere in the game, deduped in
// first-seen order — the box score's Insights card roll-up of the same notes
// that appear piecemeal on individual at-bat cards in the innings view (see
// buildCallouts above). Walks the raw feed directly rather than routing
// through computeHalfInningFeed (one call per half, with its pitch-detail and
// baserunning-advancement passes) since none of that is needed here — just
// each play's own result, batter, pitcher, and any baserunning event it
// carries. REVEAL-ONLY: the whole game is already behind the box score's
// SealBox by the time this is called, same rule as computeGameSuperlatives.
export function computeGameCalloutNotes(feed, bundle) {
  if (!bundle) return []
  const firstRun = firstRunPlay(feed)
  const firstPA = firstPAIndexByBatter(feed)
  const seen = new Set()
  const ordered = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const battingSide = play.about?.halfInning === 'top' ? 'away' : 'home'
    const pitcherId = play.matchup?.pitcher?.id
    const pitcher =
      pitcherId != null
        ? { id: pitcherId, ...personNameParts(feed?.gameData?.players?.[`ID${pitcherId}`] ?? {}) }
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
    for (const note of buildCallouts(entry, { bundle, firstRun, firstPA, battingSide })) {
      if (seen.has(note)) continue
      seen.add(note)
      ordered.push(note)
    }
  }
  return ordered
}
