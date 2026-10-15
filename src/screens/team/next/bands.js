import { lazy } from 'react'

// The seven bands of the one-scroll team page, in page order (ADR-0082). `Module` is the
// band's folder, loaded when the band comes near. A later row edits only its own folder:
// this list, Band.jsx and the page are not a module's to touch.
export const BANDS = [
  { key: 'standings', label: 'Standings', Module: lazy(() => import('./standings/index.jsx')) },
  { key: 'ranks', label: 'Ranks', Module: lazy(() => import('./ranks/index.jsx')) },
  { key: 'games', label: 'Games', Module: lazy(() => import('./games/index.jsx')) },
  { key: 'roster', label: 'Roster', Module: lazy(() => import('./roster/index.jsx')) },
  { key: 'farm', label: 'Farm', Module: lazy(() => import('./farm/index.jsx')) },
  { key: 'money', label: 'Money', Module: lazy(() => import('./money/index.jsx')) },
  { key: 'about', label: 'About', Module: lazy(() => import('./about/index.jsx')) },
]
