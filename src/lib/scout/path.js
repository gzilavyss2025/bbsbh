import { entitySegment } from '../route.js'

// A Matchup Scout address (#1410), the counterpart of scout/route.js's parse.
// `pitcher` and `hitter` are { id, name }; without both it is the bare
// pickers page. A default is never written: no `?view=pitcher`, no
// `?scope=all`, so a link that did not ask for something does not carry it.
export function scoutPath({ pitcher, hitter, view, scope, pitch, hand, metric, tab, d } = {}) {
  const q = new URLSearchParams()
  if (view === 'hitter') q.set('view', 'hitter')
  if (scope === 'reg' || scope === 'post') q.set('scope', scope)
  if (pitch) q.set('pitch', pitch)
  if (hand === 'R' || hand === 'L') q.set('hand', hand)
  if (metric) q.set('metric', metric)
  if (tab === 'zones' || tab === 'meet') q.set('tab', tab)
  if (d) q.set('d', d)
  const qs = q.toString() ? `?${q}` : ''
  if (!pitcher?.id || !hitter?.id) return `/scout${qs}`
  return `/scout/${entitySegment(pitcher.id, pitcher.name)}/${entitySegment(hitter.id, hitter.name)}${qs}`
}

// The Scout link off one plate appearance: pitcher first, then hitter. `d` is
// the game's own date so the head-to-head list holds back this meeting and any
// later one (ADR-0095); without a date it is left off and the scout's own
// default cutoff (today) applies. Null when either man has no id.
export function atBatScoutPath({ pitcher, batter, gameDate } = {}) {
  if (!pitcher?.id || !batter?.id) return null
  const name = (p) => [p.first, p.last].filter(Boolean).join(' ')
  return scoutPath({
    pitcher: { id: pitcher.id, name: name(pitcher) },
    hitter: { id: batter.id, name: name(batter) },
    d: gameDate || undefined,
  })
}
