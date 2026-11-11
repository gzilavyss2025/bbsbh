import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.jsx'
import { CopyProvider } from './copy/CopyProvider.jsx'
import { hydrateIdentityFromCache, refreshIdentityOverrides } from './lib/identity/hydrate.js'
import { CLERK_PUBLISHABLE_KEY, isClerkEnabled } from './lib/clerkConfig.js'
import { installCrashReporter, reportCrash } from './lib/crash/report.js'
import { installVitalsReporter } from './lib/crash/vitals.js'
import { WIDE_QUERY } from './hooks/useMediaQuery.js'
import { parseRoute } from './lib/route.js'
import { BUILD_COMMIT_SHORT } from './lib/buildInfo.js'
import { recoverOnce, clearRecoveryFlag, dropBuildAndReload } from './lib/crash/recover.js'
import { RootBoundary } from './components/ui/state/RootBoundary.jsx'
import './index.css'

// The crash signal (#2514): the route's NAME and the build, never the URL (lib/crash/report.js).
const reportContext = () => {
  let route = ''
  try { route = parseRoute(window.location.pathname)?.name ?? '' } catch { /* no route name */ }
  return { route, build: BUILD_COMMIT_SHORT }
}
installCrashReporter(reportContext)
// Field vitals: one `bbsbh-vitals` log line a page load, with an installed-app flag
// (lib/crash/vitals.js). Production only, so the dev server stays quiet.
if (import.meta.env.PROD) {
  installVitalsReporter(() => ({
    ...reportContext(),
    device: window.matchMedia(WIDE_QUERY).matches ? 'wide' : 'phone',
  }))
}

// A deploy that changes code renames the content-hashed chunks it touches (a
// data-only one renames none, #2873; see App.jsx's per-route `lazy()` imports),
// so a tab or installed app left open across one can get a failed
// dynamic import the next time it opens a route it hasn't loaded yet. Vite fires
// this event for exactly that case. Repair once a session: drop the cached app
// precache and the service worker (runtime caches stay), then reload from the
// network (lib/crash/recover.js — localStorage is untouched). A launch after a
// deploy no longer lands here: the worker asks the network for the page first
// (#3041). The flag clears a few seconds after a clean load so the NEXT deploy can
// repair itself too. RootBoundary's render-error repair purges every cache instead.
window.addEventListener('vite:preloadError', () => { recoverOnce(sessionStorage, dropBuildAndReload) })
window.addEventListener('load', () => {
  setTimeout(() => clearRecoveryFlag(sessionStorage), 10_000)
})

// @clerk/clerk-react is dynamically imported so its whole SDK is only ever
// fetched when a deploy actually sets VITE_CLERK_PUBLISHABLE_KEY — every user
// on every other deploy pays zero bytes for it (this app is phone-first, and
// the main bundle's size is exactly what docs/api-audit.md worries about for
// a ballpark connection). AccountButton.jsx and RevealCloudSync.jsx follow
// the same lazy pattern at their own call sites.
// Club-identity overrides, applied to the module-level stores BEFORE the first
// render. Not a provider, because the identity layer is pure synchronous
// resolvers rather than React context (src/lib/identity/overlay.js), and not
// deferred to an effect, because the flash it would cause is a club's mark
// visibly rescaling rather than a sentence changing. The cached map paints on
// the first frame; the fetch revalidates it a moment later, and App subscribes
// to the difference through useIdentityVersion.
hydrateIdentityFromCache()
refreshIdentityOverrides()

async function mount() {
  // Any error a React boundary catches, or one none catches, is the crash signal's `render` kind
  // (#2514): the kind only, never the error (lib/crash/report.js).
  const root = createRoot(document.getElementById('root'), {
    // React's default for both is to log the error; that stays.
    onCaughtError: (error) => { console.error(error); reportCrash({ kind: 'render' }) },
    onUncaughtError: (error) => { console.error(error); reportCrash({ kind: 'render' }) },
  })
  let content = (
    <CopyProvider>
      <App />
    </CopyProvider>
  )
  if (isClerkEnabled) {
    // clerkAppearance.js rides the same dynamic gate: it only ever loads
    // alongside the SDK it themes.
    const [{ ClerkProvider }, { clerkAppearance, clerkLocalization }] = await Promise.all([
      import('@clerk/clerk-react'),
      import('./lib/clerkAppearance.js'),
    ])
    content = (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        appearance={clerkAppearance}
        localization={clerkLocalization}
      >
        <CopyProvider>
          <App />
        </CopyProvider>
      </ClerkProvider>
    )
  }
  // The crawlable body api/preview.js wrote into the shell (ADR-0059), cleared
  // the moment the app is ready to paint over it. It is a SIBLING of #root
  // rather than its contents — React would clear those itself — because the
  // ALL-CAPS INVARIANT is scoped to `#root *`, and a paragraph of prose inside
  // #root paints in capitals for as long as the shell is on screen.
  //
  // Removed HERE and not at module top level: this runs one statement before
  // the first paint, so the reader keeps a readable page for the whole gap
  // rather than watching it blank out while the Clerk import resolves. On every
  // route but the ~30 vercel.json rewrites, and on every navigation an
  // installed reader makes, there is no such element and this is a no-op.
  document.getElementById('crawl')?.remove()
  root.render(
    <StrictMode>
      <RootBoundary>{content}</RootBoundary>
      <Analytics />
      <SpeedInsights />
    </StrictMode>,
  )
}

mount()
