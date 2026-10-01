import { useState, useMemo } from 'react'
import { fetchTeamHighlights, flattenPositiveClips } from '../../api/gamehighlights.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useScrollRail } from '../../hooks/scroll/useScrollRail.js'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'
import { HighlightClipCard } from '../highlights/HighlightClipCard.jsx'
import { Door } from '../ui/control/Door.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'

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

  // Re-snaps to the newest (rightmost) clip on mount and again once the
  // (async) file load lands, until the user scrolls. No pagination/sentinel
  // here (unlike PlayerPhotosRail) — the full season's clips for one player
  // are a bounded, small list fetched once.
  const { trackRef, canScroll, atStart, atEnd, scroll } = useScrollRail(clips.length, {
    flagUserScroll: true,
  })

  if (!loading && allClips.length === 0) return null

  return (
    <section>
      <SectionHead look="band" club bleed>
        Highlights
      </SectionHead>
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
        <div className="thub__door">
          <Door onClick={() => setExpanded(true)}>See all</Door>
        </div>
      )}
      {openClip && <HighlightSheet item={openClip} onClose={() => setOpenClip(null)} />}
    </section>
  )
}
