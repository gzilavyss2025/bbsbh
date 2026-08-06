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
