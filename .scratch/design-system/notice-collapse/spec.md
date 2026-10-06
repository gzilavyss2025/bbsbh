# Notice — the proposed API (#1132, slice N0)

A proposal for Gary to sign off before anyone builds. Every count comes from
`census.md`, which `census.mjs` writes. Where the proposal needs a decision, it
points at `decisions.md`.

It follows `EmptyState` (`../empty-state-collapse/spec.md`): one component in
`components/ui/state/`, one CSS file in `styles/system/`, one class helper in
`lib/design/`, a small set of props, and a `className` that is the block's
namespace. `Notice` owns a frame and its copy faces. It never owns the space
around it, and it never decides WHEN a message shows: the caller does.

This is the third family of #1132. `Table` and `EmptyState` are done. The
dashed-rule fix is the fourth item and a separate PR.

---

## 1. The premise, tested

The issue says six things "all draw a 3px left rule on a tinted inset". I read
the CSS and the JSX of each one, and I looked at each on screen (390px and
900px; `shots/`). **One of the six matches.**

| member | the issue says | what it draws today | seen |
| --- | --- | --- | --- |
| `.delaycard` | 3px rule on a tint | **Yes.** 3px `--navy` left rule, 7% navy tint over `--surface-card`, 1px hairline on the other sides, `--radius-md`, a shadow, a 38px icon bubble, a pop-in. `styles/27-player-position-innings.css:468-480`. `role="note"` (`components/inning/DelayCard.jsx:12`) | `/animation-lab` |
| `.hint--error` | 3px rule on a tint | **No.** `color: var(--clay)` and nothing else: no rule, no tint, no border. The padding comes from `.hint` (`styles/05-masthead-nav.css:606-615`). 20 sites; 6 carry `role="status"`, 14 carry no role | the slate, with the API made to fail |
| `AsyncStatus`'s error line | 3px rule on a tint | **No.** The same bare clay `<p class="hint hint--error" role="status">`, with an optional Retry `.btn` after it (`components/ui/AsyncGate.jsx:66-85`). 39 callers (8 with Retry, 2 with a stale-error line). `AsyncGate()`'s own page error (`:29`) has no role; 22 callers | the slate |
| `.gamephotos__notice` | 3px rule on a tint | **No.** A DASHED 1px `--clay` edge on `--clay-soft`, `--radius-md`, a tag word and a sentence. No left rule (`styles/14-strike-zone.css:625-652`). 2 sites, `role="note"` | `/photos` |
| `.asof-banner` | 3px rule on a tint | **No.** A DASHED 1px `--rule` edge on `--paper-1` (`styles/27-player-position-innings.css:571-582`). Three states in one block: a form, a bare link with no box, and a strip with two actions (`components/seal/AsOfBanner.jsx:56,81,90`) | all three |
| `.pitchernotice` | 3px rule on a tint | **No.** A 1px `--border-rule` edge on all four sides over a 16% `--marker` wash, `--radius-sm` (`styles/12-sealbox.css:842-851`). ADR-0017 rejected a rail for these cards on purpose. 17 frame sites. The same frame also wraps a full 600px-tall pitcher card | the innings viewer |

Where a 3px left rule on a tint DOES exist (census Part 1, `rail` rows):

- `.xl-entry__consent`: a 3px `--marker` rule on a hard-coded `rgb(181 130 74 / 0.1)`
  tint (`styles/77a-express-lane-entry.css:219-228`). That raw value is the
  `--seal` colour (`tokens/colors.css:60`). See section 12.
- Six tool-page classes: `.bpadmin__error`, `.iddrawer__error`, `.iddrawer__warn`
  (3px clay), `.cwb__error`, `.cwb__warn` (2px clay) and `.dlab__warn` (3px clay
  plus a full clay box). They look like the issue's picture. They are all held.

So the unified look is **chosen, not extracted.** That is decision Q1.

### What the census found

| | issue says | measured |
| --- | --- | --- |
| classes that draw "a 3px left rule on a tinted inset" | 6 | **1** of the 6 named. 24 selectors draw a left rule of 1.5px or more on a box; 8 of those 24 have a tint. By job: tool 8, other 7, callout 4, caveat 2, notice 2, control 1 |
| members of the family | 6 | **35 selectors MIGRATE, 97 sites** (57 error, 7 notice, 33 card). Plus 65 selectors / 71 sites HOLD and 82 / 78 n/a |
| candidate selectors | — | **182** in 246 JSX sites in 134 files |
| error lines | 21 (the EmptyState census) | **57 migrating error sites**: 39 `AsyncStatus` callers that share ONE line, 3 lines in `AsyncGate.jsx`, and 15 hand-written lines. Of the EmptyState census's 21: 18 migrate (3 of them are the `AsyncGate.jsx` lines), 2 are held (the highlight dialog), and 1 is a validation line ("Pick two different teams"), which this census calls a `notice` |
| `.pitchernotice` files | 13 (ADR-0084) | **28** (section 7) |
| `.pitchernotice` elements | 18 | **20** elements and 3 element variants |
| banners | "there are six" | **7 named banners are tape, not notice** (section 9). None draws a rule or a tint |

