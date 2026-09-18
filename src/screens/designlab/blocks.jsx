import { CARDS, GROUP_TITLES, PILLS, PILL_RECIPE, SHEET_RECIPE } from './catalog.js'
import { Entry, Group } from './Entry.jsx'

// ---------------------------------------------------------------------------
// HALF TWO OF THE DESIGN LAB: every card block and pill block, drawn with its
// REAL class name so the box on screen is the box the app ships.
//
// THE PER-ROUTE PARTIALS BELOW ARE WHY THIS PAGE TELLS THE TRUTH. Seven of the
// blocks own their base rule in a partial that src/index.css does NOT import —
// it is loaded by the one screen that needs it (see the "Per-route partials"
// list at the bottom of index.css). Without these imports those seven would
// render as unstyled <div>s on this page and read as "this block draws
// nothing", which is a real verdict in the inventory for a DIFFERENT set of
// blocks — so the page would be actively misleading about the most interesting
// finding it carries. PostseasonRacePage.jsx already imports two partials it
// does not own, for the same reason.
import '../../styles/26b-player-contract.css'
import '../../styles/26c-mound-card.css'
import '../../styles/31d-prospect-card.css'
import '../../styles/43-foul-tracker.css'
import '../../styles/47-trade-deadline.css'
import '../../styles/48-logbook.css'
import '../../styles/75-run-value.css'
import '../../styles/report/challenge-card.css'

// No stamp art anywhere on this page. `.stampcard` is the COLLECTION page's
// container, not the stamp itself: it draws a bordered sheet and nothing more.
// GameStamp.jsx, StampGameButton.jsx and useStamps are not imported here and
// must not be (ADR-0035, scripts/check-stamp-surfaces.mjs) — a stamp is a final
// score, and this page is reachable in a production build.

const sample = 'Bottom 9th, two out'

// Most card blocks are a box with content inside. One minimal child, so what
// you judge is the BOX — its border, radius, ground and shadow — and not a
// layout somebody invented for the catalog.
function CardSpecimen({ cls }) {
  return (
    <div className={cls}>
      <span className="dlab__filler">{sample}</span>
    </div>
  )
}

// A block with NO base rule draws nothing on its own. Showing it alone would
// show an unstyled box, which reads as a bug rather than as the finding. So it
// is drawn the way the app draws it: on the canonical card it actually sits on.
function NamespaceSpecimen({ cls, host }) {
  return (
    <div className={host ? `${host} ${cls}` : cls}>
      <span className="dlab__filler">{host ? `${host} + ${cls}` : `${cls} — no box of its own`}</span>
    </div>
  )
}

const HOSTS = {
  chalcard: 'thub-card',
  rvcard: 'thub-card',
  ballparkcard: 'thub-card',
  horizoncard: 'thub-card',
}

const TONE = {
  Canonical: 'canon',
  Delete: 'delete',
  Hold: 'hold',
  'Never merge': 'bespoke',
  'Stays bespoke': 'bespoke',
  'Already correct': 'canon',
  Leave: 'leave',
  'Leave — and rename': 'leave',
}
const toneFor = (verdict) => TONE[verdict] ?? (verdict.startsWith('Merge') ? 'merge' : 'leave')

function CardGroup({ group }) {
  const rows = CARDS.filter((c) => c.group === group)
  return (
    <Group title={`${GROUP_TITLES[group]} (${rows.length})`}>
      {rows.map((c) => (
        <Entry
          key={c.cls}
          title={`.${c.cls}`}
          path={`src/styles/${c.partial}`}
          consumers={c.consumers}
          verdict={c.verdict}
          tone={toneFor(c.verdict)}
          note={c.note}
        >
          {c.group === 'namespace' ? (
            <NamespaceSpecimen cls={c.cls} host={HOSTS[c.cls]} />
          ) : (
            <CardSpecimen cls={c.cls} />
          )}
        </Entry>
      ))}
    </Group>
  )
}

function PillGroup({ group }) {
  const rows = PILLS.filter((p) => p.group === group)
  return (
    <Group title={`${GROUP_TITLES[group]} (${rows.length})`}>
      {rows.map((p) => (
        <Entry
          key={p.cls}
          title={`.${p.cls}`}
          path={`src/styles/${p.partial}`}
          consumers={p.consumers}
          verdict={p.verdict}
          tone={toneFor(p.verdict)}
          note={p.fill}
        >
          <span className={p.cls}>{p.cls === 'debutpill' ? '●' : 'Rule 5.09'}</span>
        </Entry>
      ))}
    </Group>
  )
}

function Recipe({ title, lines, lede }) {
  return (
    <div className="dlab__recipe">
      <h4 className="dlab__recipetitle">{title}</h4>
      {lede && <p className="dlab__lede dlab__lede--tight">{lede}</p>}
      <ul className="dlab__recipelist">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

export function CardHalf() {
  return (
    <>
      <Recipe
        title="The sheet"
        lede="Thirteen card blocks declare this, token for token. It is the paper-scorebook card and it is already the house style — it has no name and no component, which is the only reason there are thirteen of it."
        lines={SHEET_RECIPE}
      />
      <CardGroup group="sheet" />
      <CardGroup group="dense" />
      <CardGroup group="namespace" />
      <CardGroup group="notcard" />
      <CardGroup group="bespoke" />
    </>
  )
}

export function PillHalf() {
  return (
    <>
      <Recipe
        title="The pill"
        lede="Four pill blocks declare this, identically. They differ in exactly three values — background, color and border. That is one pill with a tone, not four pills."
        lines={PILL_RECIPE}
      />
      <PillGroup group="tone" />
      <PillGroup group="interactive" />
      <PillGroup group="notpill" />
    </>
  )
}
