import { useUser } from '@clerk/clerk-react'
import { useRouteLink } from '../../lib/nav.js'

// The footer rows only an admin sees: the prospect-research diary, the
// Contender diary, and the contracts identity workbench.
//
// WHY IT IS NOT IN lib/reportPages.js WITH THE OTHER PAGES. Same reason its
// sibling AdminMenuLink is not — that registry is the single source the site
// menu, both footers and /more all render from, and none of those surfaces is
// role-aware. A row added there would print this address in the footer of every
// page for every visitor. So this stays a deliberate exception rather than
// another registry entry, and check-report-pages.mjs stays meaningful.
//
// WHY THE FOOTER RATHER THAN THE MENU, where AdminMenuLink already lives. This
// is a page you sit and READ, several thousand words of it, so it belongs with
// the directory of other things you go and read rather than in the sheet you
// open to jump somewhere. It rides FooterLegal, which is the one block both
// SiteFooter and ReportFooter share, so the row appears on every screen that
// has a footer at all instead of on the slate alone.
//
// WHY IT IMPORTS CLERK AT THE TOP. Same arrangement as AdminMenuLink and
// AccountButton: FooterParts only dynamically imports this file when a deploy
// actually configures Clerk, so a deploy without it never ships the SDK to a
// device. Returning null for a signed-out or non-admin visitor is what makes
// mounting it unconditionally safe.
//
// NOT A SECURITY BOUNDARY. The page itself makes the same check, and there is
// no endpoint behind it — the diary is authored content in the bundle. Hiding
// the row keeps a working notebook out of the way of readers it would only
// confuse. It is not what stops anyone reading anything.
export function AdminFooterLink() {
  const { isLoaded, isSignedIn, user } = useUser()
  const linkProps = useRouteLink()
  if (!isLoaded || !isSignedIn) return null
  if (user?.publicMetadata?.role !== 'admin') return null

  return (
    <>
      <p className="sitefooter__adminrow">
        <a className="dirlink" {...linkProps('/admin/research')}>
          Research diary
          {/* The same visible tag the guide rows and the menu's admin row wear —
              "this row is not an ordinary page" — rather than a second mechanism
              for the same job. Text, never a title= tooltip, which does not exist
              on the phone this app is built for. */}
          <span className="dirtag">Admin</span>
        </a>
      </p>
      <p className="sitefooter__adminrow">
        <a className="dirlink" {...linkProps('/admin/contenders')}>
          Contender diary
          <span className="dirtag">Admin</span>
        </a>
      </p>
      <p className="sitefooter__adminrow">
        <a className="dirlink" {...linkProps('/admin/contracts')}>
          Contracts workbench
          <span className="dirtag">Admin</span>
        </a>
      </p>
    </>
  )
}
