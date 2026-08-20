import { lastName } from '../../../api/select.js'
import { firstLast, isTwoWay } from '../../../api/person.js'

// Pieces MORE THAN ONE team-hub loader genuinely needs, collapsed here once the
// tabs had all landed (issue 07 of .scratch/team-page-ia — the tab loaders were
// deliberately written by copying out of the old TeamPage.jsx `loadTeam`, so
// four agents could work in parallel without sharing a function).
//
// The bar for living here is "two loaders answer the SAME question with the same
// code", not "two loaders look similar". Anything a single tab owns stays in that
// tab's loader: the recent-form window and the per-pitcher game-log fixup are
// only ever the Roster tab's, the postseason-odds join only the Numbers tab's and
// the Overview's, the prospect-level resolution only the Minors tab's.

const DASH = '—'

// ---------------------------------------------------------------------------
// Dates and cutoffs
// ---------------------------------------------------------------------------

export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// The day BEFORE `iso`. Every dated (`?d=`) team-hub request is cut off here
// rather than at `asOf` itself, so a visitor mid-scoring never sees a record,
// standing or result that already counts tonight's game.
export function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// The season a page is about: the `?d=` year on a dated link, else this year.
export function seasonOf(asOf) {
  return Number((asOf || isoToday()).slice(0, 4))
}

// The standings/schedule cutoff a loader passes to the API — null (live) on a
// bare link, the day before on a dated one.
export function cutoffFor(asOf) {
  return asOf ? dayBefore(asOf) : null
}

// The cutoff for the PRECOMPUTED score files (team-score / season-score /
// postseason-odds), which are always written through the latest completed day.
// A dated page uses exactly the same day-before cutoff as its standings request,
// so the score never looks ahead of the standings beside it.
export function scoreCutoffFor(asOf) {
  return dayBefore(asOf || isoToday())
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

function nickname(name) {
  return (name || '').split(/\s+/).slice(-1)[0] || name || DASH
}
// A split record ('lastTen' / 'home' / 'away') as a "W-L" string, or DASH when
// the split is absent (thin/early feeds) — same convention as api/standings.js's
// own splitWL.
function splitWL(rec, type) {
  const t = (rec.records?.splitRecords ?? []).find((s) => s.type === type)
  return t ? `${t.wins}-${t.losses}` : DASH
}
// The same split, as raw { wins, losses } rather than a formatted string — for
// a caller that wants to feed it through its own W-L formatter (the Numbers
// tab's home/away jersey cards). Absent split degrades to { wins: 0, losses: 0 }
// rather than null, since every consumer's own formatter already reads 0-0 as
// "no games yet".
function splitRecord(rec, type) {
  const t = (rec.records?.splitRecords ?? []).find((s) => s.type === type)
  return { wins: t?.wins ?? 0, losses: t?.losses ?? 0 }
}
function runDiff(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d)) return DASH
  return d > 0 ? `+${d}` : `${d}`
}
function runDiffTone(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d) || d === 0) return ''
  return d > 0 ? 'is-positive' : 'is-negative'
}

// The club's own division out of a fetchStandings response. Undefined for a
// thin feed with no division record, which every caller below degrades on.
// A division-less league (the Northwest League's six clubs, e.g.) has no
// `division` on either side: the static team file coalesces the missing id to
// `null` (scripts/gen-teams.mjs), but statsapi's own standings record just
// omits the field, reading `undefined`. Normalize both to `null` so that
// still counts as a match instead of silently returning no row at all.
export function divisionRecordFor(standings, team) {
  const myDivId = team.division?.id ?? null
  return standings.find((r) => (r.division?.id ?? null) === myDivId)
}

// The identity header's record line ("74–52 · 1st · NL Central"), or null when
// the feed has no row for this club — the line then simply hides.
export function teamRecordFor(standings, team, id) {
  const mine = divisionRecordFor(standings, team)?.teamRecords?.find((t) => t.team.id === id)
  return mine
    ? { wins: mine.wins, losses: mine.losses, rank: mine.divisionRank, div: team.division?.name }
    : null
}

