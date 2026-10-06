// The "six degrees of teammates" data: every MLB team-season and who played for it,
// read from public/data/team-seasons.json (gen-team-seasons.mjs, hand-run, ADR-0100).
// History about people, with no game, score or reveal state, so an open surface
// (ADR-0034). No search logic lives here: this returns the file.
//
//   { credit: [string], throughSeason,
//     players: [mlbamId],                       // every player once, ascending
//     teamSeasons: [[key, label, [index]]] }    // index into `players`; label "Cubs 1998"
//
// Empty before the file exists or on any failure.
import { staticJson } from './staticJson.js'

export const loadTeamSeasons = staticJson('/data/team-seasons.json', {
  fallback: { credit: [], throughSeason: null, players: [], teamSeasons: [] },
})
