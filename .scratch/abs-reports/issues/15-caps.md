A decision needed before the six new sections ship, because it changes how every sentence on the page renders.

## The situation

`#root *` uppercases everything in this app. The sanctioned way out is a `#root`-prefixed rule carrying a `caps-exempt` marker, registered in the list at the top of `src/styles/01-base.css`. There are about twenty such exemptions today.

**`/abs-challenges` has none.** `.hint` and `.rptsource` carry no exemption, so the page's existing sentences — including the biggest-overturn line naming a player and an umpire — ship SHOUTING today.

The new sections carry a handful of sentences that genuinely cannot be moved into a column head: the catcher denominator, the rulebook cap on in-game loss streaks, and the challenges-remaining confound. The design draws them natural-case.

## The choice

**A. Match the page and shout them.** No new rule, perfectly consistent with what ships today. Costs legibility on the few real paragraphs.

**B. Register a caps-exempt for the report pages' prose.** There is precedent with the same argument: `src/styles/11-innings.css:232` exempts Game Notes prose because shouted caps make a real paragraph much harder to scan than the app's short chrome labels. It would also fix the existing biggest-overturn sentence.

Recommendation: **B**, scoped to a single class used by the new caveat lines and the existing `.hint` on this page, registered in `01-base.css` with its reason.

Either way the volume of prose drops hard first — the surviving sentences are labels, which shout fine.

## Acceptance

- The decision recorded here, and if B, the rule added with a `#root` prefix and a comment, plus the entry in the `01-base.css` list
- `npm run lint` passes. An unmarked `text-transform: none`, or a marked one without the `#root` prefix, fails `check-caps` twice over
