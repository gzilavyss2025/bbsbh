import { useCallback, useState } from 'react'
import { SignInButton, SignOutButton, UserProfile, useAuth, useUser } from '@clerk/clerk-react'
import { mergeReceiptLines } from '../../lib/account/mergeReceiptFlag.js'
import { NEVER_SYNCED, SYNCED_ITEMS } from '../../lib/account/syncClaims.js'
import { DeviceHandoff } from './DeviceHandoff.jsx'
import { EraseDataDialog } from './EraseDataDialog.jsx'
import { MergeReceipt } from './MergeReceipt.jsx'

// My Tally's account section — the only part of the page that knows Clerk
// exists. It imports @clerk/clerk-react at its top level, so ProfilePage
// dynamically imports it and only when `isClerkEnabled`, exactly like
// AccountPitch, LogbookAccountGate and the cloud-sync components. Never a
// conditionally-called hook: Clerk's hooks throw with no ClerkProvider ancestor,
// so the CONDITION is the render of this component, not a call inside it.
//
// Three states, and all three occupy the same box so the page never jumps and
// never flashes one account's shape before settling into another's:
//   - Clerk still loading  -> the frame, with the identity line held blank
//   - signed out           -> the benefit panel, built from the claims ledger
//   - signed in            -> identity, the merge receipt, Account & security,
//                             erase, sign out
//
// The benefit copy is rendered FROM `SYNCED_ITEMS`, never hand-written. That
// array is guarded by test/sync-claims.test.js: a claim naming a sync module
// that does not exist fails CI, so this panel cannot promise something the app
// does not do. Read docs/game-log.md §3 before rewording any of it — in
// particular, sync is a convenience and never a BACKUP, so nothing here may say
// "backed up", "safe", or "never lose".

export function ProfileAccount({ status, counts, clubName }) {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [manageOpen, setManageOpen] = useState(false)
  const [erasing, setErasing] = useState(false)

  // The caller for `DELETE /api/account`, which phase 2 shipped without one.
  // Resolves true only on a real 200 — a 501 (no store on this deployment), a
  // 401 or a dead network all resolve false, and the dialog says so rather than
  // wiping the device and calling it done.
  const eraseAccount = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  }, [getToken])

  const who = user?.primaryEmailAddress?.emailAddress || user?.username || ''

  if (!isLoaded) {
    // The frame, holding its own height. Rendering the signed-out pitch here
    // and swapping it a beat later is the flash this branch exists to prevent.
    return (
      <section className="mytally__section mytally__account" aria-busy="true">
        <h2 className="mytally__sectiontitle">Account</h2>
        <p className="mytally__accountid caps-exempt">&nbsp;</p>
      </section>
    )
  }

  if (!isSignedIn) {
    return (
      <section className="mytally__section mytally__account">
        <h2 className="mytally__sectiontitle">Account</h2>
        <div className="mytally__pitch">
          <DeviceHandoff className="mytally__handoff" />
          <p className="mytally__pitchlede caps-exempt">
            Everything on this page already works, on this device. An account carries the
            things below to your other screens — start a game on the phone at the
            park, pick it up on the iPad at home, right where you left off.
          </p>
          <ul className="mytally__claims">
            {SYNCED_ITEMS.map((item) => (
              <li key={item.id}>
                <span className="mytally__claimlabel">{item.label}</span>
                <span className="mytally__claimblurb caps-exempt">{item.blurb}</span>
              </li>
            ))}
          </ul>
          <SignInButton mode="modal">
            <button type="button" className="mytally__cta">
              Create account or sign in
            </button>
          </SignInButton>
          <p className="mytally__fineprint caps-exempt">
            These never leave this device, by design:{' '}
            {NEVER_SYNCED.map((item) => item.label).join(', ')}. No public profile, no
            leaderboard, no social feed. A score is never synced — only how far you have
            opened each game.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mytally__section mytally__account">
      <h2 className="mytally__sectiontitle">Account</h2>
      <MergeReceipt userId={user?.id} lines={mergeReceiptLines({ status, counts, clubName })} />
      <p className="mytally__accountid caps-exempt">
        Signed in as <strong>{who || 'your account'}</strong>.
      </p>

      <div className="mytally__accountactions">
        <button
          type="button"
          className="mytally__rowbtn"
          aria-expanded={manageOpen}
          onClick={() => setManageOpen((open) => !open)}
        >
          Account &amp; security
          <span className="mytally__rowbtnhint caps-exempt">
            Email, connected accounts, passkeys, active devices
          </span>
        </button>
        {/* routing="virtual" is a hard constraint, not a preference:
            src/lib/route.js is a hand-rolled parseRoute with no wildcard, and
            Clerk's routing="path" wants ownership of /profile/* for its own
            sub-navigation. Virtual routing keeps every Clerk sub-screen inside
            this component and leaves our router untouched. Do not "clean this
            up" to path routing. Mounted only once opened, so a visitor who
            never taps it never pays for the profile card. */}
        {manageOpen && (
          <div className="mytally__clerkprofile">
            <UserProfile routing="virtual" />
          </div>
        )}

        <SignOutButton>
          <button type="button" className="mytally__rowbtn">
            Sign out
          </button>
        </SignOutButton>

        <button
          type="button"
          className="mytally__rowbtn mytally__rowbtn--danger"
          onClick={() => setErasing(true)}
        >
          Erase my Tally data everywhere
          <span className="mytally__rowbtnhint caps-exempt">
            Your account and this device. Erase first, then delete the account —
            deleting the account on its own leaves this data unreachable but not erased.
          </span>
        </button>
      </div>

      {erasing && (
        <EraseDataDialog
          scope="account"
          eraseAccount={eraseAccount}
          onClose={() => setErasing(false)}
        />
      )}
    </section>
  )
}
