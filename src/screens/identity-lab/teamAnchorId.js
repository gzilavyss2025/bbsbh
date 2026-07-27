// Anchor id for a team's row — shared by the row itself and the pinned
// sidebar's jump links (.colorlab__nav) so the two can never drift apart.
// There were three copies of this before the Team Identity Lab consolidated
// them (Team Color Lab, its MiLB counterpart, Uniform Names); `scope` is what
// kept them distinct, since two pages that both list all 30 clubs must not
// mint the same DOM ids.
export function teamAnchorId(teamId, scope = 'identity-lab') {
  return `${scope}-team-${teamId}`
}
