// A small inline IL cross — same glyph/color as the player page's full
// il-banner mark (src/index.css `.il-banner__mark`), sized down for use next
// to a name in a dense list (Team Leaders, the Preferred Lineup diamond)
// rather than that banner's own full-width treatment. Distinct from
// RosterList's `.ilchip` badge (used on the Injured List section itself,
// which also carries the day count) — this is a lightweight flag for a
// player showing up somewhere ELSE on the page who happens to be hurt.
export function InjuredMark({ hurt }) {
  if (!hurt) return null
  return (
    <span className="ilmark" aria-hidden="true" title="Injured List">✚</span>
  )
}
