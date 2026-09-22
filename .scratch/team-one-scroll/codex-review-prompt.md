# Design review — the team page becomes one scroll of named bands

You are doing a **design review**. Do not review code, architecture, or
implementation. Nothing in `src/` has been changed; this is a drawing and a
document, and the only question is whether the design is right before anyone
builds it.

**Do not edit, create, or delete any file. Do not commit, push, or open a PR.**
Read, render, look, and report back in chat. That is the whole job.

## Where to start

```bash
git fetch origin
git checkout claude/team-sections-design
```

Read these two. They are the deliverable:

1. **`.scratch/team-one-scroll/design.md`** — the decisions, the system stated
   as numbers, and what each one replaced.
2. **`.scratch/team-one-scroll/canvas/records/records.md`** — the Records card
   proposal, with its rejected alternatives.

Skim for background, do not close-read (`scope.md` is 1,200 lines):
`.scratch/team-one-scroll/scope.md` §2B, §2C, §2G ·
`docs/adr/0082-the-team-page-is-one-scroll-of-named-bands.md` (DRAFT) ·
`docs/adr/0030-club-theming-is-identity-only.md` · `CLAUDE.md` · `src/CLAUDE.md`

## How to see the design

The design canvas is **generated from files in this repo**, so everything is
local. Three ways, cheapest first.

**1. Rendered PNGs, already committed** — `.scratch/team-one-scroll/canvas/review/`,
four images at iPhone-13 width:

| File | Shows |
| --- | --- |
| `01-band-head-v4.png` | the settled band system: band head, standfirst, sub-head, first cards |
| `02-records-closed-158.png` | the Records card closed, Milwaukee |
| `03-records-closed-249.png` | the same at Single-A, where the league mark earns itself |
| `04-records-open-158.png` | two groups drilled open |

A snapshot; can go stale. Prefer (2) if you can run it.

**2. Render them yourself** — always current:

```bash
node .scratch/team-one-scroll/canvas/look.mjs <absolute-out-dir> V4-Loaded.dc.html Rec-Closed.dc.html
```

Renders a board at 390px and slices it into strips. Names resolve against
`.scratch/team-one-scroll/canvas/project/`. Prefix `MSYS_NO_PATHCONV=1` on
Windows; `SLICE=1000` for shorter strips. Needs
`npx playwright install chromium`.

**3. Open the source** — `.scratch/team-one-scroll/canvas/project/*.dc.html` are
plain HTML apart from three wrapper tags (`<x-dc>`, `<helmet>`, and a
`support.js` line that 404s harmlessly). Any browser renders them.

Boards worth your time:

| Board | What it is |
| --- | --- |
| `V4-Loaded.dc.html` | **the settled band system.** Judge this hardest |
| `Main.dc.html`, `V2-Loaded`, `V3-Loaded` | v1, v2, v3 — what v4 beat. Their critiques are in `canvas/project/canvas.json` under `notes` |
| `V4-Loading`, `V4-Empty` | loading and no-data states |
| `V4-Reduced.dc.html` | the same band at Single-A — three cards, not five |
| `Rec-Closed`, `Rec-Open`, `Rec-All` | Records closed → drilled → fully open |
| `Rec-249-*` | all three at Single-A |

To compare against what ships today: `npm install && npm run dev`, then
`http://localhost:5173/team/158/numbers?nointro`. The `?nointro` matters — it
stops a welcome modal covering the page.

**If you cannot render or open the boards, say so explicitly in your report.**
A review written from the documents alone is much less useful, and I need to
know that is what I am reading.

## The product, and who reads this page

**Tally Baseball** is a PWA for scoring baseball by hand. It is a **second
screen**: the reader has a paper scorebook open, a pencil in hand, and a game
on. They scan between pitches, **one-handed, on a phone**. They are not studying
the page. It is read-only.

The metaphor throughout is a **paper scorebook** — manila paper, navy ink,
pencil graphite, kraft-tape seals. Not glass, not a dashboard.

**The change.** Today `/team/{id}` is six tabs. It becomes one scroll of seven
named bands — Standing, Ranks, Games, Roster, Farm, Money, About — with a
sticky jump bar. ~20,000px on Milwaukee; five bands and ~7,100px on a
winter-ball club.

## Already decided — do not relitigate

Push back only if one is a **serious error**, and then in one line.

- **The seven bands, their order and contents.** Signed off.
- **Records is never capped.** Every row stays on the page; the ~45 rows a cap
  would drop have nowhere to go.
- **A band a club cannot fill is absent**, never disabled — it does not render
  and is not in the jump bar.
- **Club colour is identity only.** A club may colour a card that identifies the
  club, never page chrome. The jump bar is club-neutral navy.
- **The league mark is league top-5 / bottom-5.** The owner was shown this
  paints 54% of Milwaukee green and *nothing* red, and chose it over the
  alternative. His call.
