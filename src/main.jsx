import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.jsx'
import { CopyProvider } from './copy/CopyProvider.jsx'
import { hydrateIdentityFromCache, refreshIdentityOverrides } from './lib/identity/hydrate.js'
import { CLERK_PUBLISHABLE_KEY, isClerkEnabled } from './lib/clerkConfig.js'
import './index.css'

// Every deploy renames the content-hashed chunk files (see App.jsx's per-route
// `lazy()` imports), so a tab left open across one gets a failed dynamic
// import — "Failed to fetch dynamically imported module" — the next time it
// navigates to a route it hasn't loaded yet. Vite fires this event for
// exactly that case; reload once to pick up the new manifest instead of
// leaving the screen blank. The sessionStorage flag stops a reload loop if
// the failure is persistent rather than a one-off stale deploy; it's cleared
// a few seconds after a clean load so the NEXT deploy can trigger a reload
// too.
const PRELOAD_RELOAD_FLAG = 'bbsbh:reloaded-after-preload-error'
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(PRELOAD_RELOAD_FLAG)) return
  sessionStorage.setItem(PRELOAD_RELOAD_FLAG, '1')
  window.location.reload()
})
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem(PRELOAD_RELOAD_FLAG), 10_000)
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
  const root = createRoot(document.getElementById('root'))
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
  // The crawlable body api/preview.js wrote into the shell (ADR-0058), cleared
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
      {content}
      <Analytics />
      <SpeedInsights />
    </StrictMode>,
  )
}

mount()
