import { createContext, useContext } from 'react'
import { defaultCopy, fillTokens } from './registry.js'

// The copy context object and its consumer hook live here, apart from the
// provider component (CopyProvider.jsx), so each file has a single kind of
// export (component vs. hook) — the react-refresh / fast-refresh convention.

export const CopyContext = createContext(null)

// Components call useCopy().t('scoresUnlocked.title', { time }). Usable even
// with no provider mounted (defaults only) so a stray render or a unit test
// can't crash on a missing context.
export function useCopy() {
  const ctx = useContext(CopyContext)
  const resolved = ctx ? ctx.resolved : defaultCopy()
  const t = (id, tokens) =>
    Object.prototype.hasOwnProperty.call(resolved, id) ? fillTokens(resolved[id], tokens) : ''
  // `applyOverrides` is a no-op in the provider-less fallback. Nothing is
  // holding state to update, and a component that saves copy is by definition
  // mounted inside the real app — so the alternative (omitting it) would only
  // ever turn a stray render into a crash.
  return ctx || { t, resolved, applyOverrides: () => {} }
}
