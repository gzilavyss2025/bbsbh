// Pure builder for the play-by-play "call-out" notes — the season-context lines
// (leader / streak / situational-record) shown on an at-bat card. Reads only an
// atbat entry (see computeHalfInningFeed) plus a precomputed callouts bundle
// (see api/callouts.js) and returns an ordered list of notes the card renders.
// Kept pure + separate so the trigger rules and wording are checkable and
// PlayByPlay.jsx stays a view. Empty when there's no bundle (MiLB /
// un-generated game), so the card renders exactly as before.
//
// Each note is `{ text, personId, side, oppSide }` — `personId` (nullable) is
// who the note is ABOUT, for a headshot; `side`/`oppSide` ('away'|'home') name
// whose club(s) the note concerns, for a team-logo fallback when there's no
// single person (or as a second logo alongside a person, for a note that
// pits two clubs against each other). PlayByPlay's at-bat card only ever
// reads `.text` (the batter's own headshot is already on that card); the box
// score's Insights roll-up (computeGameCalloutNotes below) is what actually
// uses the identity fields to draw a headshot/logo card per note.

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

const otherSide = (side) => (side === 'away' ? 'home' : 'away')

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
    if (v != null) {
      notes.push({
        text: `Leads the ${L.team} in ${trig.phrase} (${v})`,
        personId: entry.batterId,
        side: battingSide,
      })
    }
  }

  // He homered, and the club has a lopsided record in games he does.
  if (entry.eventType === 'home_run') {
    const rec = homerRecords[entry.batterId]
    const team = bundle[battingSide]?.name
    if (rec && team) {
      notes.push({
        text: `The ${team} are ${rec} when he goes deep`,
        personId: entry.batterId,
        side: battingSide,
      })
    }
  }

  // The pitcher — on the card of the batter he just struck out — leads his club
  // in strikeouts.
  if (STRIKEOUT_EVENTS.has(entry.eventType) && entry.pitcher) {
    const P = pitcherLeaders[entry.pitcher.id]
    const v = P?.cats?.so_p
    if (v != null) {
      notes.push({
        text: `${entry.pitcher.last || 'He'} leads the ${P.team} in strikeouts (${v})`,
        personId: entry.pitcher.id,
        side: otherSide(battingSide),
      })
    }
  }

  // A steal narrated on this card — keyed on the RUNNER (who may not be the
  // batter), from the baserunning note's own runner id.
  for (const bn of entry.baserunningNotes ?? []) {
    if (!SB_EVENTS.has(bn.eventType) || bn.runnerId == null) continue
    const L = leaders[bn.runnerId]
    const v = L?.cats?.sb
    if (v != null) {
      notes.push({
        text: `Leads the ${L.team} in steals (${v})`,
        personId: bn.runnerId,
        side: battingSide,
      })
    }
  }

  // Coming into today — a streak, shown once per game (on his first PA).
  if (firstPA && entry.atBatIndex != null && firstPA.get(entry.batterId) === entry.atBatIndex) {
    const s = streaks[entry.batterId]
    if (s?.onBase) {
      notes.push({
        text: `Riding a ${s.onBase}-game on-base streak`,
        personId: entry.batterId,
        side: battingSide,
      })
    }
    if (s?.stolenBase) {
      notes.push({
        text: `Has stolen ${s.stolenBase} straight without being caught`,
        personId: entry.batterId,
        side: battingSide,
      })
    }
  }

  // This play scored the game's first run — the club's record when it does.
  if (firstRun && firstRun.atBatIndex != null && entry.atBatIndex === firstRun.atBatIndex) {
    const side = firstRun.side
    const other = otherSide(side)
    const scRec = teamRecords[side]?.scoringFirst
    const opRec = teamRecords[other]?.opponentScoringFirst
    const scName = bundle[side]?.name
    const opName = bundle[other]?.name
    if (scRec && scName) {
      let t = `The ${scName} are ${scRec} when scoring first`
      if (opRec && opName) t += ` · ${opName} ${opRec} when the opponent scores first`
      notes.push({ text: t, personId: null, side, oppSide: other })
    }
  }

  return notes
}

