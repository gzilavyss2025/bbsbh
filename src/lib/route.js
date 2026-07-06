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
// info), or 'inning{n}' (innings viewer focused on inning n). Example:
//   /07052026/milari/inning3

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

// section string -> { step, inning }. step: 0 away info, 1 home info, 2 innings.
export function sectionToStep(section) {
  if (section === 'lineup2') return { step: 1, inning: 1 }
  const m = /^inning(\d+)$/.exec(section || '')
  if (m) return { step: 2, inning: Math.max(1, Number(m[1])) }
  return { step: 0, inning: 1 } // lineup1 / anything unknown
}

// step (+ inning for the innings viewer) -> section string.
export function stepToSection(step, inning = 1) {
  if (step === 0) return 'lineup1'
  if (step === 1) return 'lineup2'
  return `inning${inning}`
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

export function matchupSlug(awayAbbr, homeAbbr) {
  return `${(awayAbbr || '').toLowerCase()}${(homeAbbr || '').toLowerCase()}`
}

// Build the path for a game section. `apiDate` is YYYY-MM-DD.
export function gamePath(apiDate, awayAbbr, homeAbbr, section) {
  return `/${apiDateToUrl(apiDate)}/${matchupSlug(awayAbbr, homeAbbr)}/${section}`
}
