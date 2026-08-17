import { GameStamp } from '../../../../components/logbook/GameStamp.jsx'
import { isMlbTeamId, teamAbbr } from '../../../../lib/teams.js'

// The two preview stamps at the head of the drawer's Stamp placement group —
// the club in the away slot and the same club in the home slot, each a REAL
// GameStamp rather than a mock-up, so the four numbers under them are judged on
// the actual art with the actual mask. They read the tuning store through the
// overlay like every real stamp does, and the drawer's draft is already applied
// to the overlay's preview layer — so a keystroke in "Away nudge down" moves
// the mark on the stamp above it before anything is saved. One render path, no
// editor-only state: the same discipline the rest of this drawer keeps.
//
// SPOILER CONTAINMENT — why this file may import GameStamp (ADR-0035,
// scripts/check-stamp-surfaces.mjs). A stamp IS a final score, and a surface
// may render one only where no unrevealed game can appear. The game these two
// stamps draw is FABRICATED RIGHT HERE: a constant gamePk, a made-up ballpark,
// a fixed date, two invented run totals. It reaches no schedule, no feed, no
// collection and no route param, so there is no real game here whose score
// could leak — the same argument that admitted the dev-only
// StampPlacementEditor, minus the DEV gate: this drawer ships, so the argument
// rests entirely on the fabricated literal, never on who can see the page.
// (The admin gating is real, but it is not the safety case.)

const SIDES = ['away', 'home']
const SIDE_LABEL = { away: 'Away slot', home: 'Home slot' }
// Spelled out rather than derived from SIDE_LABEL at render time — the casing
// guard's JS half forbids a `.toLowerCase()` on rendered text (ADR-0017).
const SIDE_SLOT_PHRASE = { away: 'away slot', home: 'home slot' }

// The other half of each preview stamp. Id-less on purpose: with no team id
// there is no knockout file to mask, so GameStamp draws the bold abbreviation —
// exactly what you want opposite the mark being judged.
const OPPONENT = { abbreviation: 'OPP', runs: 3 }

// A stamp needs a game; this one is invented, and its gamePk is a constant so
// the wear filter's turbulence seed doesn't re-chew the ink on every keystroke.
// 503, not the lab editor's 502, so a page that somehow rendered both never
// collides on the per-instance SVG ids.
const PREVIEW_GAME = { gamePk: 503, date: '2026-08-02', venue: 'Preview Ballpark', innings: 9 }

export function IdentityStampPreview({ teamId, name, abbreviation }) {
  const abbr = abbreviation || teamAbbr({ id: teamId, name }) || 'CLB'
  return (
    <div className="iddrawer__stamps">
      {SIDES.map((side) => {
        const club = { id: teamId, abbreviation: abbr, runs: 4 }
        // The club's own level rides in, so a MiLB affiliate's mark is judged
        // inside the inverted ring band its stamps actually print in
        // (stampArt.js's stampRingInverted).
        const game = {
          ...PREVIEW_GAME,
          sportId: isMlbTeamId(teamId) ? 1 : 11,
          away: side === 'away' ? club : OPPONENT,
          home: side === 'home' ? club : OPPONENT,
        }
        return (
          <figure key={side} className="iddrawer__stamp">
            <GameStamp
              game={game}
              instanceId={`iddrawer-${teamId}-${side}`}
              title={`${name ?? 'This club'} in a stamp's ${SIDE_SLOT_PHRASE[side]}`}
            />
            <figcaption className="iddrawer__stampcap">{SIDE_LABEL[side]}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}
