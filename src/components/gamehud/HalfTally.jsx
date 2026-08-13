import { revealInning } from '../../api/linescore.js'
import { revealDerived } from '../../api/derive.js'
import { SealBox } from '../SealBox.jsx'
import { Stat } from './StatBox.jsx'
import { TALLY_STAGGER_MS } from '../inning/focus/beats.js'

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
//
// THE GRID IS THE WHOLE CARD. There is no title bar: it carried a navy
// "Top 1st" masthead matching the band's own, and beside a band that already
// names the half — and directly under `.half__title`, which names it again —
// it was a third reading of the same three words, above eight cells that read
// perfectly well without it. Its removal is also what lets the card's rounded
// corners meet the outer cells (styles/focus/console.css strips the SealBox
// wrapper's padding to match), so the tally reads as one ruled block of paper
// rather than a header floating over an inset panel.
//
// THE INK-IN (ADR-0046). This card mounts fresh — `key={inning-half}` above —
// the moment the half it captions closes, which used to be marked by a
// separate hairline-and-four-figures display drawn under the at-bat card
// (HalfClose.jsx/HalfCloseRule.jsx). That display was retired for THIS one:
// the punctuation now lands directly on the numbers the reader is going to
// read anyway, rather than a second, smaller printing of four of them a beat
// earlier in a different spot. `phase` is `useFocusMode`'s `closePhase`,
// handed down through ConsoleBand exactly as it was handed to HalfClose —
// 'running' for the ~700ms right after the half commits, 'done' (or under
// reduced motion, immediately) once the reader is expected to be reading the
// card rather than watching it arrive. `--tally-i` is each cell's place in
// the grid, read by `.statline--closing` in styles/focus/console.css so the
// eight delays live in one number (beats.js's TALLY_STAGGER_MS) rather than
// eight typed separately.
export function HalfTally({ feed, inning, half, battingSide, getDerived, phase = 'done', className = '' }) {
  const closing = phase === 'running'
  return (
    <div className={`halftally ${className}`.trim()} key={`${inning}-${half}`}>
      <SealBox forceRevealed coverless>
        {() => {
          // R/H/LOB are the batting side's; E is a FIELDING stat and belongs to
          // the side in the field this half (ADR-0006). Same reads, same
          // meanings, as StatBox's full card.
          const line = revealInning(feed, inning, battingSide)
          const fieldLine = revealInning(feed, inning, battingSide === 'away' ? 'home' : 'away')
          const d = revealDerived(getDerived(), inning, half)
          return (
            <div
              className={`statline statline--console${closing ? ' statline--closing' : ''}`}
              style={closing ? { '--tally-step': `${TALLY_STAGGER_MS}ms` } : undefined}
            >
              <Stat k="R" v={line?.runs ?? 0} tone="run" style={{ '--tally-i': 0 }} />
              <Stat k="H" v={line?.hits ?? 0} style={{ '--tally-i': 1 }} />
              <Stat k="E" v={fieldLine?.errors ?? 0} style={{ '--tally-i': 2 }} />
              <Stat k="LOB" v={line?.leftOnBase ?? 0} style={{ '--tally-i': 3 }} />
              <Stat k="Pitches" v={d.pitches} style={{ '--tally-i': 4 }} />
              <Stat k="Whiffs" v={d.whiffs} style={{ '--tally-i': 5 }} />
              <Stat k="Fouls" v={d.fouls} style={{ '--tally-i': 6 }} />
              <Stat
                k="1st-pitch strikes"
                v={`${d.firstPitchStrikes}/${d.plateAppearances}`}
                style={{ '--tally-i': 7 }}
              />
            </div>
          )
        }}
      </SealBox>
    </div>
  )
}
