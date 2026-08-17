import { FooterDirectory, FooterLegal } from './FooterParts.jsx'
import { useNav } from '../../lib/nav.js'
import { PAGE_GROUPS, FOOTER_TRAIL } from '../../lib/reportPages.js'

// The directory + legal blurb shared by every standalone report page
// (Milestone Watch, Rehab Assignments, League Leaders, …) — so a reader who's
// drilled into one report can jump straight to another instead of backing out
// to the hamburger sheet. Same groups, same headings and same rows as that
// sheet and as /more; the containers differ, the taxonomy does not.
//
// Deliberately excludes SiteFooter's slate-only action row (Settings / Find a
// past matchup / Logo sheet), which needs home-screen-only state
// (favoriteTeamId, onShowLogos, …) a standalone report page has no reason to
// carry.
//
// Kept as its own direct import from lib/reportPages.js (not re-exported from
// SiteFooter, and not folded into FooterParts) so scripts/check-report-pages.mjs
// still catches drift; see that script before adding a third copy of this line.
export function ReportFooter() {
  const navigate = useNav()
  return (
    <footer className="sitefooter">
      <FooterDirectory
        groups={PAGE_GROUPS}
        trail={FOOTER_TRAIL}
        onEverything={() => navigate('/more')}
      />
      <FooterLegal />
    </footer>
  )
}
