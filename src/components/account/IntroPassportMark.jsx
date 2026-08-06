// A small decorative passport-stamp roundel for step 2 of the first-visit
// intro (PRD §6.4 element 4) — a nod at the Game Log's keepsake language
// (docs/game-log.md §1: "a passport of the games you've scored") without
// touching the real thing.
//
// Deliberately NOT the real stamp. It renders no club, no score, no gamePk,
// nothing fetched — the same posture as LogbookLanding.jsx's PreviewStamp,
// whose concentric-ring/diamond shape this borrows. scripts/check-stamp-
// surfaces.mjs forbids importing GameStamp.jsx/StampGameButton.jsx from any
// onboarding or profile surface (PRD invariant P4); this component exists
// precisely so the visual language can nod at the Game Log without going near
// either.
export function IntroPassportMark() {
  return (
    <span className="intropassport" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" />
        <circle cx="50" cy="50" r="34" />
        <path d="M50 28 72 50 50 72 28 50Z" />
        <path d="M50 35 65 50 50 65 35 50Z" />
      </svg>
    </span>
  )
}
