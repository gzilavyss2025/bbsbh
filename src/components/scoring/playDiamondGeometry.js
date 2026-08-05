// Pure geometry for PlayDiamond.jsx's out-on-the-bases drawing — split out of
// the component (which is JSX-only, no plain-JS test loader in this repo) so
// this file's own math — the whole bug surface — is unit-testable without a
// DOM/JSX renderer.
//
// How many full base-edges the solid path should trace (`traveled`), and
// which two ADJACENT bases anchor the final out leg's half-stroke, given how
// far the runner was credited safe (`reached`, 0-3) and which base he was
// retired approaching (`outAt`, 1-4, or null if he wasn't put out on the
// bases). A runner legally touches every base up through `outAt - 1` before
// the fatal leg even when `outAt` is more than one base past `reached` (2nd,
// out at home — he still rounds 3rd) — so the half-stroke always spans the
// adjacent pair immediately before the out base, never a straight chord from
// `reached` that cuts through the diamond's middle for a non-adjacent pair
// (verified live against gamePk 817477's bottom 4th: Alberto Hernandez
// forced to 2nd, then thrown out at home on Walker Janek's single — the old
// reached-to-outAt chord read as "thrown out at the pitcher's mound").
export function outLegBases(reached, outAt) {
  if (outAt == null) return { traveled: reached, legA: null, legB: null }
  if (outAt > reached) return { traveled: outAt - 1, legA: outAt - 1, legB: outAt }
  // Picked off / doubled off a base he'd already been credited safe at (or
  // beyond) — the solid path is untouched; the tick alone caps it, right at
  // the base itself, same as ever.
  return { traveled: reached, legA: Math.max(0, outAt - 1), legB: outAt }
}
