import { useState } from 'react'

// The slate's stand-in for the Home Run Derby's own empty-game night: there's
// no statsapi data for the Derby to render (see fetchAllStarInfo's header
// note), so instead of a bare "No games scheduled." this hands off straight
// to MLB's own Derby page — same external-link convention as WatchButton
// (GameView.jsx), a new tab rather than anything rendered in-app.
//
// The card leads with the 2026 (T-Mobile) Home Run Derby wordmark, bundled
// same-origin (public/logos/) so it's stable and works offline in the PWA
// rather than riding MLB's rotating build-hashed CDN path. If it ever fails to
// load, the eyebrow/title text stands in on its own (same defensive fallback
// spirit as TeamLogo).
export function DerbyCard() {
  const [logoOk, setLogoOk] = useState(true)
  return (
    <a
      className="gamecard derbycard"
      href="https://www.mlb.com/all-star/home-run-derby"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="derbycard__eyebrow">All-Star Break</span>
      {logoOk && (
        <img
          className="derbycard__logo"
          src="/logos/home-run-derby-2026.svg"
          alt="2026 Home Run Derby"
          onError={() => setLogoOk(false)}
        />
      )}
      <span className="derbycard__title">
        {logoOk ? 'Tonight' : 'Home Run Derby tonight'}
        <span className="derbycard__ext" aria-hidden="true">↗</span>
      </span>
      <span className="derbycard__sub">Bracket and results on MLB.com</span>
    </a>
  )
}
