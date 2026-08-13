import { RULE_DRAW_MS, TALLY_STAGGER_MS } from './beats.js'

// THE RULE — focus mode's punctuation for a half that has just closed
// (ADR-0046). A hairline draws itself left to right across the stage, and the
// half's four figures ink in behind it, one at a time, in mono.
//
// This is the PRESENTATIONAL half, split out from HalfClose.jsx for two
// reasons. It imports nothing score-shaped, so /animation-lab can catalogue
// the animation with made-up figures without pulling `linescore.js` (a
// reveal-only module, ADR-0001) into an unlisted QA page. And it keeps the
// component that DOES read the line down to the SealBox wrapper and four
// values, which is the shape ADR-0001 wants that read to have.
//
// `phase` is 'running' only for the ~700ms after the half commits, then
// 'done' — and 'done' is where the sequence starts under reduced motion, so a
// reader who asked for less motion gets the finished rule with the figures
// already in, never a slower version of the same performance. Everything the
// stylesheet needs to time itself arrives here as inline custom properties
// read straight off beats.js, so the numbers have one home and are tunable in
// one place (see that file's TUNING note).
//
// WHY THE FIGURES ARE R / H / E / LOB AND STOP THERE: this is the line a
// scorer writes into the four boxes at the end of a row on paper, which is the
// act the rule is punctuating. The half's pitch analysis — pitches, whiffs,
// fouls, first-pitch strikes — belongs to the console band's own tally card
// (HalfTally.jsx), which is a different question asked at the same moment.
export function HalfCloseRule({ figures, doubleRule = false, phase = 'done' }) {
  const style = {
    '--close-draw': `${RULE_DRAW_MS}ms`,
    '--close-step': `${TALLY_STAGGER_MS}ms`,
  }
  const classes = [
    'halfclose',
    doubleRule ? 'halfclose--double' : '',
    phase === 'running' ? 'halfclose--running' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} style={style}>
      {/* Decorative: the figures below say everything this line says, and a
          rule read aloud as an empty element is noise. */}
      <span className="halfclose__rule" aria-hidden="true" />
      <dl className="halfclose__line">
        {figures.map((fig, i) => (
          // `--close-i` is this figure's place in the stagger. The delay is
          // computed in CSS from it rather than typed per figure, so the four
          // can never disagree about the interval.
          <div className="halfclose__fig" key={fig.k} style={{ '--close-i': i }}>
            <dt className="halfclose__k">{fig.k}</dt>
            <dd className="halfclose__v">{fig.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
