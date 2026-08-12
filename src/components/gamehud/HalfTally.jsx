import { revealInning } from '../../api/linescore.js'
import { revealDerived } from '../../api/derive.js'
import { ordinal } from '../../lib/format.js'
import { SealBox } from '../SealBox.jsx'
import { Stat } from './StatBox.jsx'

// The finished half's tally, for focus mode's console band (ADR-0043,
// ConsoleBand.jsx). What a scorer writes down when a half CLOSES — the half's
// own line, then how the pitching got there.
//
// It exists because focus mode folds `.innings__row2` away (styles/focus/
// stage.css), so the one moment those numbers are wanted was the one moment
// they were hidden. This is deliberately NOT that whole card: no ABS
// challenges, no Statcast superlative cards, and none of the game-wide rolling
// totals — a band captioning ONE half must not carry the game's numbers. All
// of those stay in Summary, one tap away.
//
// It also gave the console row something real to hold once the half is over.
// `.gamehud--console:only-child` used to stretch the scorebug across the whole
// row whenever nothing sat beside it, which at 1280 drew a ~930px navy slab
// holding two 24px club marks — in the state the reader lands in after EVERY
// half. That rule is retired; this card spends the width instead.
//
// SPOILER FOOTING. `revealInning` and `revealDerived` are the two original
// reveal-only modules (ADR-0001): callable only from inside a SealBox's reveal
// render function, never at render top level. That is exactly the shape below,
// and it is the same one StatBox.jsx uses for the same two reads. The caller
// mounts this only for a half at or under the reveal mark, so `forceRevealed`
// is a statement of that fact rather than a bypass of it — identical to
// StatBox's own `revealed` prop. `api/spoiler-manifest.json` lists this file on
// both modules' importer allowlists.
//
// `Stat` comes from StatBox rather than being redrawn here: these cells are the
// same cells, and `.statline`'s grid (12-sealbox.css) is already the right
// shape for eight of them.
export function HalfTally({ feed, inning, half, battingSide, getDerived, className = '' }) {
  return (
    <div className={`halftally ${className}`.trim()} key={`${inning}-${half}`}>
      {/* Named for the half, not "Insights" — two rows of numbers beside a
          scorebug that shows the GAME's runs must say which they are. It keeps
          `.statbox__title`'s navy-under-a-kraft-rule masthead, the same
          signature the band beside it and `.half__title` below it wear. */}
      <h3 className="statbox__title">
        {half === 'top' ? 'Top' : 'Bottom'} {ordinal(inning)}
      </h3>
      <SealBox forceRevealed coverless>
        {() => {
          // R/H/LOB are the batting side's; E is a FIELDING stat and belongs to
          // the side in the field this half (ADR-0006). Same reads, same
          // meanings, as StatBox's full card.
          const line = revealInning(feed, inning, battingSide)
          const fieldLine = revealInning(feed, inning, battingSide === 'away' ? 'home' : 'away')
          const d = revealDerived(getDerived(), inning, half)
          return (
            <div className="statline statline--console">
              <Stat k="R" v={line?.runs ?? 0} tone="run" />
              <Stat k="H" v={line?.hits ?? 0} />
              <Stat k="E" v={fieldLine?.errors ?? 0} />
              <Stat k="LOB" v={line?.leftOnBase ?? 0} />
              <Stat k="Pitches" v={d.pitches} />
              <Stat k="Whiffs" v={d.whiffs} />
              <Stat k="Fouls" v={d.fouls} />
              <Stat k="1st-pitch strikes" v={`${d.firstPitchStrikes}/${d.plateAppearances}`} />
            </div>
          )
        }}
      </SealBox>
    </div>
  )
}
