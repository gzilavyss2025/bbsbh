// THE FOUR WINTER LEAGUES — who is behind sportId 17, and which of them ship.
//
// The level rail is MLB, AAA, AA, A+ and A. All four minor tabs go dark in
// September and stay dark past March — A+ from September 17, A from the 18th,
// AA the 25th, AAA the 28th. Measured across 2025-26 that is 175 to 197 dark
// days against MLB's own 110. Behind sportId 17 there is professional baseball
// on the field on 110 days between October 6 and February 2, with complete
// feeds and real club marks, and Tally had no door to it (issue #1055).
//
// THE SHIPPING RULE, which is the reason this table is short.
//
//   Ship no league whose data would make the app state something FALSE.
//
// Seven leagues sit behind sportId 17. Three of them do not ship, and each one
// is excluded by that single rule rather than by a judgment about the league:
//
//   Liga Roberto Clemente (133)  1.69 pitches per play, against ~3.9 in every
//                                other winter league and in MLB itself, on 8 of
//                                8 games sampled. The feed records the terminal
//                                pitch of most at-bats, drops the rest, and
//                                zeroes `count` to match. src/api/derive.js
//                                counts pitches per half-inning and puts that
//                                number on a SCORING surface, so a half that
//                                really took 28 pitches would render as 12.
//                                The app knows how to hide a stat it does not
//                                have. It does not know how to hide one it has
//                                been handed wrong, and a plausible wrong
//                                number is worse than a missing one.
//   Australian Baseball League   0 of 4 clubs have a mark on the CDN, and the
//   (595)                        club list is wrong as well — the Sydney Blue
//                                Sox played a sampled game and are not in the
//                                2025 team list.
//   Caribbean Series (162)       13 games, the field turns over every year, and
//                                one side has no mark.
//
// Dropping the Puerto Rican league costs nothing measurable: it ran entirely
// inside the other three leagues' spans, and the winter has 110 played days
// with it and 110 without. There is no day on which it is the only baseball.
//
// The four below are indistinguishable from the real thing on every check that
// matters to a scorekeeper — 60 of 60 sampled feeds carried placed `allPlays`,
// both `battingOrder` arrays at 9 or more, `linescore.innings`, pitch events on
// 80%+ of plays, and four umpires. A winter game is an ordinary game, and the
// scoring flow needs no change for one.
//
// Every measurement above is re-runnable: .scratch/offseason-design/probes/,
// with pitchdepth.mjs the one to read before anyone adds a fifth league.
export const WINTER_SPORT_ID = 17

// In rail order, which is also the order the picker draws its chips in. FALL
// is first because it is the league with OUR players in it — an AFL roster
// call returns 42 players carrying their real affiliate, which is to say
// exactly the players whose own tabs went dark in September.
//
// `slug` is a top-level route ('/mex/12152025'), not a nested one. See
// src/lib/route.js: a two-segment path already falls into the branch that
// serves '/aaa' and '/aa/08152026', so flat slugs need table entries and no
// new parse branch, where '/winter/mex/12152025' would need one.
export const WINTER_LEAGUES = Object.freeze([
  Object.freeze({ leagueId: 119, chip: 'FALL', slug: 'fall', name: 'Arizona Fall League' }),
  Object.freeze({ leagueId: 132, chip: 'MEX', slug: 'mex', name: 'Liga Mexicana del Pacifico' }),
  Object.freeze({ leagueId: 135, chip: 'VEN', slug: 'ven', name: 'Liga Venezuela Beisbol Profesional' }),
  Object.freeze({ leagueId: 131, chip: 'DOM', slug: 'dom', name: 'Liga de Beisbol Dominicano' }),
])

export const WINTER_LEAGUE_IDS = Object.freeze(WINTER_LEAGUES.map((l) => l.leagueId))

const BY_SLUG = new Map(WINTER_LEAGUES.map((l) => [l.slug, l]))
const BY_ID = new Map(WINTER_LEAGUES.map((l) => [l.leagueId, l]))

export function winterLeagueBySlug(slug) {
  return BY_SLUG.get(String(slug ?? '').toLowerCase()) ?? null
}

export function winterLeagueById(leagueId) {
  return BY_ID.get(Number(leagueId)) ?? null
}

// Is this a sportId 17 page? Asked wherever a surface has to behave differently
// for a winter club — the roster wire is off, the affiliate sort has nothing to
// match, and no clip exists for any of these games.
export function isWinterSport(sportId) {
  return Number(sportId) === WINTER_SPORT_ID
}
