import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { fetchGamePhotos, photosForPlayer, onlyPhotographer } from '../../api/gamePhotos.js'

// A setup jump, not a user-visible scroll gesture — see TeamPhotosRail's own
// copy of this helper for why `scroll-behavior: smooth` has to be bypassed.
function jumpScrollLeft(el, value) {
  const prev = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = value
  el.style.scrollBehavior = prev
}

const PHOTO_INITIAL_TARGET = 10
const PHOTO_GROW_STEP = 10
const PHOTO_BATCH_GAMES = 8
const PHOTO_MAX_BATCHES_PER_CALL = 6

// The player page's Photos section — professional camera stills only
// (`onlyPhotographer`, gamePhotos.js) whose subject is this player
// (`photosForPlayer` — its first caller; previously unused groundwork from
// PR #487, see .scratch/game-photos-by-subject/). Same live walk-back as
// TeamPhotosRail (src/screens/team/modules/media/TeamPhotosRail.jsx) — the
// cross-game photo INDEX scoped for a "no games list already loaded"
// surface in that doc's issue 01 isn't needed here, because `games` is
// cheap for the caller to fetch directly (one player's own season gameLog,
// not a scan across every team he's played for).
//
// `games` must already be this-season, decided-game-only, oldest -> newest
// — PlayerPage.jsx is responsible for excluding today's game before handing
// it down (gamePhotos.js is deliberately not reveal-only; a still can
// narrate an outcome just by being visible, same risk as a highlight clip's
// title — see that module's header). Renders nothing once exhausted with no
// photos found, so the section conditionally disappears rather than
// showing an empty state.
export function PlayerPhotosRail({ personId, games }) {
  const trackRef = useRef(null)
  const sentinelRef = useRef(null)
  const userScrolledBackRef = useRef(false)
  const pendingGrowRef = useRef(null)
  const consumedRef = useRef(0)
  const photosRef = useRef([])
  const cacheRef = useRef(new Map())
  const inFlightRef = useRef(false)
  const activeRef = useRef(true)

  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const growPhotos = useCallback(
    async (targetCount) => {
      if (inFlightRef.current || !activeRef.current) return
      inFlightRef.current = true
      setLoading(true)
      let rounds = 0
      while (
        activeRef.current &&
        consumedRef.current < games.length &&
        photosRef.current.length < targetCount &&
        rounds < PHOTO_MAX_BATCHES_PER_CALL
      ) {
        rounds++
        const end = games.length - consumedRef.current
        const start = Math.max(0, end - PHOTO_BATCH_GAMES)
        const batch = games.slice(start, end)
        consumedRef.current += batch.length
        const results = await Promise.all(
          batch.map(async (game) => {
            if (cacheRef.current.has(game.gamePk)) return cacheRef.current.get(game.gamePk)
            const raw = await fetchGamePhotos(game.gamePk)
            const filtered = onlyPhotographer(photosForPlayer(raw, personId)).map((photo) => ({
              ...photo,
              gamePk: game.gamePk,
              apiDate: game.apiDate,
            }))
            cacheRef.current.set(game.gamePk, filtered)
            return filtered
          }),
        )
        if (!activeRef.current) break
        photosRef.current = [...results.flat(), ...photosRef.current]
        setPhotos(photosRef.current)
      }
      if (activeRef.current) {
        if (consumedRef.current >= games.length) setExhausted(true)
        setLoading(false)
      }
      inFlightRef.current = false
    },
    [games, personId],
  )

  useEffect(() => {
    growPhotos(PHOTO_INITIAL_TARGET)
  }, [growPhotos])

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [photos.length])

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || userScrolledBackRef.current || photos.length === 0) return
    jumpScrollLeft(el, el.scrollWidth)
  }, [photos.length, canScroll])

  useLayoutEffect(() => {
    const el = trackRef.current
    const pending = pendingGrowRef.current
    if (!el || !pending) return
    jumpScrollLeft(el, pending.scrollLeft + (el.scrollWidth - pending.scrollWidth))
    pendingGrowRef.current = null
  }, [photos.length])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => {
      setAtStart(el.scrollLeft <= 1)
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
    }
    update()
    el.addEventListener('scroll', update)
    return () => el.removeEventListener('scroll', update)
  }, [photos.length, canScroll])

  useEffect(() => {
    const el = trackRef.current
    const sentinel = sentinelRef.current
    if (!el || !sentinel || exhausted || loading) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        userScrolledBackRef.current = true
        pendingGrowRef.current = { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth }
        growPhotos(photosRef.current.length + PHOTO_GROW_STEP)
      },
      { root: el, threshold: 0 },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [exhausted, loading, growPhotos])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  if (exhausted && photos.length === 0 && !loading) return null

  return (
    <section>
      <h3 className="section__title section__title--bar">
        <span>Photos</span>
      </h3>
      <div className="teamphotos">
        {canScroll && (
          <button
            type="button"
            className="teamphotos__nav"
            onClick={() => scroll(-1)}
            disabled={atStart}
            aria-label="Scroll to older photos"
          >
            &lsaquo;
          </button>
        )}
        <div className="teamphotos__track" ref={trackRef}>
          {!exhausted && <div ref={sentinelRef} className="teamphotos__sentinel" aria-hidden="true" />}
          {photos.length === 0 && loading && (
            <div className="teamphotos__loading" aria-hidden="true">
              Loading&hellip;
            </div>
          )}
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.original}
              target="_blank"
              rel="noreferrer"
              className="teamphotos__thumb"
              aria-label="Open full-resolution photo in a new tab"
            >
              <img src={photo.thumb} alt="" loading="lazy" />
            </a>
          ))}
        </div>
        {canScroll && (
          <button
            type="button"
            className="teamphotos__nav"
            onClick={() => scroll(1)}
            disabled={atEnd}
            aria-label="Scroll to more recent photos"
          >
            &rsaquo;
          </button>
        )}
      </div>
    </section>
  )
}
