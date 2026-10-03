// The Matchup Scout's address (#1410): '/scout' (the pickers) and
// '/scout/{pitcher-slug-id}/{hitter-slug-id}' (a pair). Imports nothing on
// purpose: route.js imports THIS file, so it hands in its own `idFromSlug`,
// the same no-cycle rule postseason/recordsRoute.js follows.
//
// The query holds the page's choices, so a shared link opens the same view:
// `?view=hitter` (the catcher's mirror, ADR-0093), `?scope=reg|post` (the
// head-to-head list's rounds; absent is All), `?pitch={code}` (one pitch
// type; absent is All), `?hand=R|L` (the pitchers in the hitter's map;
// absent is both), `?metric=whiff|swing|xwoba` (the hitter map's metric;
// absent is the page's default), and `?d=` (the head-to-head cutoff,
// ADR-0087). A value the page does not know falls back to its default,
// never an error.
const VIEWS = new Set(['pitcher', 'hitter'])
const SCOPES = new Set(['reg', 'post', 'all'])
const HANDS = new Set(['R', 'L'])
const METRICS = new Set(['xwoba', 'whiff', 'swing'])

export function parseScoutRoute(parts, q, { asOf, idFromSlug }) {
  if (parts[0] !== 'scout' || (parts.length !== 1 && parts.length !== 3)) return null
  const view = q.get('view')
  const scope = q.get('scope')
  return {
    name: 'scout',
    pitcherId: parts.length === 3 ? idFromSlug(parts[1]) : null,
    hitterId: parts.length === 3 ? idFromSlug(parts[2]) : null,
    asOf,
    view: VIEWS.has(view) ? view : null,
    scope: SCOPES.has(scope) ? scope : 'all',
    pitch: /^[A-Z]{2}$/.test(q.get('pitch') ?? '') ? q.get('pitch') : null,
    hand: HANDS.has(q.get('hand')) ? q.get('hand') : null,
    metric: METRICS.has(q.get('metric')) ? q.get('metric') : null,
  }
}
