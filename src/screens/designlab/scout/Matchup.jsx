import { Headshot } from '../../../components/player/Headshot.jsx'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'

// THE PAIR. The first thing on the page says who is facing whom: two house
// headshots (components/player/Headshot.jsx), a name and a hand each, "vs"
// between. The prototype's players are INVENTED, so `personId` is null on
// purpose: Headshot then walks straight to its monogram fallback, with no
// photo request and no club mark, in the dev server and in the review build
// alike. Phase 1 passes each person's real id and club, and the same markup
// shows his silo cutout on his club's tint.
//
// "Change" is the way back to the pickers. In the prototype it empties the
// pair; Phase 1 opens the search fields with the pair still filled in.
export function Matchup({ pitcher, hitter, onChange }) {
  return (
    <section className="scout__pair" aria-label="Matchup">
      <SectionHead
        as="span"
        action={<Pill role="control" fill="paper" onClick={onChange}>Change</Pill>}
      >
        Matchup
      </SectionHead>
      <div className="scout__pairrow">
        <Side name={pitcher.name} note={`Throws ${pitcher.throws}`} />
        <span className="scout__vs" aria-hidden="true">vs</span>
        <Side name={hitter.name} note={hitter.bats === 'S' ? 'Bats both' : `Bats ${hitter.bats}`} />
      </div>
    </section>
  )
}

function Side({ name, note }) {
  return (
    <div className="scout__side">
      <Headshot personId={null} name={name} className="scout__shot" />
      <span className="scout__name">{name}</span>
      <span className="scout__hand">{note}</span>
    </div>
  )
}
