// Player identity + roster status — is he actually ON a club, or does
// `currentTeam` just have nowhere else to point? See ../person.js's header
// for the module's overall spoiler footing.

import { isMlbTeamId } from '../../lib/teams.js'
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

export function personBio(person) {
  if (!person) return null
  const born = [person.birthCity, person.birthStateProvince ?? person.birthCountry]
    .filter(Boolean)
    .join(', ')
  return {
    id: person.id,
    fullName: person.fullName ?? '',
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
    born: born || DASH,
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
// nowhere else to point?
// ---------------------------------------------------------------------------
// `personBio.team` above comes from `currentTeam`, and that field NEVER empties:
// the API keeps aiming a released, unsigned, or decades-retired player at the
// last club he was under contract to. Pujols still reads "St. Louis Cardinals"
// four years after his last game; a reliever DFA'd last week still reads as his
// old club's. The page rendered that as his team, logo and all, which is the
// confusion this replaces.
//
// The honest signal is `rosterEntries` (hydrated in fetchPerson): one row per
// STINT — a `startDate`, an `endDate` that's absent while the stint is open, and
// a `status` naming how it ENDED (`RL` released, `FA` declared free agency,
// `RET` voluntarily retired). So "on a roster on date D" is just "some stint
// covers D". Verified live: zero false positives across 272 forty-man players
// and 120 minor leaguers, where the only names the test flagged were four who
// really had been released.
//
// Which KIND of gap it is takes one more field: `active === false` (or a last
// stint that ended on the voluntarily-retired list) means retired, and every
// other gap is an unsigned free agent.
//
// Both of those read the present, which is why only a gap running to the present
// is reportable at all — see the far-side guard below, and note that it is what
// makes this safe to point at an old box score's player links.
//
// Returns null when he IS rostered, when the gap has a stint on the far side of
// it, and when the feed carries no entries at all — each means "nothing to say,
// render the club exactly as before".
export function rosterStatusView(person, onDate) {
  const entries = (person?.rosterEntries ?? []).filter((e) => e.startDate)
  if (!entries.length || !onDate) return null
  const covers = (e) => e.startDate <= onDate && (!e.endDate || e.endDate >= onDate)
  if (entries.some(covers)) return null
  // A gap with a stint on the FAR side of it is not reportable, and this guard
  // is the whole reason the feature is safe to point at an old box score. The
  // history is holey the further back you go: Pujols's rows jump from a 2000
  // Arizona Fall League stint straight to his 2011 Angels contract, so his
  // entire Cardinals decade is a gap the naive check calls unemployment. Only a
  // gap that runs to the present is trustworthy — nothing has been recorded
  // since, because there is nothing to record. An interior gap could be either,
  // and "either" means say nothing and render the club as before.
  if (entries.some((e) => e.startDate > onDate)) return null

  const ended = entries.filter((e) => e.endDate && e.endDate <= onDate)
  const newest = (rows) => rows.reduce((a, b) => (a && a.endDate >= b.endDate ? a : b), null)
  const last = newest(ended)
  const retired = person.active === false || last?.status?.code === 'RET'
  // Which club to name as his last stop. Prefer his most recent CURRENT-MLB
  // stint, because a former big leaguer's final row is often a winter-league or
  // independent club he passed through afterward — Céspedes ends at Águilas
  // Cibaeñas, Abreu at the Senadores de San Juan, Kinsler at the Long Island
  // Ducks — and naming one of those as "last team" is the same wrong answer in
  // a different costume. Falls back to the most recent stint of any kind, which
  // is also what a career minor leaguer (and a pre-expansion club, absent from
  // the current-30 table) correctly gets.
  const stop = newest(ended.filter((e) => isMlbTeamId(e.team?.id))) ?? last
  return {
    state: retired ? 'retired' : 'free-agent',
    label: retired ? 'Retired' : 'Free Agent',
    lastTeam: stop?.team?.id
      ? { id: stop.team.id, name: stop.team.name ?? '' }
      : null,
    through: stop?.endDate ?? null,
  }
}

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
