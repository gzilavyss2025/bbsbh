import { useEffect, useRef, useState } from 'react'
import '../../../../../styles/player-next/history/photos.css'
import { fetchFinalScores } from '../../../../../api/boxlines/fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../../../api/boxlines/rows.js'
import { fetchGamePhotos, onlyPhotographer, photosForPlayer } from '../../../../../api/gamePhotos.js'
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { inMajors } from '../tbd/tbdData.js'
import { mergePhotos, newestFirst, photoCell, photoGames } from './photosView.js'

const FIRST = 6
const MORE = 10
const BATCH = 8

// His season with its postseason, newest game first, BATCH games a step: each step yields the camera stills of him from
// the games in it that are over (photosView.js has the guard).
async function* photoWalk(id, role, season) {
  const splits = newestFirst(await fetchPersonStats(id, { type: 'gameLog', group: role, season, gameType: MLB_LOG_GAME_TYPES, sportId: 1 }))
  for (let i = 0; i < splits.length; i += BATCH) {
    const batch = splits.slice(i, i + BATCH)
    const games = photoGames(batch, await fetchFinalScores(batch, role))
    const per = await Promise.all(
      games.map(async (g) => onlyPhotographer(photosForPlayer(await fetchGamePhotos(g.gamePk), id)).map((p) => ({ ...p, apiDate: g.apiDate }))),
    )
    yield per.flat()
  }
}

// Pulls steps until the walk has `want` photos or runs out. One pump at a time; a later `want` is read on the next step.
async function pump(w, set) {
  if (w.running) return
  w.running = true
  try {
    while (w.live && !w.done && w.photos.length < w.want) {
      const r = await w.it.next()
      if (r.done) w.done = true
      else w.photos = mergePhotos(w.photos, r.value)
      if (w.live) set({ photos: w.photos, done: w.done })
    }
  } catch {
    w.done = true
    if (w.live) set({ photos: w.photos, done: true })
  }
  w.running = false
}

// Photos (#2021): six camera stills of him from his latest finished games, three across; See all grows it in place.
// Open surface (ADR-0034), but a game still being played never contributes a photo (photosView.js).
// The page remounts per player, so one walk lives for the mount.
export default function PhotosModule({ bio, role, asOf, season, onEmpty }) {
  const show = !asOf && !!bio.debut && inMajors(bio)
  const [st, setSt] = useState({ photos: [], done: !show })
  const [shown, setShown] = useState(FIRST)
  const walk = useRef(null)
  useEffect(() => {
    if (!show) return
    const w = { it: photoWalk(bio.id, role, season), photos: [], done: false, want: FIRST, live: true }
    walk.current = w
    pump(w, setSt)
    return () => {
      w.live = false
    }
  }, [show, bio.id, role, season])
  const empty = st.done && !st.photos.length
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  if (empty) return null

  const cells = st.photos.slice(0, shown).map(photoCell)
  const holes = st.done ? 0 : shown - cells.length
  const more = () => {
    const n = shown + MORE
    setShown(n)
    walk.current.want = n
    pump(walk.current, setSt)
  }
  return (
    <div className="photos">
      <div className="photos__grid" aria-busy={!st.done && cells.length < shown}>
        {cells.map((c) => (
          <a key={c.id} className="photos__cell" href={c.href} target="_blank" rel="noreferrer">
            <span className="photos__frame">
              <img src={c.thumb} alt={c.caption} loading="lazy" />
            </span>
            <span className="photos__date mono">{c.date}</span>
            {c.caption && <span className="photos__caption">{c.caption}</span>}
          </a>
        ))}
        {Array.from({ length: holes }, (_, i) => (
          <span key={`hole${i}`} className="photos__cell" aria-hidden="true">
            <span className="photos__frame" />
          </span>
        ))}
      </div>
      {(!st.done || st.photos.length > shown) && cells.length >= shown && (
        <Door layout="block" onClick={more}>
          See all
        </Door>
      )}
    </div>
  )
}
