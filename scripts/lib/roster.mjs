// Shared roster-scan helpers for the generators that sweep all 30 clubs'
// rosters (gen-milestones.mjs today; gen-rookies.mjs and gen-workload.mjs run
// the same scan and can adopt this the next time either is touched).
//
// Lives here, not inline in a generator, for a plain reason: a generator file
// is a top-level script — importing one RUNS it, fetches and all — so a helper
// that stays inside it can never be unit-tested. See test/milestone-watch.test.js.

// A traded player can sit on BOTH clubs' fullRoster for a while: the old
// club's row simply isn't cleaned up, and both read `status: Active` (verified
// 2026-08-09 — Jameson Taillon, personId 592791, listed by the Cubs and the
// Blue Jays at once). A per-club scan then yields two rows for one player, and
// any generator that files a row per (player, club) writes him twice.
//
// `hydrate=person(currentTeam)` on the roster request is the tiebreak: it
// answers with the club he is actually on TODAY no matter whose roster the row
// came from, so the stale listing is the one dropped. A player whose
// currentTeam matches neither row — or is missing entirely, on a thin
// response — keeps the FIRST row seen rather than being dropped: the record is
// real either way, and a slightly stale club badge beats losing it.
export function dedupeRosterEntries(entries) {
  const byPerson = new Map()
  for (const entry of entries ?? []) {
    const personId = entry?.person?.id
    if (!personId) continue
    if (!byPerson.has(personId)) {
      byPerson.set(personId, entry)
      continue
    }
    const current = entry.person?.currentTeam?.id
    if (current && entry.teamId === current) byPerson.set(personId, entry)
  }
  return [...byPerson.values()]
}
