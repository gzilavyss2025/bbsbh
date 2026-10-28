import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import '../../../../styles/gameday-next/checkpoint.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { fetchSavantMatchup } from '../../../../api/matchup/savant.js'
import { fetchHitterEntryLines } from '../../../../api/player/hitterEntryLines.js'
import { halfIndex } from '../../../../api/select.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchOnce } from '../../../../lib/gameday/fetchOnce.js'
import { useCalloutLedger } from '../../../../hooks/useCalloutLedger.js'
import { useWsCalloutInputs } from '../../../../hooks/postseason/useWsEvents.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { ScrollCue } from '../ScrollCue.jsx'
import { useTier } from '../useTier.js'
import { checkpointMarkup } from './checkpointMarkup.js'

// Gameday's checkpoint in the stage's slot (markup and rules: checkpointMarkup.js). The phone's page
// is the one state here; the mount keys this on the half, so a new half opens on the tally.
//
// The notes take what BetweenInnings.jsx gives buildBetweenInnings: InningViewer's `notes` (bundle,
// margin notes, workload, date), plus the Savant rates, the World Series inputs and the ledger's counts
// for the next half, frozen for the half. A note counts as shown once it is on screen: at T, L and D or
// under Motion: Reduced every page is, on the phone only while the Notes page is open.
// The rosters' entry lines, once per roster for the session: the checkpoint remounts every half.
const entryLines = fetchOnce(fetchHitterEntryLines, (v) => !Object.keys(v ?? {}).length)

export function Checkpoint({ notes, inning, half, feed, ...props }) {
  const [page, setPage] = useState(null)
  const savantMatchup = useAsync(fetchSavantMatchup, []).data ?? null
  // Both rosters' regular-season lines entering the game, one request: the due-up cards' fallback line
  // (the whole roster, so a pinch hitter or a batter missing from the posted order still has one).
  const gd = feed?.gameData
  const order = ['away', 'home'].flatMap((s) => Object.values(feed?.liveData?.boxscore?.teams?.[s]?.players ?? {})
    .filter((p) => p.position?.type !== 'Pitcher' || p.position?.abbreviation === 'TWP').map((p) => p.person?.id)).filter(Boolean).sort().join(',')
  const entry = useAsync(
    () => (order ? entryLines(order.split(','), gd?.game?.season, gd?.datetime?.officialDate, gd?.teams?.home?.sport?.id ?? 1) : Promise.resolve({})),
    [order, gd?.game?.season, gd?.datetime?.officialDate],
  ).data ?? null
  const { seriesHistory, wsStarts } = useWsCalloutInputs(feed)
  const ledger = useCalloutLedger()
  const stagedIdx = halfIndex(inning, half) + 1
  const shownCounts = useMemo(() => ledger.countsFor(stagedIdx), [ledger, stagedIdx])
  const allShown = useTier() !== 'P' || motionIsReduced()
  const Seen = useCallback((p) => createElement(SeenNotes, { ...p, ledger, stagedIdx, allShown }), [ledger, stagedIdx, allShown])
  useFitNames()
  return checkpointMarkup(createElement, {
    SealBox, Seen, Headshot, Scroll: NotesScroll, PlayerLink, entry, feed, inning, half, ...props, page, onPage: setPage,
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

// The notes scroll in their box with a bouncing cue (ScrollCue.jsx).
const NotesScroll = ({ children, label = 'More notes below' }) => <ScrollCue label={label}>{children}</ScrollCue>

// The due-up cards' long surnames keep their height and narrow to fit (.gdcp__fitname): each is squeezed
// sideways by the share it runs past its card, measured after every render and on a resize.
function useFitNames() {
  useLayoutEffect(() => {
    const fit = () => {
      for (const b of document.querySelectorAll('.gdcp__fitname')) {
        b.style.transform = ''
        const room = b.closest('li')?.clientWidth ?? 0
        const need = b.scrollWidth
        if (room > 0 && need > room) b.style.transform = `scaleX(${room / need})`
      }
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  })
}
