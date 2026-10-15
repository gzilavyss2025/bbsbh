import { parentOrgIdOf } from '../../data/shared.js'

// What the page foot shows (#1107, row 5c): the level's other clubs, the Affiliate chip (a
// MiLB club with a parent club) and the Game Notes card (MLB only: no other level posts
// notes, gameNotes.js). A part with nothing to show is false/null, and `null` is no foot.
export function footParts(team, levelClubs) {
  const clubs = levelClubs?.length ? levelClubs : null
  const affiliateId = (team.sport?.id ?? 1) !== 1 ? parentOrgIdOf(team) : null
  const notes = (team.sport?.id ?? 1) === 1
  return clubs || affiliateId || notes ? { clubs, affiliateId, notes } : null
}
