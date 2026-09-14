// BOX LINES — the registry behind the player page's Game lines card
// (components/playerstats/GameLinesCard.jsx, ADR-0069). One entry is one door:
// a career line under one facet, opening the game-by-game rows that add up to
// it. The card renders these; it decides none of them.
//
// WHY THE LIST LIVES HERE AND NOT IN THE COMPONENT. #997 put it in the card,
// and the card is a .jsx file, which this repo's `node --test` suite cannot
// import. That left the one failure the facet layer explicitly warns about
// untested: an unknown `kind` keeps NOTHING, so a typo in a future facet issue
// ships as a door that opens an empty sheet rather than as an error. As pure
// data it is checked by test/boxlines-card-facets.test.js against the same
// facetPlan the sheet will use.
//
// HOW TO ADD A FACET. Push one entry, and add it nowhere else:
//
//   { key: 'home', sitCode: 'h', label: 'Home', kicker: 'Game lines · at home',
//     title: (name) => `${name} at home`, facet: { kind: 'side', home: true },
//     groups: ['hitting', 'pitching'] }
//
// `key` names the door — the card's React key and the key its label lands
// under. `facet` is the question the sheet asks of the game log (facets.js).
// `groups` is which of a two-way player's stat blocks the door belongs to.
// `section` is which of the card's four headings it files under (SECTIONS
// below), and it is what keeps a card of two dozen doors readable.
// `footNote` is optional and prefixes the sheet's foot when this facet needs
// a word the others do not.
//
// `chip: true` makes it one of a compact row of controls instead of a full
// ledger row. Only the seven weekdays use it: a ledger row each would be
// seven lines saying nearly the same thing, and the question ("does he hit on
// getaway day?") is a comparison, which wants them side by side. A chip prints
// `chipLine` rather than `careerSplitLine` — the same stat object, shortened —
// and names itself with `short`.
//
// THE LABEL'S FIGURES COME FROM ONE OF TWO SOURCES, and an entry names which:
//
//   sitCode         a statsapi SITUATION code ('h', 'd', 'sp'). Every code on
//                   the card is fetched in ONE call, whatever the count.
//   careerGameType  a career under a statsapi GAME TYPE ('P'). One call each.
//
// Most doors are situations. The postseason is not — it is the same career
// under a different game type, and careerSplits.js explains why the stat type
// that looks like the answer isn't. Nothing else is needed: the fetch, the
// gate, the sheet and the card's dress already exist.
//
// Class: spoiler-free (spoiler-manifest.json). This is a list of questions.
// Every answer goes through boxlines/rows.js's cutoff gate.
import { POSTSEASON } from './rows.js'

// The card's four headings, in the order it draws them. A door files under one
// of these and the card groups by THIS list, not by the registry's order, so
// adding a door in the wrong place cannot silently reorder the card.
//
// The headings arrived with the month, weekday and pinch-hit doors (#999,
// #1001, #1002), which took the card from seven doors to twenty. Seven needed
// no heading; twenty undifferentiated ledger rows are a wall, and the four
// groups were already there as comments in this file — they were just not
// reaching the reader.
export const SECTIONS = [
  { key: 'where', title: 'Where' },
  { key: 'when', title: 'When' },
  { key: 'how', title: 'How he got in' },
  { key: 'counted', title: 'When it counted' },
]

// The six doors shipped by #1000, #1003 (its pitcher half), #1004 and #1005,
// and the postseason door #1006 added. Each source was checked against a real
// career before it was added, which is how `ven` (#998) was found to return
// nothing at all and, for #1006, `careerPlayoffs` to answer with the wrong career. <!-- word-choice-exempt: statsapi's own stat-type name, quoted -->
// The month doors' numbers, names and statsapi situation codes. A family of
// doors that differ only in one number is built from a table rather than
// written out eight times — the entries below are the same shape as every
// hand-written one, and the suite checks them the same way.
const MONTHS = [
  [3, '3', 'March'],
  [4, '4', 'April'],
  [5, '5', 'May'],
  [6, '6', 'June'],
  [7, '7', 'July'],
  [8, '8', 'August'],
  [9, '9', 'September'],
  [10, '10', 'October'],
]

// Sunday 0, matching `weekdayOf` in facets.js and the printed week.
const WEEKDAYS = [
  [0, 'dsu', 'Sun', 'Sunday'],
  [1, 'dmo', 'Mon', 'Monday'],
  [2, 'dtu', 'Tue', 'Tuesday'],
  [3, 'dwe', 'Wed', 'Wednesday'],
  [4, 'dth', 'Thu', 'Thursday'],
  [5, 'dfr', 'Fri', 'Friday'],
  [6, 'dsa', 'Sat', 'Saturday'],
]

