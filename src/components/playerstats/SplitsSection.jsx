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
//
// The column that then folds away below 740px is OPS, not HR. OPS is literally
// OBP + SLG, both of which are printed one column to its left and are rounded so
// that they add up (see `overallSide`) — so it is the one figure on the row a
// reader can reconstruct from the row itself. Home runs are not derivable from
// anything here (SLG cannot tell 30 doubles from 15 homers) and this is an app
// for people keeping score by hand, where the home run is the most-recorded
// event there is. Hiding it was the wrong trade.
// ---------------------------------------------------------------------------

// Index into `splitHead`'s columns: OPS. Kept next to the head it indexes so the
// two cannot drift apart silently.
const NARROW_HIDE = [3]

// K%, not SO%, for the strikeout rate. The Analytics section further up THIS
// SAME PAGE (api/person/advanced.js) already labels it K%, and Recent form's
// counting line says K too — one player page should not name one rate three
// ways. K% is also the form a baseball reader meets everywhere else.
function splitHead(group) {
  return ['Split', group === 'pitching' ? 'BF' : 'PA', 'AVG/OBP/SLG', 'OPS', 'HR', 'K%', 'BB%']
}

function splitCells(side) {
  return [side.count, side.slash, side.ops, side.hr, side.soPct, side.bbPct]
}

// The reference line, as the FIRST body row rather than a table footer.
//
// It began life in the tfoot, which was wrong for the situational table in a way
// that took a review to see: a bold, tinted, rule-separated footer row makes
// exactly one claim — "this is the total of the column above" — and the
// situational rows do not sum to it. They read 170, 144, 90, 106, 94, 190
// against a reference of 314, because only bases-empty + runners-on may join
// the sum (the count rows overlap each other, RISP is inside runners-on). At
// the top of the table it is plainly a baseline you read BEFORE the comparisons
// rather than an arithmetic claim about them, which is also the better reading
// order for a reference in any case. "Season", not "All", for the same reason:
// "all" means all the rows here, and it isn't.
function referenceRow(all) {
  return all ? { key: 'all', className: 'ledger__ref', cells: ['Season', ...splitCells(all)] } : null
}

// The situational rows with a spanning label above each family. `family` comes
// off the view (api/person/stats.js); the label rows are inserted here because
// they are presentation, not data — nothing but this table needs them.
const SITUATIONAL_FAMILY = { base: 'Base state', count: 'Count' }

function situationalRows(rows, reference) {
  const out = reference ? [reference] : []
  let family = null
  for (const r of rows ?? []) {
    if (r.family !== family) {
      family = r.family
      const label = SITUATIONAL_FAMILY[family]
      if (label) {
        out.push({ key: `fam-${family}`, className: 'ledger__family', cells: [spanCell(label)] })
      }
    }
    out.push({
      key: r.code,
      className: r.sub ? 'ledger__nested' : undefined,
      cells: [r.label, ...splitCells(r.side)],
    })
  }
  return out
}

export function hasSplits(block, vsTeam) {
  return Boolean(block.splits || block.situational || (vsTeam && block.group === vsTeam.group))
}

export function SplitsSection({ block, vsTeam, season, asOf, personId, playerSurname }) {
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
              referenceRow(block.splits.all),
              ...[
                { key: 'l', label: block.group === 'pitching' ? 'vs LHB' : 'vs LHP', side: block.splits.left },
                { key: 'r', label: block.group === 'pitching' ? 'vs RHB' : 'vs RHP', side: block.splits.right },
              ].map(({ key, label, side }) => ({ key, cells: [label, ...splitCells(side)] })),
            ].filter(Boolean)}
          />
        </div>
      )}

      {/* Situational splits — where the runners are, then who owns the count.
          Same columns as the handedness ledger above so the two read as one
          family, but the two situational FAMILIES are ruled apart by a spanning
          label row: run flat, they invited a reader to compare "RISP" against
          "Two strikes" as if those were alternatives, when in fact they overlap
          freely. The overall row is summed from bases-empty + runners-on only —
          the count rows overlap each other, and RISP is a subset of runners-on.
          That last containment is drawn, not narrated: RISP is INDENTED under
          Runners on. The card used to carry a two-line caps footnote spelling
          the overlaps out, which on this page renders in all-caps chrome type
          (26-player-page.css) — the worst possible setting for the one sentence
          a reader was meant to actually read. A family rule and an indent say
          it in the table's own grammar. */}
      {block.situational && (
        <>
          <SectionTitle title="Situational" note="full season" />
          <Ledger
            leftCols={1}
            head={splitHead(block.group)}
            hideNarrow={NARROW_HIDE}
            rows={situationalRows(block.situational.rows, referenceRow(block.situational.all))}
          />
        </>
      )}

      {/* Career splits vs the club this player's team is next facing (a
          finger-scrollable strip picks a different opponent). Rendered in the
          primary stat block only, per the card's spec — and the ONLY card in
          this section on a career scope, which is why its own heading says so.
          `personId` and `playerSurname` pass straight through: the card's line
          is a door into the game lines behind it (ADR-0069), and the sheet
          needs to know whose games to ask for and whose name to wear. */}
      {vsTeam && block.group === vsTeam.group && (
        <SplitsVsTeam
          vsTeam={vsTeam}
          season={season}
          asOf={asOf}
          personId={personId}
          playerSurname={playerSurname}
        />
      )}
    </>
  )
}
