import { NavContext, ScopeContext } from './nav.js'

// Providers for the navigation seam (contexts + hooks live in nav.js). The App
// wraps the whole tree in <NavProvider> once; a game screen wraps its content
// in <LinkScope> so every link inside inherits that game's spoiler cutoff.
export function NavProvider({ navigate, children }) {
  return <NavContext.Provider value={navigate}>{children}</NavContext.Provider>
}

export function LinkScope({ asOf = null, sportId = null, children }) {
  return (
    <ScopeContext.Provider value={{ asOf, sportId }}>
      {children}
    </ScopeContext.Provider>
  )
}