// The division standings table's rows, in feed order (the standings themselves),
// each flagged `isMe` for the viewed club. Shared by the Numbers tab's full
// table and the Overview's three-row preview, which must agree row for row.
export function standingsRowsFor(standings, team, id) {
  return (divisionRecordFor(standings, team)?.teamRecords ?? []).map((t) => ({
    id: t.team.id,
    name: nickname(t.team.name),
    wins: t.wins,
    losses: t.losses,
    gb: t.gamesBack,
    streak: t.streak?.streakCode ?? DASH,
    l10: splitWL(t, 'lastTen'),
    home: splitWL(t, 'home'),
    away: splitWL(t, 'away'),
    homeRecord: splitRecord(t, 'home'),
    awayRecord: splitRecord(t, 'away'),
    diff: runDiff(t),
    diffTone: runDiffTone(t),
    isMe: t.team.id === id,
  }))
}

// ---------------------------------------------------------------------------
// Injured list
// ---------------------------------------------------------------------------

// Injured-List sort: shortest stint first (7/10 → 15 → 60 → full-season), then name.
const IL_ORDER = { 7: 0, 10: 1, 15: 2, 60: 3, IL: 4 }

// Every injured player on the club's 40-man view, each tagged with which IL
// (10/15/60-day; MiLB shows 7/60/full-season). Spoiler-free — roster membership
// reveals nothing about the score. Degrades to [] when no IL is posted.
export function injuredListFrom(ilRoster, nameOf) {
  return ilRoster
    .filter((r) => /^D\d+$/.test(r.status?.code ?? '') || r.status?.code === 'ILF')
    .map((r) => {
      const code = r.status?.code ?? ''
      return {
        id: r.person?.id,
        name: nameOf(r.person),
        jersey: r.jerseyNumber ?? '',
        pos: r.position?.abbreviation ?? '',
        ilLabel: code.match(/^D(\d+)$/)?.[1] ?? (code === 'ILF' ? 'IL' : DASH),
      }
    })
    .sort((a, b) => (IL_ORDER[a.ilLabel] ?? 9) - (IL_ORDER[b.ilLabel] ?? 9) || a.name.localeCompare(b.name))
}

// Just the ids — what a surface that only FLAGS a hurt player needs (the ✚ on a
// leaders row or a lineup diamond spot), without shaping the list itself.
export function injuredIdsFrom(ilRoster) {
  return new Set(
    ilRoster
      .filter((r) => /^D\d+$/.test(r.status?.code ?? '') || r.status?.code === 'ILF')
      .map((r) => r.person?.id)
      .filter(Boolean),
  )
}

// ---------------------------------------------------------------------------
// Roster stat splits
// ---------------------------------------------------------------------------

// A player who's changed teams mid-season (trade, waiver claim, DFA pickup)
// carries MULTIPLE splits, one per team, each tagged `.team.id`. Blindly reading
// splits[0] silently picked up whichever row sorted first, which could be an
// ex-team's line — a Brewers page showing a recent pickup's FULL season numbers.
// Narrow to the CURRENT team's own row(s) first, falling back to the raw list
// only when nothing is team-tagged (the normal case for someone who's been here
// all year).
export function preferTeamSplits(splits, teamId) {
  const teamRows = splits.filter((s) => s.team?.id === teamId)
  return teamRows.length ? teamRows : splits
}

// A roster row's season pitching stat object. Callers must pre-filter to actual
// pitchers (r.position?.type === 'Pitcher'); the `?? stats[0]` fallback exists
// only for a true pitcher whose stats array happens to lack a pitching split
// yet, and would misread a position player's hitting split as pitching
// otherwise.
export function rosterPitchingStat(r, teamId) {
  const stats = r.person?.stats ?? []
  const pit = stats.find((s) => s.group?.displayName === 'pitching') ?? stats[0]
  return preferTeamSplits(pit?.splits ?? [], teamId)[0]?.stat ?? null
}

