import { selectBoxscore, computeThreeStars, computePlayOfTheGame } from '../../api/boxscore.js'
import { revealStampFacts } from '../../api/linescore.js'
import { selectWinProbPath, selectWinProbBigPlays } from '../../api/winprob.js'
import { computeDerivedByInning, computeGameSuperlatives, computeInningDigest } from '../../api/derive.js'
import { computeGameCalloutNotes } from '../../api/callout-notes.js'
import { eligibleHighlightForPlay } from '../../api/highlights.js'

// REVEAL-ONLY, with ONE legal call site: the render function inside
// `BoxScore.jsx`'s SealBox. Every export of every module imported above is a
// reveal-only selector, which is why this file — not `BoxScore.jsx` — now
// carries their allowlist entries in `src/api/spoiler-manifest.json`.
//
// It lives in its own module only because `BoxScore.jsx` is at its size budget;
// the spoiler footing is unchanged, because a plain function called from inside
// a reveal render runs exactly when that render runs and never before. Nothing
// here may be hoisted into a `useMemo`, an effect, or a render top-level
// (ADR-0001/0002). If you add a second caller, that caller must be inside a
// reveal render too — and then say so here.
//
// Everything score-revealing the sheet needs, computed in ONE place. The seal
// still decides whether a single one of these runs.
//
// Why a cache at all: eight full passes over an ~800 KB feed ran on EVERY
// re-render of the page while the box score was open, not just when the data
// changed — opening and closing the club-sketch modal five times cost 20 of
// them (measured). They now run once per set of inputs.
//
// **ADR-0007 is the rule this obeys**: a manual cache of a reveal-only
// derivation must key on the FEED OBJECT itself, never on a gamePk, a date or a
// timestamp. A live refresh (or a Follow Live poll) mints a new feed object, and
// a new feed object misses this cache outright, so a live sheet can never freeze
// on a pre-refresh derivation — the exact bug ADR-0007 was written about. The
// other four inputs are keyed the same way for the same reason: `highlights` is
// re-polled during a live game and decides the Play of the Game's clip.
export function revealBoxScore(cacheRef, feed, winProbability, highlights, callouts, vsTeam) {
  const cached = cacheRef.current
  const k = cached.key
  if (
    k &&
    k.feed === feed &&
    k.winProbability === winProbability &&
    k.highlights === highlights &&
    k.callouts === callouts &&
    k.vsTeam === vsTeam
  ) {
    return cached.value
  }

  const box = selectBoxscore(feed)
  // WPA and the win-prob path — same gate as the box score itself.
  const stars = computeThreeStars(winProbability, feed)
  const potg = computePlayOfTheGame(winProbability, feed)
  // The video clip for that one play, if MLB cut an eligible one (see
  // eligibleHighlightForPlay). Looked up here for the same ADR-0001 reason as
  // everything else on this line — a clip's title and poster narrate the
  // outcome, so neither may exist in the DOM before the tap. Null is the common
  // case and renders the card exactly as it did before this button existed.
  const potgHighlight = eligibleHighlightForPlay(highlights, potg?.playId)
  const winProbPoints = selectWinProbPath(winProbability)
  const winProbBigPlays = selectWinProbBigPlays(winProbability)
  // One per-inning play-by-play pass, shared by the Statcast superlatives and
  // the By-inning digest so the feed isn't walked twice.
  const derivedByInning = computeDerivedByInning(feed)
  const insights = computeGameSuperlatives(feed, derivedByInning)
  // Per-half pitches / whiffs / LOB — plain play-by-play, so it holds up at
  // MiLB parks where the Statcast card can't.
  const inningDigest = computeInningDigest(feed, derivedByInning)
  // Every leader/streak/situational-record note that fired somewhere in the
  // game (see api/callout-notes.js) — the same notes the innings view shows one
  // at a time on the play they belong to, rolled up here into the Insights card.
  const calloutNotes = computeGameCalloutNotes(feed, callouts, vsTeam)
  // The Logbook stamp's game facts (ADR-0035) — the final score, the two clubs,
  // the venue, the date. Reveal-only for the same reason as everything else
  // here. See StampGameButton for why rendering inside the reveal render
  // function IS the client-side reveal gate.
  const stampFacts = revealStampFacts(feed)

  const value = {
    box,
    stars,
    potg,
    potgHighlight,
    winProbPoints,
    winProbBigPlays,
    insights,
    inningDigest,
    calloutNotes,
    stampFacts,
  }
  cacheRef.current = { key: { feed, winProbability, highlights, callouts, vsTeam }, value }
  return value
}
