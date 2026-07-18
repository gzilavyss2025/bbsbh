import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react'

// The "why sign in" panel inside the welcome/settings modal (FavoriteTeamModal).
// Signing in is the app's one account feature: it mirrors revealedThrough — the
// reveal high-water mark, never a score (ADR-0022) — across a user's own
// devices, so a game started on the couch phone picks up on the kitchen iPad,
// and the slate's "Pick up your pencil" strip (ContinueScoring.jsx) can resume
// it without a feed fetch. Entirely optional: everything works per-device
// without an account. Only ever rendered when isClerkEnabled — FavoriteTeamModal
// lazy-loads it — because it touches Clerk hooks/components at its top level,
// which throw with no ClerkProvider ancestor.
export function AccountPitch() {
  return (
    <section className="favteamsheet__section favteamsheet__section--divider">
      <h3 className="favteamsheet__sectionTitle">Your scorebook, everywhere</h3>
      <SignedOut>
        <p className="hint hint--prose favteamsheet__accountpitch">
          Create a free account to carry your reveal progress across devices —
          start a game on your phone at the park, pick it up on the iPad at home,
          right where you left off. We only ever sync how far you&rsquo;ve
          revealed, never a score.
        </p>
        <SignInButton mode="modal">
          <button type="button" className="btn btn--account">
            Create account or sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <SignedInNote />
      </SignedIn>
    </section>
  )
}

function SignedInNote() {
  const { user } = useUser()
  const who = user?.primaryEmailAddress?.emailAddress || user?.username
  return (
    <p className="hint hint--prose favteamsheet__accountpitch">
      {who ? (
        <>
          Signed in as <strong>{who}</strong>.{' '}
        </>
      ) : null}
      Your reveal progress now syncs across every device you sign in on — never a
      score. Manage your account from the avatar up in the header any time.
    </p>
  )
}
