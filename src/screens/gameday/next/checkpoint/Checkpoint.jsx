import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import '../../../../styles/gameday-next/checkpoint.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { fetchSavantMatchup } from '../../../../api/matchup/savant.js'
import { halfIndex } from '../../../../api/select.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useCalloutLedger } from '../../../../hooks/useCalloutLedger.js'
import { useWsCalloutInputs } from '../../../../hooks/postseason/useWsEvents.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { useTier } from '../useTier.js'
import { checkpointMarkup } from './checkpointMarkup.js'

// Gameday's checkpoint in the stage's slot (markup and rules: checkpointMarkup.js). The phone's page
// is the one state here; the mount keys this on the half, so a new half opens on the tally.
//
// The notes take what BetweenInnings.jsx gives buildBetweenInnings: InningViewer's `notes` (bundle,
// margin notes, workload, date), plus the Savant rates, the World Series inputs and the ledger's counts
// for the next half, frozen for the half. A note counts as shown once it is on screen: at T, L and D or
// under Motion: Reduced every page is, on the phone only while the Notes page is open.
export function Checkpoint({ notes, inning, half, feed, ...props }) {
  const [page, setPage] = useState(null)
  const savantMatchup = useAsync(fetchSavantMatchup, []).data ?? null
  const { seriesHistory, wsStarts } = useWsCalloutInputs(feed)
  const ledger = useCalloutLedger()
  const stagedIdx = halfIndex(inning, half) + 1
  const shownCounts = useMemo(() => ledger.countsFor(stagedIdx), [ledger, stagedIdx])
  const allShown = useTier() !== 'P' || motionIsReduced()
  const Seen = useCallback((p) => createElement(SeenNotes, { ...p, ledger, stagedIdx, allShown }), [ledger, stagedIdx, allShown])
  return checkpointMarkup(createElement, {
    SealBox, Seen, feed, inning, half, ...props, page, onPage: setPage,
    notes: notes && { ...notes, shownCounts, savantMatchup, seriesHistory, wsStarts },
  })
}

// Records the notes on screen for the next half, as BetweenInnings.jsx does for the card it shows.
function SeenNotes({ notes, on, ledger, stagedIdx, allShown }) {
  const keys = allShown || on ? notes.map((n) => n.dedupeKey ?? n.text).join('\n') : ''
  useEffect(() => {
    if (keys) ledger.markShown(keys.split('\n').map((dedupeKey) => ({ dedupeKey })), stagedIdx)
  }, [ledger, keys, stagedIdx])
  return null
}
