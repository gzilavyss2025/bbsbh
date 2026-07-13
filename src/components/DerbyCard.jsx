// The slate's stand-in for the Home Run Derby's own empty-game night: there's
// no statsapi data for the Derby to render (see fetchAllStarInfo's header
// note), so instead of a bare "No games scheduled." this hands off straight
// to MLB's own Derby page — same external-link convention as WatchButton
// (GameView.jsx), a new tab rather than anything rendered in-app.
export function DerbyCard() {
  return (
    <a
      className="gamecard derbycard"
      href="https://www.mlb.com/all-star/home-run-derby"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="derbycard__eyebrow">All-Star Break</span>
      <span className="derbycard__title">
        Home Run Derby tonight
        <span className="derbycard__ext" aria-hidden="true">↗</span>
      </span>
      <span className="derbycard__sub">Bracket and results on MLB.com</span>
    </a>
  )
}
