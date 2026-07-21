Status: needs-triage

# `.bs__potgDesc` / `.psseries__potgDesc` likely render shouted caps despite their caps-exempt marker

## What happened

While polishing the Day Recap (PR #289, `claude/day-highlights-review-fixes`),
a browser-driven check (Playwright screenshot + `getComputedStyle`) found that
the Day Recap's own `.gotd__potgDesc` (Turning Point play-by-play) computed to
`text-transform: uppercase` in the browser, despite being declared
`text-transform: capitalize` with a `caps-exempt` marker.

Root cause: the ALL-CAPS INVARIANT's `#root * { text-transform: uppercase; }`
(src/index.css) has specificity `(1,0,0)`. A plain, un-prefixed selector like
`.gotd__potgDesc { text-transform: capitalize; }` only has `(0,1,0)` —
**lower** specificity, so `#root *` wins regardless of source order. The
working exemptions elsewhere in the file all prefix with `#root` (e.g.
`#root .gotd__story { text-transform: none; }`, `(1,1,0)`) to actually beat
it. `.gotd__potgDesc` was missing that prefix. Fixed in PR #289.

## Why this matters for other pages

`.gotd__potgDesc`'s own comment says it copies "the same convention as
`.psseries__potgDesc`" (postseason series recap's Play of the Game), which in
turn copies `.bs__potgDesc` (the box score's own Play of the Game). Both of
those **also lack the `#root` prefix**:

```css
/* src/index.css, current main */
.bs__potgDesc {
  ...
  text-transform: capitalize; /* caps-exempt: approved title case for the box score's play-of-the-game narrative only */
}
.psseries__potgDesc {
  ...
  text-transform: capitalize; /* caps-exempt: approved title case for the series page's play-of-the-game narrative, same convention as .bs__potgDesc */
}
```

Each has a comment explicitly asserting `#root *` "isn't affected" for the
*nested* `__potgWhen`/`__potgScore` children (correct, those should stay
uppercase) — but doesn't seem to have verified the **rule's own** specificity
against `#root *`. Given the exact same rule shape newly caught rendering
uppercase in the Day Recap, these two are very likely doing the same in
production right now on the box score page and the postseason series page —
i.e. real play-by-play sentences ("Nolan Arenado homers (13) on a fly ball to
left center field") are probably shouting in full caps instead of the
intended title case.

## Suggested fix

Same shape as the Day Recap fix: split `text-transform` out into its own
`#root .bs__potgDesc { text-transform: capitalize; ... }` /
`#root .psseries__potgDesc { text-transform: capitalize; ... }` rule, matching
the pattern already used by `.gotd__story`/`.gotd__sub`/`.dayhl__rowBtn`/
`.flipback__potg`. Verify with a computed-style check
(`getComputedStyle(el).textTransform`) in a live browser, not just visual
inspection — that's how this slipped through originally (the CSS *looks*
correct on paper; the cascade math is what's wrong).

## Not fixed here

Out of scope for PR #289 (Day Recap only) — both files are unrelated pages
this PR doesn't otherwise touch.