// Ordinal-inning wording ("6th", "9th"...) for the lead-reversal note below.
function ordinalInning(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Checkpoints to look for a blown lead at, LATEST first — a team that led
// after both the 7th and the 8th but lost only gets the more dramatic (later)
// note, not both.
const LEAD_CHECKPOINTS = [9, 8, 7, 6]

// "The Orioles were 43-0 when leading after the 8th — until tonight" — a
// club's season-long record when leading after a given inning is normally
// lopsided toward winning (see gen-callouts.mjs's leadAfterRecord), so THIS
// game reversing one of those checkpoints — led after inning N, lost anyway —
// is worth flagging on its own, distinct from every per-play note above.
// Retroactive by nature: it can only be known once the whole game (in
// particular its final score) is in hand, so — like the rest of this box
// score's Insights card — it's safe to compute inside the reveal because the
// SealBox has already exposed the final score by then.
export function buildLeadReversalNote(feed, bundle) {
  if (!bundle) return null
  const finalAway = feed?.liveData?.linescore?.teams?.away?.runs
  const finalHome = feed?.liveData?.linescore?.teams?.home?.runs
  if (typeof finalAway !== 'number' || typeof finalHome !== 'number' || finalAway === finalHome) {
    return null
  }
  const winnerSide = finalAway > finalHome ? 'away' : 'home'

  // Cumulative score through each inning, stopping at the first inning whose
  // bottom half never happened (a walk-off, or a truncated/suspended game) —
  // "leading after inning N" isn't well-defined once that's true.
  let cumAway = 0
  let cumHome = 0
  const leaderAt = {} // inning num -> 'away' | 'home' | null (tied)
  for (const inn of feed?.liveData?.linescore?.innings ?? []) {
    const aR = inn.away?.runs
    const hR = inn.home?.runs
    if (typeof aR !== 'number' || typeof hR !== 'number') break
    cumAway += aR
    cumHome += hR
    leaderAt[inn.num] = cumAway > cumHome ? 'away' : cumHome > cumAway ? 'home' : null
  }

  for (const n of LEAD_CHECKPOINTS) {
    const leadingSide = leaderAt[n]
    if (!leadingSide || leadingSide === winnerSide) continue // led and won — not a reversal
    const rec = bundle.teamRecords?.[leadingSide]?.leadAfter?.[n]
    const teamName = bundle[leadingSide]?.name
    if (!rec || !teamName) continue
    return {
      text: `The ${teamName} were ${rec} when leading after the ${ordinalInning(n)} — until tonight`,
      personId: null,
      side: leadingSide,
      oppSide: winnerSide,
    }
  }
  return null
}

// Every call-out that actually fired somewhere in the game, deduped in
// first-seen order and enriched with each note's headshot/logo identity — the
// box score's Insights card roll-up of the same notes that appear piecemeal
// on individual at-bat cards in the innings view (see buildCallouts above),
// plus the whole-game-only lead-reversal note (see buildLeadReversalNote).
// Walks the raw feed directly rather than routing through
// computeHalfInningFeed (one call per half, with its pitch-detail and
// baserunning-advancement passes) since none of that is needed here — just
// each play's own result, batter, pitcher, and any baserunning event it
// carries. REVEAL-ONLY: the whole game is already behind the box score's
// SealBox by the time this is called, same rule as computeGameSuperlatives.
export function computeGameCalloutNotes(feed, bundle) {
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
    }
  }

  const firstRun = firstRunPlay(feed)
  const firstPA = firstPAIndexByBatter(feed)
  const seen = new Set()
  const ordered = []
  const add = (note) => {
    if (seen.has(note.text)) return
    seen.add(note.text)
    ordered.push(identify(note))
  }

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
    for (const note of buildCallouts(entry, { bundle, firstRun, firstPA, battingSide })) add(note)
  }

  const reversal = buildLeadReversalNote(feed, bundle)
  if (reversal) add(reversal)

  return ordered
}