The number "six" is wrong in both directions. The family is smaller in
**looks** (4 tones) and larger in **sites** (97).

---

## 2. What the family is, by job

Census Part 1 and Part 2. A class name is a poor signal here too: of the 36 classes
that carry the word `banner`, 20 are parts of the seven tapes, 7 are chips,
headings or section bands, 5 are as-of controls, 2 are tool rows and 2 are the
as-of strip itself.

| job | selectors | sites | verdict |
| --- | --- | --- | --- |
| error (a fetch or action failed) | 3 | 60 | MIGRATE 57, HOLD 3 |
| notice (a message about the page or the game) | 17 | 18 | MIGRATE 7, HOLD 11 |
| card (the pitcher card family) | 27 | 34 | MIGRATE 33, n/a 1 |
| tool (lab, admin, dev) | 25 | 35 | HOLD |
| tape (gradient or hatched bands) | 20 | 7 | HOLD |
| loading | 4 | 9 | HOLD (the plain hint or the pencil loader keeps them) |
| caveat, callout, control, live, empty, other | 86 | 83 | n/a |

---

## 3. Props

```jsx
<Notice
  tone="caution"                 // 'info' (default) | 'event' | 'caution' | 'error'
  label="Unsealed"               // optional: a caps word or short line before the text
  icon={<RainGlyph />}           // optional: one leading mark (the delay card's bubble)
  action={<Button>Retry</Button>} // optional: ONE control, after the text
  size="block"                   // 'block' (default) | 'compact'
  className="gamephotos__notice" // the block's NAMESPACE, on the root
  role="note"                    // ...rest goes to the root
>
  A photo here can show the result at a glance …
</Notice>
```

It renders one root and up to four children:

```html
<div class="notice notice--caution notice--block gamephotos__notice" role="note">
  <span class="notice__icon">…</span>          <!-- only with `icon` -->
  <div class="notice__body">
    <span class="notice__label">Unsealed</span> <!-- only with `label` -->
    <p class="notice__text">…children…</p>
  </div>
  <div class="notice__action">…</div>          <!-- only with `action` -->
</div>
```

| prop | values | what it does | migrating sites |
| --- | --- | --- | --- |
| children | text or nodes | the sentence | all |
| `tone` | `info`, `event`, `caution`, `error` | the wash and the edge (section 4) | error 57 · event 17 · caution 4 · info 2 |
| `label` | text | a caps word before the text | 2 (`Unsealed`, on two pages) |
| `icon` | one node | a leading mark | 1 (the delay card, `aria-hidden`) |
| `action` | one element | ONE control. A `Button` that acts here, or a `Door` that leads on. Never a third kind (`src/CLAUDE.md`, "One control, one door") | 8 `AsyncStatus` callers with Retry, plus App.jsx, FirstScorebook, Box Lines |
| `size` | `block` | padding `var(--space-2h) var(--space-3)` | most |
| | `compact` | padding `var(--space-1h) var(--space-2h)` | the extra-innings line |
| `className` | the namespace | goes on the root, where a family rule hooks. It may set a margin or an animation. Never a second frame | the photos notice (2), the delay card, the postponed strip |

There is **no `dismiss` prop** in the first API. One row wants it (`.mergestrip`,
held). There is no `as`, no `club` and no `reveal` prop.

Class names follow ADR-0084. `notice` is the one block that owns the `notice`
base rule, so only it may carry the word (clause 1). Elements are `__icon`,
`__label`, `__text`, `__action` and the fixed `__body` (clause 3). The tone and
the size are variants fixed when the block is made (clause 4).

### The class helper, for what is not a message

`lib/design/noticeClass.js` returns the class string for a caller that already
owns its root: `noticeClass({ tone: 'event' })`. The pitcher family needs it (a
card with its own layout, and one `<button>`; section 7). It is pure and
unit-tested like `tableClass.js` and `emptyStateClass.js`.

---

## 4. The tone set the census supports

A tone is a ROLE, never a colour. Four are in use. Counted over the MIGRATE rows
(census Part 1 tone column and Part 2):

| tone | role | colour family it reads | members | sites |
| --- | --- | --- | --- | --- |
| `info` | a neutral fact about the page or the game | navy wash, hairline edge | the delay card, the extra-innings line | 2 |
| `event` | something just changed in the game | `--marker` 16% wash | the pitcher card family, the postponed strip | 17 |
| `caution` | heed this before you go on | `--clay-soft` wash, clay edge | `.gamephotos__notice` (2 pages), the poster-overflow line, the "pick two teams" line | 4 |
| `error` | a fetch or an action failed | `--clay-soft` wash, clay edge, `--clay-deep` ink | every `.hint--error` and `AsyncStatus` line | 57 |

