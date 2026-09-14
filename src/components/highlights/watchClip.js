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
// so a just-played at-bat has a playId and no clip. That WAIT is what the
// notice below is for, and it is the only miss the notice is honest about.
//
// A PLAYID IS NOT A PROMISE OF FILM, and that is what this gate is for. Whole
// CLASSES of game carry playIds and no clips at all: every MiLB level (sportIds
// 11-14, verified zero across all four), everything before 2016, the All-Star
// game. On one of those, EVERY at-bat drew a button and EVERY tap answered
// "hasn't posted yet — clips usually land 8 to 26 minutes after the play", on a
// game that finished days ago. The sentence was not just unhelpful, it was
// false: nothing was coming.
//
// The signal to suppress the button is per-GAME and already exists —
// `filmCanExist` (api/expresslane/eligibility.js), the same five structural
// rules that decide whether Express Lane draws a door at all, pinned by
// test/express-lane-eligibility.test.js. It rides in as `filmEligible` rather
// than being imported here, so this module stays a pure pair of functions over
// values its caller already holds and needs no feed to test.
//
// IT GATES THE RAW CLIP ONLY. An edited package is a different archive: MLB
// cuts highlights for MiLB games and for seasons long before 2016, and one is
// in hand — already fetched, already joined — by the time this is asked. A game
// with no raw film can still have a package, and that button must still draw.
import { resolveClipUrl } from '../../api/expresslane/clipIndex.js'

export const CLIP_PACKAGE = 'package'
export const CLIP_RAW = 'raw'

// The film one play offers: CLIP_PACKAGE, CLIP_RAW, or null for neither.
//
// `filmEligible` is `filmCanExist(feed)` — whether raw pitch clips can exist
// for this GAME. It defaults true so a caller that genuinely cannot answer
// keeps the old behaviour (a button, and a notice on the tap) rather than
// silently losing film on a game that has it.
export function watchClipSource(highlight, playId, { filmEligible = true } = {}) {
  if (highlight) return CLIP_PACKAGE
  if (playId && filmEligible) return CLIP_RAW
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
