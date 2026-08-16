import { Suspense, lazy } from 'react'
import { isClerkEnabled } from '../../lib/clerkConfig.js'

// The Clerk boundary for BoxRevealCloudSync, kept off the box score itself.
//
// BoxRevealCloudSync.jsx imports @clerk/clerk-react at its top, so it may only
// be reached through a dynamic import behind `isClerkEnabled` — otherwise that
// SDK lands in the bundle of a deploy that has no account feature at all. That
// pattern is three declarations plus a Suspense wrapper wherever it is used
// (see InningViewer's RevealCloudSync), and BoxScore.jsx is a file this repo's
// size guard is already asking to shrink rather than grow (ADR-0038). So the
// boundary lives here, and the screen renders one element.
//
// Renders nothing at all when there is no publishable key: a deploy without
// Clerk keeps the box score's mark on the device that made it, which is exactly
// what it did before the wire existed.
const BoxRevealCloudSync = isClerkEnabled
  ? lazy(() =>
      import('./BoxRevealCloudSync.jsx').then((m) => ({ default: m.BoxRevealCloudSync })),
    )
  : null

export function BoxRevealSyncMount({ gamePk, opened, mergeOpened }) {
  if (!BoxRevealCloudSync) return null
  return (
    <Suspense fallback={null}>
      <BoxRevealCloudSync gamePk={gamePk} opened={opened} mergeOpened={mergeOpened} />
    </Suspense>
  )
}
