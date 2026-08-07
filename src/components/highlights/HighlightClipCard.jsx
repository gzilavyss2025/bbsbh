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
//
// Two sizes, one card. The default is the rail slip (fixed 232px, title and
// caption on the lower margin). `feature` is the same print blown up to fill
// whatever column it's handed, with NO lower margin at all — the box score's
// condensed-game panel, where the kraft tab already says what the video is
// ("CONDENSED GAME (12:20)") and a title line under it would just repeat the
// tab in different words. `label` is that tab's text; everything else about
// the card — the mat, the tape, the hover lift — is identical, on purpose.
export function HighlightClipCard({ clip, caption, label = 'Watch', variant, onOpen }) {
  const title = clip.title || 'Highlight'
  const feature = variant === 'feature'
  // "Watch highlight: …" on a rail slip, which is what the spoiler-DOM
  // invariant sweeps for (e2e/invariants/spoiler-dom.spec.js); the feature
  // print isn't a highlight and says so — its title IS its subject
  // ("Condensed Game: NYM@CLE - 8/4/26").
  const ariaLabel = feature
    ? `Watch ${title}`
    : `Watch highlight: ${title}${caption ? `, ${caption}` : ''}`
  return (
    <button
      type="button"
      className={`hlclip${feature ? ' hlclip--feature' : ''}`}
      onClick={onOpen}
      aria-label={ariaLabel}
    >
      <span className="hlclip__frame">
        <img className="hlclip__poster" src={clip.poster} alt="" loading="lazy" />
        {/* The triangle glyph is the tab's CSS ::before */}
        <span className="hlclip__play" aria-hidden="true">
          {label}
        </span>
      </span>
      {!feature && (
        <span className="hlclip__caption">
          <span className="hlclip__title">{title}</span>
          {caption && <span className="hlclip__meta">{caption}</span>}
        </span>
      )}
    </button>
  )
}
