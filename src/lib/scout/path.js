import { entitySegment } from '../route.js'

// A Matchup Scout address (#1410), the counterpart of scout/route.js's parse.
// `pitcher` and `hitter` are { id, name }; without both it is the bare
// pickers page. A default is never written: no `?view=pitcher`, no
// `?scope=all`, so a link that did not ask for something does not carry it.
export function scoutPath({ pitcher, hitter, view, scope, pitch, d } = {}) {
  const q = new URLSearchParams()
  if (view === 'hitter') q.set('view', 'hitter')
  if (scope === 'reg' || scope === 'post') q.set('scope', scope)
  if (pitch) q.set('pitch', pitch)
  if (d) q.set('d', d)
  const qs = q.toString() ? `?${q}` : ''
  if (!pitcher?.id || !hitter?.id) return `/scout${qs}`
  return `/scout/${entitySegment(pitcher.id, pitcher.name)}/${entitySegment(hitter.id, hitter.name)}${qs}`
}