// A roster row's season fielding splits, one per position played — see
// fetchTeamRoster's hydrate note (api/team.js) on why this needs live
// verification. Feeds the Preferred Lineup diamond below.
export function rosterFieldingSplits(r, teamId) {
  const stats = r.person?.stats ?? []
  return preferTeamSplits(stats.find((s) => s.group?.displayName === 'fielding')?.splits ?? [], teamId)
}

// A roster row's season hitting line — feeds the Top Substitutes list's
// games-played ranking.
export function rosterHittingStat(r, teamId) {
  const stats = r.person?.stats ?? []
  const hit = stats.find((s) => s.group?.displayName === 'hitting')
  return preferTeamSplits(hit?.splits ?? [], teamId)[0]?.stat ?? null
}

// Innings pitched ("104.1" = 104⅓) → outs, so a workload tiebreak compares
// linearly (see api/teamLeaders.js's identical ipToOuts).
export function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return (Number(whole) || 0) * 3 + (Number(frac[0]) || 0)
}

// ---------------------------------------------------------------------------
// Pitching staff (season line)
// ---------------------------------------------------------------------------

// Every roster pitcher's season line — starts, saves, innings-as-outs — off
// the 40Man roster so a hurt ace or closer still counts. Shared by the Roster
// tab's own Starting Pitchers sort and the Overview's smaller preview, which
// must rank the same way.
export function fullPitchingLineFrom(fullRoster, teamId) {
  return fullRoster
    .filter((r) => r.position?.type === 'Pitcher' || isTwoWay(r.person))
    .map((r) => {
      const stat = rosterPitchingStat(r, teamId)
      return {
        id: r.person?.id,
        name: firstLast(r.person),
        jersey: r.jerseyNumber ?? '',
        gs: Number(stat?.gamesStarted) || 0,
        saves: Number(stat?.saves) || 0,
        ipOuts: ipToOuts(stat?.inningsPitched),
      }
    })
}

// Top-N by games started; a tie goes to whoever logged more innings (more of
// the season's workload behind the same start count), then jersey number for
// a stable sort.
export function topStartingPitchersFrom(fullPitchers, limit = 5) {
  return [...fullPitchers]
    .filter((p) => p.gs > 0)
    .sort((a, b) => b.gs - a.gs || b.ipOuts - a.ipOuts || Number(a.jersey) - Number(b.jersey))
    .slice(0, limit)
}

// The most saves among pitchers NOT already claiming a starter slot — a
// swingman who picked up a save or two before moving into the rotation
// shouldn't out-close the bullpen's actual closer.
export function closerFrom(fullPitchers, startingIds) {
  const relievers = fullPitchers.filter((p) => !startingIds.has(p.id))
  const maxSaves = relievers.reduce((max, p) => Math.max(max, p.saves), 0)
  return maxSaves > 0 ? relievers.find((p) => p.saves === maxSaves) : null
}

// ---------------------------------------------------------------------------
// Preferred lineup
// ---------------------------------------------------------------------------

// The Preferred Lineup diamond's eight field spots plus DH, in no particular
// order (DefenseDiamond itself lays the field spots out; DH rides beneath).
const PREFERRED_LINEUP_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

