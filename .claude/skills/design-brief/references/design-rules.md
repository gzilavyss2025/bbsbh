# Design rules for a bbsbh design prompt

Shared by `design-brief` and `design-retry`. Each rule says where it comes from. Check a
rule against the repo before you put it in a prompt: a stale rule is worse than none.

## Best practice for a design prompt

These come from the Claude API model-migration notes (Opus 4.7 and later).

- **Pick the direction before the build.** For an open design brief, one prompt asks the
  model for 3 or 4 distinct directions (each: background, accent, typeface, one line of
  reason), stops, and builds only the one the user picks. More effort does not give more
  variety; this step does.
- **Name the look.** A model that gets no palette or type falls back to a house style of
  warm cream, serif display type and an amber accent. Point at the tokens instead.
- **Give the whole spec up front.** A long task works better with the goal, the limits and
  the check all in the first prompt.
- **Give it a way to check the result.** A model that can see its own output (a
  screenshot, a crop) corrects itself. This costs less than higher effort.
- **Keep the scope small.** One page or one card per prompt. A big redesign is a plan
  plus slices, not one prompt.

## What a bbsbh page must keep

- **The spoiler rule.** A scoring surface (slate score cells, lineup pages, innings
  viewer, box score) never holds a score-revealing value before the reveal. A redesign
  must not move that value out of its `SealBox`. Read `CLAUDE.md` "The spoiler rule" and
  `src/CLAUDE.md` "UI-side spoiler enforcement". Other pages (stats, standings, player and
  team pages) open live.
- **Tokens, not raw values.** Semantic variables from `src/tokens/*.css`, not hex. Type
  uses the roles in `tokens/typography.css`. Guards reject raw values and ad hoc type
  (`check-raw-values`, `check-typography`). `src/styles/CLAUDE.md`.
- **One control, one door.** A button that acts on this page is `.btn`. A door that opens
  more is `.door`. Never draw a third. `src/CLAUDE.md` "Design system".
- **Name a block for its job, not its shape.** ADR-0084 and `docs/design-system-naming.md`.
- **A paper scorebook.** Manila paper, navy ink, pencil graphite, kraft-tape amber for
  seals. Numbers are mono and tabular. Structural labels are condensed capitals.
- **`--seal` has a scope.** It is for places where a reveal is possible. Rank and flag
  emphasis use `--marker` (ADR-0083, `check-seal-scope`).
- **Contrast and focus.** Text on background holds WCAG AA (`check-contrast`, ADR-0023).
  Focus uses `var(--focus-ring)`.
- **Capitals.** The all-caps rule lives in `src/styles/01-base.css`. No `.toUpperCase()` in
  a component without a marker (ADR-0017).
- **Team marks on a dark surface** use the `mono` variant of `TeamLogo`, not a CSS filter
  (ADR-0031).
- **Phone first, every width checked.** The main target is an iPhone, about 390 px wide.
  A design also holds at iPad portrait (820 px), iPad landscape (1180 px) and desktop
  (1440 px). iPad is touch, so nothing may need hover.
- **Minor-league data degrades.** Every new field falls back to `''`, `null` or a dash.
- **Look first.** `/design-lab` shows every token, component, card and pill. Use an
  existing block before you add a partial. The partial order in `src/index.css` is the
  cascade; never reorder it.
- **A partial for one lazy screen** is imported by that screen, not by `index.css`.

## Preferences Gary has stated

These live in Gary's memory, not in the repo. A cloud agent cannot read them, so they are
copied here. Check each against `src/` before you cite it.

- No native `title=` hover tooltips. They do not work on touch.
- A rank reads "78 of 89": no `#`, on its own line.
- The page shouts its headings and keeps natural case in body copy.
- `--marker` is a fill, not an ink. Use it for chips only.
- Fonts ship one weight, so `font-weight` does nothing.
- A screen wraps in `.screen`, or the footer widens by 32 px.
- Animation work goes in the Animation Lab page. Check an animation with a multi-frame
  strip, not one still.

## How to verify a design change

- Start the first free reserved dev server (`npm run dev`, or `dev:2` to `dev:5`). Load the
  exact route with `?nointro`. Hand Gary the clickable local URL. The `run` skill has the
  loop and `docs/test-games.md` has verified game ids.
- A cloud session takes a screenshot with `.claude/skills/run/shot.mjs`.
- The e2e suite runs only when Gary asks.
- `npm run lint` runs the design guards. `npm test` and the build still apply.
