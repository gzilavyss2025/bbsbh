import { useMemo } from 'react'
import { selectDueUpNow } from '../../../api/dueup.js'
import { batterLineText } from '../../../api/boxscore/batterLine.js'
import { DueUpBatters, dueUpMotionKey } from './DueUpBatters.jsx'

// Who's due up to face the entering pitcher, BEFORE any of this half is
// revealed — the stamped due-up card (DueUpBatters), same "entering the half"
// spoiler-safety footing as the lineup/defense reference just below it
// (selectDueUpNow's own lineupEntering-derived gate). Each batter's line reads
// only the halves already revealed (`batterLineText` takes `revealedThrough` as
// its hard boundary, ADR-0009), so before his first at-bat it is his average
// entering the game. Gone the moment the user starts revealing (HalfInning.jsx
// drops this alongside PrePitchChanges/the entering reference on
// startedRevealing) — once real at-bats are on screen, "who's due up" is just
// the top of the live play-by-play feed.
export function UpNextBatters({ feed, inning, half, revealedThrough, teamId, teamName }) {
  const info = useMemo(() => {
    const due = selectDueUpNow(feed, inning, half, revealedThrough)
    if (!due) return null
    const batters = due.batters.map((b) => ({
      ...b,
      line: batterLineText(feed, due.battingSide, b.id, revealedThrough),
    }))
    return { ...due, batters }
  }, [feed, inning, half, revealedThrough])
  if (!info) return null
  return <DueUpBatters label="Due up" teamName={teamName} teamId={teamId} batters={info.batters} motionKey={dueUpMotionKey(feed, inning, half, 'now')} className="upnext" />
}
