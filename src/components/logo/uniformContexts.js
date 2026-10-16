import { createContext } from 'react'

// Posted uniform assets, handed down without drilling (spoiler-free static
// data; the same assignment UniformFigure draws on the lineup page).
// `GameUniformsContext`: both clubs' assets for this game ({ away, home }, each
// null/absent until posted), published by GameView. `BattingUniformContext`:
// the assets of the club at bat in one half-inning, published by InningPage, so
// an at-bat's strike zone can dress its batter in them (StrikeZone.jsx).
export const GameUniformsContext = createContext(null)
export const BattingUniformContext = createContext(null)
