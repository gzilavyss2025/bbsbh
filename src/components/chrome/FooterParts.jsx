import { useRouteLink } from '../../lib/nav.js'
import { isGuidePath } from '../../lib/reportPages.js'
import { TallyBaseballMark, TallyWordmark } from './TallyBrand.jsx'
import { BuildStamp } from '../ui/BuildStamp.jsx'
import { DirectoryHeading } from './DirectoryHeading.jsx'

// The two blocks the slate's SiteFooter and every report page's ReportFooter
// both end with. They were duplicated line-for-line in those two files, which
// is how the footer stayed a flat run of nineteen links after the hamburger
// sheet was grouped (#744) — one of them would have had to be changed twice.
//
// The page LIST is still passed in rather than imported here, so both callers
// keep their own direct import from lib/reportPages.js and
// scripts/check-report-pages.mjs keeps catching a hand-rolled list in either.

// The footer's directory: the same PAGE_GROUPS the More sheet and /more render,
// laid out as columns instead of a sheet or a page. Three containers, one
// taxonomy — a reader who learned the sheet's headings reads the same six words
// here.
//
// Every row is an <a>. They were `<button onClick={navigate}>`, which swallowed
// middle-click, cmd-click and open-in-new-tab, and left the site with no
// crawlable list of its own pages at all — the sheet is a dialog and /more is
// an empty #root shell to a crawler, so this footer is the only one of the
// three a crawler can follow. See useRouteLink: a plain left-click is still a
// client-side push with no page load.
export function FooterDirectory({ groups, trail, onEverything }) {
  const linkProps = useRouteLink()

  return (
    <nav className="sitefooter__more" aria-label="More pages">
      <p className="sitefooter__more-label">More Baseball</p>

      <div className="navdir">
        {groups.map((group) => (
          <section key={group.id} className="navdir__col">
            <DirectoryHeading group={group} />
            <ul className="navdir__list">
              {group.pages.map((page) => (
                <li key={page.path}>
                  <a className="dirlink" {...linkProps(page.path)}>
                    {page.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="navdir__trail">
        {trail.map((page) => (
          <section key={page.path} className="navdir__trail-group">
            <DirectoryHeading group={page.group} />
            <a className="dirlink dirlink--trail" {...linkProps(page.path)}>
              {page.label}
              {isGuidePath(page.path) && <span className="dirtag">Guides</span>}
            </a>
          </section>
        ))}
        <button type="button" className="navdir__everything" onClick={onEverything}>
          Everything, on one page
        </button>
      </div>
    </nav>
  )
}

const YEAR = new Date().getFullYear()

// The small print. Identical in both footers, and it always was.
export function FooterLegal() {
  return (
    <div className="sitefooter__legal">
      <p className="sitefooter__brand">
        <TallyBaseballMark size={18} />
        <TallyWordmark height={14} tight />
        <span>Baseball</span>
      </p>
      <p>Data via the MLB Stats API. Not affiliated with MLB or any club.</p>
      <p>Built for keeping score by hand. Game results stay sealed until opened.</p>
      <p>
        © {YEAR}
        <BuildStamp />
      </p>
    </div>
  )
}
