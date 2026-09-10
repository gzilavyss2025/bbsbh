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
// HOW TO ADD A FACET. Push one entry, and add its `sitCode` nowhere else:
//
//   { sitCode: 'h', label: 'Home', kicker: 'Game lines · at home',
//     title: (name) => `${name} at home`, facet: { kind: 'side', home: true },
//     groups: ['hitting', 'pitching'] }
//
// `sitCode` is the statsapi situation code whose CAREER row supplies the
// label's figures — every code on the card is fetched in ONE call
// (careerSplits.js). `facet` is the question the sheet asks of the game log
// (facets.js). `groups` is which of a two-way player's stat blocks the door
// belongs to. Nothing else is needed: the fetch, the gate, the sheet and the
// card's dress already exist.
//
// Class: spoiler-free (spoiler-manifest.json). This is a list of questions.
// Every answer goes through boxlines/rows.js's cutoff gate.

// The six doors shipped by #1000, #1003 (its pitcher half), #1004 and #1005.
// Each code was checked against a real career on 2026-09-03 before it was
// added, which is how `ven` (#998) was found to return nothing at all.
export const CARD_FACETS = [
  // WHERE HE PLAYED. `h`/`a` count games at the park; the rows count the club
  // the schedule listed as home. Both are MLB's own, and they differ only on a
  // relocated home game — see the `side` case in facets.js for the measurements
  // and for the third definition that must not be reinvented.
  {
    sitCode: 'h',
    label: 'Home',
    kicker: 'Game lines · at home',
    title: (name) => `${name} at home`,
    facet: { kind: 'side', home: true },
    groups: ['hitting', 'pitching'],
  },
  {
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
    sitCode: 'd',
    label: 'Day',
    kicker: 'Game lines · day games',
    title: (name) => `${name} by day`,
    facet: { kind: 'dayNight', value: 'day' },
    groups: ['hitting', 'pitching'],
  },
  {
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
    sitCode: 'sp',
    label: 'Started',
    kicker: 'Game lines · as a starter',
    title: (name) => `${name}, starts`,
    facet: { kind: 'started', value: true },
    groups: ['pitching'],
  },
  {
    sitCode: 'rp',
    label: 'In relief',
    kicker: 'Game lines · in relief',
    title: (name) => `${name}, in relief`,
    facet: { kind: 'started', value: false },
    groups: ['pitching'],
  },
]

// The doors one stat block shows. A two-way player's page draws the card once
// per block, so each asks its own group's question.
export function cardFacetsFor(group) {
  return CARD_FACETS.filter((r) => r.groups.includes(group))
}
