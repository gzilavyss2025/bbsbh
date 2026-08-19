// The view model behind the printable pre-pitch scorecard (`/{date}/{matchup}/sheet`)
// — everything that sheet prints, and deliberately nothing else.
//
// SPOILER FOOTING, and it is the whole design. This module imports `api/select.js`
// and NOTHING else out of the data layer. `select.js` is the spoiler-FREE selector
// module (`api/spoiler-manifest.json` classifies it so), and the four selectors
// below are the exact ones the two lineup pages already call at their own render
// top level today — see `screens/TeamInfo.jsx`, which reads `selectTeamMeta`,
// `selectOfficials`, `selectGameInfo` and `selectLineup` the same way. Printing
// them onto paper is not a new disclosure; it is the same staging information in
// a different shape.
//
// `api/linescore.js` and `api/derive.js` — the reveal-only pair — are not imported
// here and must never be. That negative is enforced rather than promised: both
// carry an `importers` allowlist in the manifest, and
// `scripts/check-spoiler-manifest.mjs` (run by `npm run lint`) fails the moment a
// file that isn't on it reaches for one. `api/scorecardGame.js` is off limits too,
// for a subtler reason: it is classed `reveal-gated`, and every one of its
// builders clamps on a `through` half-index rather than sealing. That is the
// right shape for the scorecard PAGE, which inks what you have revealed and
// stops. It is the wrong shape for a printable sheet, which has no reveal state
// to clamp against and must be blank by construction.
//
// This model must also never grow a "fill in what has happened so far" mode. The
// empty at-bat grid IS the product: Tally shows you the game, you keep the score
// by hand. The inked grid already exists, in `api/scorecardGame.js`'s
// `scorecardPlays` — reached by the scorecard page under its reveal clamp, and
// by the DEV-only Scorecard Lab in full. Leave it there.
//
// MiLB degrades the way everything else does: every field falls back to `''` and
// every unposted lineup slot becomes a blank write-in row, so a AA feed with no
// batting order, no crew and no weather prints a usable blank sheet rather than a
// page of em dashes.

import {
  selectGameInfo,
  selectLineup,
  selectOfficials,
  selectTeamMeta,
} from '../../api/select.js'
import { scorebookDate } from '../../lib/dates.js'

// Columns of at-bat boxes on the printed grid. Nine regulation innings plus two
// spare columns, which is what the paper #22 sheet gives you and enough extras
// for all but a marathon; a longer game runs onto the scorer's own second sheet,
// same as it always has.
export const SHEET_INNINGS = 11

// Batting-order slots. Always nine rows, posted or not — the shape of the sheet
// is fixed, and an unposted slot is a line you write on.
export const SHEET_SLOTS = 9

// The crew positions the sheet always draws a line for. A regular-season game is
// worked by four; a MiLB game is often two or three and the missing bases simply
// aren't in the feed, so they print blank rather than vanishing (the sheet has to
// have somewhere to write the name the PA announces). `selectOfficials` can also
// return LF/RF for a six-man postseason crew — those are appended after these
// four rather than replacing them.
const STANDARD_CREW = ['HP', '1B', '2B', '3B']

// The four standard slots, each filled from the feed where the feed has it, then
// any extra role the feed carries (LF/RF on a six-man crew) appended in the order
// `selectOfficials` returns them.
function crewLines(feed) {
  const posted = selectOfficials(feed)
  const byRole = {}
  for (const o of posted) byRole[o.role] = o.name ?? ''

  const lines = STANDARD_CREW.map((role) => ({ role, name: byRole[role] ?? '' }))
  for (const o of posted) {
    if (!STANDARD_CREW.includes(o.role)) lines.push({ role: o.role, name: o.name ?? '' })
  }
  return lines
}

// One club's nine batting rows, padded out so the grid is always nine tall. A
// posted slot carries the jersey number and the STARTING fielding position
// (`selectLineup` reads each player's own `battingOrder` and `allPositions[0]`
// rather than the live array, so a pinch-hitter late in a game can't turn this
// into a row of PHs — see that selector's header).
function battingRows(feed, side) {
  const posted = selectLineup(feed, side)
  return Array.from({ length: SHEET_SLOTS }, (_, i) => {
    const row = posted[i]
    return {
      order: i + 1,
      jersey: row?.jersey ?? '',
      position: row?.position ?? '',
      name: row?.nameLastFirst ?? '',
    }
  })
}

// A probable starter, flattened to what the sheet prints. Null when the club
// hasn't announced one (or when the feed never carries probables, as MiLB's
// often doesn't) — the caller draws a blank line instead.
function starterLine(meta) {
  const p = meta.probablePitcher
  if (!p?.name) return null
  return { name: p.nameLastFirst || p.name, jersey: p.jersey ?? '', hand: p.hand ?? '' }
}

// One half of the sheet: the club that bats, its manager and order, and the arm
// it faces. `facing` is the OPPOSING probable — the pitcher whose name goes at the
// head of this grid's pitching line, exactly as a paper scorecard pairs them.
function clubBlock(feed, side, managers) {
  const meta = selectTeamMeta(feed, side)
  const oppMeta = selectTeamMeta(feed, side === 'away' ? 'home' : 'away')
  const mgr = managers?.[side]
  return {
    side,
    label: side === 'away' ? 'Visitors' : 'Home',
    name: meta.name || '',
    abbr: meta.abbreviation || '',
    manager: mgr ? `${mgr.lastFirst}${mgr.interim ? ' (interim)' : ''}` : '',
    starter: starterLine(meta),
    facing: starterLine(oppMeta),
    facingClub: oppMeta.teamName || oppMeta.name || '',
    lineup: battingRows(feed, side),
  }
}

// Assemble the whole sheet. `managers` is `useGameData`'s `{ away, home }` pair
// (managers aren't in the live feed — see api/game.js) and `weather` is its
// outdoor scorebook reading; both are optional and both degrade to a blank line.
// Returns null with no feed, so the page can render nothing rather than a sheet
// of empty strings that looks like a load succeeded.
export function buildSheetModel(feed, { managers = null, weather = null } = {}) {
  if (!feed) return null

  const info = selectGameInfo(feed)
  return {
    // The scheduled start until the box score posts a real first-pitch time —
    // same fallback, in the same order, as the lineup page's own First pitch
    // fact, so the two can't disagree about tonight's game.
    firstPitch: info.firstPitch || info.scheduledTime || '',
    officialDate: info.officialDate,
    date: scorebookDate(info.officialDate),
    venue: info.venue || '',
    // The outdoor reading from the park's lat/lon; the box score's own weather is
    // the closed-roof INTERIOR and is only worth printing when there's nothing
    // else, which is the same order TeamInfo's GameFacts uses.
    weather: weather?.text || info.weather || '',
    crew: crewLines(feed),
    clubs: [clubBlock(feed, 'away', managers), clubBlock(feed, 'home', managers)],
  }
}
