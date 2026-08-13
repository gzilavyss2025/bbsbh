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
//   '/trade-deadline'                   -> { name: 'trade-deadline' }  (redirects to the latest season)
//   '/trade-deadline/{year}'            -> { name: 'trade-deadline-season', season: year }
//   '/all-star-rosters'                 -> { name: 'all-star-rosters' }
//   '/all-star-legacy'                  -> { name: 'all-star-legacy' }
//   '/standings'                        -> { name: 'standings' }
//   '/fouls'                            -> { name: 'fouls' }
//   '/admin'                            -> { name: 'admin' }  (copy editor, Clerk-admin gated, unlinked)
//   '/profile'                          -> { name: 'profile' }  (My Tally — your club, this device, your account)
//   '/player/{id}'                      -> { name: 'player', id, asOf, sportId }
//   '/team/{id}'                        -> { name: 'team', id, asOf, sportId }
//   '/umpire/{id}'                      -> { name: 'umpire', id }
//   '/umpires'                          -> { name: 'umpire-rankings' }
//   '/manager/{id}'                     -> { name: 'manager', id }
//   '/scorecard-lab'                    -> { name: 'scorecard-lab' }  (dev only, unlinked)
//   '/identity-lab'                     -> { name: 'identity-lab' }  (dev-only curation lab)
//   '/uniform-names'                    -> { name: 'uniform-names' }  (dev-only curation page)
//   '/game-notes-debug'                 -> { name: 'game-notes-debug' }  (unlisted QA page)
//   '/animation-lab'                    -> { name: 'animation-lab' }  (unlisted QA page)
//   '/wordmark-lab'                     -> { name: 'wordmark-lab' }  (unlisted design study)
//   '/first-scorebook'                   -> { name: 'first-scorebook' }   (personal retrospective)
//   '/logbook'                           -> { name: 'logbook', season: null }  (your game stamps, newest season)
//   '/logbook?place={gamePk}'            -> { name: 'logbook', placing: gamePk } (book in placement mode)
//   '/logbook/stats'                     -> { name: 'logbook-stats' }          (what the collection adds up to)
//   '/logbook/new'                       -> { name: 'logbook', creating: true } (start a new book, no other book on screen)
//   '/logbook/{season}'                  -> { name: 'logbook', season }        (one season's stamps)
//   '/logbook/book/{bookId}'             -> { name: 'logbook', bookId, season: null }   (a specific named book)
//   '/logbook/book/{bookId}/{season}'    -> { name: 'logbook', bookId, season }
//   '/logbook/book/{bookId}/stats'       -> { name: 'logbook-stats', bookId }  (one book's retrospective)
//   '/photos'                            -> { name: 'photos' }   (high-res game photo finder, unsealed — see root CLAUDE.md)
//   '/photos/{gamePk}'                   -> { name: 'photos', gamePk }   (same page, deep-linked to one game)
//   '/team/{id}/leaders'                -> { name: 'team-leaders', id, asOf, sportId }
//   '/team/{id}/{roster|games|numbers|minors}'
//                                       -> { name: 'team-{tab}', id, asOf, sportId }
//   '/team/{id}/stamp-in'               -> { name: 'team-stamp-in', id, asOf, sportId }
//                                          (a club's played season, every result showing, one
//                                           stamp per game you watched — ADR-0042. NOT a tab.)
//   '/team/{id}/photos'                 -> { name: 'team-photos', id, asOf, sportId }
//                                          (professional photos merged across the whole season's
//                                           decided games, unsealed like '/photos'. NOT a tab —
//                                           one entry point, the Photos rail's own door.)
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
// info), 'boxscore', 'preview' (the shareable preview-image studio), 'sheet'
// (the printable pre-pitch scorecard), or 'top{n}' / 'bottom{n}' (innings
// viewer, one page per half-inning). Legacy 'inning{n}' links still parse (as
// the top half).
// Example: /07052026/milari/bottom3
//
// Player/team pages are game-independent (resolvable by id on a cold link) and
// show CURRENT stats by default, however you reached them. Two optional hints:
// `?d={officialDate}` shows the page as it stood entering that day, and
// `?s={sportId}` hints the level so the fetch layer can skip a lookup.
//
// `?d=` used to be stamped automatically onto every link out of a started game,
// as a spoiler cutoff. It isn't any more (ADR-0034, "The cutoff is opt-in now")
// — it still parses and still applies, so an already-shared dated link resolves
// the way its sender meant it to, but nothing puts it there for you. Accepts a
// URL that may include a `?query`.

