// Lightweight, dependency-free URL routing over the History API. There is no
// react-router here on purpose — the app has exactly three shapes of screen, so
// a tiny parse/build pair keeps the "no dependency" ethos while making every
// game section deep-linkable and shareable.
//
// Route shapes:
//   '/'                                 -> { name: 'home' }
//   '/{MMDDYYYY}'                       -> { name: 'home', date: YYYY-MM-DD }
//   '/logos'                            -> { name: 'logos' }
//   '/about'                            -> { name: 'about' }
//   '/prospects'                        -> { name: 'prospects' }
//   '/rehab'                            -> { name: 'rehab' }
//   '/milestones'                       -> { name: 'milestones' }
//   '/awards'                           -> { name: 'awards-history' }
//   '/postseason-history'               -> { name: 'postseason-history' }
//   '/postseason-leaders'               -> { name: 'postseason-leaders' }
//   '/postseason/{seriesId}'            -> { name: 'postseason-series', seriesId }
//   '/all-star-rosters'                 -> { name: 'all-star-rosters' }
//   '/all-star-legacy'                  -> { name: 'all-star-legacy' }
//   '/standings'                        -> { name: 'standings' }
//   '/fouls'                            -> { name: 'fouls' }
//   '/admin'                            -> { name: 'admin' }  (copy editor, Clerk-admin gated, unlinked)
//   '/player/{id}'                      -> { name: 'player', id, asOf, sportId }
//   '/team/{id}'                        -> { name: 'team', id, asOf, sportId }
//   '/umpire/{id}'                      -> { name: 'umpire', id }
//   '/umpires'                          -> { name: 'umpire-rankings' }
//   '/manager/{id}'                     -> { name: 'manager', id }
//   '/top-games'                        -> { name: 'top-games' }
//   '/scorecard-lab'                    -> { name: 'scorecard-lab' }  (dev only, unlinked)
//   '/team-color-lab'                   -> { name: 'team-color-lab' }  (unlisted QA page)
//   '/uniform-names'                    -> { name: 'uniform-names' }  (dev-only curation page)
//   '/team-pattern-lab'                 -> { name: 'team-pattern-lab' }  (unlisted QA page)
//   '/game-notes-debug'                 -> { name: 'game-notes-debug' }  (unlisted QA page)
//   '/first-scorebook'                   -> { name: 'first-scorebook' }   (personal retrospective)
//   '/photos'                            -> { name: 'photos' }   (high-res game photo finder, unsealed — see root CLAUDE.md)
//   '/photos/{gamePk}'                   -> { name: 'photos', gamePk }   (same page, deep-linked to one game)
//   '/team/{id}/leaders'                -> { name: 'team-leaders', id, asOf, sportId }
//   '/leaders'                          -> { name: 'leaders', scope: 'mlb', asOf, sportId }
//   '/leaders/{scope}'                  -> { name: 'leaders', scope, asOf, sportId }
//   '/leaders/org/{orgId}'              -> { name: 'leaders', scope: 'org', orgId, asOf, sportId }
//   '/{MMDDYYYY}/{matchup}/{section}'   -> { name: 'game', date, matchup, section }
//
// Leader-page `scope` is one of mlb/al/nl (league), aaa/aa/aplus/a (level), or
// 'org' with an orgId (a club's whole farm system). See api/leaders.js.
//
// `matchup` is the away + home team abbreviations concatenated and lowercased
// (MIL @ ARI -> 'milari'); `section` is 'lineup1' (away info), 'lineup2' (home
// info), 'boxscore', or 'top{n}' / 'bottom{n}' (innings viewer, one page per
// half-inning). Legacy 'inning{n}' links still parse (as the top half).
// Example: /07052026/milari/bottom3
//
// Player/team pages are game-independent (resolvable by id on a cold link), but
// carry an optional query so a link opened FROM a sealed game stays spoiler-
// safe: `?d={officialDate}` cuts stats off at the day before that game, and
// `?s={sportId}` hints the level. Both are omitted on a bare shared link (which
// has no game to spoil, so it defaults to current stats). Accepts a URL that
// may include a `?query`.

