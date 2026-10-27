import { fetchHeadToHead } from '../../../../api/scout/headToHead.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { scoutPath } from '../../../../lib/scout/path.js'

// The Due up batter's matchup with the pitcher on the mound, a row under his name: the door to the
// full Scout first, then "vs Peralta" and his line against him in every meeting BEFORE tonight (the
// Scout's own Savant read, cut off at the game's date, so tonight's pitches never count). Pre-game
// data: no seal (ADR-0034). Names come from the feed's player index.
const person = (feed, id) => {
  const p = feed?.gameData?.players?.[`ID${id}`] ?? {}
  return { id, last: p.lastName ?? '', name: p.fullName ?? '' }
}

export function ScoutLine({ feed, hitterId, pitcherId }) {
  const date = feed?.gameData?.datetime?.officialDate ?? null
  const { data } = useAsync(() => fetchHeadToHead(hitterId, pitcherId, date), [hitterId, pitcherId, date])
  const linkProps = useRouteLink()
  const hitter = person(feed, hitterId)
  const pitcher = person(feed, pitcherId)
  const href = scoutPath({ pitcher, hitter, d: date || undefined })
  const t = data?.totals
  const line = !data ? null : !t?.pa ? 'First meeting' : [`${t.h}-for-${t.ab}`, t.hr && `${t.hr} HR`, t.bb && `${t.bb} BB`, t.k && `${t.k} K`].filter(Boolean).join(' · ')
  return (
    <span className="gdp__scout">
      <a className="gdp__scoutdoor" {...linkProps(href)}>Scout ›</a>
      <span className="gdp__scoutvs">vs {pitcher.last}</span>
      {line && <b className="gdp__scoutline">{line}</b>}
    </span>
  )
}
