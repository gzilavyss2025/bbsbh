# Design critique — what the census cannot see

A design review of the Tally Baseball UI, written against `main` at `608675299`
(the commit that shipped `/design-lab`, PR #1123). Input to issues #1113 (the
collapse) and #1114 (the guard). It does not repeat the census in
`inventory.md`; it starts where that regex stopped.

**How it was measured.** A dev server on port 5171 from the
`claude/design-critique` worktree. Playwright captured `/design-lab`, `/`,
`/team/158`, `/team/158/numbers`, `/player/christian-yelich-592885` and its
Stats tab at 390px and 900px, in viewport-tall strips, and I read every strip
as an image. The source files corroborate what the pictures show; the pictures
came first. Fourteen evidence shots are in `critique-shots/` beside this file,
named by finding. Every count below is from `src/styles/` on that commit.

**Rule of the review.** No product code changed. The bespoke list in
`inventory.md` stands unless a finding argues against it out loud.

---

## The findings, ranked by leverage

Each finding carries: what I saw, the evidence, what to build, what it costs,
and whether it agrees with the inventory's verdict or overturns it.

### 1. The capsule is the system's real primitive, and there are 70 of them, not 10

**What I saw.** On the team hub, one screen holds the tab bar (Overview /
Roster / Games), the "Game notes" button, the "Postseason odds" button on the
band, the club rail's arrow buttons and the "Live scores" toggle. They are the
same drawn object: a hairline outline, a capsule or near-capsule radius,
condensed uppercase at 11–13px, paper fill, navy fill when active. A reader
cannot tell which of them is a tab, which is a badge and which is a door. On
the player page the "Signed" chip, the award chips ("NL MVP ×1") and the "MLB
only" toggle are the same object again. The lab's own verdict chip and jump
links are the same object a tenth time.

**Evidence.** `critique-shots/08-team-hub-390.jpg`, `10-player-390.jpg`,
`06-lab-pills-900.jpg`. A shape search (any rule with a pill radius and its own
`font-size`, states excluded) finds **70 base rules**. Eleven contain the word
`pill`. The others are named `chip` (9), `tag`, `rank`, `level`, `badge`,
`close`, `btn`, `door`, `term`, `mark`, `avail`, `regime`, `pending` and
`button` — for example `.rankchip` (`31-wild-card.css`) is the inventory's
pill recipe declaration for declaration, in mono, and was never counted
because its name says chip (`.rankchip`, `31-wild-card.css:301`). Tabs:
`.teamtabs__btn` (`46-consent-modal.css:360`) draws the same outline as
`.mastheadpill` (`10-lineup.css:547`) at a different height.

**What to build.** One `Pill` with **two axes, not one `tone`**:

- `fill` — `outline` (paper ground, hairline), `paper` (filled paper), `ink`
  (navy, paper text), `seal` (kraft, seal ink). Four fills cover all 70.
- `role` — `tag` (static, 20–22px tall, 2px 7px padding) or `control`
  (tappable, `min-height` 34px, `padding 0 12px`, a pressed state, a focus
  ring). A control and a tag must not share a height, because height is how a
  thumb tells them apart.

Meaning (rookie, prospect, milestone, due-up) lives in the copy and in a
colour token passed to the component, not in a tone name. Six tones is what
happens when meaning and fill are one axis.

**Cost.** Medium: one component, four fills, and a sweep over 70 rules in ~45
partials. Mechanical, but it touches the tab bar, so run `e2e/site-search` and
the hub tab specs after. Do this **before** the card collapse: the card heads
carry these controls.

**Verdict.** Agree with "merge the pills". **Overturn the model**: `tone` with
six values is the residue of six file names. The real split is tag vs control,
crossed with four fills. `#1114`'s guard must count capsules by shape
(`border-radius: var(--radius-pill)` + `font-size`), never by the substring
`pill`, or the 60 unnamed ones stay invisible.

### 2. Buttons are the family with the worst ratio of variants to intent