- `caution` and `error` share a colour family on purpose. They differ in ink
  (`caution` keeps body ink with a clay-deep label; `error` is clay-deep) and in
  the live role (section 8). If Gary wants one tone, merge them: no site breaks.
- **No tone reads `--seal*`** (ADR-0083). The tone guard is `check-seal-scope.mjs`;
  `notice.css` is not on its allowlist, so a `--seal` read fails lint.
- **`event` looks near kraft amber, so it needs a reason.** It is `--marker`
  (highlighter yellow, `#E9C33F`) at 16% over card paper: a pale cream, not the
  brown-amber of `--seal` (`#B5824A`). The pitcher card already wears it, because
  ADR-0083 moved that card off kraft. Keeping it is the point: a Notice must not
  become something a reader mistakes for a sealed cover.
- **No club colour.** ADR-0030's 2026-08-10 addendum lets a club colour "a card
  that identifies the club", never "a control, cover, or seal-state report". No
  member needs a club-coloured Notice. A themed Notice would be a later decision
  for Gary, not a default. `Notice` reads no `--bar-accent` or club property.

---

## 5. File layout and directory budgets

- `src/components/ui/state/Notice.jsx`: beside `EmptyState.jsx`.
- `src/styles/system/notice.css`
- `src/lib/design/noticeClass.js`
- `test/notice-cascade.test.js`: pins the CSS slot, the helper, the import rule,
  that `Notice.jsx` and the helper import no `src/api/` or stamp module, and that
  `notice.css` names no `--seal` token.
- A `/design-lab` entry: `screens/designlab/catalog.js` +
  `screens/designlab/components.jsx` (four tones, a label + action one, a compact
  one; at 390px and 740px). Both files are under the 600-line cap
  (409 and 420 lines).
- `src/components/ui/CLAUDE.md` gains one line for `Notice` (the `state/` line
  already says "`Notice` joins it when its census lands").

Directory budgets (`scripts/check-dir-size.mjs`, cap 12), counted on `main` at
`1be24feeb`:

| directory | today | after | note |
| --- | --- | --- | --- |
| `src/components/ui/state/` | 1 | 2 | |
| `src/components/ui/` | 10 files, 6 folders | unchanged | |
| `src/styles/system/` | 11 | **12, at the cap** | `notice.css` is the 12th file |
| `src/lib/design/` | 10 | 11 | |

**`system/` is full after N1.** The next file added there fails `check-dir-size`.
The fix is a subfolder, not a budget: move `empty-state.css` and `notice.css`
into `system/state/`, which mirrors `components/ui/state/`. That edits the
`src/index.css` imports and every test that pins the old path
(`test/empty-state-cascade.test.js`, `test/notice-cascade.test.js`). It belongs
to whichever slice adds the 13th file, not to N1. Do not add a budget entry.

### Cascade

`system/notice.css` goes into `src/index.css` right after `system/empty-state.css`
(`src/index.css:69`) and before `06-loader-and-cards.css`. Every family partial
loads later, so a namespace rule (`.gamephotos__notice { margin: … }`) wins on
order at equal specificity. `test/notice-cascade.test.js` pins the slot.

---

## 6. What `notice.css` owns

```css
.notice {
  --notice-edge: var(--border-rule);
  --notice-wash: transparent;
  --notice-ink: var(--text-body);
  margin: 0;
  border: var(--bw-hair) solid var(--notice-edge);
  border-radius: var(--radius-sm);
  background: var(--notice-wash);
  color: var(--notice-ink);
}
.notice--block   { padding: var(--space-2h) var(--space-3); }
.notice--compact { padding: var(--space-1h) var(--space-2h); }
.notice--info    { --notice-edge: var(--border-hairline);
                   --notice-wash: color-mix(in srgb, var(--navy) 7%, var(--surface-card)); }
.notice--event   { --notice-wash: color-mix(in srgb, var(--marker) 16%, var(--surface-card)); }
.notice--caution { --notice-edge: var(--clay); --notice-wash: var(--clay-soft); }
.notice--error   { --notice-edge: var(--clay); --notice-wash: var(--clay-soft);
                   --notice-ink: var(--clay-deep); }
/* + __icon, __body, __label, __text, __action: faces and gaps only */
```

This is the **wash** look (Q1, recommended). The **rail** look would add
`border-left: 3px solid var(--notice-edge)` and drop the other three edges.

- **A solid edge, no shadow.** The delay card's shadow and the dashed edges of
  `.gamephotos__notice`, `.asof-banner` and `.postponed` are not in the base. A
  caller may keep a dashed edge in its namespace rule until the dashed-rule fix
  decides (section 11). `Notice` never owns a dashed edge.
- **The body face for the sentence** (the `.hint--prose` face; the app uppercases
  every string, `01-base.css`), the display face for the label. The same rule as
  `EmptyState`.
