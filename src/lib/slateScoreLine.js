// Pure formatter for a slate card's "Scores Unlocked" score + inning line.
// Dependency-free / React-free so it can be pinned by the unit suite
// (test/slate-scores.test.js). Consumes one entry from fetchSlateScores plus the
// spoiler-free game model (for abbreviations + the coarse abstractState).
//
// Everything this returns is UPPERCASE-SAFE (team abbreviations, digits, an
// en-dash, and the TOP/BOT/MID/END/F tokens below), so the global
// `#root * { text-transform: uppercase }` rule renders it correctly with NO
// caps-exemption. Do not introduce natural-case words here without registering
// an exemption in index.css (scripts/check-caps.mjs enforces it).

const STATE_ABBR = { top: 'TOP', middle: 'MID', bottom: 'BOT', end: 'END' }

function liveInningLabel(entry) {
  const n = entry.currentInning
  if (!Number.isFinite(n)) return null
  const abbr = STATE_ABBR[String(entry.inningState || '').toLowerCase()] || ''
  return abbr ? `${abbr} ${n}` : String(n)
}

// Returns { score, inning } or null. `score` is e.g. "MIL 4 – AZ 2" (away first,
// matching the card's left-away / right-home column order). `inning` is the live
// half ("BOT 7") for a game in progress, an extra-innings marker ("F/10") for an
// extras Final, and null for a regulation Final (the card's own "FINAL" status
// already carries that — no duplication). Returns null when there is nothing
// meaningful to show (no entry, or a lean feed with no runs posted), so the card
// renders exactly as it does today.
export function slateScoreLine(entry, game) {
  if (!entry) return null
  const a = entry.awayScore
  const h = entry.homeScore
  if (!Number.isFinite(a) || !Number.isFinite(h)) return null
  const awayAbbr = game?.away?.abbreviation || 'AWAY'
  const homeAbbr = game?.home?.abbreviation || 'HOME'
  const score = `${awayAbbr} ${a} – ${homeAbbr} ${h}`
  const state = game?.abstractState
  let inning = null
  if (state === 'Final') {
    const n = entry.currentInning
    inning = Number.isFinite(n) && n > 9 ? `F/${n}` : null
  } else if (state === 'Live') {
    inning = liveInningLabel(entry)
  }
  return { score, inning }
}
