import { lazy, Suspense } from 'react'
import { TallyLockup } from './TallyBrand.jsx'
import { SiteSearchButton } from './SiteSearch.jsx'
import { SiteMenuButton } from './SiteMenu.jsx'
import { goHome } from '../lib/home.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'

// AccountButton.jsx imports @clerk/clerk-react at its top, so it's only
// dynamically imported (and only then does that SDK ever reach a user's
// device) when a deploy actually configures Clerk — see main.jsx's matching
// dynamic import and clerkConfig.js.
const AccountButton = isClerkEnabled
  ? lazy(() => import('./AccountButton.jsx').then((m) => ({ default: m.AccountButton })))
  : null

// The Tally wordmark shown atop every screen (except
// the slate, which is already home) — tapping it returns to '/' with a full
// reload (see lib/home.js). Not sticky; each screen still owns whatever
// page-specific header sits below it. The search + menu buttons ride on the
// same row so site-wide search and the standalone pages (standings,
// prospects, etc.) are reachable from anywhere (the slate gets its own copy
// in its topbar — see GameSelect — since it doesn't render SiteHeader).
export function SiteHeader() {
  return (
    <div className="sitebar">
      <button
        type="button"
        className="sitebar__home"
        onClick={goHome}
        aria-label="Back to games"
      >
        <TallyLockup height={22} />
      </button>
      <div className="sitebar__actions">
        <SiteSearchButton />
        <SiteMenuButton />
        {AccountButton && (
          <Suspense fallback={null}>
            <AccountButton />
          </Suspense>
        )}
      </div>
    </div>
  )
}
