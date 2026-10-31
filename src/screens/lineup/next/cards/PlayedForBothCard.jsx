import { useState } from 'react'
import { fetchPositionTags } from '../../../../api/person-fetch.js'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { realHeadshotUrl } from '../../../../lib/teams.js'
import { FoldCard } from './FoldCard.jsx'
import { PlayedForBothSheet } from '../sheets/PlayedForBothSheet.jsx'

// Played for both (#2579): everyone with an MLB game for each of tonight's clubs, retired players
// included, from the hand-run shard (api/history/playedForBoth.js). Career history by club and
// season, never a game value, so it is open on this scoring surface. Folded like Former teammates.
// `pfb` is null or empty for a pair with no shard (MiLB, a miss), and then the card does not mount.
export function PlayedForBothCard({ pfb, away, home }) {
  const [sheet, setSheet] = useState(false)
  if (!pfb?.rows?.length) return null
  const n = pfb.rows.length
  return (
    <>
      <FoldCard title="Played for both" count={`${n} ${n === 1 ? 'player' : 'players'}`} className="lpfb">
        <Body pfb={pfb} away={away} home={home} onAll={() => setSheet(true)} />
      </FoldCard>
      {sheet && <PlayedForBothSheet pfb={pfb} away={away} home={home} onClose={() => setSheet(false)} />}
    </>
  )
}

// Whether a player's silo photo exists. The CDN answers 404 for a missing one.
const probe = (id) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve(true)
  img.onerror = () => resolve(false)
  img.src = realHeadshotUrl(id)
})

// Mounts only when the card opens, so the photo checks and the position call wait for that tap.
// A skeleton holds the shape until both settle, so nothing jumps (Gary, 2026-10-27).
function Body({ pfb, away, home, onAll }) {
  const ids = pfb.top.map((p) => p.id)
  const key = ids.join(',')
  const { data } = useAsync(async () => {
    const [tags, photos] = await Promise.all([fetchPositionTags(ids), Promise.all(ids.map(probe))])
    return { tags, hasPhoto: new Set(ids.filter((_, i) => photos[i])) }
  }, [key])
  return (
    <div className="lpfb__body">
      <p className="lpfb__caption">
        Played in the majors for the {away.teamName} and the {home.teamName}.
        {pfb.throughSeason && ` Through ${pfb.throughSeason}.`}
      </p>
      {!data ? (
        <ul className="lpfb__grid" aria-busy="true" aria-label="Loading players">
          {ids.map((id) => <li key={id} className="lpfb__tile lpfb__tile--skel" />)}
        </ul>
      ) : (
        <Settled top={pfb.top} tags={data.tags} hasPhoto={data.hasPhoto} />
      )}
      <Door className="lpfb__door" onClick={onAll}>All {pfb.rows.length} players</Door>
    </div>
  )
}

function Settled({ top, tags, hasPhoto }) {
  const faces = top.filter((p) => hasPhoto.has(p.id))
  const names = top.filter((p) => !hasPhoto.has(p.id))
  return (
    <>
      {faces.length > 0 && (
        <ul className="lpfb__grid">
          {faces.map((p) => {
            const [first, ...rest] = p.name.split(' ')
            return (
              <li key={p.id}>
                <PlayerLink id={p.id} name={p.name} className="lpfb__tile">
                  <Headshot personId={p.id} name={p.name} isMlb className="lpfb__shot" />
                  <span className="lpfb__first">{first}</span>
                  <span className="lpfb__last">{rest.join(' ')}</span>
                  {tags[p.id] && <span className="lpfb__pos">{tags[p.id]}</span>}
                </PlayerLink>
              </li>
            )
          })}
        </ul>
      )}
      {names.length > 0 && (
        <p className="lpfb__names">
          {names.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ' · '}
              <PlayerLink id={p.id} name={p.name}>{p.name}</PlayerLink>
              {tags[p.id] && <span className="lpfb__pos">{tags[p.id]}</span>}
            </span>
          ))}
        </p>
      )}
    </>
  )
}
