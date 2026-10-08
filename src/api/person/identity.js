// Player identity + roster status — is he actually ON a club, or does
// `currentTeam` just have nowhere else to point? See ../person.js's header
// for the module's overall spoiler footing.

import { birthplace } from '../../lib/person/birthplace.js'
import { rosterStatusView as rosterStatus } from '../../lib/person/rosterStatus.js'
import { isMlbTeamId, teamFullName } from '../../lib/teams.js'
import { DASH, num } from './shared.js'

// ---------------------------------------------------------------------------
// Player identity
// ---------------------------------------------------------------------------

export function personSportId(person) {
  return person?.currentTeam?.sport?.id ?? 1
}

export function isPitcher(person) {
  const p = person?.primaryPosition
  return p?.type === 'Pitcher' || p?.code === '1'
}

// Ohtani-type: a distinct primary position ('TWP' / code 'Y' / type
// 'Two-Way Player'). Such a player gets BOTH a batting and a pitching block.
export function isTwoWay(person) {
  const p = person?.primaryPosition
  return p?.abbreviation === 'TWP' || p?.code === 'Y' || p?.type === 'Two-Way Player'
}

// Starter / closer / reliever from a season pitching stat line. Only CL-vs-not
// changes the season tiles (closer leads with SV); the roster chip shows all
// three. Heuristic, since the API has no role field: mostly-starts => SP; else
// a real save count => CL; otherwise RP (incl. swing arms like Chad Patrick,
// who by design fall here and get the W-L-led tile set). Returns null when the
// season stat has no games yet (e.g. the "entering today" cutoff lands before
// a rookie's first appearance) rather than guessing RP — a starter making his
// MLB debut has zero starts logged the moment before that first game, and
// defaulting to RP there mislabeled him as a reliever; the UI falls back to
// the primary-position abbreviation ('P') instead.
export function pitcherRole(stat) {
  if (!stat) return null
  const g = num(stat.gamesPitched ?? stat.gamesPlayed)
  if (g === 0) return null
  const gs = num(stat.gamesStarted)
  if (gs / g >= 0.5) return 'SP'
  if (num(stat.saves) >= 8) return 'CL'
  return 'RP'
}

// The signed draft, matched to the person's draftYear — NOT drafts[0], which
// can be an earlier UNSIGNED draft (Judge was a 31st-round 2010 pick out of
// high school before his 2013 first round). Undrafted / international players
// carry no draft, so this returns null and the fact box shows "—".
export function draftInfo(person) {
  const year = person?.draftYear
  const drafts = person?.drafts ?? []
  const signed =
    drafts.find((d) => String(d.year) === String(year)) ??
    (drafts.length ? drafts[drafts.length - 1] : null)
  if (!signed && !year) return null
  return {
    year: year ?? signed?.year ?? '',
    round: signed?.pickRound ?? '',
    overall: signed?.pickNumber ?? '',
    teamId: signed?.team?.id ?? null,
    teamName: signed?.team?.name ?? '',
  }
}

// First name / surname for the two-line hero treatment. A plain split on the
// first space handles suffixes and multi-word surnames correctly without
// needing the API's separate firstName/lastName fields ("Vladimir Guerrero
// Jr." -> "Vladimir" / "Guerrero Jr.", "Elly De La Cruz" -> "Elly" / "De La
// Cruz"). A one-word name (rare) renders with no first-name line.
export function splitDisplayName(fullName) {
  const s = (fullName || '').trim()
  if (!s) return { first: '', last: '' }
  const i = s.indexOf(' ')
  if (i === -1) return { first: '', last: s }
  return { first: s.slice(0, i), last: s.slice(i + 1) }
}

// The player's own nickname ("Hammerin' Hank"). Empty when the record has none.
export function personNickname(person) {
  return (person?.nickName ?? '').trim()
}

// "Smyrna, Vanderbilt": high schools first, then colleges, from
// `hydrate=education`. Names only; empty when the record lists neither.
export function educationSummary(person) {
  const { highschools, colleges } = person?.education ?? {}
  const list = (v) => (Array.isArray(v) ? v : [])
  return [...list(highschools), ...list(colleges)]
    .map((s) => (s?.name ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

export function personBio(person) {
  if (!person) return null
  return {
    id: person.id,
    fullName: person.fullName ?? '',
    nickname: personNickname(person),
    education: educationSummary(person),
    number: person.primaryNumber ?? '',
    posAbbr: person.primaryPosition?.abbreviation ?? '',
    posName: person.primaryPosition?.name ?? '',
    bats: person.batSide?.code ?? '',
    throws: person.pitchHand?.code ?? '',
    isPitcher: isPitcher(person),
    twoWay: isTwoWay(person),
    heightWeight:
      person.height && person.weight
        ? `${person.height} · ${person.weight}`
        : person.height || DASH,
    age: person.currentAge ?? DASH,
    birthDate: person.birthDate ?? null,
    born: birthplace(person) || DASH,
    debut: person.mlbDebutDate ?? '',
    draft: draftInfo(person),
    // `parentOrgId`/`parentOrgName` ride along on `currentTeam` for a MiLB
    // club (verified live) — the parent MLB org that team is affiliated with.
    // Absent for an MLB team, so this doubles as the "is this a MiLB player"
    // signal the hero uses to show the affiliate mark.
    team: person.currentTeam
      ? {
          id: person.currentTeam.id,
          name: person.currentTeam.name,
          parentOrgId: person.currentTeam.parentOrgId ?? null,
          parentOrgName: person.currentTeam.parentOrgName ?? '',
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Roster status — is he actually ON a club, or does `currentTeam` just have
// nowhere else to point? The rule and its notes are in lib/person/rosterStatus.js,
// shared with the crawler body; this binds the app's team table to it.
// ---------------------------------------------------------------------------
export const rosterStatusView = (person, onDate) =>
  rosterStatus(person, onDate, { isMlbTeamId, teamFullName })

// The last season he actually appeared in a game, at or before `throughYear` —
// the number behind the "Last played in 2022" banner. `person.lastPlayedDate` is
// the API's own answer and is MLB-scoped (Céspedes reads 2020, his last big
// -league game, not the winter ball he played in 2021), but it's only populated
// once MLB has flipped a player inactive, so an unsigned free agent has none.
// Those fall back to the year-by-year splits the career register already
// fetched: the newest season with a game in it. Takes the later of the two
// rather than picking a winner, so neither source can understate the answer.
// Null when nothing on hand says he ever played.
export function lastPlayedSeason(person, seasonSplits, throughYear) {
  const capped = (y) => (Number.isFinite(y) && (!throughYear || y <= throughYear) ? y : 0)
  const played = (seasonSplits ?? [])
    .filter((s) => num(s.stat?.gamesPlayed) > 0)
    .map((s) => capped(Number(s.season)))
  const stated = capped(Number((person?.lastPlayedDate ?? '').slice(0, 4)))
  return Math.max(stated, ...played, 0) || null
}
