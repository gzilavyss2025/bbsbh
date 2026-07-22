import { useNav } from '../lib/nav.js'
import { REPORT_PAGES } from '../lib/reportPages.js'
import { TallyBaseballMark, TallyWordmark } from './TallyBrand.jsx'

// Same list + trailing About link SiteFooter.jsx uses — kept as its own
// direct import (not re-exported from SiteFooter) so scripts/check-report-pages.mjs
// still catches drift; see that script before adding a third copy of this line.
const FOOTER_LINKS = [...REPORT_PAGES, { label: 'About', path: '/about' }]

const YEAR = new Date().getFullYear()

// The "More Baseball" links + legal blurb shared by the slate's SiteFooter and
// every standalone report page (Milestone Watch, Rehab Assignments, League
// Leaders, …) — so a reader who's drilled into one report can jump straight
// to another instead of backing out to the hamburger menu. Deliberately
// excludes SiteFooter's slate-only action row (Settings / Find a past
// matchup / Logo sheet), which needs home-screen-only state (favoriteTeamId,
// onShowLogos, …) a standalone report page has no reason to carry.
export function ReportFooter() {
  const navigate = useNav()
  return (
    <footer className="sitefooter">
      <div className="sitefooter__more">
        <p className="sitefooter__more-label">More Baseball</p>
        <nav className="sitefooter__links" aria-label="More pages">
          {FOOTER_LINKS.map((item) => (
            <button
              key={item.path}
              type="button"
              className="sitefooter__link"
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sitefooter__legal">
        <p className="sitefooter__brand">
          <TallyBaseballMark size={18} />
          <TallyWordmark height={14} />
          <span>Baseball</span>
        </p>
        <p>Data via the MLB Stats API. Not affiliated with MLB or any club.</p>
        <p>Built for keeping score by hand. Game results stay sealed until opened.</p>
        <p>© {YEAR}</p>
      </div>
    </footer>
  )
}