export function parseRoute(url) {
  const [path, query = ''] = (url || '').split('?')
  const parts = path.split('/').filter(Boolean)
  const q = new URLSearchParams(query)
  const asOf = q.get('d') || null
  const sportId = q.get('s') ? Number(q.get('s')) : null
  if (parts.length === 0) return { name: 'home' }
  // A bare 8-digit date is the slate paged to that day ('/07172026') — the
  // home screen, shareable. Every named single-segment route below is
  // non-numeric, so the digit test can safely come first. An impossible
  // calendar date (e.g. '13452026') falls through to today's slate rather
  // than erroring on a hand-mangled link.
  if (parts.length === 1 && /^\d{8}$/.test(parts[0])) {
    const date = urlDateToApi(parts[0])
    return isRealDate(date) ? { name: 'home', date } : { name: 'home' }
  }
  if (parts.length === 1 && parts[0] === 'logos') return { name: 'logos' }
  if (parts.length === 1 && parts[0] === 'about') return { name: 'about' }
  if (parts.length === 1 && parts[0] === 'prospects') return { name: 'prospects' }
  if (parts.length === 1 && parts[0] === 'rehab') return { name: 'rehab' }
  if (parts.length === 1 && parts[0] === 'milestones') return { name: 'milestones' }
  if (parts.length === 1 && parts[0] === 'awards') return { name: 'awards-history' }
  if (parts.length === 1 && parts[0] === 'postseason-history')
    return { name: 'postseason-history' }
  if (parts.length === 1 && parts[0] === 'postseason-leaders')
    return { name: 'postseason-leaders' }
  if (parts.length === 1 && parts[0] === 'all-star-rosters')
    return { name: 'all-star-rosters' }
  if (parts.length === 1 && parts[0] === 'all-star-legacy')
    return { name: 'all-star-legacy' }
  if (parts.length === 1 && parts[0] === 'standings') return { name: 'standings' }
  if (parts.length === 1 && parts[0] === 'fouls') return { name: 'fouls' }
  // Admin copy editor — the site owner tunes consent-pop-up wording here. Not
  // linked from anywhere in the app; reachable by URL and gated to a Clerk
  // admin (see AdminCopy.jsx + api/copy.js). Parsed regardless so a stray
  // production visit renders the (locked) panel rather than falling through to
  // the generic game route.
  if (parts.length === 1 && parts[0] === 'admin') return { name: 'admin' }
  if (parts.length === 1 && parts[0] === 'umpires') return { name: 'umpire-rankings' }
  if (parts.length === 1 && parts[0] === 'top-games') return { name: 'top-games' }
  // Dev-only scorecard harness — parsed and rendered, but linked from nowhere.
  if (parts.length === 1 && parts[0] === 'scorecard-lab')
    return { name: 'scorecard-lab' }
  // Dev-only team-color swatch harness — parsed and rendered, but linked from nowhere.
  if (parts.length === 1 && parts[0] === 'team-color-lab')
    return { name: 'team-color-lab' }
  // Dev-only uniform-name curation page (App.jsx gates the actual component
  // to import.meta.env.DEV, same as scorecard-lab below) — parsed here
  // regardless so a stray production visit falls through to 'home' instead of
  // matching the generic 3-segment game route.
  if (parts.length === 1 && parts[0] === 'uniform-names')
    return { name: 'uniform-names' }
  // Win-probability band pattern review harness — parsed and rendered, but linked from nowhere.
  if (parts.length === 1 && parts[0] === 'team-pattern-lab')
    return { name: 'team-pattern-lab' }
  // Unlisted QA page (every club's Game Notes calibration status + a shortcut
  // to open its modal) — linked from nowhere, reachable only by direct URL.
  if (parts.length === 1 && parts[0] === 'game-notes-debug')
    return { name: 'game-notes-debug' }
  // Personal scorebook archive, reached from the site menu or a direct link.
  if (parts.length === 1 && parts[0] === 'first-scorebook')
    return { name: 'first-scorebook' }
  // High-res game photo finder — unsealed, see root CLAUDE.md's spoiler section.
  if (parts.length === 1 && parts[0] === 'photos') return { name: 'photos' }
  // Same page, deep-linked straight to one game's gallery (e.g. from the box
  // score) — skips the club/season picker instead of adding a distinct route name.
  // A non-numeric segment falls back to the plain browse view (same idea as
  // the invalid-date fallback above) rather than stranding the page with
  // neither a picker nor a gallery to show.
  if (parts.length === 2 && parts[0] === 'photos') {
    const gamePk = Number(parts[1])
    return Number.isFinite(gamePk) ? { name: 'photos', gamePk } : { name: 'photos' }
  }
  if (parts.length === 2 && parts[0] === 'player')
    return { name: 'player', id: parts[1], asOf, sportId }
  if (parts.length === 2 && parts[0] === 'team')
    return { name: 'team', id: parts[1], asOf, sportId }
  // A series id (e.g. '2025-division-112-158') already matches
  // postseason-history.json's own `series.id` 1:1 — no separate slug scheme.
  if (parts.length === 2 && parts[0] === 'postseason')
    return { name: 'postseason-series', seriesId: parts[1] }
  // Umpires carry no spoiler-cutoff hint: assignments/dates are never
  // score-revealing, so unlike player/team links there's no `?d=`/`?s=` to parse.
  if (parts.length === 2 && parts[0] === 'umpire')
    return { name: 'umpire', id: parts[1] }
  // Managers carry no spoiler-cutoff hint either — a coaching career/awards
  // record is never score-revealing, same footing as umpires above.
  if (parts.length === 2 && parts[0] === 'manager')
    return { name: 'manager', id: parts[1] }
  if (parts.length === 1 && parts[0] === 'leaders')
    return { name: 'leaders', scope: 'mlb', asOf, sportId }
  if (parts.length === 2 && parts[0] === 'leaders')
    return { name: 'leaders', scope: parts[1].toLowerCase(), asOf, sportId }
  // Both 3-segment 'leaders'/'team' branches must come BEFORE the generic
  // 3-segment game branch below, which would otherwise swallow them as a game
  // (date='leaders'/'team').
  if (parts.length === 3 && parts[0] === 'leaders' && parts[1] === 'org')
    return { name: 'leaders', scope: 'org', orgId: Number(parts[2]), asOf, sportId }
  if (parts.length === 3 && parts[0] === 'team' && parts[2] === 'leaders')
    return { name: 'team-leaders', id: parts[1], asOf, sportId }
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

// Whether a YYYY-MM-DD string names a real calendar date — a Date round-trip
// catches out-of-range months/days (e.g. '2026-13-45', '2026-02-30') that a
// pure digit-count regex lets through.
function isRealDate(api) {
  const [y, m, d] = (api || '').split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

// The slate paged to a specific day. Today's slate is canonically the bare
// '/' — GameSelect only builds this for a non-today date — so the home URL
// never grows a redundant date suffix.
export function slatePath(apiDate) {
  return `/${apiDateToUrl(apiDate)}`
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

// Build a player / team page path, carrying the spoiler-safe cutoff hints when
// linked from a game: `d` = the game's officialDate (YYYY-MM-DD), `s` = sportId.
// Both optional — a bare link (no game context) omits them and shows current
// stats.
function linkQuery({ d, s } = {}) {
  const q = new URLSearchParams()
  if (d) q.set('d', d)
  if (s) q.set('s', String(s))
  const qs = q.toString()
  return qs ? `?${qs}` : ''
}
export function playerPath(id, opts = {}) {
  return `/player/${id}${linkQuery(opts)}`
}
export function teamPath(id, opts = {}) {
  return `/team/${id}${linkQuery(opts)}`
}
export function postseasonSeriesPath(seriesId) {
  return `/postseason/${seriesId}`
}
export function umpirePath(id) {
  return `/umpire/${id}`
}
export function managerPath(id) {
  return `/manager/${id}`
}
export function umpireRankingsPath() {
  return '/umpires'
}
export function foulsPath() {
  return '/fouls'
}
export function gamePhotosPath(gamePk) {
  return `/photos/${gamePk}`
}
export function teamLeadersPath(id, opts = {}) {
  return `/team/${id}/leaders${linkQuery(opts)}`
}
// The broader leader pages. `mlb` is the bare `/leaders` (the top-level entry);
// every other league/level scope carries its key. Org leaders take a club id.
export function leadersPath(scope = 'mlb', opts = {}) {
  return `${scope === 'mlb' ? '/leaders' : `/leaders/${scope}`}${linkQuery(opts)}`
}
export function orgLeadersPath(orgId, opts = {}) {
  return `/leaders/org/${orgId}${linkQuery(opts)}`
}
