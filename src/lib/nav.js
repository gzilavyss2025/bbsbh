import { createContext, useContext } from 'react'

// Contexts + hooks for the deep name/team links (providers live in nav.jsx —
// split out so each file exports one kind of thing and Fast Refresh stays happy).
//
// NavContext carries the App's History-API `go`, so a PlayerLink/TeamLink
// anywhere in the tree can navigate without a threaded prop. ScopeContext
// carries what a link should stamp onto its target: `sportId` (a level hint for
// the fetch layer) and `asOf` (the `?d=` as-of cutoff).
//
// `asOf` here is now only ever PROPAGATION — a page that was itself opened at a
// dated URL keeps its links dated, so one visit gives one answer. It is no
// longer INJECTION: `GameView` used to supply the current game's officialDate,
// stamping a cutoff on every link out of a game, and stopped on 2026-08-06
// (ADR-0034, "The cutoff is opt-in now"). Stats surfaces open live. Empty off a
// game, and empty on a game too.
export const NavContext = createContext(() => {})
export const ScopeContext = createContext({})

export function useNav() {
  return useContext(NavContext)
}

export function useLinkScope() {
  return useContext(ScopeContext)
}

// A real anchor beats a button for navigation. `<button onClick={navigate}>`
// silently swallows middle-click, cmd/ctrl-click, "open link in new tab", and
// the browser's own status-bar destination preview — every one of which a
// reader expects from something that looks like a link. This returns the props
// to spread onto an `<a>`, so those gestures reach the browser while a plain
// left-click still becomes a client-side push with no page load.
//
// A `/learn` path is deliberately NOT intercepted: the guides are
// server-rendered documents outside the React app (ADR-0048), and pushing one
// through the client router would paint the SPA over a document the server
// already sent. Those links are ordinary navigations, on purpose.
export function useRouteLink() {
  const navigate = useNav()
  return function linkProps(path) {
    return {
      href: path,
      onClick(event) {
        if (event.defaultPrevented) return
        if (path.startsWith('/learn')) return
        // Anything but an unmodified primary click is the reader asking the
        // browser for something we are not being asked to do.
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(path)
      },
    }
  }
}
