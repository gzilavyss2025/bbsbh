import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNav } from '../../lib/nav.js'
import { profilePath } from '../../lib/route.js'
import { hasSeenMergeReceipt, markMergeReceiptSeen } from '../../lib/account/mergeReceiptFlag.js'
import { normalizeSilentChannels, rollupSync } from '../../lib/account/syncStatus.js'
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
// first successful pull this session — the same condition the card itself
// effectively requires (its `lines` are empty, and it renders nothing, until
// the channels it reads have answered).
//
// That rollup MUST be taken over the normalized store, not the raw one. This
// component renders on the slate, where `RevealCloudSync` has never mounted, so
// the `reveal` channel is silent and the raw rollup is permanently `local` —
// which made the first build of this strip unreachable by construction, in
// exactly the scenario it exists for (you signed in somewhere else and landed
// here). See normalizeSilentChannels' header.
export function MergeReceiptStrip() {
  const { isSignedIn, user } = useUser()
  const status = useSyncStatusState()
  const navigate = useNav()
  const [dismissedThisSession, setDismissedThisSession] = useState(false)
  // Read the one-shot flag ONCE, at mount. This component subscribes to the
  // sync store, so a render-body read would hit localStorage on every channel
  // phase change — the full card (MergeReceipt.jsx) already does it this way.
  const [seenAtMount] = useState(() => hasSeenMergeReceipt(user?.id))

  if (!isSignedIn || dismissedThisSession || seenAtMount) return null
  if (rollupSync(normalizeSilentChannels(status)) !== 'synced') return null

  return (
    <div className="mergestrip" role="note">
      <button
        type="button"
        className="mergestrip__link caps-exempt"
        onClick={() => navigate(profilePath())}
      >
        Account sync complete. View details in My Tally ›
      </button>
      <button
        type="button"
        className="mergestrip__dismiss"
        onClick={() => {
          markMergeReceiptSeen(user?.id)
          setDismissedThisSession(true)
        }}
        aria-label="Dismiss this note"
      >
        ✕
      </button>
    </div>
  )
}
