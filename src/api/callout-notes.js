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

const otherSide = (side) => (side === 'away' ? 'home' : 'away')

// A hitter's career line against one club, from the separately-fetched
// vs-team-splits file (api/vsTeamSplits.js) — read directly here rather than
// through that module's vsTeamSplitsFor, which also builds the player-page's
// opponent-selector strip that this per-PA note has no use for. `car` is a
// CAREER total (see gen-vs-team-splits.mjs), not season-only, so the note
// always reads "career", never "this year". Kept only past a real sample
// (VS_TEAM_MIN_GAMES) — a 1-game "career" line is a coincidence, not a fact.
const VS_TEAM_MIN_GAMES = 3
function vsTeamCareerLine(vsTeam, personId, teamId) {
  const car = vsTeam?.players?.[personId]?.vs?.[String(teamId)]?.car
  if (!car || car.g < VS_TEAM_MIN_GAMES) return null
  return car
}

export function buildCallouts(
  entry,
  { bundle, firstRun, firstPA, battingSide, vsTeam, timesFacing } = {},
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
  const isFirstPA = firstPA && entry.atBatIndex != null && firstPA.get(entry.batterId) === entry.atBatIndex
  if (isFirstPA) {
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
      })
    }
    const platoon = entry.pitcher?.hand === 'L' ? sit?.vl : entry.pitcher?.hand === 'R' ? sit?.vr : null
    if (platoon) {
      const arm = entry.pitcher.hand === 'L' ? 'lefties' : 'righties'
      notes.push({
        text: `Hitting ${platoon.avg} (${platoon.ops} OPS) against ${arm} this year`,
        personId: entry.batterId,
        side: battingSide,
      })
    }

    // His birthday — precomputed against the slate's own date (see
    // gen-callouts.mjs's isBirthdayOn), so no date math happens client-side.
    if (bundle.birthdays?.includes(entry.batterId)) {
      notes.push({ text: `Celebrating his birthday today`, personId: entry.batterId, side: battingSide })
    }

    // Career line against tonight's opponent (see vsTeamCareerLine) — the
    // "Turang is a career .303 with 2 HR against the Pirates" call-out.
    const oppTeamId = bundle[otherSide(battingSide)]?.teamId
    const car = oppTeamId != null ? vsTeamCareerLine(vsTeam, entry.batterId, oppTeamId) : null
    if (car) {
      const oppName = bundle[otherSide(battingSide)]?.name
      const hrPart = car.hr > 0 ? ` with ${car.hr} HR` : ''
      if (oppName) {
        notes.push({
          text: `Career ${car.avg}${hrPart} against the ${oppName}`,
          personId: entry.batterId,
          side: battingSide,
        })
      }
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
    })
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

// Ordinal wording ("6th", "9th", "3rd"...) — shared by the lead-reversal note
// (inning number) and the times-through-the-order note above (trip number).
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Cumulative runs each side has scored through each inning, stopping at the
// first inning whose bottom half never happened (a walk-off, or a truncated/
// suspended game) — "through inning N" isn't well-defined past that point.
// Shared by every whole-game, checkpoint-based note below.
function cumulativeInnings(feed) {
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

  const leaderAt = {} // inning num -> 'away' | 'home' | null (tied)
  for (const row of cumulativeInnings(feed)) {
    leaderAt[row.inning] = row.cumAway > row.cumHome ? 'away' : row.cumHome > row.cumAway ? 'home' : null
  }

  for (const n of LEAD_CHECKPOINTS) {
    const leadingSide = leaderAt[n]
    if (!leadingSide || leadingSide === winnerSide) continue // led and won — not a reversal
    const rec = bundle.teamRecords?.[leadingSide]?.leadAfter?.[n]
    const teamName = bundle[leadingSide]?.name
    if (!rec || !teamName) continue
    return {
      text: `The ${teamName} were ${rec} when leading after the ${ordinal(n)} — until tonight`,
      personId: null,
      side: leadingSide,
      oppSide: winnerSide,
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

// "The Dodgers are 32-4 when scoring 8+ runs" — the highest bucket each side's
// own final score actually clears. No "reversal" framing (unlike the lead note
// above) since RUN_SCORED_BUCKETS carries no lopsidedness floor at the data
// layer — the record itself, however it reads, is the point.
export function buildRunsScoredNote(feed, bundle) {
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
      const rec = bundle.teamRecords?.[side]?.runsScored?.[n]
      const teamName = bundle[side]?.name
      if (!rec || !teamName) continue
      return { text: `The ${teamName} are ${rec} when scoring ${n}+ runs`, personId: null, side, oppSide: otherSide(side) }
    }
  }
  return null
}

// "The Cubs are 3-19 when allowing 4+ runs by the 7th" — symmetric to
// buildLeadReversalNote but for runs ALLOWED rather than a lead. Checked
// LATEST checkpoint first, same reasoning as LEAD_CHECKPOINTS: a team that
// blew up early AND late only needs the one, more dramatic, note.
export function buildRunsAllowedNote(feed, bundle) {
  if (!bundle) return null
  const rows = cumulativeInnings(feed)
  for (const n of RUNS_ALLOWED_CHECKPOINTS) {
    const row = rows.find((r) => r.inning === n)
    if (!row) continue
    for (const side of ['away', 'home']) {
      const allowed = side === 'away' ? row.cumHome : row.cumAway
      if (allowed < RUNS_ALLOWED_THRESHOLD) continue
      const rec = bundle.teamRecords?.[side]?.runsAllowedByInning?.[n]
      const teamName = bundle[side]?.name
      if (!rec || !teamName) continue
      return {
        text: `The ${teamName} are ${rec} when allowing ${RUNS_ALLOWED_THRESHOLD}+ runs by the ${ordinal(n)}`,
        personId: null,
        side,
        oppSide: otherSide(side),
      }
    }
  }
  return null
}

// "The Twins are 14-22 in games they've trailed by 3+" — fires for whichever
// side actually fell behind by COMEBACK_DEFICIT+ at some point tonight,
// regardless of the final result (the record itself covers both outcomes).
export function buildComebackNote(feed, bundle) {
  if (!bundle) return null
  let deficitSide = null
  for (const row of cumulativeInnings(feed)) {
    if (row.cumHome - row.cumAway >= COMEBACK_DEFICIT) deficitSide = 'away'
    else if (row.cumAway - row.cumHome >= COMEBACK_DEFICIT) deficitSide = 'home'
    if (deficitSide) break
  }
  if (!deficitSide) return null
  const rec = bundle.teamRecords?.[deficitSide]?.comeback
  const teamName = bundle[deficitSide]?.name
  if (!rec || !teamName) return null
  return {
    text: `The ${teamName} are ${rec} in games they've trailed by ${COMEBACK_DEFICIT}+`,
    personId: null,
    side: deficitSide,
    oppSide: otherSide(deficitSide),
  }
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
    }
  }

  const firstRun = firstRunPlay(feed)
  const firstPA = firstPAIndexByBatter(feed)
  const timesFacing = timesFacingPitcher(feed)
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
    for (const note of buildCallouts(entry, { bundle, firstRun, firstPA, battingSide, vsTeam, timesFacing })) {
      add(note)
    }
  }

  const reversal = buildLeadReversalNote(feed, bundle)
  if (reversal) add(reversal)
  const runsScored = buildRunsScoredNote(feed, bundle)
  if (runsScored) add(runsScored)
  const runsAllowed = buildRunsAllowedNote(feed, bundle)
  if (runsAllowed) add(runsAllowed)
  const comeback = buildComebackNote(feed, bundle)
  if (comeback) add(comeback)

  return ordered
}
