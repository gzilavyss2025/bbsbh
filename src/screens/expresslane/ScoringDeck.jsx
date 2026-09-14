import { AtBatBox } from '../../components/scoring/AtBatBox.jsx'

// THE SCORING DECK — the middle band of Concept A's Split Deck, and the half
// of Express Lane that is about paper rather than video.
//
// WHY IT IS NOT ONE BOX. A scorer does not write a stolen base on the batter's
// box. He writes it on the RUNNER's box — the box of the plate appearance in
// which that runner reached — which on the #22 sheet is a row further up. Same
// for a wild pitch, a balk, a passed ball, and every hit that moves a man who
// was already on. So a surface showing only the man at the plate is unusable
// for exactly the plays Express Lane exists to catch: the scorer would watch a
// steal, look at the screen, and find no diamond to mark it on.
//
// So the deck draws the batter's box AND the box of every man standing on
// base, each one a real `AtBatBox` — the same component the #22 sheet draws,
// not a summary of it — so what is on the screen is what goes on the paper.
//
// THE RUNNERS' DIAMONDS ARE TRUE AS OF THE CURSOR, NEVER PAST IT. That is
// api/expresslane/runners.js's job, through computeHalfInningFeed's `stepCap`,
// and it is the whole reason this deck can exist at all: built off the
// finished half instead, a man who reached first in the third would show a
// fully shaded diamond the moment his own at-bat was revealed, telling the
// scorer the run came home before he had scored the play that drove it in.
//
// ORDER: third base first, then second, then first, then the batter's own box
// beneath them. Two reasons, and they agree. It is the order the men will
// score in, so the eye reads the deck the way the inning will happen. And it
// puts the batter's box at the bottom, nearest the thumb and nearest the
// primary action, where the box being written in most often belongs.

const BASE_LABEL = { 1: 'on first', 2: 'on second', 3: 'on third' }

// One man on base: his name, the base he stands on, and his own box.
function RunnerBox({ base, card }) {
  const name = card.batter?.last ?? card.runner?.last ?? ''
  return (
    <li className="xl-deck__runner">
      <p className="xl-deck__runnerhead">
        <span className="xl-deck__runnername">{name}</span>
        <span className="xl-deck__base">{BASE_LABEL[base] ?? ''}</span>
      </p>
      <div className="xl-deck__paper">
        <AtBatBox atbat={card} />
      </div>
    </li>
  )
}

export function ScoringDeck({
  batter,
  pending = null,
  runners = [],
  waiting = false,
  // THE PLAY IS HELD: its film is on the screen and none of it is written yet.
  // The deck above is already the pre-pitch one — the hook caps it short of
  // this plate appearance — so all this flag adds is the line that says why the
  // box is empty. See lib/expresslane/hold.js.
  held = false,
  // The play's own play-by-play sentence, which the hook empties while the play
  // is held. Not rendered and then covered: it is not in the DOM until the
  // scorer has watched the play (ADR-0001).
  story = '',
  onExpand = null,
}) {
  if (!batter && !pending && !runners.length) {
    return (
      <section className="xl-deck xl-deck--empty">
        <p className="xl-deck__empty">Nothing written yet.</p>
      </section>
    )
  }

  // Two states, and the difference is whether the cursor's row FINISHED a plate
  // appearance. On a terminal row there is a play to write, so the main box is
  // that play's. On a row inside a plate appearance still going, there is no
  // play yet — the main box is the empty one the scorer is about to write in,
  // which is exactly what the paper looks like at that moment.
  const who = batter?.batter ?? batter?.runner ?? pending ?? {}
  const name = who.last ?? ''
  const first = who.first ?? ''

  return (
    <section className="xl-deck" aria-label="Scoring deck">
      {runners.length > 0 && (
        <>
          {/* Two words, because the boxes under them are the whole
              explanation: these are the plate appearances those men reached
              on, which is where a steal or an advance gets written. A label
              that spelled the instruction out as well was teaching the
              paper's own rule to someone already holding the paper. */}
          <h2 className="xl-deck__label">On base</h2>
          <ul className="xl-deck__runners">
            {/* Keyed on the card's own identity rather than on a plate-
                appearance number: the extra-innings automatic runner never
                took one, so `card.atBatIndex` is undefined for him and every
                placement in a game would share that key. */}
            {runners.map(({ base, card }) => (
              <RunnerBox
                key={card.kind === 'placed' ? `placed:${card.runnerId}` : `pa:${card.atBatIndex}`}
                base={base}
                card={card}
              />
            ))}
          </ul>
        </>
      )}

      <div className="xl-deck__batter">
        <p className="xl-deck__batterhead">
          <span className="xl-deck__battername">
            {first ? `${first} ` : ''}
            {name}
          </span>
          {/* "this play" only when there IS one. The cursor on a terminal row
              sits on a plate appearance that is OVER and is being written down;
              mid-plate-appearance the box is still empty, and calling that
              "this play" would point the scorer at a pitch he has not reached. */}
          <span className="xl-deck__atbat">{batter ? 'this play' : 'at bat'}</span>
        </p>
        {/* The batter's box is the deck's main box, drawn large. `onExpand`
            opens this plate appearance's own pitches — a plate appearance the
            scorer has ALREADY reached, never one ahead of the cursor, so the
            expand cannot become a second door around the film gate. */}
        <div className="xl-deck__box">
          <div className="xl-deck__paper">
            {/* `atbat={null}` is AtBatBox's own empty template — every zone
                blank. Not a loading state and not an error: it is the box as
                the paper has it before the play happens. */}
            <AtBatBox atbat={batter} onEdit={batter ? onExpand : null} />
          </div>
        </div>

        {/* One line under the box, and which one is the whole of the hold on
            this band. Held: why the box is empty and how to fill it. Written:
            the play's own sentence, which is the thing that settles a play the
            picture leaves ambiguous — who covered the bag, which runner the
            throw went after. Never both, and never the sentence early. */}
        {held ? (
          <p className="xl-deck__hold">
            Watch it, then show the play.
            <span className="xl-deck__holdkey"> Press space.</span>
          </p>
        ) : story ? (
          <p className="xl-deck__story">{story}</p>
        ) : null}
      </div>

      {/* While the next clip is still coming, the deck may show only what was
          already true BEFORE the advance. It does that by simply not changing:
          this line says the screen is holding, and nothing about the play. */}
      {waiting && (
        <p className="xl-deck__holding" role="status">
          Holding for the film.
        </p>
      )}
    </section>
  )
}
