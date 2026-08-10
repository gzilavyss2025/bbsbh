# Focus mode holds after the half commits — decide whether `held` should exist at all

Status: ready-for-human
Raised: 2026-08-10, in review of PR #635 (focus mode)
Mirrored: https://github.com/gzilavyss2025/bbsbh/issues/660
Deferred: deliberately, by Gary — the shipped behaviour is coherent, this is a
design call rather than a defect.

## What happens today

`useFocusMode` (`src/components/inning/focus/FocusControls.jsx`) keeps focus
mode on after the half it is scoring finishes:

```js
const held = sealedSeen && !currentSealed && !summaryOpen
const postHalf = sealedSeen && !currentSealed
const focused = currentSealed || held
```

So revealing a half — by stepping to its last at-bat or by tapping "Rest of
half" — does not return the reader to the ordinary innings page. The page stays
in `.innings--focus` until they tap the new **Summary** button in the floating
bar.

Two consequences follow, and they are one decision, not two.

### 1. The R/H/E/LOB row is behind an extra tap

`styles/focus/stage.css` hides `.innings__row2` in focus mode. Its own comment
justifies that hiding like this:

> the row2 stat card is the R/H/E/LOB summary you write when the half CLOSES,
> at which point the half commits and focus mode ends anyway.

`held` is what makes that sentence false. Focus mode no longer ends when the
half commits, so the totals a scorer writes down between halves — R/H/E, LOB,
pitch counts, the WPA chart — are hidden at exactly the moment they are wanted,
and reachable only by tapping Summary. Before this branch they were simply on
screen the instant the half revealed.

### 2. "Rest of half" renders the whole half in the one-at-bat hero layout

In the held state `stepping` is false, so `PlayByPlay`'s `bounds` is null and
`visibleEntries` is every entry — but `focusHeader={focusOne}` is still true, so
every card renders with an `AtBatHero` header. Measured on gamePk 823035's top
1st at 834px: **4 at-bat cards, 4 hero headers**, each carrying a batter AND a
pitcher portrait, all animating in together on `focus-deal`. The same pitcher's
portrait repeats down the page — the duplication
`.innings--focus .pbp__batshot { display: none }` exists to prevent one card
from having.

ADR-0043 describes focus mode as "**ONE** at-bat as a full-width hero". The held
state is a third layout neither the ADR nor the PR describes: N heroes.

## Options

**A. Drop `held` (recommended).** The half commits, focus mode ends, the reader
lands on the ordinary page with its totals already visible — which is what
ADR-0043 already claims happens. This deletes `held`, `postHalf`, `summaryOpen`,
`openSummary`, the Summary button, the `.revealsplit__btn.is-active` skin
(`07-team-logo-and-buttons.css`), and the `focus.postHalf` gate on
`DueUpConsole`. It is a net simplification and it makes the ADR true again.

**B. Keep `held`, fix its two side effects.** Stop hiding `.innings__row2` once
`postHalf` is true, and pass `focusHeader={focusOne && stepping}` so a committed
half reads with its ordinary `.pbp__top` rows. Then amend ADR-0043 to describe
the held state as a deliberate third phase and rewrite `stage.css`'s "focus mode
ends anyway" justification, which is currently arguing for a behaviour the code
does not have.

Either is defensible. What is not defensible is leaving the ADR and the CSS
comment asserting something the code contradicts.

## Already fixed on the branch, do not redo

Three findings adjacent to this one were fixed in the review pass and are NOT
part of this ticket:

- the console band no longer leaves a dead column in the post-half state
  (`.gamehud--console:only-child`);
- `DueUpConsole` is additionally gated on `stepFrontierIdx != null`;
- the floating dock now clears the action bar (`--pagenav-innings-h`), which is
  what the reader collides with immediately after tapping Summary.

## Comments
