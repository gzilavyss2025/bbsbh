import { useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// ONE ENTRY ON THE ANIMATION LAB: the title and its Play control, the prose,
// the live stage, and whatever frozen strips the caller hands over as children.
//
// WHY THERE IS A PLAY BUTTON AT ALL. This page mounts fifteen demos at once and
// most of them are ONE-SHOTS — an arrival, an ink-in, a stamp, a cascade. A CSS
// animation with no `forwards` fill is over within about half a second of
// mounting, and the browser then REMOVES it from the element outright. So by
// the time a reviewer has scrolled to the ninth entry, nine of them have
// already played to an empty room. Measured on this page before this control
// existed: the five loops were still running and every one-shot below them
// reported ZERO animations left on the node. The page said "running live" and
// was showing settled ink.
//
// So a stage now rests PAUSED ON ITS FIRST FRAME — the "before" the button
// promises — and plays only when asked (see `.animlab__live:not(.is-running)`
// in 46-consent-modal.css). Nothing on the page moves until you press
// something, which is the other half of the fix: one animation is far easier to
// judge when fourteen others are not running beside it.
//
// PLAY REMOUNTS, IT DOES NOT RESUME. Resuming is not enough for the case this
// exists for. An animation that already finished is GONE from the element and
// there is nothing left to un-pause, which is exactly why a "start" that only
// flipped `animation-play-state` would have looked broken on the entries that
// most needed it. Bumping `runId` re-keys the stage, React mounts a fresh
// subtree, and every animation in it starts from zero the way it does on the
// surface it was copied from. That also makes Play a REPLAY, which is the
// button a reviewer reaches for second.
//
// A HOVER ENTRY NEVER PAUSES AND GETS NO BUTTON. Its demo is a transition, and
// a transition has nothing to start — you start it with the pointer. It still
// has to be SETTLED to be hovered, so `hover` leaves the stage running: the
// straightedge entry's lineup rows have to finish arriving before there is a
// row to point at. `animation-play-state` does not touch transitions, so the
// pause above could never have frozen a hover anyway; leaving them live is
// about what the demo has to LOOK like, not about what pausing would do.
export function Entry({ title, note, live, hover = false, children }) {
  const [runId, setRunId] = useState(0)
  const [running, setRunning] = useState(false)
  const stage = useRef(null)

  // Back to "Play" once the stage has nothing left running. Checked on EVERY
  // animationend rather than the first, which is what keeps a staggered cascade
  // from flipping the label while its later rows are still drawing: nine rows
  // end nine times, and only the last one finds no sibling still going. A loop
  // never satisfies it, so a breath keeps its Stop for as long as it breathes.
  // `animationend` from a pseudo-element targets its originating element, so
  // the drawn cross-out's `::after` bubbles up here like any other.
  const settle = () => {
    const playing = stage.current?.getAnimations({ subtree: true }) ?? []
    if (!playing.some((a) => a.playState === 'running')) setRunning(false)
  }

  return (
    <section className="animlab__entry">
      <div className="animlab__head">
        <h2 className="animlab__title">{title}</h2>
        {!hover && (
          <button
            type="button"
            className="animlab__play"
            /* Fifteen buttons reading "Play" are one button to a screen reader
               unless each says which entry it belongs to. */
            aria-label={`${running ? 'Stop' : 'Play'} — ${title}`}
            onClick={() => {
              if (running) {
                setRunning(false)
                return
              }
              setRunId((n) => n + 1)
              setRunning(true)
            }}
          >
            {running ? 'Stop' : 'Play'}
          </button>
        )}
      </div>
      <p className="hint hint--prose">{note}</p>
      <div
        key={runId}
        ref={stage}
        className={`animlab__live${running || hover ? ' is-running' : ''}`}
        onAnimationEnd={settle}
      >
        {live}
      </div>
      {children}
    </section>
  )
}
