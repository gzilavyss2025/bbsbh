import { useState } from 'react'

// "Did this become true while the reader was watching?" — the one gate every
// one-shot animation in styles/motion/ hangs off.
//
// THE PROBLEM IT SOLVES. A CSS animation runs when its element mounts, or when
// the element gains the class that carries it. That is exactly right for a
// change the reader just caused, and exactly wrong for a cold load, a return
// visit, a navigation, or a force-reveal (the Scores Unlocked pass, ADR-0026,
// or the reader's own stamp, ADR-0048), where the very same DOM appears
// already-changed and would replay a gesture nobody made. A substitution that
// happened in the third inning must render struck through, not draw itself
// again every time the page is opened.
//
// So: this returns true only for the render in which `value` went false -> true
// with the component already mounted, and keeps returning true while it stays
// true, so the class it drives is stable (a class that flickered off would
// restart the animation it is meant to run once). A first render of `true` —
// which is what every cold load looks like — returns FALSE. Unmounting resets
// it, which is why navigating between halves re-arms rather than replays: the
// innings viewer remounts on `key={inning}` anyway (ADR-0002).
//
// State adjusted during render, React's documented escape hatch — the same
// shape ScorecardPage's ink-in diff and GameView's lastInningSection use. The
// render-phase update re-renders before commit, so the committed DOM carries
// the class from its first frame and the animation runs exactly once, rather
// than after an effect on the following frame, where it would visibly start
// late.
//
// NOT ScorecardPage's diff, on purpose. That one diffs a SET of at-bat ids to
// find which cards are new, because it marks individual cells inside a grid
// that is always mounted. Every animation in the motion study turns on a single
// boolean instead — "is this half unsealed", "is this player replaced" — and
// wrapping a boolean in a set diff would have been the more complicated way to
// ask a simpler question. The two are siblings, not one lifted into the other.
//
// It reads a boolean and returns a boolean. It never sees a score, and it must
// not be given one: what it gates is WHEN a mark is drawn, never whether the
// reader may see it. That decision is upstream, in the seal.
export function useBecameTrue(value) {
  const [seen, setSeen] = useState({ value: null, fresh: false })
  if (seen.value !== value) {
    // `seen.value === false` and not a falsy check: the initial `null` means
    // "this component has not rendered yet", which is the cold-load case and
    // the whole point of the gate.
    setSeen({ value, fresh: seen.value === false && value === true })
  }
  return seen.value === value ? seen.fresh : false
}
