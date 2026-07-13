# Innings-section notification cards share one tier system; casing, color, and button copy follow one rule each

A July 2026 audit of the innings viewer (three independent passes: text
formatting, mid-inning notices, button/label copy) found the same shape of
drift repeatedly — the same kind of thing rendered differently depending on
which component happened to get written first. This ADR fixes the standard
each drift should have followed, so it doesn't re-happen piecemeal.

## Notification tiers

Every "something happened" moment in the half-inning feed sorts into one of
three tiers, judged by **whether a person newly becomes active** (enters, or
changes what they're doing):

- **Tier 1 — entry notice.** A fresh actor becomes active: a new pitcher, a
  fresh fielder, a pinch runner, *and now a defensive switch* (a player
  already in the game moving to a new position — previously the one case
  that fell through to a plain `EventNote`, on the reasoning that there was
  "no entering moment to make a card of"; a position change is exactly as
  worth a scorer's notice as a fresh entrant, so `PlayByPlay.jsx` now routes
  `defensive_switch` through `FielderNotice` same as `defensive_substitution`,
  and `select.js`'s `selectPrePitchChanges` builds the same `fielder` shape
  for a between-halves change so `HalfInning.jsx`'s `PrePitchChanges` can
  promote it to a card too, instead of a bullet in the pre-pitch list).
  Rendered as `.pitchernotice.pitchernotice--pbp` (or `--statbox` between
  halves): headshot, "Now V-ing for the Team", full name.
- **Tier 2 — team/administrative event.** No new actor, but a fact worth a
  scorer's attention: a mound visit (now captioned with the real shorthand
  "MV" plus the visiting club's own mark and a used/open pip row —
  `MoundVisitPips`, sized off the exported `moundVisitsAllowed(inning)` —
  instead of a bare "N visits left" string) or an ejection (captioned "EJ" in
  the clay/negative ink, same card).
- **Tier 3 — event note.** A baserunning/misc event with no plate appearance
  of its own (steal, caught stealing, pickoff, wild pitch, passed ball,
  balk) — captioned with the real scorer's shorthand (`EVENT_CODES` in
  `PlayByPlay.jsx`: SB, CS, PO, WP, PB, BK) plus a small headshot of the one
  person the event is actually about, when the feed names one.

All three tiers now render inside the **same** kraft-amber
`.pitchernotice.pitchernotice--pbp` card — there is no separate "thin banner"
chrome and no colored accent-rail-on-card treatment. That rail pattern (a
left `border-left` in the tier's accent color) was the first design tried and
explicitly rejected: this app has no other left-rail notices, and the weight
distinction reads perfectly well from *what's inside* the shared card (a full
headshot vs. a code-and-context row vs. a bare code-and-sentence) without a
second visual language. `EventNote` (plain icon + text line) still exists,
but only as the resolution-failure fallback for tiers 1/2 (the incoming
player isn't in `gameData.players`) — never a first-class rendering choice
for an event type that has a home in one of the three tiers above.

## Casing: the global CSS invariant is the only source of truth

Per-component `.toUpperCase()`/`.toLowerCase()` calls on a rendered name or
label are always redundant — `#root *` in `index.css` already uppercases
everything except the marked `caps-exempt` families (see that file's header
comment). Six components had drifted into calling `.toUpperCase()` in JS
anyway (`RollingLine`, `ExtrasBanner`, `EnteringReference`'s `LineupName`,
`DefenseDiamond`'s `DefenseName`, `RosterPanel`, `StatcastCard`) — removed.
Beyond redundancy, JS `.toUpperCase()` and CSS `text-transform: uppercase`
can disagree on real names (Turkish "i", German "ß"), so the CSS path is the
only one that's actually correct for every name the feed can produce, not
just the common case.

`ordinal()` (half-inning suffixes: "3rd", "21st") was reimplemented four
times, one copy using uppercase suffixes — invisible today only because the
invariant re-uppercases whatever it produced. Hoisted into `src/lib/format.js`
as the one copy; every caller imports it.

## Color: `--accent-positive` and `--accent-negative` are never cross-wired

`--accent-positive` (field green) means runs, hits, on-base outcomes,
successful challenges. `--accent-negative` (clay) means outs, errors,
ejections, alerts. `RollingLine`'s scored-frame highlight
(`.rolling__pick.rolling__runs`) had the two swapped — a half that scored was
inked in the *alert* color, the one place in the app where "the team just
scored" and "something went wrong" shared a color. Fixed to
`--accent-positive`, matching the R stat and the RBI tag it sits above.

## Button/label copy

- **Same-view stepping** (the half-inning nav) uses a leading chevron with a
  short word: "‹ Back", "Next ›". **Cross-section jumps** (the floating
  bar's advance button, box-score link) name the destination with a
  *trailing* chevron and no verb prefix — "Top 4th ›", "Box score ›" — matching
  the convention `TeamInfo.jsx`'s `nextLabel` prop already established
  ("Home team ›", "Innings ›"). The floating bar's `→` arrow and "Next: "/
  "View " prefixes were the one place in the app using a different glyph and
  a different phrasing convention from everywhere else; removed.
- **Reveal affordances always show the word "Reveal" in the visible label**,
  not only in the `aria-label` — matching `SealBox`'s own cover ("Tap to
  reveal") and the slate's "Reveal all results". The floating bar's two split
  buttons ("Next at-bat" / "Whole {half}") didn't; now "Reveal next at-bat" /
  "Reveal whole {half}".
- **An accessible name must contain its visible word** (WCAG 2.5.3) — the
  Back button's `aria-label` said "Previous half-inning", sharing no word
  with its visible "‹ Back"; changed to "Back one half-inning".
- **"Box score" is sentence case in source**, not "View box score", "Box
  Score", or "BOX" outside its intentional short tab-label form — including
  `document.title` (`GameView.jsx`'s `gameTitle`), which the ALL-CAPS
  invariant can't reach since it never touches the DOM.

## Enforcement

- `scripts/check-caps.mjs` gates the CSS half of the casing rule; a sibling
  check should gate the JS half (`.toUpperCase()`/`.toLowerCase()` on
  component-rendered text, opt out via a `caps-js-exempt` marker) the same
  way, in `npm run lint`.
- `src/CLAUDE.md`'s spoiler-enforcement list carries a pointer here so a
  future session touching these components loads this ADR first.
