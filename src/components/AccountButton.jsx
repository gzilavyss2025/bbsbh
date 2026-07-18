import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { isClerkEnabled } from '../lib/clerkConfig.js'

// Only rendered when Clerk is configured (see clerkConfig.js) — otherwise
// ClerkProvider isn't mounted at all and these components would have no
// context to read. Signing in is what lets revealedThrough sync across a
// user's devices (see useRevealCloudSync.js); it's entirely optional —
// everything works locally, per-device, without ever touching this.
export function AccountButton({ className = '' }) {
  if (!isClerkEnabled) return null
  return (
    <div className={`accountbtn ${className}`}>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="accountbtn__signin" aria-label="Sign in to sync reveal progress across devices">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  )
}
