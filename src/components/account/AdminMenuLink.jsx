import { useUser } from '@clerk/clerk-react'
import { useRouteLink } from '../../lib/nav.js'

// The one row in the site menu that only an admin sees: a link to /admin,
// which until now was reachable only by typing the address.
//
// WHY IT LIVES HERE, not in lib/reportPages.js with the other nineteen pages.
// That registry is the shared source the site menu, both footers and /more all
// render from (scripts/check-report-pages.mjs enforces it), and none of those
// other three surfaces is role-aware. An entry added there would print /admin
// in the footer of every page for every visitor. So this is a deliberate
// exception rather than a twentieth registry row, and it stays a single
// surface: the menu, where a signed-in owner already goes for everything else
// that is theirs.
//
// WHY IT IMPORTS CLERK AT THE TOP. Same reason AccountButton.jsx does, and it
// is loaded the same way: SiteMenu only dynamically imports this file when a
// deploy actually configures Clerk (see clerkConfig.js), so a deploy without
// it never ships the SDK to a device. Rendering `null` for a signed-out or
// non-admin visitor is what makes that safe to do unconditionally.
//
// NOT A SECURITY BOUNDARY. This is the same client-side `publicMetadata.role`
// check AdminCopy.jsx makes on the page itself; api/copy.js independently
// enforces a server-side allowlist on every write. Hiding the row keeps it out
// of the way of people it would only confuse — it is not what stops anyone
// editing anything.
export function AdminMenuLink({ onNavigate }) {
  const { isLoaded, isSignedIn, user } = useUser()
  const linkProps = useRouteLink()
  if (!isLoaded || !isSignedIn) return null
  if (user?.publicMetadata?.role !== 'admin') return null

  const props = linkProps('/admin')
  return (
    <li>
      <a
        className="dirlink sitemenusheet__item"
        href={props.href}
        onClick={(event) => {
          props.onClick(event)
          if (event.defaultPrevented) onNavigate?.()
        }}
      >
        Site admin
        {/* The same visible tag the eleven guide rows wear — "this row is not
            an ordinary page" — rather than a second mechanism for the same
            job. Text, never a title= tooltip, which does not exist on the
            phone this app is built for. */}
        <span className="dirtag">Admin</span>
      </a>
    </li>
  )
}
