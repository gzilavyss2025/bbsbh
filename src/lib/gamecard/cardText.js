// The words the pitcher game card (#2969) and its PNG share, so the screen and
// the saved image cannot say two different things. Pure; reads only the card
// that api/pitcher/gameCard.js built (reveal-only, so these run after reveal).

// "4 H · 2 R · 1 BB · 4 K · 1 HR": earned runs only when they differ, a homer only when he allowed one.
export function headline(l) {
  const runs = l.er === l.r ? `${l.r} R` : `${l.r} R (${l.er} ER)`
  return [`${l.h} H`, runs, `${l.bb} BB`, `${l.k} K`, l.hr > 0 && `${l.hr} HR`].filter(Boolean).join(' · ')
}

// "WS · Nov 1, 2025 · @ TOR · W 5–4 (11)": the band's top line. The opponent
// ("@" on the road, "vs" at home) and his club's result, its runs first, so a
// shared image says who and how without the footer. No result until final.
export function contextLine(card) {
  const { game, line } = card
  const mine = line.side === 'home' ? game.home : game.away
  const theirs = line.side === 'home' ? game.away : game.home
  const opp = theirs.abbr ? `${line.side === 'home' ? 'vs' : '@'} ${theirs.abbr}` : ''
  let result = ''
  if (game.final && mine.runs != null && theirs.runs != null && mine.runs !== theirs.runs) {
    result = `${mine.runs > theirs.runs ? 'W' : 'L'} ${mine.runs}–${theirs.runs}${game.innings ? ` (${game.innings})` : ''}`
  }
  return [game.round, game.date, opp, result].filter(Boolean).join(' · ')
}

// The pitcher's own decision spelled out ("Win", not "W"), so on the image it
// cannot be read as his club's result, which the band's context line carries.
export function decisionWord(dec) {
  return { W: 'Win', L: 'Loss', S: 'Save' }[dec] ?? '' // the box score's three decisions (api/boxscore.js)
}
