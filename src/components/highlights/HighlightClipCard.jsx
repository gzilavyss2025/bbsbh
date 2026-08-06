// One video-highlight clip as a tappable card — a printed still pasted into
// the scorebook (see 52-highlight-clip-card.css for the full treatment).
//
// PURELY PRESENTATIONAL, and deliberately caller-agnostic: no fetching, no
// schedule/game-shape knowledge, no spoiler logic (every caller only ever
// hands it decided-game clips — see TeamHighlightsRail's header). `clip`
// only needs `poster` (image URL) and `title`; `caption` arrives as a
// prebuilt string ("Jul 9 @ STL") because the game lookup that produces it
// is the CALLER's business — that's what lets the planned
// PlayerHighlightsRail (.scratch/highlights-cascade/issues/04) render this
// exact card from a differently-sourced clip list.
export function HighlightClipCard({ clip, caption, onOpen }) {
  const title = clip.title || 'Highlight'
  return (
    <button
      type="button"
      className="hlclip"
      onClick={onOpen}
      aria-label={`Watch highlight: ${title}${caption ? `, ${caption}` : ''}`}
    >
      <span className="hlclip__frame">
        <img className="hlclip__poster" src={clip.poster} alt="" loading="lazy" />
        {/* The triangle glyph is the tab's CSS ::before */}
        <span className="hlclip__play" aria-hidden="true">
          Watch
        </span>
      </span>
      <span className="hlclip__caption">
        <span className="hlclip__title">{title}</span>
        {caption && <span className="hlclip__meta">{caption}</span>}
      </span>
    </button>
  )
}
