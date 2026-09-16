import { ROLE_IN_PROSE } from '../../../api/around-the-game/absChallenges.js'
import { clubName, clubShort } from '../../../api/around-the-game/clubs.js'
import { humanDateWithYear } from '../../../lib/dates.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../../components/around-the-game/StatSlab.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { UmpireLink } from '../../../components/umpire/UmpireLink.jsx'
import { inches, num2 } from './format.js'

// THE BIGGEST OVERTURN OF THE SEASON — the single pitch that moved the most run
// expectancy when the call came off the board.
//
// SPOILER-FREE, and it is the section on the page closest to the line: it names
// a club, an opponent, a date and an inning. None of those is a score, and the
// run figure is expectancy MOVED by one pitch, not runs that scored, so the
// game's result cannot be read back out of it.

export function BiggestOverturn({ summary, clubs }) {
  const big = summary?.biggest ?? null
  if (!big) return null

  return (
    <BroadcastSection title="The biggest overturn of the season">
      <SlabRow>
        <Slab
          tone="lead"
          value={num2(big.runs)}
          label="Runs on one pitch"
          note={`${inches(big.missInches)} off the edge`}
        />
        <Slab
          value={`${big.half === 'top' ? 'Top' : 'Bottom'} ${big.inning}`}
          label="When"
          note={humanDateWithYear(big.date)}
        />
        <Slab
          value={clubShort(clubs, big.teamId)}
          label="Challenged"
          note={`Against ${clubName(clubs, big.oppId)}`}
        />
        <Slab
          value={big.callType === 'strike' ? 'Strike' : 'Ball'}
          label="What was called"
          note="Overturned"
        />
      </SlabRow>
      {/* The space before the comma was a stray {' '} after the player
          link, and it printed: "Iván Herrera , the catcher, asked…". */}
      <p className="hint rptprose">
        <PlayerLink id={big.playerId} name={big.playerName}>
          {big.playerName}
        </PlayerLink>
        , {ROLE_IN_PROSE[big.role] ?? 'the club'}, asked for the review, and{' '}
        {big.umpireId ? (
          <UmpireLink id={big.umpireId} name={big.umpireName}>
            {big.umpireName}
          </UmpireLink>
        ) : (
          'the plate umpire'
        )}
        ’s call did not stand.
      </p>
    </BroadcastSection>
  )
}