- **House rules, all lint-enforced:** display and mono ship at ONE weight (700),
  so `font-weight` is a no-op — emphasis is colour or size. No native `title=`
  tooltips. Headings shout (global `#root *` uppercase); body copy stays natural
  case. Rank numbers carry no "#" and sit on their own line from the stat.

## Open — this is where your review lands

1. **Does the band system hold?** One band-head treatment, seven uses, zero
   variants. The head opens on a **full-bleed 2px ink rule**; the sub-head is the
   same gesture at 1px in pencil; a card head is a **contained** club-coloured
   filled bar; a group label inside a card is a contained hairline. The claim:
   **full-bleed = page structure, contained = card structure** yields four
   readable levels from two devices. Does that read at 390px, one-handed?
2. **The two problems it exists to solve.** (a) **Scale** — Records is 3,238px
   against a 91px Ballpark, and the rhythm must survive it. (b) **Floor** — a
   five-band winter club must read as a shorter book, not a broken page. Point at
   a board and say whether each is answered.
3. **The Records reorganization.** Twelve groups become twelve 44px ledger lines,
   each carrying how many splits sit behind it and the spread of win pct inside
   it. 3,238px → 760px closed, everything still reachable. Are those the right
   two figures on the line? Is closed-on-arrival right for this reader?
4. **The league mark as drawn.** A row takes a 3px edge in its gutter and inks
   its win pct to match; an index line takes a *proportional* edge — green sized
   to the top-5 count, clay to the bottom-5, over a faint track. Does a mixed
   group read as mixed? Is the key at the card foot enough?
5. **The system numbers.** design.md §5 claims one band-head treatment, **ten**
   type sizes (all existing tokens), **three** spacing values between blocks
   (48/32/16), and **no new colour token**. Check the drawings against those
   claims and name where they are broken.
6. **The harmonization list.** design.md §3 inventories eight repeated elements
   drawn thirty ways across three pages. Anything missing? Is the collapse right?

**Two things I especially want attacked**, because both are load-bearing:

- **The full-bleed rule as the band head.** If a card's contained club bar still
  out-shouts it at phone width, the system fails and I need to know now.
- **Closed-on-arrival for Records.** The argument is that a scorekeeper wants
  *one* of these rows and which one changes with the inning, so opening any by
  default is right for almost nobody. If that reasoning is wrong, the whole
  reorganization is wrong.

**Do not propose** a two-up grid for cards (tiles are fine and already shipped),
a different accent colour per band, icons as band identity, a coloured pill on
every heading, centre-aligned band heads, a new shadow as a separator, or a
scroll progress indicator. Each was rejected for a reason recorded in design.md
§8 — to propose one anyway, argue against the recorded reason.

---

## How to report back

Output **one markdown block** in chat, in exactly this shape, so it can be
pasted straight into the working session and acted on. No preamble, no summary
paragraph before it.

```
## Design review — team page one-scroll

**Saw the design via:** committed PNGs / rendered myself / source only / could not see it
**Boards actually looked at:** <list them>

### F1 — <the claim, one line>
- **Severity:** blocker | major | minor
- **Where:** <board filename, or design.md §N, or a file:line>
- **Wrong:** <one sentence>
- **Costs the reader:** <one sentence, in second-screen terms>
- **Fix:** <concrete change — a value, a device, a placement>
- **Breaks:** <what the fix costs, or "nothing">

### F2 — ...

### Verdict on the two load-bearing ideas
- **Full-bleed rule as the band head:** holds / fails — <one line why>
- **Closed-on-arrival for Records:** right / wrong — <one line why>

### Working well, do not change
- <one line each, at most four>
```

Rules for that block:

- **Rank findings most serious first.** F1 is the thing you would fix before
  anything else.
- **Severity means:** *blocker* = the design does not work and should not be
  built as drawn; *major* = it works but a reader is meaningfully worse off;
  *minor* = a refinement.
- **"Costs the reader" must be in second-screen terms.** "Harder to scan between
  pitches", "needs a second hand", "the eye crosses the row twice" are real
  costs. "Less elegant", "feels dated", "inconsistent" are not — if you cannot
  name the cost to someone holding a pencil, drop the finding.
- **Every "Fix" must be concrete enough to execute** without another round trip:
  name the value, the token, the device, or the placement. "Improve the
  hierarchy" is not a fix; "take the sub-head to `--fs-title-sm` 18px and drop
  its rule" is.
- **Anchor every finding to something I can open** — a board filename, a
  design.md section, or a file:line. A finding with no anchor will be dropped.
- **At most 10 findings.** If you have more, the extra ones were minor.
- If a claim in design.md is contradicted by what you actually see in a board,
  say so explicitly and name both — that is the most valuable thing you can
  find.
