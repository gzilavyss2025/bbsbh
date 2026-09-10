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
// `footNote` is optional and prefixes the sheet's foot when this facet needs
// a word the others do not.
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

// The six doors shipped by #1000, #1003 (its pitcher half), #1004 and #1005,
// and the postseason door #1006 added. Each source was checked against a real
// career before it was added, which is how `ven` (#998) was found to return
// nothing at all and, for #1006, `careerPlayoffs` to answer with the wrong career. <!-- word-choice-exempt: statsapi's own stat-type name, quoted -->
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
    groups: ['hitting', 'pitching'],
  },
  {
    key: 'road',
    sitCode: 'a',
    label: 'Road',
    kicker: 'Game lines · on the road',
    title: (name) => `${name} on the road`,
    facet: { kind: 'side', home: false },
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
    groups: ['hitting', 'pitching'],
  },
  {
    key: 'night',
    sitCode: 'n',
    label: 'Night',
    kicker: 'Game lines · night games',
    title: (name) => `${name} at night`,
    facet: { kind: 'dayNight', value: 'night' },
    groups: ['hitting', 'pitching'],
  },
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
    groups: ['pitching'],
  },
  {
    key: 'relief',
    sitCode: 'rp',
    label: 'In relief',
    kicker: 'Game lines · in relief',
    title: (name) => `${name}, in relief`,
    facet: { kind: 'started', value: false },
    groups: ['pitching'],
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
    groups: ['hitting', 'pitching'],
  },
]

// The doors one stat block shows. A two-way player's page draws the card once
// per block, so each asks its own group's question.
export function cardFacetsFor(group) {
  return CARD_FACETS.filter((r) => r.groups.includes(group))
}