**What I saw.** There is no `Button` in `src/components/ui/`. `.btn` exists in
`07-team-logo-and-buttons.css:416` with eight modifiers (`--reveal`, `--next`,
`--ink`, `--seal`, `--ghost`, `--danger`, `--chip`, `--account`). Beside it,
about 45 blocks redraw the same outlined condensed-caps control from scratch,
at five heights (28, 30, 32, 34, 44px) and five type sizes (11–15px).

**Evidence.** Three "more" doors are declaration-identical:
`.teammates__more` (`10-lineup.css`), `.marginnotes__more` (`20-charts.css`)
and `.pshistory__more` (`33-awards-history.css`) — I diffed them. Two scope
switches differ in one property (`.stepnav__btn` in `05-masthead-nav.css` vs
`.posinn__scopebtn` in `27-player-position-innings.css`: `--shadow-card` vs
`--inset-cell`). Two doors carry the same ten declarations (`.wirerail__door`,
`25-wide-layout.css`; `.oseason__door`, `78-offseason.css`). Two dashed "load
more" boxes match (`.txpage__more`, `.txcard__more`). `.refreshbtn`,
`.notesbtn`, `.teamtabs__btn`, `.umpage__filterbtn`, `.sitefooter__action`,
`.mytally__rowbtn` and `.sc-zoom__btn` are the same control at 28–44px.

**What to build.** `Button` with `size` (`control` 34px for in-card switches,
`tap` 44px for the bar and the page) and `skin` (`outline`, `ink`, `seal`,
`ghost`, `danger`). Keep `.btn--reveal` bespoke: the kraft hatch on the reveal
button is the seal metaphor doing its job. And a separate **`Door`** — the
"See all ›" / "Full roster ›" / "more" affordance. It is not a button; it is a
right-aligned condensed link in `--accent-link` with a chevron. `ChevronLink`
already exists for it. The three identical `__more` boxes and the two dashed
ones become one `Door` with an `inline` (text) or `block` (full-width row)
layout.

**Cost.** Medium to high in file count (~40 partials), low in risk. Batch it
in two PRs: doors first (they are copy-visible and cheap), then controls.

**Verdict.** Not in the inventory. This is the family #1113 should collapse
**first**, because the pill work (finding 1) and the card heads (finding 3)
both depend on it.

### 3. One band, six selectors: the section heading is the un-counted card variant

**What I saw.** The strongest recurring object in the app is the club-coloured
band with a 3px accent underline — "National League Central", "Ballpark",
"Season Report", "2026 Stats", "Game log", "Photos". On the team hub it sits
inside a card with rounded top corners. On the player page it bleeds to the
page edge with square corners. It is the same idea in two framings.

