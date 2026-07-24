# SealBox reveals via a lazily-invoked render function, one-directional, re-sealed only by parent remount

An earlier "compute the value, then hide it with CSS/state" design would put
the score in the DOM (or React tree) before reveal, defeating the spoiler
rule the moment a user inspects the page or a stray re-render flashes it.
`src/components/SealBox.jsx` instead takes its revealable content as a render
function (`children` as a function, not a node), invoked only once the box is
in its revealed branch — so the sealed value is never computed or placed in
the DOM ahead of time.

Reveal is one-directional: there's no "hide again" action, so a stray
double-tap can't flash-and-rehide, and there's no "reveal the whole game"
bypass — reveal is strictly per-half-inning. Re-sealing on inning navigation
is deliberately not a state reset inside `SealBox` itself; the parent
(`InningViewer.jsx`, via `InningPage.jsx`) remounts the tree with
`key={`${inning}-${half}`}`, which resets every `SealBox` back to sealed as a
side effect of React's remount semantics rather than bespoke reset logic.

**Amended by ADR-0026 (mechanism unchanged).** `forceRevealed` — already an
established input (`StatBox.jsx`, `HalfInning.jsx`) — gains a global source: the
site-wide Scores Unlocked day pass, which drives the box-score seal
(`BoxScore.jsx`) and, via `effectiveReveal`'s render mark, every half-inning
seal. This is not the "reveal the whole game" bypass this ADR rules out: that
prohibition is about the *persisted* reveal mechanism, and the pass never
advances `revealedThrough`. Reveal stays one-directional and per-half within a
session; the pass is an ephemeral, expiring render override on top of it, and
the render-function gate below is untouched — children are still only invoked in
the revealed branch, so nothing sealed reaches the DOM ahead of time.
