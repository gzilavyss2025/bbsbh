import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { logbookPath, profilePath } from '../../lib/route.js'
import { teamLogoUrl } from '../../lib/teams.js'

// Signed in, the trigger shows the user's favorite team's logo (the same
// choice the welcome modal / slate pin uses) instead of Clerk's photo/initials
// avatar — this is a scorebook, not a social app, so "who you root for" is
// the identity worth a header slot. Purely visual: Clerk's own avatar image is
// hidden via the `elements` classes below and the logo overlays the same box
// (pointer-events: none in CSS), so the real UserButton stays the tap target
// and the account menu opens exactly as before. Nothing is uploaded to Clerk,
// and a favorite-team change shows up here immediately. **Do not regress that**
// — it is the header's account identity, and My Tally is where it is changed.
const teamAvatarAppearance = {
  elements: {
    userButtonAvatarBox: 'accountbtn__avatarbox',
    userButtonAvatarImage: 'accountbtn__avatarimg',
  },
}

// Menu-item marks. Clerk requires a `labelIcon` on every custom link, so these
// are drawn here as plain inline SVG in the paper-scorebook idiom (a page for
// My Tally, a stamped roundel for the Game Log) rather than pulling an icon set
// in behind a two-line menu.
function PageIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <line x1="5" y1="5.5" x2="11" y2="5.5" />
      <line x1="5" y1="8.5" x2="11" y2="8.5" />
      <line x1="5" y1="11.5" x2="9" y2="11.5" />
    </svg>
  )
}

function StampIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.2 11.8 8 8 11.8 4.2 8Z" />
    </svg>
  )
}

// Only rendered when Clerk is configured (see clerkConfig.js) — otherwise
// ClerkProvider isn't mounted at all and these components would have no
// context to read. Signing in is what lets revealedThrough sync across a
// user's devices (see RevealCloudSync.jsx). Scoring and reveals still work
// locally without it; on a configured deploy the Game Log explains why an
// account is needed before it opens the user's synced book.
export function AccountButton({ className = '' }) {
  const { favoriteTeamId } = useFavoriteTeam()
  if (!isClerkEnabled) return null
  const logo = teamLogoUrl(favoriteTeamId)
  return (
    <div className={`accountbtn ${className}`}>
      <SignedIn>
        <span className="accountbtn__team">
          {/* Clerk's composition API. Declaring the two default actions
              explicitly is what fixes their ORDER around the custom links —
              custom items are otherwise appended after whatever Clerk renders.
              "Manage account" is relabelled to "Account & security" through
              clerkLocalization, so the menu and My Tally's own disclosure name
              the same thing the same way.
              `href` navigation goes through the browser rather than our
              History-API router (no Clerk router integration is configured),
              which is fine: vercel.json rewrites every path to index.html, so
              /profile and /logbook both resolve on a cold load. */}
          <UserButton afterSignOutUrl="/" appearance={logo ? teamAvatarAppearance : undefined}>
            <UserButton.MenuItems>
              <UserButton.Link label="My Tally" labelIcon={<PageIcon />} href={profilePath()} />
              <UserButton.Link label="Game Log" labelIcon={<StampIcon />} href={logbookPath()} />
              <UserButton.Action label="manageAccount" />
              <UserButton.Action label="signOut" />
            </UserButton.MenuItems>
          </UserButton>
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
