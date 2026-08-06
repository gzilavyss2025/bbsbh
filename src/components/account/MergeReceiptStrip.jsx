import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNav } from '../../lib/nav.js'
import { profilePath } from '../../lib/route.js'
import { hasSeenMergeReceipt, markMergeReceiptSeen } from '../../lib/account/mergeReceiptFlag.js'
import { rollupSync } from '../../lib/account/syncStatus.js'
import { useSyncStatusState } from '../sync/SyncStatusProvider.jsx'

// A one-line pointer to the merge receipt card that already lives on
// /profile (components/profile/MergeReceipt.jsx, PRD §5.3) — for the case the
// sign-in itself happened somewhere other than the slate (the header's
// UserButton, or another device entirely), so the slate says SOMETHING before
// the visitor happens to open My Tally on their own. Same lazy-Clerk-import
// gate as AccountButton/ContinueScoring; mounted by GameSelect only when
// isClerkEnabled.
//
// Shares the full card's one-shot flag (`bbsbh:mergeReceipt:{userId}`) —
// dismissing either one dismisses both, on purpose: they are two renderings
// of one fact, not two prompts. Never renders counts itself (PRD P10); it
// only says a merge happened and points at the surface that will.
//
// Trigger: signed in, and every configured sync channel has completed its
// first successful pull this session (`rollupSync(status) === 'synced'`) —
// the same condition the card itself effectively requires (its `lines` are
// empty, and it renders nothing, until the channels it reads have answered).
export function MergeReceiptStrip() {
  const { isSignedIn, user } = useUser()
  const status = useSyncStatusState()
  const navigate = useNav()
  const [dismissedThisSession, setDismissedThisSession] = useState(false)

  if (!isSignedIn || dismissedThisSession) return null
  if (hasSeenMergeReceipt(user?.id)) return null
  if (rollupSync(status) !== 'synced') return null

  return (
    <div className="mergestrip" role="note">
      <button
        type="button"
        className="mergestrip__link caps-exempt"
        onClick={() => navigate(profilePath())}
      >
        Your book is on this account now — see what joined it in My Tally ›
      </button>
      <button
        type="button"
        className="mergestrip__dismiss"
        onClick={() => {
          markMergeReceiptSeen(user?.id)
          setDismissedThisSession(true)
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
