import { createContext } from 'react'

// Posted uniform assets, handed down without drilling (static
// data; the same assignment UniformFigure draws on the lineup page).
// `GameUniformsContext`: both clubs' assets for this game ({ away, home }, each
// null/absent until posted), published by GameView. `BattingUniformContext`:
// the assets of the club at bat in one half-inning, published by InningPage, so
// an at-bat's strike zone can dress its batter in them (StrikeZone.jsx).
export const GameUniformsContext = createContext(null)
export const BattingUniformContext = createContext(null)
// The figures a strike zone tries when no uniform art is posted (or it fails), in order: a list of
// { jersey, pants } URL pairs (api/uniforms.js fallbackFigureUrls), or null for the plain silhouette.
// Gameday's hero passes MLB's own Gameday batters (Gary, 2026-10-29).
export const BatterFallbackContext = createContext(null)
