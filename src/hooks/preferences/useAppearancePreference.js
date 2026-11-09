import { useEffect } from 'react'
import { usePreferences } from './usePreferences.js'
import { effectiveTheme, themeAttribute } from './effectiveTheme.js'

// Applies the `appearance` preference to <html> (ADR-0130), like
// useMotionPreference. Mounted once, in App.jsx. index.html's inline script does
// the same before first paint; this keeps it live after a change on My Tally.
//
// No saved choice forces 'light' (ADR-0131). A saved 'system' removes the attribute (CSS follows prefers-color-scheme). The phone
// chrome follows too: every theme-color meta gets the resolved theme's canvas
// colour (paper or true black), and re-resolves if the system flips live. The
// media-scoped meta in index.html covers the moment before this runs.
const CHROME = { light: '#F6EFDC', dark: '#000000' }

export function useAppearancePreference() {
  const { appearance, has } = usePreferences()
  const chosen = has('appearance')

  useEffect(() => {
    const root = document.documentElement
    const attr = themeAttribute(appearance, chosen)
    if (attr) root.dataset.theme = attr
    else delete root.dataset.theme

    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    const paint = () => {
      const color = CHROME[effectiveTheme(appearance, query?.matches === true, chosen)]
      for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = color
    }
    paint()
    query?.addEventListener?.('change', paint)
    return () => {
      query?.removeEventListener?.('change', paint)
      delete root.dataset.theme
    }
  }, [appearance, chosen])
}
