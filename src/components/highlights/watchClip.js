// WHICH FILM A REVEALED PLAY OFFERS, and what the player is given on a tap.
//
// Two sources, and they are not the same thing:
//
//   1. THE PACKAGE — MLB's own edited highlight from the `content` endpoint,
//      joined to the play on `guid === playId` (api/highlights.js). It is a
//      produced cut with a title, a blurb and more than one angle. It exists
//      for about 7% of plays: 23 clips against 327 pitches on gamePk 824634.
//   2. THE RAW CLIP — roughly 7.5 seconds of the one pitch, keyed on the same
//      `playId` the card already holds and resolved by
//      api/expresslane/clipIndex.js. It exists for effectively every plate
//      appearance, and it carries no words at all.
//
// THE PACKAGE WINS WHEN THERE IS ONE. The raw clip is the floor under it, not
// a replacement for it.
//
// THE BUTTON COSTS NO NETWORK. A `playId` in hand is already proof that a clip
// should exist, so the source is decided from data the card holds. Only the
// TAP asks a host anything, and it asks once, about one playId. Never resolve
// a half-inning up front and never prefetch: the host that serves the bytes
// blocks a client that bursts (clipIndex.js's network note has the numbers).
//
// SPOILER-FREE, and its CALLER still owns the gate. Nothing here reads a
// score, a count, an out or a result — it takes a clip item it never opens
// plus a playId, and returns a word and a URL. But the Watch button may render
// only inside an already-revealed play, because a raw clip's frames carry the
// broadcast scorebug burned into the pixels (score, inning, count, outs). That
// is safe inside a half the reader has revealed and a leak outside one.
//
// DEGRADES, NEVER FAILS LOUDLY. Clips publish 8 to 26 minutes after the pitch,
// so a just-played at-bat has a playId and no clip. There are no clips at all
// before 2016, none for MiLB, and none for All-Star or exhibition games. Each
// of those reaches the same polite notice by the same path, because there is
// no cheap per-play signal that would let the button suppress itself instead.
import { resolveClipUrl } from '../../api/expresslane/clipIndex.js'

export const CLIP_PACKAGE = 'package'
export const CLIP_RAW = 'raw'

// The film one play offers: CLIP_PACKAGE, CLIP_RAW, or null for neither.
export function watchClipSource(highlight, playId) {
  if (highlight) return CLIP_PACKAGE
  if (playId) return CLIP_RAW
  return null
}

// Said when the lookup comes back empty. It is a WAIT far more often than a
// failure, so it says so rather than reading as a broken player.
const NOT_POSTED = 'MLB hasn’t posted this clip yet. Clips usually land 8 to 26 minutes after the play.'

// One tap, one lookup. Returns what the player renders: `src` for a clip that
// is there, `notice` for one that is not.
//
// A MISS IS NOT A FACT ABOUT THE PLAY, only about the minute you asked in, so
// a caller must not remember one — resolveClipUrl keeps a hit and drops a
// miss for exactly that reason, and a second tap after the clip publishes
// gets it. Never throws: a refusal, a timeout, an abort and a clip that has
// not published all arrive here as the same empty answer.
export async function resolveRawClip(playId, { fetchImpl = null, signal = null } = {}) {
  const src = await resolveClipUrl(playId, { fetchImpl, signal })
  return src ? { src, notice: '' } : { src: null, notice: NOT_POSTED }
}