// The team hub's tabs, as `third URL segment -> route name`. Every one of these
// is a real address (the URL changes, back/forward work, each tab is
// shareable), and each loads only its own data — see .scratch/team-page-ia.
// `leaders` predates the rebuild and is unchanged; it lives here so the whole
// set is ONE parse branch rather than a growing stack of near-identical ones.
// The Overview tab is the bare '/team/{id}', so it is deliberately absent.
const TEAM_TAB_ROUTES = {
  leaders: 'team-leaders',
  roster: 'team-roster',
  games: 'team-games',
  numbers: 'team-numbers',
  minors: 'team-minors',
}

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
  if (parts.length === 1 && parts[0] === 'trade-deadline')
    return { name: 'trade-deadline' }
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
  // My Tally — the page that reports on YOU rather than on baseball: the club
  // you follow, how this device behaves, what an account carries between them.
  // Deliberately ONE address with sections on it, not '/profile/{sub}': a
  // sub-route would make this parser grow a wildcard it has never needed, and
  // would force Clerk's <UserProfile> into path routing (it owns its own
  // sub-navigation), which is why that component is mounted routing="virtual".
  // A stray '/profile/x' therefore falls through to the slate, same forgiving
  // shape as every other unknown second segment here.
  if (parts.length === 1 && parts[0] === 'profile') return { name: 'profile' }
  if (parts.length === 1 && parts[0] === 'umpires') return { name: 'umpire-rankings' }
  // Dev-only scorecard harness — parsed and rendered, but linked from nowhere.
  if (parts.length === 1 && parts[0] === 'scorecard-lab')
    return { name: 'scorecard-lab' }
  // Dev-only Team Identity Lab — every dimension of a club's visual identity
  // (MLB treatments, each MiLB level's Home/Away, the WPA band pattern) behind
  // one in-page dimension switcher. Replaced /team-color-lab,
  // /team-color-lab-{aaa,aa,higha,a} and /team-pattern-lab, which were unlisted
  // and linked from nowhere, so there's nothing to redirect.
  if (parts.length === 1 && parts[0] === 'identity-lab')
    return { name: 'identity-lab' }
  // Dev-only uniform-name curation page (App.jsx gates the actual component
  // to import.meta.env.DEV, same as scorecard-lab above) — parsed here
  // regardless so a stray production visit falls through to 'home' instead of
  // matching the generic 3-segment game route. Same reason the lab above is
  // still parsed: see ADR-0029's isolation layers.
  if (parts.length === 1 && parts[0] === 'uniform-names')
    return { name: 'uniform-names' }
  // Unlisted QA page (every club's Game Notes calibration status + a shortcut
  // to open its modal) — linked from nowhere, reachable only by direct URL.
  if (parts.length === 1 && parts[0] === 'game-notes-debug')
    return { name: 'game-notes-debug' }
  // Unlisted QA page cataloging every decorative animation in the app, live +
  // frozen stage-by-stage — linked from nowhere, reachable only by direct URL.
  if (parts.length === 1 && parts[0] === 'animation-lab')
    return { name: 'animation-lab' }
  // Unlisted Tally brand study — no score/reveal content, safe to ship.
  if (parts.length === 1 && parts[0] === 'wordmark-lab')
    return { name: 'wordmark-lab' }
  // Personal scorebook archive, reached from the site menu or a direct link.
  if (parts.length === 1 && parts[0] === 'first-scorebook')
    return { name: 'first-scorebook' }
  // The Logbook — this user's own collection of game stamps (ADR-0035). It
  // renders scores plainly, which is safe for exactly one reason: a stamp only
  // exists for a game its owner already finished revealing. `season: null` means
  // "the newest season you have stamps in" and is resolved by the page, not
  // here, since only the local collection knows.
  // `?place={gamePk}` puts the book into placement mode for one stamp — the
  // hand-off from the box score's mint card. Deliberately a QUERY and not a
  // route name: it is a transient mode of this same page (you leave it by
  // placing the stamp or by cancelling), not an address worth sharing, and a
  // stale link to it degrades to the plain book.
  if (parts.length === 1 && parts[0] === 'logbook')
    return { name: 'logbook', season: null, placing: toGamePkParam(q.get('place')) }
  // A specific named BOOK (ADR-0036's shelf), additive alongside the two
  // routes above rather than a replacement for them: '/logbook' and
  // '/logbook/{season}' keep meaning exactly what they always have — the
  // default book's content, since every stamp minted before this feature
  // already lives in DEFAULT_BOOK_ID (src/lib/books.js's migration). This is
  // the only way to deep-link or bookmark a NON-default book. Same `?place=`
  // hand-off as the bare route, for the same reason: opening a specific book
  // from the box score's mint card should drop straight into placement mode.
  if (parts.length === 3 && parts[0] === 'logbook' && parts[1] === 'book')
    return {
      name: 'logbook',
      bookId: parts[2],
      season: null,
      placing: toGamePkParam(q.get('place')),
    }
  // THIS BRANCH MUST STAY ABOVE THE SEASON BRANCH BELOW, for the identical
  // reason '/logbook/stats' has to stay above '/logbook/{season}' above:
  // `Number(parts[3])` would parse 'stats' as NaN and silently fall through to
  // the bare book page instead of the retrospective.
  if (parts.length === 4 && parts[0] === 'logbook' && parts[1] === 'book' && parts[3] === 'stats')
    return { name: 'logbook-stats', bookId: parts[2] }
  // One season of a specific book. A non-numeric or out-of-range segment falls
  // back to that book's bare page (same idea as the invalid-date fallback
  // above) rather than stranding it on a season that cannot exist.
  if (parts.length === 4 && parts[0] === 'logbook' && parts[1] === 'book') {
    const season = Number(parts[3])
    return {
      name: 'logbook',
      bookId: parts[2],
      season: Number.isInteger(season) && season >= 1876 && season <= 2200 ? season : null,
      placing: toGamePkParam(q.get('place')),
    }
  }
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
  // The Logbook retrospective — what your collection adds up to (ADR-0035, the
  // game-stamps PRD §6). It reads ONLY your own stamps, which is what lets it
  // print final scores plainly, same argument as /logbook itself.
  //
  // THIS BRANCH MUST STAY ABOVE THE SEASON BRANCH BELOW. That one parses
  // `Number(parts[1])`, so '/logbook/stats' would resolve to season NaN ->
  // null -> the bare Logbook page, silently and with no error to notice. Every
  // named second segment this route ever grows has the same problem and needs
  // the same placement.
  if (parts.length === 2 && parts[0] === 'logbook' && parts[1] === 'stats')
    return { name: 'logbook-stats' }
  // Starting a new book. A named second segment, so it sits above the season
  // branch below for the reason the block just above spells out. It carries the
  // same `?place=` hand-off as every other Logbook route: starting a book is one
  // of the ways to answer "which book does this stamp go in", so the stamp has
  // to still be in hand on the other side of it.
  if (parts.length === 2 && parts[0] === 'logbook' && parts[1] === 'new')
    return { name: 'logbook', creating: true, season: null, placing: toGamePkParam(q.get('place')) }
  // One season of the Logbook. A non-numeric or out-of-range segment falls back
  // to the bare page (same idea as the invalid-date fallback above) rather than
  // stranding it on a season that cannot exist.
  if (parts.length === 2 && parts[0] === 'logbook') {
    const season = Number(parts[1])
    return {
      name: 'logbook',
      season: Number.isInteger(season) && season >= 1876 && season <= 2200 ? season : null,
      placing: toGamePkParam(q.get('place')),
    }
  }
  if (parts.length === 2 && parts[0] === 'player')
    return { name: 'player', id: parts[1], asOf, sportId }
  if (parts.length === 2 && parts[0] === 'team')
    return { name: 'team', id: parts[1], asOf, sportId }
  // A series id (e.g. '2025-division-112-158') already matches
  // postseason-history.json's own `series.id` 1:1 — no separate slug scheme.
  if (parts.length === 2 && parts[0] === 'postseason')
    return { name: 'postseason-series', seriesId: parts[1] }
  // The year matches the precomputed file's own name 1:1 (public/data/
  // trade-deadline/{year}.json) — no separate slug scheme, same idea as the
  // postseason series id above. A non-numeric segment falls back to the
  // season index rather than stranding the page with nothing to show.
  if (parts.length === 2 && parts[0] === 'trade-deadline') {
    const season = Number(parts[1])
    return Number.isFinite(season) ? { name: 'trade-deadline-season', season } : { name: 'trade-deadline' }
  }
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
  // Stamp In (ADR-0042) — a club's played season with every result showing, so
  // the reader can press a stamp for each game they watched. Deliberately NOT
  // in TEAM_TAB_ROUTES above: it is a standalone page with exactly one entry
  // point (the Schedule card's button on the Games tab), not a sixth tab, and
  // TeamTabBar draws a button for every name in that table. Same 3-segment
  // shape as the tabs, so it needs the same placement above the generic game
  // branch below, which would otherwise read it as date='team'.
  if (parts.length === 3 && parts[0] === 'team' && parts[2] === 'stamp-in')
    return { name: 'team-stamp-in', id: parts[1], asOf, sportId }
  // A club's professional photos, merged across its whole season — reached
  // from exactly one place (the Photos rail's own "Full season" door), not a
  // sixth tab, same reasoning and same placement as stamp-in just above.
  if (parts.length === 3 && parts[0] === 'team' && parts[2] === 'photos')
    return { name: 'team-photos', id: parts[1], asOf, sportId }
  if (parts.length === 3 && parts[0] === 'team' && TEAM_TAB_ROUTES[parts[2]])
    return { name: TEAM_TAB_ROUTES[parts[2]], id: parts[1], asOf, sportId }
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
// 2 innings, 3 box score, 4 preview poster, 5 printable sheet. `half` only
// matters for step 2.
export function sectionToStep(section) {
  if (section === 'lineup2') return { step: 1, inning: 1, half: 'top' }
  if (section === 'boxscore') return { step: 3, inning: 1, half: 'top' }
  // The shareable preview image (screens/GamePreview.jsx). A real section so
  // the studio is a link you can send someone, but deliberately NOT one of the
  // four stops the "next" buttons walk — it is a thing you make, not a page in
  // the scorebook.
  if (section === 'preview') return { step: 4, inning: 1, half: 'top' }
  // The printable pre-pitch scorecard (screens/sheet/ScoreSheetPage.jsx), and
  // the same kind of stop as 'preview' above for the same reason: a real,
  // shareable address, because handing the sheet's URL to a phone's share sheet
  // IS how it reaches a printer — but a thing you make, not a page you score, so
  // it stays out of the four the "next" buttons walk.
  if (section === 'sheet') return { step: 5, inning: 1, half: 'top' }
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
  if (step === 4) return 'preview'
  if (step === 5) return 'sheet'
  return `${half === 'bottom' ? 'bottom' : 'top'}${inning}`
}

