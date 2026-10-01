import { useState, useMemo } from 'react'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useScrollRail } from '../../../../hooks/scroll/useScrollRail.js'
import { fetchTeamHighlights, flattenPositiveClips } from '../../../../api/gamehighlights.js'
import { HighlightSheet } from '../../../../components/playbyplay/HighlightSheet.jsx'
import { HighlightClipCard } from '../../../../components/highlights/HighlightClipCard.jsx'
import { MONTH_LABELS } from '../TeamStatsCard.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'

// "Jul 9 @ STL" / "Jul 9 STL" (home game, no "@" — same isHome convention
// GameStubCard's own opponent caption uses in TeamGames.jsx). `game` is a
// `seasonGames` row looked up by the clip's own gamePk — undefined for a
// clip whose game somehow isn't in the currently-loaded schedule window
// (a doubleheader edge or a season boundary), in which case the caption is
// just the bare date.
function gameCaption(clip, game) {
  const d = new Date(`${clip.date}T00:00:00Z`)
  const dateLabel = `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}`
  if (!game?.opponent) return dateLabel
  const oppLabel = `${game.isHome ? '' : '@ '}${game.opponent.abbreviation}`
  return `${dateLabel} ${oppLabel}`
}

// Team hub Games tab — a rail of this club's own "positive" highlight clips
// (issue 01's per-team precompute, teamId-scoped at generation time), same
// shell/scroll shape as TeamPhotosRail but reading one static file instead of
// walking the schedule live: no pagination, no backward growth, just whatever
// the file holds.
//
// Not a spoiler surface: `fetchTeamHighlights` only ever reads decided-game
// clips (see that module's header) — this component never receives, and
// never needs, anything that could resolve to a game in progress.
//
// `games` (== seasonGames, same list TeamPhotosRail is handed) is used ONLY
// to label each clip's card with its date/opponent — never to fetch or
// filter anything, so this stays a single static-file read with no live
// per-game walk. A clip whose gamePk isn't in the window just shows its
// bare date (see gameCaption).
//
// `limit`, when passed (the Overview's preview copy), keeps only the most
// recent N clips — a display cap, not a fetch change: `fetchTeamHighlights`
// always reads the same one small static file regardless, so a preview here
// costs nothing extra the way TeamPhotosRail's preview mode has to guard for.
export function TeamHighlightsRail({ teamId, games, limit = null }) {
  const { data, loading } = useAsync(() => fetchTeamHighlights(teamId), [teamId])
  const clips = useMemo(() => {
    const all = flattenPositiveClips(data)
    return limit != null ? all.slice(-limit) : all
  }, [data, limit])
  const gamesByPk = useMemo(() => new Map(games.map((g) => [g.gamePk, g])), [games])

  const [open, setOpen] = useState(null)

  // Re-snaps to the newest (rightmost) clip on mount and again once the
  // (async) file load lands, until the user scrolls.
  const { trackRef, canScroll, atStart, atEnd, scroll } = useScrollRail(clips.length, {
    flagUserScroll: true,
  })

  if (!loading && clips.length === 0) return null

  return (
    <Card
      head={
        <SectionHead look="band" club>
          Highlights
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
              caption={gameCaption(clip, gamesByPk.get(clip.gamePk))}
              onOpen={() => setOpen(clip)}
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
      {open && <HighlightSheet item={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
