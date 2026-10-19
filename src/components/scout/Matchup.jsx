import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Pill } from '../ui/control/Pill.jsx'

// THE PAIR (the Matchup Scout, #1408; the stamped card, #2319 V01/V22). One
// stamped card says who is facing whom: a headshot, a last name, a hand with
// the club's mark, and a 4px bar in the player's side colour (pitcher blue,
// hitter amber) for each, "vs" between. `pitcher` and `hitter` are
// { id, name, last, throws | bats, teamId }. The page passes real ids and
// clubs, so each shows his silo cutout; the Design Lab prototype's players are
// invented and carry no id, so Headshot walks straight to its monogram, with
// no photo request at all, and no club mark draws.
//
// "Change pair" reopens the pickers with the pair still filled in (Gary, item
// 13). `filters` ({ summary, onOpen }) adds the Filters row inside the card;
// the Design Lab passes none and gets no row.
export function Matchup({ pitcher, hitter, onChange, filters }) {
  return (
    <section className="scout__pair" aria-label="Matchup">
      <span className="scout__pairtab">Matchup</span>
      <div className="scout__pairrow">
        <Side role="pitcher" person={pitcher} note={handLine('Throws', pitcher.throws, pitcher)} />
        <span className="scout__vs" aria-hidden="true">vs</span>
        <Side role="hitter" person={hitter} note={handLine('Bats', hitter.bats === 'S' ? 'both' : hitter.bats, hitter)} />
      </div>
      <div className="scout__pairfoot">
        {filters && (
          <button type="button" className="scout__filters" aria-haspopup="dialog" onClick={filters.onOpen}>
            <span className="scout__filterslabel">Filters</span>
            {filters.summary}
            <span className="scout__filtersarrow" aria-hidden="true">▾</span>
          </button>
        )}
        <Pill role="control" fill="paper" className="scout__change" onClick={onChange}>Change pair</Pill>
      </div>
    </section>
  )
}

// A retired player's line adds his years and "Retired" (slice 7b).
const handLine = (verb, hand, p) => [`${verb} ${hand}`, ...(p.retired ? [p.years, 'Retired'] : [])].filter(Boolean).join(' · ')

// The phone shows the last name, the desktop the whole name (CSS swaps them).
function Side({ role, person, note }) {
  return (
    <div className="scout__side" data-role={role}>
      <Headshot personId={person.id ?? null} name={person.name} teamId={person.teamId ?? null} tint={false} className="scout__shot" />
      <div className="scout__sidetext">
        <span className="scout__name">
          <span className="scout__lastname">{person.last ?? person.name}</span>
          <span className="scout__fullname">{person.name}</span>
        </span>
        <span className="scout__hand">
          {note}
          {person.teamId != null && <TeamLogo teamId={person.teamId} size={18} />}
        </span>
        <span className="scout__sidebar" aria-hidden="true" />
      </div>
    </div>
  )
}