Under that band the player page uses **four more heading idioms in one
scroll**: a graphite label with a hairline (`.section__title`, "Team leaders
— See all ›"); a kicker over a title inside a card ("PLAYER COMPENSATION /
CONTRACT"); a label with rules either side ("STATCAST ——— PERCENTILE RANK");
and a label inside an inset box ("MILESTONE WATCH").

**Evidence.** `critique-shots/11-player-headings-390.jpg`, `08-team-hub-390.jpg`.
The band is painted by six selectors: `.team-hub.is-themed .thub-card__head`,
`.tstats-card__head`, `.roster-super__head`, `.team-score__head`
(`09-team-info.css:242–248`), `.player.is-themed .section__title--bar`
(`09-team-info.css:153`, negative margins to bleed), and `.metricbar`
(`44-pre-game-cards.css:29`, the undressed navy + `--seal` form). All six read
the same three properties from `lib/headerTheme.js` (`--bar-fill`,
`--bar-accent`, `--bar-text`). Across the tree there are 63 `__title`, 61
`__head`, 47 `__label`, 12 `__eyebrow` and 6 `__kicker` base rules.

**What to build.** `SectionHead` with three looks: `band` (the club-themed
bar, ADR-0030's three properties, corners follow the parent), `label` (the
graphite condensed label with a hairline — today's `.thub-card__head` and
`.section__title`), `rule` (label with a trailing rule). Every look takes a
right-hand `note` and an `action` slot (a `Door` or a `Pill role="control"`).
The kicker-over-title idiom is retired: a card's name is its head. This is the
slot `Card` needs (finding 4).

**Cost.** Medium. Six selectors become one, 26 files render `section__title`
and 22 render the masthead, so the sweep is wide but the DOM barely changes.

**Verdict.** Not in the inventory. It changes the card verdicts: the thing
that varies between two sheets on a real page is the **head**, not the shadow.

### 4. The four proposed card variants are residue, not axes

**What I saw.** In the lab, `.thub-card`, `.abscard`, `.lineupcard`,
`.metriccard` and `.startercard` are indistinguishable, as the inventory says.
`.rehabcard` ("flat", no shadow) is also indistinguishable from them at
catalog size — because the shadow is invisible (finding 5). `.teammatecard`,
`.tradecard` and `.offdaycard` differ only by inner padding. On the real pages
what actually varies between cards is: (a) whether the card has a head and
which kind, (b) whether the body is padded prose or edge-to-edge rows (a
table, a list, a chart), (c) sheet radius + shadow vs tight radius + none.

**Evidence.** `critique-shots/03-lab-seedcard-unstyled-900.jpg` (see finding
11 for why `.seedcard` draws nothing there), `12-team-numbers-runvalue-390.jpg`
(Run Value: a sheet with a label head and a flush ledger body),
`13-team-overview-roster-390.jpg` (Roster: a sheet with a band head and a
flush list body; the "Team leaders" pair is a tight sheet with a band head).

**What to build.** `Card` with three props:

- `frame` — `sheet` (`--radius-md`, `--shadow-card`) or `ledger`
  (`--radius-sm`, no shadow). This is the inventory's Group A vs Group B.
- `head` — `none | label | band`, via `SectionHead` (finding 3).
- `body` — `padded` (prose, facts, charts) or `flush` (a table or list that
  owns its own row rules).

Drop the four proposed variants: `dense` is `frame="ledger"`; `flat` is a
variant of a shadow nobody can see; `interactive` is a **state of the whole
card** (`as="a"` / `as="button"` with the hover tint and focus ring, which
keeps `.offdaycard`'s identity tint by passing it as the accent — ADR-0050
holds); `accent` has exactly one consumer (`.prospectcard`'s 3px top rule) and
stays a namespace rule on that block.

**Cost.** Low once findings 2 and 3 exist; the sheet collapse itself is the
cheap part. Ship `Card` after `SectionHead`, not before.

**Verdict.** Agree: 13 sheets merge; the bespoke seven stay; `.pin-card`
dies; `.stampcard` holds. **Overturn**: the variant axes. **Overturn**
`.delaycard` "leave — it is a banner": it is one of an un-counted **Notice**
family (`.pitchernotice`, `.hint--error`, `AsyncStatus`'s error line,
`.gamephotos__notice`, `.asof-banner`, `.delaycard`) that draws a 3px left
rule on a tinted inset. Count it and give it a `Notice` with a `tone`.

### 5. Six tokens nobody can tell apart

**What I saw.** In the lab's effects row, `--shadow-card`, `--shadow-raised`
and `--inset-cell` render as four identical paper boxes. In the colour rows,
`--paper-0` and `--paper-1` are one swatch; `--ink-0` and `--ink-1` are one
swatch.

**Evidence.** `critique-shots/01-lab-effects-900.jpg`, `05-lab-tokens-phone-390.jpg`.
Perceptual distance (CIE ΔE, 1.0 is the just-noticeable threshold):

| Pair | ΔE | Verdict |
| --- | --- | --- |
| `--paper-0` vs `--paper-1` (canvas vs page) | **1.2** | invisible |
| `--ink-0` vs `--ink-1` (heading vs body) | **4.2** | not a decision |
| `--paper-2` vs `--paper-3` (card vs inset) | 4.0 | marginal |
| `--paper-1` vs `--paper-2` (page vs card) | 5.1 | reads |
| `--rule` vs `--rule-soft` | 7.9 | reads |
| `--ink-1` vs `--ink-2` (body vs muted) | 14.4 | clear |

`--shadow-raised` (27 uses) is `0 2px 4px .10, 0 8px 24px .10` against
`--shadow-card`'s `.08/.06` (130 uses) — on manila the diffuse layer is below
the eye's floor either way.

The type scale has **28 names for 25 sizes**: `--fs-label` and `--fs-compact`
are both 12px; `--fs-display-lg` and `--fs-num-xl` are both 40px; `--fs-field`
and `--fs-num-md` are both 16px. And one role does every job: `--fs-caption`
(11px) is used **793 times** — 393 in the display face (labels, pills, table
heads, button text), 178 in mono (cells, ranks), 83 in the body face (running
copy at 11px). The next role, `--fs-small`, has 234.

**What to build.**

- Fold `--paper-1` into `--paper-0` (`--bg-page` aliases `--bg-canvas`).
  Usage is 91 + 58 vs 32 + 6; nobody will see the change.
- Either push `--ink-0` darker so a heading reads as a heading, or fold it
  into `--ink-1`. A 4.2 ΔE difference is a token that pretends.
- Make `--shadow-raised` actually raised (it is the sheet, the hover card,
  the popover — 27 uses that want to float) or delete it.
- Alias the three duplicate sizes to one name each.
- Split `--fs-caption` by job: `--fs-label` (12, display, tracked) for
  labels, pills and table heads; `--fs-cell` (11, mono) for figures; and stop
  setting body-face copy at 11px at all (83 rules — those are the paragraphs
  a phone reader squints at).
- The primitive tier leaks: 155 rules read `--paper-*` directly and 104 read
  `--rule*` directly, past the alias tier. Add both prefixes to the guard that
  already rejects ad-hoc type values.

**Cost.** Low. Search-and-replace plus one guard line; the shadow change is a
taste call for Gary.

**Verdict.** Not in the inventory. The inventory's "four unfiled dimensions"
finding stands; this one is bigger.

### 6. The 4px spacing scale is nominal

**What I saw.** `src/CLAUDE.md` says the scorebook "snaps to this scale".
It does not.

**Evidence.** In `padding`, `margin` and `gap` declarations across
`src/styles/`: **2,227 raw px literals** against 1,964 `var(--space-*)` reads.
Of the literals, **1,415 are off the 4px scale** (812 on it). 2px (265), 10px
(262), 6px (259) and 14px (109) are used as often as 8px (273) and more than
16px (45). About 490 are odd numbers (3, 5, 7, 9, 11, 13px). `.section__title`
itself is `margin: 18px 0 8px` (`09-team-info.css:515`); `.metricbar` is
`padding: 10px`, `gap: 10px`.

**What to build.** Admit the half steps: `--space-1h` 6px, `--space-2h` 10px,
`--space-3h` 14px, and then guard: no raw px in `padding`/`gap` (margins keep
their 1–3px optical nudges, which are real). Or delete the sentence from
`src/CLAUDE.md`. Either is honest; the current state is neither.

**Cost.** Low for the guard and the three tokens; the sweep is a lint-driven
afternoon and can be done partial by partial.

**Verdict.** Not in the inventory.

### 7. A dashed border means three things

**What I saw.** Dashed rules appear in 44 partials and carry three unrelated
meanings: **provisional** (the hatched 2029 option year on the contract, a
placed extra-innings runner, a postponed game, a bye seed — the pencil mark),
**empty / waiting** (`.stampstrip__mount--empty`, `.refpanel__empty`,
`.logbook__pending`, `.teamphotos__loading`, `.hlclip__loading`), and **door**
(`.txpage__more`, `.txcard__more`, `.awards__expand`, `.txntl-expand`,
`.shelf__newtile`, `.passportpage__addpage`, `.vsteam__door`). The same stroke
says "not real yet", "nothing here" and "tap for more".

**Evidence.** `critique-shots/11-player-headings-390.jpg` (the hatched 2029
bar — the good use), the dashed-selector list from the review run.

**What to build.** Keep dashed for the scorebook meaning only: provisional,
pencilled-in. Doors go solid (finding 2's `Door`). Empty states get one
`EmptyState`: a dashed inset **with graphite copy inside it** — there are 40
empty-state selectors and no component; `.prospectcard__empty` has a label
and a note, `.txpage__empty` is a bare `.hint`, `.refpanel__empty` is a box.

**Cost.** Low to medium. The door move rides on finding 2; `EmptyState` is a
small component and a sweep.

**Verdict.** Not in the inventory.

### 8. Tables: 25 cell recipes for two real densities

**What I saw.** 40 `<table>`s in JSX. Thirty ride on `.standings` by co-class
(`standings rpt` 18 times, `foulboard`, `umprank`, `trrank`, `dh`,
`rv__board`), `.ledger` shares its declaration block, and `.bs__grid` /
`.pitchers__grid` are the bare ledger. Distinct `th`/`td` padding recipes in the
tree: **25**, across roughly 13 named families. Cell padding runs 5px 2px, 6px
1px, 6px 0, 7px 0, 7px 8px, 8px 4px, 8px 9px, 4px 10px. The team-leaders
"Batting / Pitching" pair is a table built from divs, so it obeys none of them.

**Evidence.** `critique-shots/14-player-stats-gamelines-390.jpg`,
`12-team-numbers-runvalue-390.jpg`, `08-team-hub-390.jpg`.

**What to build.** `Table` with `frame` (`sheet` — the boxed `.standings`
look; `bare` — the box-score ledger) and `density` (`row` 7/8px, `tight`
5/2px). Mono figures, condensed heads, a sticky first column as a flag. Leave
`scorecard/*` and `.bs__grid--tally` bespoke: they are the sheet you score on.

**Cost.** Medium. The `.standings` co-class pattern already does most of the
work; the risk is the sticky-cell border trick documented in
`26-player-page.css`, which must survive.

**Verdict.** Not in the inventory.

### 9. Where the metaphor has drifted, and where it must not be flattened

**Drifted.**

- **The seal amber has stopped meaning "sealed".** `--seal*` is read in 62
  partials; 60 rules use it as a **border** on things that are not covers
  (`.mastheadpill`, `.psodds-pill`, `.roster-super__toggle`, the lab's verdict
  box), and 18 mix it into tints — the "1st of 30" rank chip on the Season
  Report is `color-mix(--seal 16%)` with a literal `border-radius: 20px`
  (`.team-score__rank`, `28-team-hub.css:420`). Kraft tape is the one colour in
  this app that carries a promise. When a rank wears it, the promise is
  diluted. Rule for #1113: **the seal token may appear only where a reveal is
  possible** (the seal box, the reveal buttons, the due-up pill, the tear).
  Ranks and highlights get their own alias — `--marker` (highlighter yellow)
  already exists and is barely used. Cost: one alias, one sweep, one guard
  line in `check-stamp-surfaces`'s style.
- **The Season Report card** (`critique-shots/09-team-hub-season-report-900.jpg`)
  is a SaaS scorecard: a card nested in a card, a `9.4 /10`, a headline
  ("The class of the league"), a dot plot with a logo stepper. It is well
  made and it is not a scorebook. Same for "Who challenges" (a scatter with a
  dashed regression line). These are report surfaces; give them a `report`
  frame that says so (a ruled, un-shadowed ledger) instead of the sheet.
- **The contract salary bars** are a finance dashboard's bar chart. The
  hatched 2029 option year is the one scorebook idea in it; keep that, and
  consider a ledger row per season instead of bars.

**Carrying real meaning — do not flatten.**

- The slate card: the `@` watermark in Big Shoulders, the park art, the
  hatched green/clay win–loss stubs on Last 10 (`--win-texture`,
  `--il-texture`). Ticket stubs. This is the front door and it is right.
- The club band with the 3px accent underline. A ledger tab. Six selectors
  (finding 3) but one correct idea, and ADR-0030's "a club may colour a card
  that identifies the club" is exactly the rule that keeps it honest.
- Mono tabular figures everywhere, including in the hero ("95–58").
- Dotted underlines on the situational-records labels and the label-with-rule
  heads: pencil rules on paper.
- The kraft reveal button with its hatch, and the tear.
- The ruled 2×4 passport page.
- The hatched "pencilled-in" option year on the contract.

**Verdict.** The bespoke list is right. I add one rule to it: the seal colour
is bespoke to the seal.

### 10. The naming grammar, as a rule

The system is groping toward a grammar. Written down:

1. **A block is named for its job, never its shape.** `standings`, `roster`,
   `contract`, `runvalue`, `wire`. Shape words — `card`, `pill`, `chip`, `tag`,
   `btn`, `door`, `sheet`, `notice` — belong only to the block that **owns the
   base rule for that shape**. `.thub-card` may keep `card` because it draws
   the box; `.chalcard` may not, because it draws nothing.
2. **A namespace has no shape word.** `.chal`, `.rv`, `.ballpark`,
   `.horizon`, `.adv`, `.foul`. Its elements are `.chal__board`, `.rv__rank`.
3. **The head, the body and the door have fixed names**: `__head` (with
   `__title`, `__note`, `__action` inside it), `__body`, `__door`. Not
   `__kicker`, `__eyebrow`, `__hd`, `__heading`, `__sub`, `__lede`, `__more`.
4. **A variant is `--word`; a state is `.is-word`.** `--ledger`, `--band`;
   `.is-active`, `.is-empty`, `.is-themed`. Never a state as a modifier.
5. **A control's name says it is a control.** `__btn`, `__toggle`, `__tab`,
   `__door`. A `__chip` or `__tag` is never tappable; if it is, it is a
   `__btn` in the pill skin.
6. **The shape guard counts shapes, not words** (#1114). A capsule is
   `border-radius: var(--radius-pill)`; a sheet is the four-token recipe; a
   band is `--bar-fill`. The guard fails when a block outside the allowlist
   declares one.

Under this rule `.reg-pill` is `.reg__tag`, the seven `…card` namespaces lose
the word, `.derbycard` becomes `.gamecard--derby`, and `.gamecardstack` is
`.slate__stack`.

### 11. The lab is a catalog; it needs to become an instrument

**What I saw.**

- **Two verdicts rest on an unstyled specimen.** `.seedcard` and `.pswscard`
  render as bare text in the lab (`critique-shots/03-lab-seedcard-unstyled-900.jpg`),
  because `34-postseason.css` is a per-route partial the lab does not import.
  The page's own header says this trap is why it imports eight partials; it
  missed the ninth. The "tight sheet" group therefore shows three tight sheets
  and one nothing.
- **`.phcard` escapes its stage.** It is `position: fixed`, so on the page it
  floats over the "bespoke" group and clips `.tally-cl-card`'s specimen
  (`04-lab-phcard-escapes-900.jpg`). A popover needs a positioned stage.
- **On a phone the page is 34,144px tall**, 18,000 of it colour swatches at
  one per row (`05-lab-tokens-phone-390.jpg`). The app is phone-first; its
  catalog is not readable on one.
- **No states.** Hover, focus, pressed, disabled, active-tab, empty, error,
  themed — none are shown, and the states are where the buttons and pills
  diverge (finding 1's tag-vs-control split is invisible in a resting
  specimen).
- **No composition.** Every block is alone. A system fails in composition: a
  card with a band head, a flush table body and a door is the unit that
  matters, and it is nowhere on the page.
- **Only two families.** Buttons, heads, tables, doors, empty states and
  notices are absent (findings 2, 3, 7, 8).
- **The lab draws its own capsule** (`.dlab__verdict`, `.dlab__jumplink`).
  Once `Pill` exists the lab should consume it — the first real test of the
  component is whether the catalog can be built from it.

**What to build (for #1115 too).**

- A **pairs** view: two specimens side by side with a one-line question
  ("same thing?"). That is what a design team's eye does; a grid of forty
  does not.
- A **states** row per entry, and a **composition** band: three real cards
  assembled from `Card` + `SectionHead` + `Table` + `Door`, at 390 and 740.
- A **page in miniature**: the player page's Overview tab rendered from the
  new parts, so a change to one part shows up in context.
- Import every per-route partial a listed block owns (assert it at build
  time: a listed class with no matching rule in `document.styleSheets` fails
  the page).
- Collapse the tokens band on phones to a swatch grid.
- If `/design-lab` mirrors to claude.ai/design, mirror the composition band,
  not the grid: the grid is the census, the composition is the system.

**Cost.** Low to medium; the page is 1,800 lines and all of this is additive.

**Verdict.** The inventory's three "first run" findings stand. Two more
belong beside them: the missing partial and the escaping popover.

---

## The three questions, answered short

**1. What does a name census structurally miss?** Everything that shares a
shape and not a substring: 60 capsules not called `pill` (finding 1), ~45
buttons not called `btn` (2), six heads that paint one band (3), the
`Notice` family (4). The reverse also: the inventory called `.rehabcard`
"flat" and `.shadow-raised` a role, and neither difference renders (5); it
called `.seedcard` a tight sheet from a rule the lab never loaded (11); and
`.teammatecard` / `.tradecard` / `.offdaycard` are "the sheet" by recipe but
differ by inner padding rhythm on the page (4).

**2. What families were never counted?** Buttons and doors (worst ratio,
finding 2), section heads (3), tables (8), empty states and notices (7, 4),
form controls (about 40 field and switch selectors; `--fs-field` is read in
eight files and nothing else sets a field size — coherent enough to leave),
charts (`colchart`,
`scatter`, `winprob`, `rolling` in `report/charts.css` and `20-charts.css` —
already one vocabulary; leave), modals (`.scrim` + `.sheet` + the search
overlay, correctly bespoke per ADR-0037; leave).

**3. Where has the metaphor drifted?** The seal colour as decoration, the
report cards as dashboards, the salary bars (finding 9). Where it holds and
must not be flattened: the slate card, the club band, the mono figures, the
pencil rules, the reveal button, the passport page, the hatched option year.

## What is already coherent

The four faces each have one job and keep it. The radii are obeyed (323
`--radius-sm`, 199 `--radius-md`, 142 `--radius-xs`, 139 `--radius-pill`;
literal radii are rare and small). The chart partials are one vocabulary. The
club-theme mechanism (three properties, identity only) is the best-designed
seam in the app. The modals are correctly bespoke. Move on from these.

## Order of work for #1113

1. Tokens (finding 5) and the seal rule (9) — cheap, and everything after
   reads better against a scale that means something.
2. `Door` and `Button` (2).
3. `Pill` on two axes (1).
4. `SectionHead` (3), then `Card` on `frame` / `head` / `body` (4).
5. `Table` (8), `EmptyState` and `Notice` (7, 4).
6. The lab consumes its own parts and grows the pairs, states and
   composition views (11); #1114's guard counts shapes (10).

## Open questions for Gary

1. `--shadow-raised`: make it visibly float (the sheet, the hover card), or
   delete it and have one shadow?
2. The 4px scale: admit the 2px half-steps and guard, or drop the claim?
3. The seal colour: agree that ranks and highlights should stop wearing it,
   and that `--marker` (highlighter) takes that job?
4. The Season Report and "Who challenges" cards: a distinct `report` frame,
   or accept that report surfaces look like reports?
