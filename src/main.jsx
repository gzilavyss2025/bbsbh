import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.jsx'
import { CLERK_PUBLISHABLE_KEY, isClerkEnabled } from './lib/clerkConfig.js'
import './index.css'

// @clerk/clerk-react is dynamically imported so its whole SDK is only ever
// fetched when a deploy actually sets VITE_CLERK_PUBLISHABLE_KEY — every user
// on every other deploy pays zero bytes for it (this app is phone-first, and
// the main bundle's size is exactly what docs/api-audit.md worries about for
// a ballpark connection). AccountButton.jsx and RevealCloudSync.jsx follow
// the same lazy pattern at their own call sites.
async function mount() {
  const root = createRoot(document.getElementById('root'))
  let content = <App />
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
        <App />
      </ClerkProvider>
    )
  }
  root.render(
    <StrictMode>
      {content}
      <Analytics />
      <SpeedInsights />
    </StrictMode>,
  )
}

mount()