// One player per field position off the 40Man roster (so an injured/rehabbing
// regular still counts — the Injured List flags that separately), keyed FIRST
// off each player's CURRENT primary position rather than season-cumulative games
// started: a player who's since moved off a position still owns the season's
// higher games-started total there, so ranking each position independently by GS
// double-booked him at both spots. GS only breaks ties among teammates who share
// a primary position (rare — a real battle for a spot).
//
// A position can still come up empty on primary position alone (a thin feed, or
// a tag that hasn't caught up with a recent move) — a SECOND pass fills any
// position still open with whoever has the most games started there among
// players not already claimed elsewhere. DH skips the first pass entirely (it's
// almost never anyone's primary position) and goes straight to that fallback.
//
// Shared by the Roster tab's projection and the Overview's lineup preview, which
// must show the same nine.
export function preferredLineupFrom(fullRoster, teamId) {
  const gsAt = (r, pos) =>
    Number(
      rosterFieldingSplits(r, teamId).find((s) => s.position?.abbreviation === pos)?.stat?.gamesStarted,
    ) || 0
  const bestByPosition = {}
  const claimed = new Set()
  for (const pos of PREFERRED_LINEUP_POSITIONS) {
    if (pos === 'DH') continue
    const candidates = fullRoster.filter((r) => r.person?.id && r.position?.abbreviation === pos)
    if (!candidates.length) continue
    const best = candidates.reduce((a, b) => (gsAt(b, pos) > gsAt(a, pos) ? b : a))
    bestByPosition[pos] = {
      position: pos,
      id: best.person.id,
      last: lastName(best.person),
      // The diamond PRINTS the surname (that is what a scorebook does) but its
      // link ADDRESSES the whole name — ADR-0057. Two different jobs, so both
      // spellings ride along rather than one being derived from the other.
      name: firstLast(best.person),
      gs: gsAt(best, pos),
    }
    claimed.add(best.person.id)
  }
  for (const pos of PREFERRED_LINEUP_POSITIONS) {
    if (bestByPosition[pos]) continue
    let best = null
    for (const r of fullRoster) {
      const pid = r.person?.id
      if (!pid || claimed.has(pid)) continue
      const gs = gsAt(r, pos)
      if (gs > 0 && (!best || gs > best.gs))
        best = { position: pos, id: pid, last: lastName(r.person), name: firstLast(r.person), gs }
    }
    if (best) {
      bestByPosition[pos] = best
      claimed.add(best.id)
    }
  }
  return PREFERRED_LINEUP_POSITIONS.map((pos) => bestByPosition[pos]).filter(Boolean)
}

// The diamond's own row shape — the lineup above, each spot flagged when that
// player is currently on the IL (DefenseDiamond draws the ✚).
export function lineupDefenseFrom(preferredLineup, injuredIds) {
  return preferredLineup.map((p) => ({
    position: p.position,
    last: p.last,
    name: p.name,
    id: p.id,
    hurt: injuredIds.has(p.id),
  }))
}

// ---------------------------------------------------------------------------
// Empty-tab detection (issue 08)
// ---------------------------------------------------------------------------

// Which of the five tab buttons opens onto nothing for this club, decided
// cheaply off the identity data every tab already has (loadTeamIdentity's
// `team`) — never by fetching a tab's own payload just to find out (PRD
// non-negotiable 2). An MLB club never hides anything: every one of them has a
// farm system and a league. Only two MiLB cases are cheap enough to trust:
//  - `minors`: the Minors tab's own affiliates/prospects lookup is keyed off
//    `team.parentOrgId` — with none, every module in that tab comes back empty.
//  - `numbers`: with no league at all there are no standings and no rank
//    context — the tab would open onto nothing but a 0-0 jersey strip.
// A hidden tab is still a real route — this only decides the BUTTON (see
// TeamTabBar's `hidden` prop). Roster and Games are never hidden: every club
// reachable in this app has an active roster and plays a schedule.
export function hiddenTeamTabs(team) {
  const hidden = new Set()
  const isMilb = (team.sport?.id ?? 1) !== 1
  if (!isMilb) return hidden
  // Cot's covers the major leagues only, so a MiLB club's Contracts tab would
  // open on an empty ledger every time. Hidden rather than shown-and-apologetic:
  // a tab that is always empty is not a tab.
  hidden.add('contracts')
  if (!team.parentOrgId) hidden.add('minors')
  if (!team.league?.id) hidden.add('numbers')
  return hidden
}
