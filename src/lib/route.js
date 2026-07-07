// Lightweight, dependency-free URL routing over the History API. There is no
// react-router here on purpose — the app has exactly three shapes of screen, so
// a tiny parse/build pair keeps the "no dependency" ethos while making every
// game section deep-linkable and shareable.
//
// Route shapes:
//   '/'                                 -> { name: 'home' }
//   '/logos'                            -> { name: 'logos' }
//   '/{MMDDYYYY}/{matchup}/{section}'   -> { name: 'game', date, matchup, section }
//
// `matchup` is the away + home team abbreviations concatenated and lowercased
// (MIL @ ARI -> 'milari'); `section` is 'lineup1' (away info), 'lineup2' (home
// info), 'boxscore', or 'top{n}' / 'bottom{n}' (innings viewer, one page per
// half-inning). Legacy 'inning{n}' links still parse (as the top half).
// Example: /07052026/milari/bottom3

export function parseRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'home' }
  if (parts.length === 1 && parts[0] === 'logos') return { name: 'logos' }
  if (parts.length === 3) {
    const [date, matchup, section] = parts
    return {
      name: 'game',
      date,
      matchup: matchup.toLowerCase(),
      section: section.toLowerCase(),
    }
  }
  return { name: 'home' }
}

// section string -> { step, inning, half }. step: 0 away info, 1 home info,
// 2 innings, 3 box score. `half` only matters for step 2.
export function sectionToStep(section) {
  if (section === 'lineup2') return { step: 1, inning: 1, half: 'top' }
  if (section === 'boxscore') return { step: 3, inning: 1, half: 'top' }
  const m = /^(top|bottom)(\d+)$/.exec(section || '')
  if (m) return { step: 2, inning: Math.max(1, Number(m[2])), half: m[1] }
  const legacy = /^inning(\d+)$/.exec(section || '')
  if (legacy) return { step: 2, inning: Math.max(1, Number(legacy[1])), half: 'top' }
  return { step: 0, inning: 1, half: 'top' } // lineup1 / anything unknown
}

// step (+ inning/half for the innings viewer) -> section string.
export function stepToSection(step, inning = 1, half = 'top') {
  if (step === 0) return 'lineup1'
  if (step === 1) return 'lineup2'
  if (step === 3) return 'boxscore'
  return `${half === 'bottom' ? 'bottom' : 'top'}${inning}`
}

// URL date (MMDDYYYY) <-> API date (YYYY-MM-DD).
export function urlDateToApi(d) {
  if (!/^\d{8}$/.test(d)) return null
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`
}
export function apiDateToUrl(api) {
  const [y, m, d] = (api || '').split('-')
  return `${m}${d}${y}`
}

// Doubleheaders: both games share a date and matchup, so game 2 (and beyond)
// carries a '-2' suffix ('milstl-2') to keep the two URLs distinct. Game 1
// stays bare, so every pre-existing link still parses and resolves unchanged.
export function matchupSlug(awayAbbr, homeAbbr, gameNumber = 1) {
  const base = `${(awayAbbr || '').toLowerCase()}${(homeAbbr || '').toLowerCase()}`
  return gameNumber > 1 ? `${base}-${gameNumber}` : base
}

// Build the path for a game section. `apiDate` is YYYY-MM-DD.
export function gamePath(apiDate, awayAbbr, homeAbbr, section, gameNumber = 1) {
  return `/${apiDateToUrl(apiDate)}/${matchupSlug(awayAbbr, homeAbbr, gameNumber)}/${section}`
}
