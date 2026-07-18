import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { teamLogoUrl } from '../lib/teams.js'

// Signed in, the trigger shows the user's favorite team's logo (the same
// choice the welcome modal / slate pin uses) instead of Clerk's photo/initials
// avatar — this is a scorebook, not a social app, so "who you root for" is
// the identity worth a header slot. Purely visual: Clerk's own avatar image is
// hidden via the `elements` classes below and the logo overlays the same box
// (pointer-events: none in CSS), so the real UserButton stays the tap target
// and the account menu opens exactly as before. Nothing is uploaded to Clerk,
// and a favorite-team change shows up here immediately.
const teamAvatarAppearance = {
  elements: {
    userButtonAvatarBox: 'accountbtn__avatarbox',
    userButtonAvatarImage: 'accountbtn__avatarimg',
  },
}

// Only rendered when Clerk is configured (see clerkConfig.js) — otherwise
// ClerkProvider isn't mounted at all and these components would have no
// context to read. Signing in is what lets revealedThrough sync across a
// user's devices (see useRevealCloudSync.js); it's entirely optional —
// everything works locally, per-device, without ever touching this.
export function AccountButton({ className = '' }) {
  const { favoriteTeamId } = useFavoriteTeam()
  if (!isClerkEnabled) return null
  const logo = teamLogoUrl(favoriteTeamId)
  return (
    <div className={`accountbtn ${className}`}>
      <SignedIn>
        <span className="accountbtn__team">
          <UserButton afterSignOutUrl="/" appearance={logo ? teamAvatarAppearance : undefined} />
          {logo && <img className="accountbtn__teamlogo" src={logo} alt="" aria-hidden="true" />}
        </span>
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
