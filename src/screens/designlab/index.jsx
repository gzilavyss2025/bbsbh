import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { Band } from './Entry.jsx'
import { TokenHalf } from './tokens.jsx'
import { CardHalf, PillHalf } from './blocks.jsx'
import { ComponentHalf } from './components.jsx'
import { CARDS, PILLS } from './catalog.js'
import '../../styles/designlab/lab.css'

// UNLISTED CATALOG PAGE (see route.js), reachable only by direct URL
// (/design-lab). It renders the design system — every token, every shared
// component, and every card and pill block in src/styles/ — so that what
// already exists can be SEEN before the next thing is built.
//
// WHY THIS PAGE EXISTS. An agent writes nearly all the UI here. A human design
// team keeps a system coherent by looking: they open the catalog, see two
// buttons that are almost the same, and merge them. An agent greps, finds one
// plausible partial, and writes a new one beside it. The measured result was 32
// card blocks and 10 pill blocks against 12 shared components (issue #1112).
//
// THE PAGE IS NOT THE DELIVERABLE. `.scratch/design-system/inventory.md` is —
// one row per block, with the verdict issue #1113 executes. This page is how
// that document gets CHECKED: forty rows in a table are unreviewable, forty
// rendered blocks side by side are obvious in a minute. When the two disagree,
// the markdown is the one to fix first, because it is the one that has to
// survive this page being superseded.
//
// THE LAB INVENTS NO GEOMETRY. Every specimen is the real component or the real
// class. This page's own CSS (styles/designlab/lab.css) covers the frame only —
// the grid, the headings, the captions. A catalog that draws its own card has
// added a 33rd card. If an entry looks wrong here, write it down in the
// inventory; do not patch it with a lab-only override.
//
// NO LIVE GAME DATA. No feed, no gamePk, no score, no stamp art. Every prop and
// every specimen is invented, like animation-lab and between-innings-lab, so
// the page is safe to ship and safe to reach in a production build.
export function DesignLab() {
  useDocumentTitle('Design Lab')

  const sheets = CARDS.filter((c) => c.group === 'sheet').length
  const namespaces = CARDS.filter((c) => c.group === 'namespace').length
  const tones = PILLS.filter((p) => p.group === 'tone').length

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Design Lab</h1>
      </header>

      <p className="hint hint--prose">
        The design system, rendered. Every token comes from the shipped stylesheet and every
        component and block is the real one — this page copies nothing. Unlisted, and linked from
        nowhere else in the app.
      </p>

      <nav className="dlab__jump" aria-label="Design lab sections">
        <a className="dlab__jumplink" href="#tokens">Tokens</a>
        <a className="dlab__jumplink" href="#components">Components</a>
        <a className="dlab__jumplink" href="#cards">Cards</a>
        <a className="dlab__jumplink" href="#pills">Pills</a>
      </nav>

      <section className="dlab__verdictbox">
        <h2 className="dlab__bandtitle">What the catalog shows</h2>
        <p className="dlab__lede">
          {CARDS.length} card blocks and {PILLS.length} pill blocks, against 12 shared components.
          But there are not {CARDS.length} cards: <strong>{sheets} of them draw the same box</strong>,
          token for token, and <strong>{namespaces} draw no box at all</strong>. On the pill side,{' '}
          <strong>{tones} are the same pill</strong> differing in exactly three values. The team hub
          already ships the pattern that fixes this — a canonical card with a box-less class beside
          it — under a name nobody generalised.
        </p>
        <p className="dlab__lede">
          The verdicts on each entry are proposals for issue #1113, and they are Gary&rsquo;s to sign
          off. The reasoning, the consumer counts and the four open questions are in{' '}
          <code>.scratch/design-system/inventory.md</code>. The naming grammar every rename below
          follows is ADR-0084, and the 143 classes that break it are{' '}
          <code>docs/design-system-naming.md</code>.
        </p>
      </section>

      <Band
        id="tokens"
        title="One — the tokens"
        lede="604 lines across six files, layered primitive to semantic alias (ADR-0023). Read live from document.styleSheets, so this page cannot drift from what ships."
      >
        <TokenHalf />
      </Band>

      <Band
        id="components"
        title="Two — the shared components"
        lede="Everything in ui/, badges/ and the reusable half of chrome/. These are the destinations a new surface should be reaching for."
      >
        <ComponentHalf />
      </Band>

      <Band
        id="cards"
        title={`Three — the ${CARDS.length} card blocks`}
        lede="Grouped by what they actually are, not by where they live. The groups are the finding."
      >
        <CardHalf />
      </Band>

      <Band
        id="pills"
        title={`Four — the ${PILLS.length} pill blocks`}
        lede="A much simpler story than the cards, and the one to collapse first."
      >
        <PillHalf />
      </Band>
    </div>
  )
}
