// Roster status — is he actually ON a club, or does `currentTeam` just have
// nowhere else to point? One rule for the player page (src/api/person/identity.js
// binds the app's team table to it) and the crawler body (api/_lib/cards.js binds
// the edge copy in api/_lib/entity.js). Pure, no imports: the edge runtime can't
// take src/lib/teams.js, so the two team lookups arrive as arguments (#1779).
// Roster status is open-surface biography, not a score (ADR-0034).
//
// `personBio.team` (src/api/person/identity.js) comes from `currentTeam`, and that field NEVER empties:
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
export function rosterStatusView(person, onDate, { isMlbTeamId, teamFullName = () => null }) {
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
  // Which ORG to name as his last stop, not which literal row. A stint's org is
  // itself when the row is already an MLB club, or its affiliate's parentOrgId
  // when the row is a MiLB one — so an outright assignment to his own club's
  // farm team still reads as that club, not as whichever MLB team he last wore
  // a jersey for. Prefer the newest stint that resolves to an org at all,
  // because a former big leaguer's final row is often a winter-league or
  // independent club he passed through afterward — Céspedes ends at Águilas
  // Cibaeñas, Abreu at the Senadores de San Juan, Kinsler at the Long Island
  // Ducks — none of those carry a parentOrgId, so this still falls through to
  // the affiliated stint underneath. Falls back to the most recent stint of
  // any kind, which is also what a career minor leaguer (and a pre-expansion
  // club, absent from the current-30 table) correctly gets.
  const stintOrg = (e) => {
    const id = e.team?.id
    if (isMlbTeamId(id)) return id
    return isMlbTeamId(e.team?.parentOrgId) ? e.team.parentOrgId : null
  }
  const stop = newest(ended.filter((e) => stintOrg(e) != null)) ?? last
  const stopOrg = stop ? stintOrg(stop) : null
  return {
    state: retired ? 'retired' : 'free-agent',
    label: retired ? 'Retired' : 'Free Agent',
    lastTeam: stopOrg
      ? { id: stopOrg, name: teamFullName(stopOrg) ?? '' }
      : stop?.team?.id
        ? { id: stop.team.id, name: stop.team.name ?? '' }
        : null,
    through: stop?.endDate ?? null,
    retiredAge: retired ? ageOn(person.birthDate, stop?.endDate) : null,
  }
}

// `currentAge` is not a live age for every historical player: statsapi
// freezes it at death for deceased players. A retired page needs neither a
// death date nor a clock. Measure the final roster date against birth date
// once, and the Overview can keep saying a stable baseball fact.
function ageOn(birthDate, throughDate) {
  const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate ?? '')
  const through = /^(\d{4})-(\d{2})-(\d{2})$/.exec(throughDate ?? '')
  if (!birth || !through) return null
  let age = Number(through[1]) - Number(birth[1])
  if (`${through[2]}-${through[3]}` < `${birth[2]}-${birth[3]}`) age -= 1
  return age >= 0 ? age : null
}
