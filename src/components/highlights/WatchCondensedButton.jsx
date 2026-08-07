import { useEffect, useRef, useState } from 'react'
import { fetchHighlights, selectCondensedGame } from '../../api/highlights.js'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'

// "Condensed game" on a revealed slate card (GameResultFace.jsx) — the whole
// game in ~12 minutes, which is what "I'm done scoring, show me what happened"
// actually wants.
//
// FETCHES ON TAP, NEVER BEFORE, and that is the whole design. The `content`
// endpoint is 430 KB per game and does NOT honor `?fields=` (measured
// 2026-08-06 — byte-identical response), so a 16-game slate that loaded video
// metadata per card would parse ~6.9 MB on a phone. That is the same wall
// `usePastGameSignals` already hit with the unpruned feed, which is why
// PAST_GAME_FEED_FIELDS exists; there is no equivalent escape here. So the
// button is inert markup until pressed, and you pay one 430 KB fetch for the
// one game you chose to watch.
//
// THE SHEET OPENS FIRST, then fills. That fetch is several hundred ms, and a
// tap that does nothing visible for half a second reads as broken.
//
// WHY THE CONDENSED CUT AND NOT PLAY OF THE GAME. The card has `potg` in hand
// already, so its clip is the tempting anchor — but `eligibleHighlightForPlay`
// matched a real clip in only 25 of 44 sampled games (see its header), so a
// per-play button here would dead-end roughly four times in ten. Every one of
// the 41 Final games in the live sweep had a condensed cut.
//
// SPOILER RULE: this renders only from the flip card's BACK face, which
// PastGameFlipCard mounts only once `revealed` is true — the same gate that
// lets GameResultFace call reveal-only selectors directly. The label is
// deliberately structural ("Condensed game", never a clip title, which would
// narrate the outcome), so even the button's own text would survive being seen
// early. It must not move to the front face, `cardMeta`, or anything
// classifyGameCards computes before the reveal.
export function WatchCondensedButton({ gamePk }) {
  const [open, setOpen] = useState(false)
  const [item, setItem] = useState(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const liveRef = useRef(true)

  // Set on the way IN as well as cleared on the way out. Cleanup-only would
  // leave this false forever after StrictMode's dev double-invoke (mount →
  // unmount → remount runs the cleanup but never re-arms the flag), and every
  // post-fetch guard below would bail — the dialog sticks on "Loading…"
  // forever. Same trap for any real remount, so this is not a dev-only fix.
  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
    }
  }, [])

  const onClick = async () => {
    setOpen(true)
    // Already fetched once — a Final game's content doesn't change, so
    // reopening is free.
    if (item || notice) return
    setLoading(true)
    try {
      const condensed = selectCondensedGame(await fetchHighlights(gamePk))
      if (!liveRef.current) return
      if (condensed) setItem(condensed)
      // MLB posts the cut roughly half an hour after the final out, so on a
      // slate you revealed the moment the last game ended this is a WAIT, not
      // a failure — say so rather than showing a broken player.
      else setNotice('MLB hasn’t posted the condensed game yet. It usually lands about half an hour after the final out.')
    } catch {
      if (liveRef.current) setNotice('Couldn’t load the condensed game.')
    } finally {
      if (liveRef.current) setLoading(false)
    }
  }

  return (
    <>
      <button type="button" className="btn flipback__watchbtn" onClick={onClick}>
        <span className="flipback__watchIcon" aria-hidden="true" /> Condensed game
      </button>
      {open && (
        <HighlightSheet
          item={item}
          loading={loading}
          notice={notice}
          title="Condensed game"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
