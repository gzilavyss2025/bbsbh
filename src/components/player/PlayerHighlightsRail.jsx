import { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react'
import { fetchTeamHighlights, flattenPositiveClips } from '../../api/gamehighlights.js'
import { useAsync } from '../../hooks/useAsync.js'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'
import { HighlightClipCard } from '../highlights/HighlightClipCard.jsx'
import { ChevronLink } from '../ui/ChevronLink.jsx'

// A setup jump, not a user-visible scroll gesture — see TeamPhotosRail's own
// copy of this helper for why `scroll-behavior: smooth` has to be bypassed.
function jumpScrollLeft(el, value) {
  const prev = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = value
  el.style.scrollBehavior = prev
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "Jul 9" — bare date only, no opponent (unlike TeamHighlightsRail's
// gameCaption, which resolves one from its already-loaded seasonGames). This
// rail has no such list in hand — fetching one just for a caption would be
// exactly the extra per-page-view cost the PRD's precompute was built to
// avoid — so the caption identifies the game by date alone, same degraded
// form gameCaption itself falls back to when it can't resolve an opponent.
function clipCaption(clip) {
  const d = new Date(`${clip.date}T00:00:00Z`)
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

// The player page's Highlights rail — video clips crediting this player,
// filtered from the SAME precomputed per-team file TeamHighlightsRail reads
// (src/api/gamehighlights.js, the highlights-cascade's issue 01/03), kept
// client-side to `clip.playerId === playerId`. `teamId` must be his CURRENT
// team — a trade means clips filed under an old club's file before the trade
// won't surface here. Accepted trade-off, per the PRD's "Precompute shape";
// not solved here, and not worth fetching multiple team files to work around.
//
// Full-season, not a recent-games window: the PRD's full-season sweep found
// real 12+ day gaps with zero credited clips for a regular player, so this is
// one static-file read (no pagination/backward-walk, unlike PlayerPhotosRail's
// live per-game walk) rendered as a single scrollable list. Newest clip
// anchored to the right edge on mount/data-load (PRD's "Rail ordering" —
// scrolling left moves backward through the season, the opposite of every
// other rail in this app).
//
// Renders the shared HighlightClipCard (src/components/highlights/) —
// TeamHighlightsRail's exact same card, per that component's own header: it
// was built caller-agnostic specifically so this rail could reuse it
// verbatim rather than growing a second thumbnail treatment. The rail shell
// itself still reuses .teamphotos/.teamphotos__* (the track/nav mechanics),
// same convention PlayerPhotosRail already established.
//
// Empty renders nothing (no section, no spinner-that-never-resolves) — a
// bench player's genuinely sparse rail is expected per the PRD's
// "Drawbacks", not a bug.
export function PlayerHighlightsRail({ playerId, teamId, limit }) {
  const trackRef = useRef(null)
  const userScrolledBackRef = useRef(false)

  const [canScroll, setCanScroll] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)
  const [openClip, setOpenClip] = useState(null)
  const [expanded, setExpanded] = useState(!limit)

  const { data, loading } = useAsync(() => fetchTeamHighlights(teamId), [teamId])
  const allClips = useMemo(
    () => flattenPositiveClips(data).filter((c) => c.playerId === playerId),
    [data, playerId],
  )
  // Newest clip is anchored to the right edge (see the header above), so a
  // capped preview keeps the newest `limit` — the tail of the array.
  const clips = !expanded && limit ? allClips.slice(-limit) : allClips

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
  }, [clips.length])

  // Re-snaps to the newest (rightmost) clip on mount and again once the
  // (async) file load lands — guarded so a later layout change (e.g. a
  // window resize flipping `canScroll`) can't yank the view back to the end
  // after the user has actually scrolled. No pagination/sentinel here
  // (unlike PlayerPhotosRail) — the full season's clips for one player are a
  // bounded, small list fetched once.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || userScrolledBackRef.current || clips.length === 0) return
    jumpScrollLeft(el, el.scrollWidth)
  }, [clips.length, canScroll])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const flagUserScroll = () => {
      userScrolledBackRef.current = true
    }
    el.addEventListener('pointerdown', flagUserScroll)
    el.addEventListener('wheel', flagUserScroll, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', flagUserScroll)
      el.removeEventListener('wheel', flagUserScroll)
    }
  }, [])

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
  }, [clips.length, canScroll])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  if (!loading && allClips.length === 0) return null

  return (
    <section>
      <h3 className="section__title section__title--bar">
        <span>Highlights</span>
      </h3>
      <div className="teamphotos">
        {canScroll && (
          <button
            type="button"
            className="teamphotos__nav"
            onClick={() => scroll(-1)}
            disabled={atStart}
            aria-label="Scroll to older highlights"
          >
            &lsaquo;
          </button>
        )}
        <div className="teamphotos__track" ref={trackRef}>
          {clips.length === 0 && loading && (
            <div className="hlclip__loading" aria-hidden="true">
              Loading&hellip;
            </div>
          )}
          {clips.map((clip) => (
            <HighlightClipCard
              key={clip.clipId}
              clip={clip}
              caption={clipCaption(clip)}
              onOpen={() => setOpenClip(clip)}
            />
          ))}
        </div>
        {canScroll && (
          <button
            type="button"
            className="teamphotos__nav"
            onClick={() => scroll(1)}
            disabled={atEnd}
            aria-label="Scroll to more recent highlights"
          >
            &rsaquo;
          </button>
        )}
      </div>
      {!expanded && allClips.length > limit && (
        <div className="thub-door">
          <ChevronLink onClick={() => setExpanded(true)}>See all</ChevronLink>
        </div>
      )}
      {openClip && <HighlightSheet item={openClip} onClose={() => setOpenClip(null)} />}
    </section>
  )
}
