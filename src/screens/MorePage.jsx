// This page's own partial, kept out of the core sheet (src/index.css) so only
// /more pays for it.
import '../styles/59-more-directory.css'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useRouteLink } from '../lib/nav.js'
import { MENU_GROUPS, isGuidePath } from '../lib/reportPages.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'

// "Everything" — every standalone page on the site, grouped, on one address.
//
// This is the second way to reach a page, and that is the point rather than a
// side effect: WCAG 2.4.5 (Multiple Ways, AA) asks for more than one route to
// a page, and names a site map, a search function, and a list of links to all
// pages as the ways to satisfy it. Site search is the first. This is the
// second, and unlike the hamburger sheet it is addressable — you can link
// someone to it, the Back button behaves, and it survives a reload.
//
// It renders the SAME registry the sheet does (lib/reportPages.js), so a page
// added to a group appears in both, plus every footer, with no second list.
//
// Two things it deliberately is NOT:
//
// - It is not server-rendered, so it is not a crawl surface. vercel.json's
//   catch-all serves every app route the empty #root shell; only /learn goes
//   through api/page.js. Making this crawlable would mean a new serverless
//   function, and api/ already sits at the Hobby plan's ceiling (ADR-0048).
//   The argument for this page is readers and 2.4.5, not search engines.
// - It is not a replacement for the sheet. The sheet is one tap from anywhere;
//   this is the place to send someone, and the place to browse when the sheet's
//   groups are not enough.
export function MorePage() {
  useDocumentTitle('Everything')
  const linkProps = useRouteLink()

  return (
    <div className="screen">
      <SiteHeader />

      <header className="moredir__head">
        <h1 className="moredir__title">Everything</h1>
        <p className="moredir__blurb">
          Every page on Tally, in one place. Scores stay sealed wherever they
          normally would.
        </p>
      </header>

      <div className="moredir__grid">
        {MENU_GROUPS.map((group) => (
          <section key={group.id} className="moredir__card">
            <h2 className="dirhd">{group.label}</h2>
            <ul className="navdir__list">
              {group.pages.map((page) => {
                const props = linkProps(page.path)
                return (
                  <li key={page.path}>
                    <a className="dirlink" href={props.href} onClick={props.onClick}>
                      {page.label}
                      {isGuidePath(page.path) && (
                        // The guides are documents, not app screens. Saying so
                        // is honest about the page load, and it is visible
                        // text rather than a title= tooltip, which is
                        // invisible on the phone this app is built for.
                        <span className="dirtag">Guide</span>
                      )}
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <ReportFooter />
    </div>
  )
}
