import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { jumpScrollLeft, useScrollRail } from '../../../../hooks/scroll/useScrollRail.js'
import { fetchTeamPhotoBatch } from '../../../../api/gamePhotos.js'
import { useNav } from '../../../../lib/nav.js'
import { teamPhotosPath } from '../../../../lib/route.js'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'

const PHOTO_INITIAL_TARGET = 10
const PHOTO_GROW_STEP = 10
const PHOTO_BATCH_GAMES = 8
const PHOTO_MAX_BATCHES_PER_CALL = 6
// A `limit` (preview mode, see below) caps the walk to ONE batch — bounded,
// predictable cost for a caller that wants a taste rather than the whole rail.

// Team Page's Photos rail — professional camera stills only
// (`onlyPhotographer`, gamePhotos.js; drops both TV broadcast frame grabs and
// rendered graphic cards like Statcast darkroom cards or ABS challenge result
// cards) whose subject is this club (`photosForTeam`). Walks `games`
// backward from the newest game. Unlike the AllGames grid, the data isn't
// preloaded — each game's photos are a real fetch (fetchGamePhotos), so
// "scroll back" here grows the window by fetching more games on demand
// rather than slicing an array already in memory.
//
// Spoiler footing: gamePhotos.js is deliberately NOT reveal-only (a
// recap/celebration photo narrates the outcome just by looking at it, same
// risk as a highlight clip's title — see that module's header). Every other
// consumer gets away with that because it's scoped to decided games only —
// but this rail is a DELIBERATE exception, same posture as TeamPhotosPage
// (its own header has the full argument): its callers hand it `photoGames`
// (`allStartedGames`, scheduleGames.js), not `seasonGames`, on the current
// (undated) tab — so a photo here may come from a game still in progress,
// by explicit product override, not by omission. A dated view (`asOf` set)
// falls back to the decided-only list instead, so a `?d=` link still
// freezes the page at that date — see loadGames.js/loadOverview.js's own
// `photoGames` comments for why that split exists. Never hand this
// component the raw `schedule`, which still carries not-yet-started games.
//
// Deliberately does NOT read a precomputed cross-game index. One was scoped
// in .scratch/game-photos-by-subject/issues/01-cross-game-photo-index.md for
// a cheap "every team/player's photos from anywhere" lookup, but this page
// already has the one team's full decided-game list in memory, so a bounded
// live walk-back is enough; that index stays open for a future surface (a
// player page, say) that has no such list already loaded.
//
// `limit`, when passed (the Overview's preview copy), turns off scroll-
// triggered growth entirely and caps the walk to a single batch — the
// Overview loader deliberately does not pay for a full photo walk-back
// (see loadOverview.js), so its preview must cost at most one bounded round
// of game fetches, never the open-ended walk the Games tab's full rail does.
// The card always carries a "Full season" door to `/team/{id}/photos`
// (TeamPhotosPage.jsx) regardless of `limit` — that page is the one place a
// reader can see every professional photo the club's season has, so it's the
// rail's door everywhere it renders, not just in preview mode.
export function TeamPhotosRail({ teamId, games, limit = null }) {
  const navigate = useNav()
  const sentinelRef = useRef(null)
  const pendingGrowRef = useRef(null)
  const consumedRef = useRef(0)
  const photosRef = useRef([])
  const cacheRef = useRef(new Map())
  const inFlightRef = useRef(false)
  const activeRef = useRef(true)

  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [exhausted, setExhausted] = useState(false)

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
    async (targetCount, maxBatches = PHOTO_MAX_BATCHES_PER_CALL) => {
      if (inFlightRef.current || !activeRef.current) return
      inFlightRef.current = true
      setLoading(true)
      let rounds = 0
      while (
        activeRef.current &&
        consumedRef.current < games.length &&
        photosRef.current.length < targetCount &&
        rounds < maxBatches
      ) {
        rounds++
        const { photos: batchPhotos, consumed } = await fetchTeamPhotoBatch(
          games,
          teamId,
          consumedRef.current,
          PHOTO_BATCH_GAMES,
          cacheRef.current,
        )
        consumedRef.current += consumed
        if (!activeRef.current) break
        photosRef.current = [...batchPhotos, ...photosRef.current]
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
    growPhotos(limit ?? PHOTO_INITIAL_TARGET, limit != null ? 1 : undefined)
  }, [growPhotos, limit])

  // Opens pre-scrolled to the newest (rightmost) photo and keeps re-snapping
  // as batches land, until the user scrolls back — the sentinel handler below
  // flips userScrolledBackRef, handing off to the pendingGrowRef effect's
  // position-preserving compensation. (The initial load can span several
  // async batches, so there is no single moment to key a one-time jump off.)
  const { trackRef, userScrolledBackRef, canScroll, atStart, atEnd, scroll } = useScrollRail(
    photos.length,
  )

  // Restores the pre-growth scroll position after older photos are prepended
  // (see pendingGrowRef below) — without it, prepending content shoves the
  // user's current view further right instead of leaving it visually still.
  useLayoutEffect(() => {
    const el = trackRef.current
    const pending = pendingGrowRef.current
    if (!el || !pending) return
    jumpScrollLeft(el, pending.scrollLeft + (el.scrollWidth - pending.scrollWidth))
    pendingGrowRef.current = null
  }, [photos.length, trackRef])

  // Scrolling (or paging via the < button) into the sentinel at the front of
  // the track grows the window toward Opening Day. Preview mode (`limit`)
  // never mounts the sentinel at all (see the render below), so this never
  // fires there — the card's window is fixed to whatever the one bounded
  // batch found.
  useEffect(() => {
    const el = trackRef.current
    const sentinel = sentinelRef.current
    if (limit != null || !el || !sentinel || exhausted || loading) return
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
  }, [exhausted, loading, growPhotos, limit, trackRef, userScrolledBackRef])

  // Preview mode never grows past its one batch, so "nothing here" is settled
  // the moment that batch's fetch finishes rather than waiting on `exhausted`
  // (which would otherwise stay false for a club with more games left unwalked).
  if (photos.length === 0 && !loading && (exhausted || limit != null)) return null

  return (
    <Card
      head={
        <SectionHead look="band" club action={<Door onClick={() => navigate(teamPhotosPath(teamId))}>Full season</Door>}>
          Photos
        </SectionHead>
      }
    >
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
          {!exhausted && limit == null && (
            <div ref={sentinelRef} className="teamphotos__sentinel" aria-hidden="true" />
          )}
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
    </Card>
  )
}
