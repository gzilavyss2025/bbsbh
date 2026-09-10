import { staticJson } from './staticJson.js'

// COMMAND RECEIVED — the pitchers who threw to a catcher this season, ranked by
// how close they finished to his target while he was the one holding it.
//
// THE FIGURE IS NOT A CATCHER STAT, AND THE CARD SAYS SO. What it measures is
// each PITCHER's command, split by who was behind the plate. A catcher's
// target-setting is somewhere in there, and so is framing, and game-calling, and
// which arms his manager pairs him with — none of which this can separate. So
// the card is descriptive, and its footer says that in as many words rather than
// leaving a reader to infer a skill from a ranking. That footer is required
// copy, not flavour.
//
// WHERE THE CATCHER COMES FROM. Not from OpenCommand — that dataset carries no
// catcher identity anywhere, because its method detects an anonymous glove and
// was never told whose it was. The catcher is bbsbh's own join, replayed out of
// each game's defensive substitutions (api/catcherOfRecord.js) in the nightly
// precompute (scripts/gen-command-received.mjs).
//
// SPOILER FOOTING — spoiler-FREE, no SealBox. A season median distance per
// pitcher, over games already final: no line, no running score, no per-game
// granularity. The substitution replay that BUILT it is spoiler-adjacent and
// stays caller-gated where it lives (catcherOfRecord.js); what survives into
// this file is an aggregate with the timing washed out of it. Same footing as
// targetCommand.js beside it on the player page, an open surface (ADR-0034).
//
// OpenCommand data, CC BY-NC-SA 4.0 — the card carries the credit line.
export const fetchCommandReceived = staticJson('/data/command-received.json', {
  fallback: { season: null, catchers: {}, names: {} },
})

// One catcher's ranked list, or null when he isn't in the file: a player who
// never caught, a season outside OpenCommand's coverage, or a catcher with no
// pitcher over the pitch floor. Null renders nothing.
export function commandReceivedFor(data, personId, season) {
  // One season per file, gated the same way targetCommandFor gates its own —
  // last year's battery shown under this year's heading is worse than no card.
  if (season != null && data?.season != null && Number(season) !== Number(data.season)) return null
  const entry = data?.catchers?.[personId]
  if (!entry?.pitchers?.length) return null

  const names = data.names ?? {}
  return {
    // His whole season behind the plate — the line the rows are read against.
    // Counted off the same pitches the rows came from, including the arms too
    // thin to earn a row of their own, so it is his season and not the sum of
    // what happens to be listed.
    pitches: entry.n,
    miss: entry.miss,
    pitchers: entry.pitchers.map(([id, n, miss], i) => ({
      rank: i + 1,
      id,
      // An id with no name is still a real row — the count and the figure are
      // the reading. Falling back to the id keeps it honest rather than blank.
      name: names[id] || `#${id}`,
      pitches: n,
      miss,
      // Where he sits against the catcher's own season, so a reader can see at a
      // glance which arms were sharper than the rest of the staff and which
      // were not. Not a league rank: that is the pitcher's own card's job
      // (api/targetCommand.js), and printing one here would invite reading this
      // list as a ranking of pitchers rather than of one catcher's battery.
      better: miss < entry.miss,
    })),
  }
}

// The footer the card must print. Here, not in the component, for the reason the
// header gives: it is a term of the reading, and a string a component owns is a
// string a redesign can quietly drop.
export const CAUSATION_NOTE =
  'This is each pitcher’s own command, split by who was catching. ' +
  'A pitcher’s own aim moves it far more than his catcher does.'
