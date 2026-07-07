import { createContext, useContext } from 'react'

// Contexts + hooks for the deep name/team links (providers live in nav.jsx —
// split out so each file exports one kind of thing and Fast Refresh stays happy).
//
// NavContext carries the App's History-API `go`, so a PlayerLink/TeamLink
// anywhere in the tree can navigate without a threaded prop. ScopeContext
// carries the spoiler cutoff a link should stamp — `asOf` (the current game's
// officialDate) + `sportId` — so a link opened from a sealed game cuts the
// player page's stats off the day before and nothing leaks. Empty off a game.
export const NavContext = createContext(() => {})
export const ScopeContext = createContext({})

export function useNav() {
  return useContext(NavContext)
}

export function useLinkScope() {
  return useContext(ScopeContext)
}
