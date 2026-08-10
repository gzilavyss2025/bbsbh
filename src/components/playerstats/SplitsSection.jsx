import { Ledger } from '../player/Ledger.jsx'
import { SectionTitle } from '../ui/SectionTitle.jsx'
import { SplitsVsTeam } from './SplitsVsTeam.jsx'
import { spanCell } from '../../lib/ledger.js'

// SPLITS — the player page's third top-level section: the vs-L/R breakdown, the
// situational tables, and career splits vs the club he is next facing. The
// three used to be stacked cards under one bar heading, which let three things
// go wrong that this component now holds fixed:
//
// 1. EVERY sub-card names its own time scope. The first two are full-season;
//    the third is CAREER. They look alike enough that an unlabelled career line
//    reads as a season one, and a career line is the one most likely to be
//    quoted at a game.
// 2. Every split table foots an OVERALL row. A split is meaningless except as a
//    difference from the player's own line — "he hits .240 vs lefties" says
//    nothing until you know what he hits against everyone — and that reference
//    is summed from the very rows above it (`overallSide`, api/person/stats.js)
//    so it always shares their scope exactly. Taking it from the season tile
//    instead would let a promoted big leaguer's MLB line foot a MiLB split set.
// 3. The first sub-card is titled like the other two. It used to sit bare under
//    "Splits", which made the two headed cards below it look like the only
//    named things in the section.
//
// The bar-wearing "Splits" heading itself stays with PlayerPage — that file
// owns which of the page's top-level sections wear the club bar.

// ---------------------------------------------------------------------------
// One column set, shared by both tables so they read as one family (and so the
// overall row that foots each is built by the same call).
//
// The slash column prints AVG/OBP/**SLG** and OPS stands on its own. It used to
// print OPS as the third slash field, which no reader of a slash line expects:
// the convention is slugging there, so the table quietly claimed a .703 SLG for
// a .703 OPS. OPS is also the one of the four that can exceed 1.000, which a
// leading-dot slash has no room for.
//
// RBI and XBH came out. On a phone-first page this table was eight columns wide
// and already scrolled sideways, hiding SO%/BB% — the two most stable and most
// predictive figures in it — off the right edge. XBH is what SLG already says,
// and RBI within a split mostly reports how often his team-mates were on base.
// HR then folds away below 740px (Ledger's `hideNarrow`), for the same reason
// and in the same direction: SLG already carries his power, and a table whose
// last column sits off the edge of the phone is a table with six columns and a
// secret. It comes back at the wide breakpoint.
// ---------------------------------------------------------------------------

// Index into `splitHead`'s columns: HR. Kept next to the head it indexes so the
// two cannot drift apart silently.
const NARROW_HIDE = [4]

function splitHead(group) {
  return ['Split', group === 'pitching' ? 'BF' : 'AB', 'AVG/OBP/SLG', 'OPS', 'HR', 'SO%', 'BB%']
}

function splitCells(side) {
  return [side.count, side.slash, side.ops, side.hr, side.soPct, side.bbPct]
}

function overallRow(all) {
  return all ? [{ label: 'All', cells: splitCells(all) }] : null
}

// The situational rows with a spanning label above each family. `family` comes
// off the view (api/person/stats.js); the label rows are inserted here because
// they are presentation, not data — nothing but this table needs them.
const SITUATIONAL_FAMILY = { base: 'Base state', count: 'Count' }

function situationalRows(rows) {
  const out = []
  let family = null
  for (const r of rows ?? []) {
    if (r.family !== family) {
      family = r.family
      const label = SITUATIONAL_FAMILY[family]
      if (label) {
        out.push({ key: `fam-${family}`, className: 'ledger__family', cells: [spanCell(label)] })
      }
    }
    out.push({ key: r.code, cells: [r.label, ...splitCells(r.side)] })
  }
  return out
}

export function hasSplits(block, vsTeam) {
  return Boolean(block.splits || block.situational || (vsTeam && block.group === vsTeam.group))
}

export function SplitsSection({ block, vsTeam, season, asOf }) {
  return (
    <>
      {block.splits && (
        <div className="player__seasonsplits">
          <SectionTitle title="By handedness" note="full season" />
          <Ledger
            leftCols={1}
            head={splitHead(block.group)}
            hideNarrow={NARROW_HIDE}
            rows={[
              { key: 'l', label: block.group === 'pitching' ? 'vs LHB' : 'vs LHP', side: block.splits.left },
              { key: 'r', label: block.group === 'pitching' ? 'vs RHB' : 'vs RHP', side: block.splits.right },
            ].map(({ key, label, side }) => ({ key, cells: [label, ...splitCells(side)] }))}
            totals={overallRow(block.splits.all)}
          />
        </div>
      )}

      {/* Situational splits — where the runners are, then who owns the count.
          Same columns as the handedness ledger above so the two read as one
          family, but the two situational FAMILIES are ruled apart by a spanning
          label row: run flat, they invited a reader to compare "RISP" against
          "Two strikes" as if those were alternatives, when in fact they overlap
          freely. The overall row is summed from bases-empty + runners-on only —
          the count rows overlap each other, and RISP is a subset of runners-on. */}
      {block.situational && (
        <>
          <SectionTitle title="Situational" note="full season" />
          <Ledger
            leftCols={1}
            head={splitHead(block.group)}
            hideNarrow={NARROW_HIDE}
            rows={situationalRows(block.situational.rows)}
            totals={overallRow(block.situational.all)}
          />
        </>
      )}

      {/* Career splits vs the club this player's team is next facing (a
          finger-scrollable strip picks a different opponent). Rendered in the
          primary stat block only, per the card's spec — and the ONLY card in
          this section on a career scope, which is why its own heading says so. */}
      {vsTeam && block.group === vsTeam.group && (
        <SplitsVsTeam vsTeam={vsTeam} season={season} asOf={asOf} />
      )}
    </>
  )
}
