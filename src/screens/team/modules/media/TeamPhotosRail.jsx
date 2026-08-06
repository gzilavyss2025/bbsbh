import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { fetchGamePhotos, photosForTeam, onlyPhotographer } from '../../../../api/gamePhotos.js'

// A setup jump, not a user-visible scroll gesture — bypasses the track's own
// `scroll-behavior: smooth` (index.css) so it lands instantly. Without this,
// the animated glide from position 0 briefly leaves the leading-edge sentinel
// on screen mid-flight, which the IntersectionObserver below reads as "scrolled
// back" and grows the window before the user has touched anything.
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

// Team Page's Photos rail — professional camera stills only
// (`onlyPhotographer`, gamePhotos.js; drops both TV broadcast frame grabs and
// rendered graphic cards like Statcast darkroom cards or ABS challenge result
// cards) whose subject is this club (`photosForTeam`). Walks `games` (==
// seasonGames, the same oldest -> newest, cutoff-filtered list the tab's
// AllGames grid renders off) backward from the newest game. Unlike that
// grid, the data isn't preloaded — each game's photos are a real fetch
// (fetchGamePhotos), so "scroll back" here grows the window by fetching more
// games on demand rather than slicing an array already in memory.
//
// Spoiler footing: gamePhotos.js is deliberately NOT reveal-only (a
// recap/celebration photo narrates the outcome just by looking at it, same
// risk as a highlight clip's title — see that module's header) and today's
// other two consumers get away with that because /photos is a standalone
// unsealed tool and GamePhotosStrip only ever renders inside the box score's
// SealBox. This rail leans on the same precedent the AllGames grid already
// uses instead of either of those: `games` is `seasonGames`
// (allDecidedGames(schedule)), which fetchTeamSchedule has already cut off at
// the page's `asOf` (`won` is only ever non-null for a game at/before that
// cutoff) — so a photo here can never come from a game the rest of this page
// hasn't already revealed the result of. Never hand this component the raw
// `schedule`, which still carries not-yet-decided/future games.
//
// Deliberately does NOT read a precomputed cross-game index. One was scoped
// in .scratch/game-photos-by-subject/issues/01-cross-game-photo-index.md for
// a cheap "every team/player's photos from anywhere" lookup, but this page
// already has the one team's full decided-game list in memory, so a bounded
// live walk-back is enough; that index stays open for a future surface (a
// player page, say) that has no such list already loaded.
export function TeamPhotosRail({ teamId, games }) {
  const trackRef = useRef(null)
  const sentinelRef = useRef(null)
  // Flips true the first time the user actually scrolls back (the sentinel
  // fires) — see the two effects below. Named for what stops the auto-snap,
  // not for "has the initial load finished," since the initial load can span
  // several async batches with no single moment to key off of.
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

  // Walks `games` backward from consumedRef's cursor in small batches,
  // fetching + filtering each batch's photos concurrently, until either
  // `targetCount` is met or every game has been scanned (Opening Day). Caps
  // the number of batches a single call will chase so one interaction can't
  // stall the UI scanning a whole quiet season — if the target still isn't
  // met when the cap is hit, the sentinel (still in view, since nothing new
  // rendered to push it off) simply re-fires the next call.
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
            const filtered = onlyPhotographer(photosForTeam(raw, teamId)).map((photo) => ({
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
    [games, teamId],
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

  // Opens pre-scrolled to the newest (rightmost) photo — mirrors
  // LastTenGamesStrip's own mount-only jump, but `photos` starts empty (the
  // first fetch hasn't landed yet), the initial load can span several async
  // batches (growPhotos keeps walking backward until it hits
  // PHOTO_INITIAL_TARGET), and `canScroll` flipping true (once there's
  // enough content to overflow) shrinks the track to make room for the nav
  // arrows, moving the true right edge. So rather than jump once on a single
  // signal, this keeps re-snapping to the current end on every relevant
  // change (new photos, canScroll settling) until the user actually scrolls
  // back — at which point the sentinel handler below flips
  // userScrolledBackRef and this stops for good, handing off to the
  // pendingGrowRef effect's position-preserving compensation instead.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || userScrolledBackRef.current || photos.length === 0) return
    jumpScrollLeft(el, el.scrollWidth)
  }, [photos.length, canScroll])

  // Restores the pre-growth scroll position after older photos are prepended
  // (see pendingGrowRef below) — without it, prepending content shoves the
  // user's current view further right instead of leaving it visually still.
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

  // Scrolling (or paging via the < button) into the sentinel at the front of
  // the track grows the window toward Opening Day.
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
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Photos</span>
      </div>
      <div className="thub-card__body">
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
                aria-label={
                  photo.focus?.playerName
                    ? `Open full-resolution photo of ${photo.focus.playerName} in a new tab`
                    : 'Open full-resolution photo in a new tab'
                }
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
      </div>
    </div>
  )
}
