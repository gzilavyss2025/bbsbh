# Design review — the team page becomes one scroll of named bands

*Hand this whole file to Codex. Everything it needs is in the repo; it does not
need access to the Claude artifact.*

---

You are doing a **design review**, not a code review. Nothing in `src/` has been
changed and nothing is being merged into the app — this is a drawing and a
document, and the question is whether the design is right before anyone builds
it.

## Where to start

```bash
git fetch origin
git checkout claude/team-sections-design
```

Read these two, in this order. They are the deliverable:

1. **`.scratch/team-one-scroll/design.md`** — the decisions, the system stated as
   numbers, and what each one replaced.
2. **`.scratch/team-one-scroll/canvas/records/records.md`** — the Records card
   proposal in detail, with its rejected alternatives.

For background, skim (do not close-read — `scope.md` is 1,200 lines):

- `.scratch/team-one-scroll/scope.md` §2B (the seven bands), §2C (the order),
  §2G (what each band head must carry)
- `docs/adr/0082-the-team-page-is-one-scroll-of-named-bands.md` — **DRAFT**
- `docs/adr/0030-club-theming-is-identity-only.md`
- `CLAUDE.md`, `src/CLAUDE.md`

## How to see the design

**There is no artifact to open.** The design canvas is *generated from files in
this repo*, so the repo is the source of truth and you can see everything
locally. Three ways, cheapest first:

**1. The rendered PNGs, already committed** —
`.scratch/team-one-scroll/canvas/review/`, four images at iPhone-13 width:

| File | What it shows |
| --- | --- |
| `01-band-head-v4.png` | the settled band system: band head, standfirst, sub-head, first cards |
| `02-records-closed-158.png` | the Records card closed, Milwaukee |
| `03-records-closed-249.png` | the same at Single-A, where the league mark earns itself |
| `04-records-open-158.png` | two groups drilled open |

These are a snapshot and can go stale. Prefer (2) if you can run it.

**2. Render them yourself** — always current, one command per board:

```bash
node .scratch/team-one-scroll/canvas/look.mjs <absolute-out-dir> V4-Loaded.dc.html Rec-Closed.dc.html
```

It renders an artboard at 390px and slices it into readable strips. Board names
resolve against `.scratch/team-one-scroll/canvas/project/`. On Windows prefix
with `MSYS_NO_PATHCONV=1`. Set `SLICE=1000` for shorter strips. Needs Playwright
(`npx playwright install chromium`).

**3. Open the source directly** — `.scratch/team-one-scroll/canvas/project/*.dc.html`
are plain HTML apart from three wrapper tags (`<x-dc>`, `<helmet>`, and a
`support.js` line that 404s harmlessly). A browser renders them as-is.

The boards worth your time:

| Board | What it is |
| --- | --- |
| `V4-Loaded.dc.html` | **the settled band system.** Judge this one hardest |
| `Main.dc.html`, `V2-Loaded`, `V3-Loaded` | v1, v2, v3 — what v4 beat. Sticky-note critiques are in `canvas/project/canvas.json` under `notes` |
| `V4-Loading`, `V4-Empty` | the loading and no-data states |
| `V4-Reduced.dc.html` | the same band at Single-A, three cards instead of five |
| `Rec-Closed`, `Rec-Open`, `Rec-All` | the Records card, closed → drilled → fully open |
| `Rec-249-*` | all three at Single-A |

**To compare against what ships today**, run the app and open the real page:

```bash
npm install && npm run dev      # port 5173, strictPort
```

`http://localhost:5173/team/158/numbers?nointro` is today's Records card.
`?nointro` matters — it stops a welcome modal covering the page.

## What the product is, and who reads this page

**Tally Baseball** is a PWA for scoring baseball by hand. It is a **second
screen**: the reader has a paper scorebook open, a pencil in hand, and a game
on. They scan between pitches, **one-handed, on a phone**. They are not studying
the page. It is read-only — it is not a data-entry tool.

The metaphor throughout is a **paper scorebook**: manila paper, navy ink, pencil
graphite, kraft-tape seals. Not glass, not a dashboard.