// A `?place=` gamePk, or null. Deliberately strict — a mangled value drops the
// mode rather than putting the book into placement for a game that isn't real.
function toGamePkParam(value) {
  if (!value || !/^\d+$/.test(value)) return null
  const pk = Number(value)
  return Number.isInteger(pk) && pk > 0 ? pk : null
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

// Build a player / team page path. `d` = the as-of date (YYYY-MM-DD), `s` =
// sportId. Both optional, and both absent on an ordinary link — including one
// out of a game, which is the change ADR-0034's amendment records. A path
// carrying `d` is one the reader asked for, and every link built from that page
// keeps it so a single visit gives a single answer.
// Exported so the as-of date control (`components/seal/AsOfBanner.jsx`) can
// apply a picked date to whatever page it's rendering on by re-appending this
// query to `location.pathname` — the same query string every path builder
// below already produces, so a hand-built one can't drift from theirs.
export function linkQuery({ d, s } = {}) {
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
export function tradeDeadlinePath() {
  return '/trade-deadline'
}
export function tradeDeadlineSeasonPath(year) {
  return `/trade-deadline/${year}`
}
export function umpirePath(id) {
  return `/umpire/${id}`
}
export function managerPath(id) {
  return `/manager/${id}`
}
export function foulsPath() {
  return '/fouls'
}
export function gamePhotosPath(gamePk) {
  return `/photos/${gamePk}`
}
// The Logbook, optionally paged to one season. A bare `/logbook` lets the page
// pick the newest season the local collection actually has.
export function logbookPath(season = null) {
  return season ? `/logbook/${season}` : '/logbook'
}
// The retrospective over the whole collection — deliberately not season-paged,
// so 'stats' can never collide with a season segment.
export function logbookStatsPath() {
  return '/logbook/stats'
}
// Starting a new book — its own page, so no other book is on screen while you
// decide what one looks like. Optionally carrying a stamp, for the same reason
// every other Logbook path can: you may start a book in order to put THIS
// keepsake in it, and the flow must not drop it on the way.
export function logbookNewPath(gamePk = null) {
  return gamePk ? `/logbook/new?place=${Number(gamePk)}` : '/logbook/new'
}
// A specific named book (ADR-0036's shelf), optionally paged to one season —
// the additive counterpart to logbookPath() for a user with more than one
// book. `DEFAULT_BOOK_ID` is a legitimate argument here, but only through
// lib/logbookNav.js, which owns the one rule for choosing between the two
// addresses that book can have; read that file's header before building
// either by hand.
export function bookPath(bookId, season = null) {
  return season ? `/logbook/book/${bookId}/${season}` : `/logbook/book/${bookId}`
}
// The retrospective over one specific book, additive counterpart to
// logbookStatsPath().
export function bookStatsPath(bookId) {
  return `/logbook/book/${bookId}/stats`
}
// The book, opened in placement mode for one freshly minted stamp. See the
// `?place=` note in parseRoute for why this is a query rather than a route.
export function logbookPlacePath(gamePk) {
  return `/logbook?place=${Number(gamePk)}`
}
// My Tally. A fixed address with no parameters — same reasoning as /logbook
// (docs/game-log.md §2): the URL outlives any redirect we would maintain, so it
// never changes even if the destination is renamed again.
export function profilePath() {
  return '/profile'
}
export function teamLeadersPath(id, opts = {}) {
  return `/team/${id}/leaders${linkQuery(opts)}`
}
// Any team-hub tab, by its URL segment ('roster' / 'games' / 'numbers' /
// 'minors' / 'leaders'), plus 'overview' for the bare '/team/{id}' the tabs
// hang off.
// Goes through linkQuery like every other team link: a team page opened at a
// dated URL must keep `?d=`/`?s=` across a tab switch, or the same visit would
// answer "entering April 1" on one tab and "today" on the next.
export function teamTabPath(id, tab, opts = {}) {
  return tab === 'overview' ? teamPath(id, opts) : `/team/${id}/${tab}${linkQuery(opts)}`
}
// Stamp In — the club's played season, one stamp per game you watched
// (ADR-0042). Built in exactly one place, the Schedule card's button on the
// Games tab, and carried through linkQuery like every other team link so a
// dated visit stays dated across the hop. Do not build a second entry point:
// the page's consent gate is the address's own, and every other surface in the
// app is sealed by default.
export function teamStampInPath(id, opts = {}) {
  return `/team/${id}/stamp-in${linkQuery(opts)}`
}
// A club's professional photos, merged across its whole season (unsealed,
// same footing as gamePhotosPath). Built in exactly one place today — the
// Photos rail's own "Full season" door — and carried through linkQuery like
// every other team link.
export function teamPhotosPath(id, opts = {}) {
  return `/team/${id}/photos${linkQuery(opts)}`
}
// The broader leader pages. `mlb` is the bare `/leaders` (the top-level entry);
// every other league/level scope carries its key. Org leaders take a club id.
export function leadersPath(scope = 'mlb', opts = {}) {
  return `${scope === 'mlb' ? '/leaders' : `/leaders/${scope}`}${linkQuery(opts)}`
}
export function orgLeadersPath(orgId, opts = {}) {
  return `/leaders/org/${orgId}${linkQuery(opts)}`
}
