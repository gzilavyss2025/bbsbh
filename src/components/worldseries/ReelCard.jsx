import { formatClipDuration, highlightPoster } from '../../api/highlights.js'
import { CornerBadge } from '../ui/frame/CornerBadge.jsx'

// One card on the reel: a clip (16:9, play badge, runtime) or a photographer's
// still (3:2, "Photo" corner badge). Both carry the game tag top-right and a
// title of two lines. Past games only: the reel never gets today's game
// (lib/postseason/worldseries/reel.js). A clip opens the existing player; a
// photo opens its full-resolution file in a new tab, as the team and box-score
// photo rails do (no viewer exists).
export function ReelCard({ card, onOpenClip }) {
  const tag = card.tag ? <span className="ww-reel__tag">{card.tag}</span> : null
  if (card.kind === 'photo') {
    const { photo } = card
    return (
      <a
        className="ww-reel__card ww-reel__card--photo"
        href={photo.original}
        target="_blank"
        rel="noreferrer"
        aria-label={`${card.tag}, Photo: ${card.title}`}
      >
        <CornerBadge host={<img className="ww-reel__thumb" src={photo.thumb} alt="" loading="lazy" />}>Photo</CornerBadge>
        {tag}
        <span className="ww-reel__title">{card.title}</span>
      </a>
    )
  }
  const duration = formatClipDuration(card.item?.duration)
  return (
    <button
      type="button"
      className="ww-reel__card ww-reel__card--clip"
      onClick={() => onOpenClip(card.item)}
      aria-label={`${card.tag}, clip${duration ? `, ${duration}` : ''}: ${card.title}`}
    >
      <span className="ww-reel__frame">
        <img className="ww-reel__thumb" src={highlightPoster(card.item)} alt="" loading="lazy" />
        <span className="ww-reel__play" aria-hidden="true">
          ▶ {duration}
        </span>
      </span>
      {tag}
      <span className="ww-reel__title">{card.title}</span>
    </button>
  )
}