**The change under review.** Today `/team/{id}` is six tabs. It becomes one
scroll of seven named bands — Standing, Ranks, Games, Roster, Farm, Money,
About — with a sticky jump bar. On Milwaukee that is ~20,000px; on a winter-ball
club it is five bands and ~7,100px.

## What is already decided — do not relitigate these

Push back only if you think one is a **serious error**, and say so in one line
rather than reopening the argument.

- **The seven bands, their order, and their contents.** Signed off on #1105.
- **Records is never capped.** Every row stays on the page. The alternative was
  measured and rejected: the ~45 rows that would fall off have nowhere to go.
- **A band a club cannot fill is absent**, never disabled — it does not render
  and is not in the jump bar.
- **Club colour is identity only** (ADR-0030). A club may colour a card that
  identifies the club, never page chrome. The jump bar is club-neutral navy.
- **The league mark is league top-5 / bottom-5.** The owner was shown that this
  paints 54% of Milwaukee green and *nothing* red, and chose it anyway over the
  alternative. It is his call.
- **House rules, all enforced by lint:** display and mono ship at ONE weight
  (700), so `font-weight` is a no-op — emphasis is colour or size. No native
  `title=` tooltips. Headings shout (a global `#root *` uppercase); body copy
  stays natural case. Rank numbers carry no "#" and sit on their own line from
  the stat they rank.

## What is open — this is where your review lands

1. **Does the band system hold?** One band-head treatment, seven uses, zero
   variants. The head opens on a **full-bleed 2px ink rule**; the sub-head is
   the same gesture at 1px in pencil; a card head is a **contained** club-coloured
   filled bar; a group label inside a card is a contained hairline. The claim is
   that **full-bleed = page structure, contained = card structure** gives four
   readable levels from two devices. Does that actually read at 390px, one-handed?
2. **The two problems it was built to solve.** (a) **Scale**: Records is 3,238px
   against a 91px Ballpark, and the page's rhythm must survive it. (b) **Floor**:
   a five-band winter club must read as a shorter book, not a broken page. Point
   at a board and say whether it answers these.
3. **The Records reorganization.** Twelve groups become twelve 44px ledger lines,
   each carrying how many splits are behind it and the spread of win pct inside
   it. 3,238px → 760px closed. Everything still reachable. Is the index line
   carrying the right two figures? Is closed-on-arrival right for this reader?
4. **The league mark as drawn.** A row takes a 3px edge in its gutter and inks
   its win pct to match; an index line takes a *proportional* edge, green sized
   to the top-5 count and clay to the bottom-5, over a faint track. Does a mixed
   group read as mixed? Is the key at the card foot enough to explain it?
5. **The system numbers.** design.md §5 claims: one band-head treatment, **ten**
   type sizes (all existing tokens), **three** spacing values between blocks
   (48/32/16), **no new colour token**. Check the drawings against those claims
   and say where they are broken.
6. **The harmonization list.** design.md §3 inventories eight repeated elements
   drawn thirty different ways across three pages. Is anything missing, and is
   the proposed collapse right?

## What I want back

Be specific and concrete. For each point:

- **name the artboard or the file and line**,
- **say what is wrong in one sentence**,
- **say what it costs the reader** — this is a second screen, so "harder to
  scan between pitches" is a real cost and "less elegant" is not,
- **propose the fix**, and say what it would break.

Rank your findings **most serious first**. If something is genuinely good, say
so in one line and move on — I need the problems.

Two things I especially want challenged:

- **The full-bleed rule as the band head.** It is the load-bearing idea. If a
  card's contained bar still out-shouts it at phone width, the system fails and
  I need to know now.
- **Closed-on-arrival for Records.** The argument is that a scorekeeper wants
  *one* of these rows and which one changes with the inning, so opening any by
  default is right for almost nobody. If that reasoning is wrong, the whole
  reorganization is wrong.

Please do not propose: a two-up card grid for cards (tiles are fine and already
shipped), a different accent colour per band, icons as band identity, a coloured
pill on every heading, centre-aligned band heads, a new shadow as a separator,
or a scroll progress indicator. Each was considered and rejected for a reason
recorded in design.md §8 — if you want one anyway, argue against the recorded
reason.
