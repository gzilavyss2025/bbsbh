import { GUIDES_GROUP } from '../../lib/reportPages.js'

// A link to one of the /learn guides, placed on the surface that guide is
// about — the box score's guide on the box score, the symbols reference on
// the scorecard.
//
// This exists because the guides had no way in. Eleven pages written to teach
// somebody to keep score, server-rendered for crawlers (ADR-0053), in the
// sitemap, and linked from nowhere inside the app. Putting them in the
// hamburger menu helps a reader who thinks to open the hamburger menu. Putting
// one HERE reaches the reader who is looking at a box score wondering what
// LOB means, which is the whole audience the guides were written for.
//
// Two deliberate mechanics:
//
// - **A plain anchor, no router.** A guide is a server-rendered document
//   outside the React app. Pushing one through the client router would paint
//   the SPA over a document the server already sent. This is an ordinary
//   navigation and must stay one.
// - **The label comes from the registry**, not the call site, so a guide's
//   name is written once (lib/reportPages.js) however many surfaces point at
//   it. Passing a path that isn't in the registry renders nothing rather than
//   shipping a dead link.
//
// Never put one of these inside a SealBox reveal function. It carries no game
// data at all, so it belongs where an unrevealed reader can still reach it —
// that reader is the one who needs it most.
export function GuideLink({ path, eyebrow = 'New to this?', className = '' }) {
  const guide = GUIDES_GROUP.pages.find((page) => page.path === path)
  if (!guide) {
    if (import.meta.env?.DEV) {
      console.warn(`GuideLink: "${path}" is not in GUIDES_GROUP (src/lib/reportPages.js)`)
    }
    return null
  }

  return (
    <a className={`guidelink ${className}`} href={guide.path}>
      <span className="guidelink__eyebrow">{eyebrow}</span>
      <span className="guidelink__label">{guide.label}</span>
    </a>
  )
}