export const CARD_FACETS = [
  // WHERE HE PLAYED. `h`/`a` count games at the park; the rows count the club
  // the schedule listed as home. Both are MLB's own, and they differ only on a
  // relocated home game — see the `side` case in facets.js for the measurements
  // and for the third definition that must not be reinvented.
  {
    key: 'home',
    sitCode: 'h',
    label: 'Home',
    kicker: 'Game lines · at home',
    title: (name) => `${name} at home`,
    facet: { kind: 'side', home: true },
    section: 'where',
    groups: ['hitting', 'pitching'],
  },
  {
    key: 'road',
    sitCode: 'a',
    label: 'Road',
    kicker: 'Game lines · on the road',
    title: (name) => `${name} on the road`,
    facet: { kind: 'side', home: false },
    section: 'where',
    groups: ['hitting', 'pitching'],
  },
  // WHEN HE PLAYED. The rows read day/night off the SCHEDULE record, never the
  // game log, which reported "day" for two known night games (ADR-0069).
  {
    key: 'day',
    sitCode: 'd',
    label: 'Day',
    kicker: 'Game lines · day games',
    title: (name) => `${name} by day`,
    facet: { kind: 'dayNight', value: 'day' },
    section: 'when',
    groups: ['hitting', 'pitching'],
  },
  {
    key: 'night',
    sitCode: 'n',
    label: 'Night',
    kicker: 'Game lines · night games',
    title: (name) => `${name} at night`,
    facet: { kind: 'dayNight', value: 'night' },
    section: 'when',
    groups: ['hitting', 'pitching'],
  },
  // WHICH MONTH (#999). Eight doors, and the eight are the whole regular
  // season: statsapi's situation codes number the months, '3' March through
  // '10' October, and a career row came back for every one of them on both
  // groups (verified 2026-09-14 on 592885 hitting and 656849 pitching). A
  // month with no games renders no door, so April through September is what
  // most careers show and March and October belong to the long ones.
  //
  // THE DOOR AND THE ROWS AGREE EXACTLY HERE, which is worth saying because
  // the home/road doors above them do not. Measured over three careers, MLB's
  // monthly aggregate matched the rows month for month, all eight, every time
  // — Yelich 21/221/272/292/290/326/287/16 on both sides. A month is a fact
  // about the date, and the date is the one thing the game log and the
  // schedule cannot disagree about.
  ...MONTHS.map(([month, sitCode, name]) => ({
    key: `m${month}`,
    sitCode,
    label: name,
    kicker: `Game lines · in ${name}`,
    title: (surname) => `${surname} in ${name}`,
    facet: { kind: 'month', month },
    section: 'when',
    groups: ['hitting', 'pitching'],
  })),
  // WHICH DAY OF THE WEEK (#1001). Seven CHIPS, not seven ledger rows. The
  // question a weekday split answers is a comparison — is he worse on getaway
  // day? — and a comparison wants its seven answers side by side, where a
  // stack of seven near-identical lines buries it. They match exactly too:
  // 277/198/267/257/161/277/288 on Yelich, door and rows, and the same on
  // Peterson and Vazquez.
  //
  // Sunday first, the way a calendar is printed, which is also `weekdayOf`'s
  // own numbering in facets.js — so the chip row reads left to right in the
  // order the facet numbers them and no reader has to translate.
  ...WEEKDAYS.map(([day, sitCode, short, name]) => ({
    key: `w${day}`,
    sitCode,
    chip: true,
    short,
    label: `${name}s`,
    kicker: `Game lines · on ${name}s`,
    title: (surname) => `${surname} on ${name}s`,
    facet: { kind: 'weekday', day },
    section: 'when',
    groups: ['hitting', 'pitching'],
  })),
  // HOW HE GOT INTO THE GAME. Pitchers only: the hitting game log carries no
  // gamesStarted, so a hitter's `started` is null and the facet would keep
  // nothing. A hitter's started/entered reads the box score and is #1003's
  // other half, not shipped here.
  {
    key: 'started',
    sitCode: 'sp',
    label: 'Started',
    kicker: 'Game lines · as a starter',
    title: (name) => `${name}, starts`,
    facet: { kind: 'started', value: true },
    section: 'how',
    groups: ['pitching'],
  },
  {
    key: 'relief',
    sitCode: 'rp',
    label: 'In relief',
    kicker: 'Game lines · in relief',
    title: (name) => `${name}, in relief`,
    facet: { kind: 'started', value: false },
    section: 'how',
    groups: ['pitching'],
  },
  // OFF THE BENCH, BAT IN HAND (#1002). Hitters only, and the one door on this
  // card whose rows MLB publishes no per-game list for: `pH` gives the career
  // aggregate, and the rows come from the game log's own `positionsPlayed`
  // (facets.js). The issue costed this at one boxscore per candidate game,
  // capped at 40 with a "Show older"; it costs nothing of the sort, and the
  // cap and the paging were never built because there is nothing to page.
  {
    key: 'pinchHit',
    sitCode: 'pH',
    label: 'Pinch hitting',
    kicker: 'Game lines · pinch hitting',
    title: (surname) => `${surname} as a pinch hitter`,
    footNote: 'Games he came to the plate as a pinch hitter.',
    facet: { kind: 'pinchHit' },
    section: 'how',
    groups: ['hitting'],
  },
  // WHEN IT COUNTED (#1006). The only door so far whose rows are not regular
  // season, which is why it is the only one that changes what the FETCH asks
  // for rather than just what it keeps: a game log carries no October until the
  // call names the rounds. Its label comes from a career total under a game
  // type, not from a situation code — careerSplits.js has both sources and the
  // stat type that pretends to be this one.
  {
    key: 'postseason',
    careerGameType: 'P',
    label: 'Postseason',
    kicker: 'Game lines · postseason',
    title: (name) => `${name} in the postseason`,
    footNote: 'Postseason only; the pill names the round.',
    facet: { kind: 'gameTypes', types: POSTSEASON },
    section: 'counted',
    groups: ['hitting', 'pitching'],
  },
]

// The doors one stat block shows. A two-way player's page draws the card once
// per block, so each asks its own group's question.
export function cardFacetsFor(group) {
  return CARD_FACETS.filter((r) => r.groups.includes(group))
}
