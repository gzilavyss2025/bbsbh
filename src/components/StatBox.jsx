import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { SealBox } from './SealBox.jsx'

// The R/H/E/LOB + pitch-stat summary card for the half being viewed, in row 2
// beside the win-probability chart — its own coverless seal driven by the same
// reveal flag as the rest of the half (nothing computed until revealed — the
// spoiler guard is unchanged). Before reveal, `placeholder` swaps in a sealed
// hint card rather than an empty slot.
export function StatBox({ feed, inning, half, battingSide, getDerived, revealed, className = '', placeholder = false }) {
  if (!revealed && placeholder) {
    return (
      <div className={`statbox statbox--sealed ${className}`} aria-hidden="true">
        <span className="statbox__hint">Totals seal until you reveal this half</span>
      </div>
    )
  }
  return (
    <div className={`statbox ${className}`} key={`${inning}-${half}`}>
      <SealBox forceRevealed={revealed} coverless>
        {() => {
          // R/H/LOB are the batting side's; E is a *fielding* stat, so it
          // belongs to the side in the field this half (ADR-0006). Same read as
          // the pre-split seal.
          const line = revealInning(feed, inning, battingSide)
          const fieldLine = revealInning(feed, inning, battingSide === 'away' ? 'home' : 'away')
          const d = revealDerived(getDerived(), inning, half)
          const rolling = rollingPitches(getDerived(), inning, half)
          return (
            <>
              <div className="rhe">
                <Stat k="R" v={line?.runs ?? 0} tone="run" big />
                <Stat k="H" v={line?.hits ?? 0} big />
                <Stat k="E" v={fieldLine?.errors ?? 0} big />
                <Stat k="LOB" v={line?.leftOnBase ?? 0} big />
              </div>
              <div className="pitchgrid">
                <Stat k="Pitches" v={d.pitches} />
                <Stat k="Total pitches" v={rolling} unit="rolling" />
                <Stat k="Whiffs" v={d.whiffs} />
                <Stat
                  k="1st-pitch strikes"
                  v={`${d.firstPitchStrikes}/${d.plateAppearances}`}
                  small
                />
              </div>
            </>
          )
        }}
      </SealBox>
    </div>
  )
}

function Stat({ k, v, unit, tone, big, small }) {
  return (
    <div
      className={`stat ${big ? 'stat--big' : ''} ${small ? 'stat--small' : ''} ${
        tone ? `stat--${tone}` : ''
      }`}
    >
      <span className="stat__v">{v}</span>
      <span className="stat__k">
        {k}
        {unit ? <em className="stat__unit"> {unit}</em> : null}
      </span>
    </div>
  )
}
