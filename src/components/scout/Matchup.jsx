import { Headshot } from '../player/Headshot.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Stack } from '../ui/layout/Stack.jsx'

// THE PAIR (the Matchup Scout, #1408). The first thing on the page says who
// is facing whom: two house headshots, a name and a hand each, "vs" between.
// `pitcher` and `hitter` are { id, name, throws | bats, teamId }. The page
// passes real ids and clubs, so each shows his silo cutout on his club's
// tint. The Design Lab prototype's players are invented and carry no id, so
// Headshot walks straight to its monogram, with no photo request at all.
//
// "Change" reopens the pickers with the pair still filled in (Gary, item 13).
export function Matchup({ pitcher, hitter, onChange }) {
  return (
    <Stack gap="snug" as="section" className="scout__pair" aria-label="Matchup">
      <SectionHead
        as="span"
        action={<Pill role="control" fill="paper" onClick={onChange}>Change</Pill>}
      >
        Matchup
      </SectionHead>
      <div className="scout__pairrow">
        <Side person={pitcher} note={handLine('Throws', pitcher.throws, pitcher)} />
        <span className="scout__vs" aria-hidden="true">vs</span>
        <Side person={hitter} note={handLine('Bats', hitter.bats === 'S' ? 'both' : hitter.bats, hitter)} />
      </div>
    </Stack>
  )
}

// A retired player's line adds his years and "Retired" (slice 7b).
const handLine = (verb, hand, p) => [`${verb} ${hand}`, ...(p.retired ? [p.years, 'Retired'] : [])].filter(Boolean).join(' · ')

function Side({ person, note }) {
  return (
    <Stack gap="tight" className="scout__side">
      <Headshot personId={person.id ?? null} name={person.name} teamId={person.teamId ?? null} className="scout__shot" />
      <span className="scout__name">{person.name}</span>
      <span className="scout__hand">{note}</span>
    </Stack>
  )
}
