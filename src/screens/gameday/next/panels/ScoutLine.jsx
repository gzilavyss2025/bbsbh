import { fetchHeadToHead } from '../../../../api/scout/headToHead.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchOnce } from '../../../../lib/gameday/fetchOnce.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { scoutPath } from '../../../../lib/scout/path.js'

// The Due up batter's matchup with the pitcher on the mound, a row under his name: the door to the
// full Scout first, then "vs Peralta" and his line against him in every meeting BEFORE tonight (0-for-0 when they have never met) (the
// Scout's own Savant read, cut off at the game's date, so tonight's pitches never count). Pre-game
// data: no seal (ADR-0034). Names come from the feed's player index.
const person = (feed, id) => {
  const p = feed?.gameData?.players?.[`ID${id}`] ?? {}
  return { id, last: p.lastName ?? '', name: p.fullName ?? '' }
}

// One Savant read per pair and date for the session: a batter comes up again every few innings.
const headToHead = fetchOnce(fetchHeadToHead)

// `door={false}`: no Scout link; `vsHitter`: "vs Chourio", the batter named, for a line read from the pitcher's
// side (the batting view's pitcher block, Gary 2026-10-29).
export function ScoutLine({ feed, hitterId, pitcherId, door = true, vsHitter = false }) {
  const date = feed?.gameData?.datetime?.officialDate ?? null
  const { data } = useAsync(() => headToHead(hitterId, pitcherId, date), [hitterId, pitcherId, date])
  const linkProps = useRouteLink()
  const hitter = person(feed, hitterId)
  const pitcher = person(feed, pitcherId)
  const href = scoutPath({ pitcher, hitter, d: date || undefined })
  const t = data?.totals
  const line = !data ? null : !t?.pa ? '0-for-0' : [`${t.h}-for-${t.ab}`, t.hr && `${t.hr} HR`, t.bb && `${t.bb} BB`, t.k && `${t.k} K`].filter(Boolean).join(' · ')
  return (
    <span className="gdp__scout">
      {door && <a className="gdp__scoutdoor" {...linkProps(href)}>Scout ›</a>}
      <span className={`gdp__scoutvs${vsHitter ? ' gdp__scoutvs--hitter' : ''}`}>vs {vsHitter ? hitter.last : pitcher.last}</span>
      {/* `--len` lets a host size a long line down to its width (the stage's pitcher card). */}
      {line && <b className="gdp__scoutline" style={{ '--len': line.length }}>{line}</b>}
    </span>
  )
}