- **Tokens only.** No raw value, so the `check-raw-values` budgets do not rise.

What it does NOT own: **margins** (the caller's namespace; the pitcher frame's
`margin: 4px 14px` stays in the card's namespace), **when it shows**, and **any
motion** (the delay card's pop-in and the postponed strip's entrance stay in
their namespaces).

### The ADR-0084 names

The ledger (`docs/design-system-naming.md:342-351`) gives two renames to this
family. They do not fit the grammar as written:

| ledger row | problem | proposed |
| --- | --- | --- |
| `.delaycard` → `.notice--delay` | `--delay` is not a tone. A variant per member would make `notice--delay`, `notice--pitcher`, … and the tone would stop meaning anything | the delay card becomes `<Notice tone="info" icon=…>` with the namespace `.delay` (`.delay__title`, `.delay__detail`, and its pop-in). The ledger row changes in N5 |
| `.pitchernotice` → `.notice--pitcher` | its 20 elements cannot hang off a modifier (`.notice--pitcher__shot` is not valid BEM) | a namespace with no shape word, picked in N8 (candidates: `.moment`, `.change`). See section 7 |

**Collapsing and renaming are different jobs (ADR-0084).** Slices N1 to N7
collapse. They rename only what they must (the delay card, in N5). N8 is the one
pure rename.

---

## 7. The pitcher card — its own section

The pitcher card is the largest group (33 migrating sites) and the least like a
message. It is three sizes of one frame:

| size | what it is | frame sites | where |
| --- | --- | --- | --- |
| the FULL Now Pitching card (#1344) | headshot, season line, an animated pitch scene, a pitch-mix grid, last appearance: **about 600px tall at 390px wide** (`shots/sheet-members-900.png`; `components/playbyplay/pitcherCard/PitcherCard.jsx`). It shows only where an arm takes the mound; the same call sites draw the compact header otherwise | 3 (`HalfInning.jsx`, `PlayByPlay.jsx`, `PitcherSheet.jsx`) | the innings viewer, the scorecard lens sheet |
| the compact actor card | headshot + two text lines + badges: the pitcher header, fielder, batter, pinch runner. One is a `<button>` (the scorecard lens's arm notice) | 7 | the innings viewer, the lens |
| the handoff cards | the compact header with the Arms-tab table nested under it | 2 | the innings viewer |
| the one-line event bar | a code and a sentence: mound visit (club mark + pips), ejection, steal / pickoff / balk, the in-feed DELAY | 4 | the innings viewer |

All of them wear the same frame: `.pitchernotice--pbp` (hairline on four sides,
16% marker wash, `--radius-sm`) added by the caller through `className`
(`components/playbyplay/PitcherNotice.jsx:70`, `HalfInning.jsx:380,568,578`,
`PlayByPlay.jsx:381,419,451,469`). One site is a `<button>`: the scorecard lens's
`ArmNotice` (`components/scoring/lens/LensCards.jsx:37`).

**The verified file list is 28 files, not 13.** ADR-0084's ledger names 13. The
ten JSX files: `HalfInning`, `BatterNotice`, `EventCards`, `FielderNotice`,
`PinchRunNotice`, `PitcherHandoffCard`, `PitcherNotice`, `PlayByPlay`,
`LensCards`, `PitcherSheet`. The CSS: `12-sealbox.css`, `13-play-by-play.css`,
`focus/atbat.css`, `focus/console.css`, `pitcher-card/card.css`,
`scorecard/lens-cards.css`, plus comment-only mentions in `01-base.css`,
`21a-box-score-stars.css`, `tokens/layout.css`, `postseason/series-live.css`
and `lib/design/contrastPairings.js`. Also `src/components/playbyplay/CLAUDE.md`,
`docs/design-system-naming.md`, ADR-0017, and `test/card-cascade.test.js`, which
**pins a selector by name** (`:905`, `.half:has(.pitchernotice--pbp):not(:has(.statgrid))`,
the rule at `focus/console.css:120`). The ledger's `†` means "names the class only
in a comment" (`docs/design-system-naming.md:44`). It does not mean a guard lists
the file. No script under `scripts/` names `pitchernotice`.

### Option A — `Notice` is the frame; the pitcher card keeps its inner layout (recommended)

The frame comes from `noticeClass({ tone: 'event' })` on the card's existing root
(`PitcherNotice` and its kin render their own `<div>`; the arm button stays a
`<button>`). The inner parts keep their rules and are renamed out of
`pitchernotice` in a separate last slice (N8).

- **Cost:** N6 (event bars and handoff cards: 6 sites in 2 files), N7 (actor
  cards, the full card and the lens button: 10 sites in 5 files) and N8 (the
  rename: 41 rows, about 20 files). Three slices, all on the scoring surface.
- **Gain:** one definition of the "marker wash". The postponed strip uses the
  same recipe today (`styles/06-loader-and-cards.css:518`). ADR-0084 clause 1 is
  met: only `.notice` carries the shape word.
- **Spoiler-scope risk:** the cards sit in the innings viewer, so each of N6 and
  N7 follows the Card plan's seal pin (`test/card-cascade.test.js:918`, the
  `C4_SEAL` table). The frame class moves; no `SealBox`, `revealedThrough` read
  or reveal-only import moves. The focus console's `:has(.pitchernotice--pbp)`
  rule and its test must change in the same commit, or the console layout breaks
  without an error.
- **The grammar problem:** the card is not "label + text". It has no `__text`
  and no `__label` of its own. So it takes the frame through the helper, not the
  component. That leaves two doors into one CSS slot (like `Button` and
  `buttonClass`). It is also why the ledger's `.notice--pitcher` target cannot
  stand (section 6).

### Option B — the pitcher card is held out of `Notice`

`Notice` never draws an actor card. The `.pitchernotice` family keeps its frame
and is renamed only.

- **Cost:** N8 only (the rename, about 20 files). N6 and N7 vanish.
- **Gain:** the scoring surface is touched once, with no visual intent. No seal
  pin beyond the rename's own.
- **The grammar problem:** ADR-0084 clause 1 still forces the rename, because
  `.notice` will own the `notice` base rule, so `.pitchernotice--pbp` would be a
  second "notice" frame under a name that says otherwise. The marker wash is
  then defined twice (`.pitchernotice--pbp` and `notice--event`). `event` has
  only the postponed strip as a user, so the tone is hard to justify. And the
  ledger rows for `.pitchernotice` must be rewritten as HOLD.

Either way N8 is needed. Option A costs two more slices.

---

## 8. Accessibility

Today: 6 of the 20 `.hint--error` sites carry `role="status"` and 14 carry none
(census Part 2, role column). `AsyncStatus` says "status" for an error
(`AsyncGate.jsx:69,82`). `AsyncGate()` says nothing (`:29`). The admin errors use
`role="alert"` (`bpadmin__error`, `iddrawer__error`). The delay card and the
photos notice use `role="note"`.

`Notice` passes `role` to the root. It sets one default.

| tone | role | what the reader's tool announces |
| --- | --- | --- |
| `error`, when it replaces content after a fetch fails | **`role="alert"`** (default for `tone="error"`) | at once, interrupting: "Couldn't load games. Check your connection and try again." The Retry label follows, because `action` is inside the root |
| `error`, stale (data still on screen) | `role="status"` (the caller passes it) | politely, after the current speech |
| `caution` that appears after the reader acts (a filter, a bad pair) | `role="status"` | politely |
| `caution` that is on the page at load (the photos notice) | `role="note"` (static, not live) | nothing on load; it is found by reading |
| `info` at load (the delay card, the extra-innings line) | `role="note"` | nothing |
| `event` inside the revealed feed | none | nothing: the reader just moved there by tapping, and a live region per card would repeat every card |

- A Notice that appears when a fetch fails, or after the reader acts, IS a live
  region. A static one is not.
- Moving 14 silent errors to `role="alert"` is a visible change for assistive
  tools only. The PR body of N2 and N4 says so.
- The pitcher frame gets no role (it has none today).
- Colour is never the only signal: every `error` and `caution` line keeps its
  words ("Couldn't …", "Unsealed"). A tone adds no icon in the first API.

---

## 9. What is held, and why

`Notice` never draws these. Start from EmptyState's holds (`../empty-state-collapse/decisions.md`
Q4). Where a Notice site differs, the reason is stated.

| group | rows | why |
| --- | --- | --- |
| **the seven tape banners**: `.allstar-banner`, `.break-banner`, `.offday-banner`, `.rehab-banner`, `.il-banner`, `.lastplayed-banner`, `.game-status-banner` | 7 sites, 20 selectors | Gradient, hatched or flat-filled bands with white or heading ink and no rule or tint (`styles/27-player-position-innings.css:276-460`). They are the status-tape family of ADR-0083 (three weaves of one hatch), a different language from a washed box. Decision Q5 |
| **`.asof-banner`** | 3 sites, 7 selectors | A control strip, not a message: a date form, a bare link, and a strip with TWO actions. The live state draws no box. A Notice has one message and at most one action |
| **`.liveedge`** (3 sites with the lab demo) | | Reads `--seal` (`styles/07-team-logo-and-buttons.css:442`) and reports the seal state. ADR-0083 allowlists it (`check-seal-scope.mjs:62`); ADR-0030's addendum bars a seal-state report from club colour. No Notice may read `--seal*` |
| `.mergestrip` | 1 | A strip with a link and a dismiss button. It needs a `dismiss` prop no other row uses |
| the pregame board's message and status tag | 2 | Scoreboard art inside `PregameScoreboard.jsx` (a green panel; a solid marker tag) |
| `.hlsheet__empty` in the highlight dialog | 3 | One muted box mixes a wait, an error and "not playable" (`HighlightSheet.jsx:113-126`, `WatchCondensedButton.jsx:67,69`). Split it before it can be a Notice |
| **Express Lane**: `.xl-entry__consent`, `.xl-film__msg`, `.xl__prerollmsg`, `.xl__prerollsub`, `.xl-deck__holding` | 7 sites, 5 selectors | The dark album ground (`--album-*`). No contrast pair for these inks on that ground is asserted. `.xl-entry__consent` is a real consent line (the closest match to the issue's picture); a Notice there is a separate call |
| `.sc-armnotice` (the button) | 1 | Stays a `<button>`; takes the frame through the helper (section 7) |
| lab, admin and dev pages | 35 sites, 25 selectors | #1113 Q5 and EmptyState Q4: leave them. **Here they differ:** they hold the only clay 3px rules (section 1). Moving them would be cheap, and they would set the `error` look. The answer stands unless Gary lifts it |
| loading lines | 9 | They keep the plain hint or the pencil loader (EmptyState, "Already decided") |
| footnotes (`caveat`) | 6 here, 64 counted in the EmptyState census | They do not move. This census found one edge case: `LogbookStatsPage.jsx:271` warns that totals leave out unresolved stamps |

Two groups the issue did not name belong to other families: the **EmptyState**
rows (5) are done; the **callouts** (5: `.pbp__callout`, `.pbp__subnote`,
`.tscoremodal__pull`, `.researchdiary__question`) are typography inside content.
The word "callout" also names the Margin Notes feature (`docs/callouts.md`); the
census uses it only for an editorial rule.

---

## 10. The spoiler scope

79 sites sit on a spoiler surface (innings 43, slate 13, Express Lane 10,
lineups 7, scorecard 5, box score 1). 44 of them migrate. Four members are the
ones to watch: the pitcher family, the delay card, the slate's `AsyncStatus`
error line, and the as-of banner.

The as-of banner is **beside** a scoring surface, not on one. `AsOfBanner` is
imported by the team hub, the player hub, both leader boards and the Scout
head-to-head (`TeamHubShell.jsx:319`, `PlayerHubShell.jsx:215`,
`LeadersPage.jsx:105`, `TeamLeadersPage.jsx:53`, `scout/HeadToHead.jsx:36`). All
are open surfaces (ADR-0034's "The cutoff is opt-in now"). It is held anyway.

The rule is the Card and Table rule: **move the box, never the gate.**

- **`Notice` fetches, computes and gates nothing.** `Notice.jsx` and
  `noticeClass.js` import no `src/api/` module and no stamp module (ADR-0035).
  `notice-cascade.test.js` pins that.
- **It has no reveal prop and must not gain one.** A sealed value is the
  `SealBox`'s job (ADR-0002). A Notice is never a placeholder for a value that
  a reveal fills.
- **The test that decides WHEN stays byte for byte** where the caller put it:
  `revealed || isNextToReveal` for the Now Pitching card (`HalfInning.jsx:373`,
  ADR-0010); the half filter on the delay card (`InningViewer.jsx:864-868`, which
  renders OUTSIDE the seal for the half on screen, ADR-0043); `effInning > regulation`
  for the extra-innings line (`InningViewer.jsx:854`, ADR-0008); the
  `postponed &&` mount in `GameCard.jsx:291`. A slice changes the element only.
- **Copy says what is missing or what state the page is in, never what happened
  in the game.** Safe today: "Couldn't load games", "Delay in progress", "Play
  stopped for 42 min", "Postponed", "Games resume Thu, Jul 16". The in-feed
  `DelayNotice` names the man who LEFT (ADR-0060); that copy comes from the
  caller and does not change. A new Notice on a scoring surface must not say a
  run, a hit or an out.
- **Each spoiler slice (N4 to N8) adds a seal pin** like `C4_SEAL`
  (`test/card-cascade.test.js:918-950`): per touched file, the reveal-only
  imports, the `<SealBox>` count and the `revealedThrough` count, measured on
  `origin/main`. If it fails, stop and ask. Never edit the literal to match.
- **The spoiler scope gets its own slices.** N4 (the shared error line, which
  includes the slate and the lineup pages), N5 (delay, extras, postponed), N6 and
  N7 (the pitcher frame), N8 (the rename).

---

## 11. The dashed members — an input to the dashed-rule fix

This census does not decide what dashed means. It records the dashed edges on a
candidate (census Part 4, 10 rules):

| rule | selector | job and verdict |
| --- | --- | --- |
| `styles/14-strike-zone.css:625` | `.gamephotos__notice` | notice, MIGRATE (N3) |
| `styles/27-player-position-innings.css:571` | `.asof-banner` | notice, HOLD |
| `styles/06-loader-and-cards.css:508` | `.postponed` | notice, MIGRATE (N5) |
| `styles/scorecard/lens-cards.css:82` | `.sc-armnotice__more` (a divider inside a button) | control, n/a |
| `styles/49-passport-book.css:989` | `.logbook__order` | control, n/a |
| `styles/postseason/series-parts.css:54`, `styles/scout/scout.css:383` | two readouts | other, n/a |
| `styles/05-masthead-nav.css:519,524,588` | `.levelprog__step` (the stepper) | other, n/a |

If a Notice tone should be dashed, the candidates are `caution` (it is dashed
today on the photos notice) and `event` (the postponed strip is dashed: "held, not
final"). Both fit the issue's "provisional" reading, but I did not pick. N3 and N5
keep the dashed edge in the member's namespace rule, so there is **no visible
change** and the dashed-rule PR can decide.

---

## 12. Findings outside this plan

Found while reading. None is fixed here.

1. **Raw seal tint.** `rgb(181 130 74 / x)` is `--seal` (`#B5824A`) written as a
   literal in three Express Lane rules: `.xl-entry__consent` (`77a:224`),
   `.xl-entry__choice.is-on` (`77a:164`) and `.xl__chip.is-on` (`77:226`). The
   comment at `77a:148-153` says the chosen card left kraft at ADR-0083.
   `check-seal-scope.mjs` reads tokens, so it cannot see these. A Notice must not
   copy the value.
2. **An error drawn as empty.** `OffseasonLead.jsx:52` reads only `data` and
   `loading` from `useAsync`, so a failed league-moves fetch draws the
   EmptyState "No moves filed in the last N days".
3. **A failure with no message.** `TeamTransactionsCard.jsx:165` shows a failed
   page fetch only as the button label "Try loading again".
4. **Two delay designs.** `.delaycard` (between halves, navy) and the in-feed
   `DelayNotice` (marker card with a clay `DELAY` code). Both stay; they differ on
   purpose (ADR-0060).
5. **The ledger.** `docs/design-system-naming.md` lists 13 files and 18 elements
   for `.pitchernotice`. The verified numbers are 28 and 20. Its `.notice--delay`
   and `.notice--pitcher` targets do not fit the grammar (section 6). `N9` fixes
   the rows.
6. **A local name clash.** Both research-diary pages define a local
   `function Notice()` (`ResearchDiaryPage.jsx:62`, `ContenderDiaryPage.jsx:55`).
   They are admin pages and are held, but a shared `Notice` import there would
   collide.
7. **`.hint--error` outlives the collapse.** Five dev pages still wear it
   (`UniformNamesPage`, `ScorecardLab`, `ColorLabBody`, `DugoutRail`, `milb.jsx`),
   so the rule stays in `05-masthead-nav.css` unless Gary lifts the tool hold.

---

## 13. Visible change — one row per member that would move

Look A (wash) and the recommended answers to `decisions.md`. "Before" is what
the reader sees now.

| member | before | after | where | pages |
| --- | --- | --- | --- | --- |
| bare error lines (`.hint--error`, 14 lines) | clay text, no box | clay-deep text in a clay-soft box with a clay hairline; `role="alert"` where it was silent | open pages: the game route, the scorebook archive, series pages, Scout, Stamp In, the notes archive | 7 files |
| the `AsyncStatus` error line (39 callers) | clay text, `role="status"`, Retry `.btn` below | the same words in a box, Retry inside it, `role="alert"` | **the slate**, the lineup page, standings, every report board | 38 files |
| `AsyncGate()` page error (22 callers) | clay text, no role | boxed, `role="alert"` | player and team pages | 2 route families |
| Box Lines error | grey text, then a Retry button | a clay box with Retry inside | the lineup page (Box Lines sheet) | 1 sheet |
| slate card back error | clay text | boxed | the slate, after Reveal | 1 |
| `.hint` errors in the caveat colour (All-Star Legacy, club list) | grey text | boxed, `error` tone | `/all-star-legacy`, My Tally | 2 |
| the photos notice | dashed clay box, tag + text | the same words and tag; edge stays dashed until the dashed-rule PR; ≤ 2px less side padding | `/photos`, a team's photos | 2 |
| the delay card | 3px navy rail, shadow, 7% tint | **no rail, no shadow**; the 7% navy wash, a hairline all round; icon and pop-in kept | the innings viewer | 1 |
| the extra-innings line | caps label on card paper | body-face sentence on the navy wash | extra-inning halves | 1 |
| the postponed strip | marker wash, dashed edge, stamp | the same (the dashed edge stays in its namespace) | the slate | 1 |
| the pitcher card family | marker wash, hairline, `--radius-sm` | **none**: the frame values are identical; the margin stays in the card's namespace | the innings viewer, the lens | 33 sites |
| poster-overflow line, "pick two teams" line | clay or grey text | boxed `caution` | game preview, the game finder | 2 |
| erase failure | clay text in the sheet | boxed | My Tally erase sheet | 1 |

The largest change is the bare error line becoming a boxed callout on about 45
screens (48 files), one of them the slate. That is decision Q2. If Gary keeps those as text,
the rows above turn into "none" and `Notice` has 6 sites, not 97.

---

## 14. Contrast pairs `Notice` needs

Proposed for `src/lib/design/contrastPairings.js`. I did not edit it. Ratios are
measured with that file's `ratio()` on the shipped token values. `color-mix()` is
precomputed by hand (the guard cannot parse it), the way `#F8EECE` is.

| fg | bg | ratio | min | for | already asserted? |
| --- | --- | --- | --- | --- | --- |
| `text-heading` | `#EBE8DD` (navy 7% over `--surface-card`) | 14.58 | 4.5 | `info` title | no |
| `text-body` | `#EBE8DD` | 11.90 | 4.5 | `info` sentence | no |
| `text-caption` | `#EBE8DD` | **4.72** | 4.5 | `info` detail line (the delay card's second line). Thin margin | no |
| `text-heading` | `#F8EECE` (marker 16% over card) | 15.43 | 4.5 | `event` | yes (`lens notice: label and name`) |
| `text-body` | `#F8EECE` | 12.59 | 4.5 | `event` sentence | no |
| `text-caption` | `#F8EECE` | 4.99 | 4.5 | `event` caption (`__pitchno`, `__mvcount`) | no |
| `clay`, `clay-deep` | `#F8EECE` | 4.70, 6.81 | 4.5 | `event` code and flag | yes |
| `text-body` | `clay-soft` (`#F3E0DB`) | 11.46 | 4.5 | `caution` sentence | no |
| `clay-deep` | `clay-soft` | 6.20 | 4.5 | `caution` label, `error` text | yes (`pill tint: clay`) |
| `clay` | `clay-soft` | **4.28** | 4.5 | **fails**: do not use `--clay` as text on a clay wash | — |

The last row matters. Today's error text is `--clay` on the page (4.75:1). Moved
onto a clay-soft box it would drop to 4.28:1 and fail AA. So `error` ink is
`--clay-deep`. A clay edge (non-text, 3:1) is `--clay` against `--surface-card`
at 5.05:1 and needs no new pair.

---

## 15. The lab

`/design-lab` gets a `Notice` entry in N1: the four tones, a label + action
`Notice`, and a `compact` one, at 390px and 740px. The delay card keeps its
`/animation-lab` demo (`screens/AnimationLab.jsx`). The lab's `delaycard` row
(`screens/designlab/catalog.js:254`) names the class as data and must change in
N5.

## 16. What I did not see live

Seen live (390px and 900px, `?nointro`): the delay card (`/animation-lab`, pop-in
frozen at rest), the photos notice (`/photos`), the as-of banner in all three
states (`/leaders`), the slate error line (the API made to fail), and the pitcher
family (`/07072026/milstl-2/top1` to `top8` with a reveal mark in `localStorage`,
the way a reader's device holds it). Seen as **injected markup with the real
classes** (the state is rare): the seven tape banners, the postponed strip, the
merge strip, the extra-innings line, the live-edge chip. **Not seen:** the
`AsyncGate()` page error, the standings error line, the Box Lines error, the
slate card-back error, the highlight dialog, and every `HOLD` Express Lane row
(inferred from CSS).

---

## 17. Corrections after N0 (measured on `main` at `9d01ade71`)

The stack PR (#1518) landed after the census. Three numbers above change.

1. **Three `AsyncStatus` callers never show an error.** `screens/scout/ScoutPage.jsx`,
   `screens/scout/meetings/MeetingsPanel.jsx` and `screens/designlab/scout/ScoutLab.jsx`
   pass only `loading hasData={false}`. They reach the loader, not the error line.
   Their rows are now `loading`, HOLD. The callers that can show the error line are
   **36, not 39**, so the migrating error sites are 54 and the total is 94, not 97.
   The N4 count of 45 becomes 42. The Scout restructure (#1490) also moved two
   rows: `screens/scout/HeadToHead.jsx#1` is `MeetingsPanel.jsx#1`, and
   `screens/scout/MapParts.jsx#1` is `screens/scout/zones/MapParts.jsx#1`. It added
   `.scout__callout` (a 3px `--award-line` rule on `--surface-card`, no tint), a
   generated sentence about the map: callout, n/a.
2. **The pilot line moved.** `.posterstudio__warn` is at `screens/GamePreview.jsx:169`,
   not 167. The rule is still `styles/62-game-preview.css:138`.
3. **Three tests pin the import order around `empty-state.css`.** `notice.css` sits
   between `empty-state.css` and `06-loader-and-cards.css`, so N1 changes the
   expected list in `test/empty-state-cascade.test.js` (06 right after
   `empty-state.css`), `test/card-cascade.test.js` (only `table.css` and
   `empty-state.css` between `card.css` and 06) and `test/table-cascade.test.js`
   (only `empty-state.css` between `table.css` and 06). The checks keep their strength.
