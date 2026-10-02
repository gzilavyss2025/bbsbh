// The addresses of the two situational-record explorers, the regular-season
// /situational-records and the postseason /postseason-records. Their query is
// the same shape (a category, a metric, a sort), so the parse lives once, here,
// and route.js calls it — route.js had no room left for a second copy.
//
// Imports nothing, on purpose: route.js imports THIS file, so a `linkQuery`
// import back would be a cycle. The only hint a postseason address carries is
// `?d=`, which is written the way linkQuery writes it.

// Parses either explorer's address. `name` is the first path segment; returns
// null for anything else. The /team-records spelling is the old address of the
// regular-season page and stays an inbound alias for shared links. Every value
// is free-form: the page validates each one and falls back, never errors.
export function parseRecordsRoute(name, q, { asOf, sportId }) {
  const shared = {
    asOf,
    category: q.get('category') || null,
    metric: q.get('metric') || null,
    sort: q.get('sort') || null,
    order: q.get('order') || null,
  }
  if (name === 'situational-records' || name === 'team-records') {
    return {
      name: 'situational-records',
      sportId,
      half: q.get('half') || null,
      month: q.get('month') || null,
      ...shared,
    }
  }
  if (name === 'postseason-records') {
    return {
      name: 'postseason-records',
      season: q.get('season') || null,
      view: q.get('view') || null,
      team: q.get('team') || null,
      min: q.get('min') || null,
      ...shared,
    }
  }
  return null
}

// A postseason-records address. `season` is a year or 'all' (absent means the
// latest on file), `view` is 'teams' for the by-team view (absent means the
// by-situation view), `team` a club id, `min` the all-years minimum games. A default is never written, so a link
// that did not ask for something does not carry it.
export function postseasonRecordsPath({ season, view, team, min, category, metric, sort, order, d } = {}) {
  const q = new URLSearchParams()
  if (d) q.set('d', d)
  if (season) q.set('season', String(season))
  if (view === 'teams') q.set('view', 'teams')
  if (view === 'teams' && team) q.set('team', String(team))
  // The all-years floor on games in a split; 0 or absent is "any".
  if (Number(min) > 0) q.set('min', String(min))
  if (category) q.set('category', category)
  if (metric) q.set('metric', metric)
  if (sort && sort !== 'pct') q.set('sort', sort)
  if (order === 'asc' || order === 'desc') q.set('order', order)
  const qs = q.toString()
  return `/postseason-records${qs ? `?${qs}` : ''}`
}
