import { lazy, Suspense } from 'react'
import { useRouteLink } from '../../lib/nav.js'
import { isGuidePath } from '../../lib/reportPages.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { TallyBaseballMark, TallyWordmark } from './TallyBrand.jsx'
import { BuildStamp } from '../ui/BuildStamp.jsx'

// AdminFooterLink.jsx imports @clerk/clerk-react at its top, so it is only
// dynamically imported — and only then does that SDK reach a device — when a
// deploy actually configures Clerk. Same arrangement SiteMenu uses for
// AdminMenuLink, for the same reason. It renders null for everyone who is not
// a signed-in admin, so mounting it unconditionally below is safe.
const AdminFooterLink = isClerkEnabled
  ? lazy(() =>
      import('../account/AdminFooterLink.jsx').then((m) => ({ default: m.AdminFooterLink })),
    )
  : null

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
// Gary, 2026-10-28: one list, no group headings, every page in alphabetical order, folded shut until
// opened. `actions` ({ label, onClick }) are the footer's own tools (Find a past matchup, the logo
// sheet), listed with the pages as buttons. The rows are still links, so a crawler still finds them.
export function FooterDirectory({ groups, trail, actions = [] }) {
  const linkProps = useRouteLink()
  const rows = [
    ...groups.flatMap((g) => g.pages),
    ...trail,
    ...actions,
  ].sort((a, b) => a.label.localeCompare(b.label))

  return (
    <nav className="sitefooter__more" aria-label="More pages">
      <details className="navdir__fold">
        <summary className="t-label t-label--bold sitefooter__more-label">More Baseball</summary>
        <ul className="navdir__list navdir__list--all">
          {rows.map((r) => (
            <li key={r.path ?? r.label}>
              {r.path ? (
                <a className="dirlink" {...linkProps(r.path)}>
                  {r.label}
                  {isGuidePath(r.path) && <span className="dirtag">Guides</span>}
                </a>
              ) : (
                <button type="button" className="dirlink dirlink--action" onClick={r.onClick}>{r.label}</button>
              )}
            </li>
          ))}
        </ul>
      </details>
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
      {/* The owner's own row, invisible to everyone else. It sits here rather
          than in the directory above because it is not one of the site's
          pages — see AdminFooterLink for why it is not in the shared page
          registry that feeds that directory. */}
      {AdminFooterLink && (
        <Suspense fallback={null}>
          <AdminFooterLink />
        </Suspense>
      )}
    </div>
  )
}
