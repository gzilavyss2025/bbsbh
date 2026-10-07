# Decisions for Gary — notices (#1132)

## The five questions

Each line gives my recommendation first, then the cost. Gary answered all five on 2026-10-06 (table below).
The census (`census.md`) and the proposal (`spec.md`) back each one.

1. **Q1. What does a notice look like?** Recommended: **a thin edge all round
   and a pale tint inside (a "wash"), the same for every tone.** Trade-off: only
   the delay card has the thick left bar today, and it loses it. The issue asks
   for the bar. The census shows 1 of the 6 named things draws one.
2. **Q2. Does a one-line error get a box, or stay text?** Recommended: **a box**,
   with a smaller box for errors that sit inside a card. Trade-off: about 42
   screens change at once, and the slate is one of them. The words do not change.
3. **Q3. Is the pitcher card in or out?** Recommended: **in, but only its outer
   frame.** Its inside layout and its look stay the same. Trade-off: three
   slices on the innings viewer, which is the screen the app exists for.
4. **Q4. Which tones?** Recommended: **four: info, event, caution, error.**
   Trade-off: caution and error are the same colour family; they differ in ink
   and in what a screen reader says.
5. **Q5. Leave these as they are?** Recommended: **yes.** The seven tape
   banners, the as-of banner, the live-edge chip, the sync strip, the Express
   Lane lines, the pregame board tags, and the lab and admin pages. Trade-off:
   they keep their own look, and 2 of the 6 things the issue names stay out.

| # | Gary's answer |
| --- | --- |
| Q1 | Wash: a thin edge all round and a pale tint, the same for every tone (2026-10-06). |
| Q2 | A box: every error becomes a Notice with tone `error` (2026-10-06). |
| Q3 | Frame only: the pitcher cards take their outer frame from a shared class (2026-10-06). |
| Q3, name | The pitcher card family is named `.change` (ADR-0084: a name for the job, no shape word). N8a, N8b and N8c rename it (2026-10-07). |
| Q4 | Four tones: info, event, caution, error (2026-10-06). |
| Q5 | Leave all: the 71 held sites stay as they are (2026-10-06). |

Some words used below:

- A **notice** is a message about the state of the page or the game: "Play
  stopped for 42 min", "Couldn't load games", "Unsealed". It is not "Loading…"
  and it is not "Nothing here" (that is an empty state, which is done).
- A **wash** is a pale tinted fill with a thin edge around it. A **rail** is a
  thick bar on the left edge only.
- A **tone** is a role, not a colour: what the message is for.
- A **tape banner** is a filled band across a page head, like the injured-list
  strip. It has no rail and no wash.
- **Dashed** is the pencil line. Its meaning is a separate PR (the fourth item
  of #1132). This plan does not decide it.

---

## Q1. What does a notice look like?

**Recommendation: the wash.** A 1px edge all round, a pale tint, rounded
corners, no shadow. Four tones change only the tint and the edge colour.

The issue says six things "all draw a 3px left rule on a tinted inset". I tested
that (`spec.md`, section 1). One of the six does: the delay card. The others
draw a dashed box (the photos notice, the as-of banner), a thin edge with a tint
(the pitcher card) or just coloured text (the error lines). So the shared look
has to be chosen. It cannot be copied from what exists.

| option | what it is | who it matches today | what changes |
| --- | --- | --- | --- |
| **A. Wash (recommended)** | thin edge all round, pale tint | the pitcher card family (33 sites), the postponed strip, the photos notice (minus the dashes) | the delay card loses its bar and its shadow |
| B. Rail | a 3px left bar on a tint, no other edge | the delay card (1 site) and six lab and admin classes | the pitcher cards lose their box (33 sites, and ADR-0017 chose against a rail on purpose); every error line gets a bar |
| C. Per tone | a bar for info and error, a wash for event and caution | nothing wholly | two looks in one component, and a rule to remember |

Why A: it is the look the largest group already has. ADR-0017 (July 2026)
rejected a left bar for the notification cards and said "this app has no other
left-rail notices". Since then one other app-facing bar has appeared (the
delay card). Choosing B means overturning ADR-0017 for 33 sites to match 1.

Trade-off: the delay card changes. Its bar goes, its shadow goes, and its tint
and icon stay. If the bar matters to you, B is the answer, and the cost is the
pitcher card.

## Q2. Does a one-line error get a box, or stay text?

**Recommendation: a box.** The tone is `error`: a pale clay fill, a thin clay
edge, dark-clay words. An error inside a card, a row or an article takes the
smaller size so it does not become a box in a box.

Today an error is coloured words and nothing else (`.hint--error`, one colour
rule). That is 57 places: 39 pages that share one line (`AsyncStatus`), 3 lines
in the cold-load gate, and 15 written by hand. One shared line draws the 39, so
the change is 3 lines of code, but the check list is long.

| option | what it is | what changes |
| --- | --- | --- |
| **A. Box (recommended)** | every error is a notice with tone `error` | about 42 screens look different; the slate shows the box when games fail to load. Screen readers hear the error at once (`role="alert"`) where 14 of 20 lines were silent |
| B. Text stays | errors stay coloured words; Notice serves only the 40 places that already have a box | nothing changes on the error pages. Notice shrinks from 97 sites to about 40. Two looks for "something failed" stay |

One fact makes A safer than it looks. The error words are `--clay` on the page
(4.75:1). Put on a pale clay box they would fall to 4.28:1 and fail the contrast
check. So the box uses the darker clay for its words (6.20:1). That is a design
rule, not a surprise.

Trade-off: a plain grey page gets a loud box on a bad day. That is the point of
an error. If a screenshot shows one box that looks heavy, that place takes the
smaller size or goes on the hold list.

## Q3. Is the pitcher card in or out?

**Recommendation: in, but only its outer frame (option A).** The inside layout
(headshot, name, badges, the pitch scene) is not touched. The same frame class
also draws the postponed strip, so the app keeps one definition of that yellow
wash.

The pitcher card is not one thing. It is a full card about 600px tall (stats, a
pitch scene, a pitch grid), a compact card with a headshot, two handoff cards
with a table, and four one-line bars (mound visit, ejection, steal, delay). All
wear one frame. One site is a button (the scorecard's arm notice).

| option | what it is | cost | risk |
| --- | --- | --- | --- |
| **A. Frame only (recommended)** | the frame comes from the shared class; the inside keeps its rules; a last slice renames `pitchernotice` away | 3 slices (N6, N7, N8), about 28 files touched in all | all on the innings viewer and the scorecard. The focus console has a rule that finds the frame by its name; a test pins it. A seal pin test guards each slice |
| B. Held out | the card keeps its frame; only the rename (ADR-0084) happens | 1 slice (N8), about 20 files | the lowest. But the yellow wash is then defined twice, and the `event` tone has one user |

Each option has a naming problem:

- A: ADR-0084's table says `.pitchernotice` becomes `.notice--pitcher`. That
  cannot work. The card has 20 inner parts, and a "variant" cannot own parts.
  The card needs its own name with no shape word in it. I suggest one is picked
  in N8 (`.moment` or `.change` are the candidates).
- B: the name `pitchernotice` breaks ADR-0084 clause 1 as soon as `.notice`
  exists, so the rename is needed anyway. The ledger row becomes a HOLD.

Trade-off: A spends two more slices on the most careful screen in the app to get
one definition of a wash. If you would rather not touch it, B is safe and loses
little.

## Q4. Which tones?

**Recommendation: four.** The census found four roles, each with real users.

| tone | role | users | colour family |
| --- | --- | --- | --- |
| `info` | a neutral fact | 2 (the delay card, the extra-innings line) | navy tint |
| `event` | something changed in the game | 17 (the pitcher cards, the postponed strip) | highlighter yellow tint |
| `caution` | heed this | 4 (the photos notice on two pages, the poster-overflow line, "pick two teams") | pale clay |
| `error` | something failed | 57 | pale clay, dark-clay words |

Two cautions:

- **No tone uses the sealed amber** (`--seal`, ADR-0083). A check in lint
  fails if one does.
- **`event` looks near kraft** to a quick eye. It is the pale highlighter
  yellow the pitcher card has worn since ADR-0083, not the brown of the seal.
  The reason to keep it: the pitcher card already does, and it is not a
  control, so a reader cannot mistake it for a cover.

| option | what it is | cost |
| --- | --- | --- |
| **A. Four (recommended)** | as above | `caution` and `error` look alike; they differ in ink and in what a screen reader says |
| B. Three | merge `caution` and `error` | one tone fewer; the photos notice would use the error ink and announce as an alert |
| C. Other names | keep four, rename (`note`, `news`, `warn`, `fail`) | nothing breaks; names are cheap to change before N1 |

Trade-off: with four, someone adding a notice picks between two clay tones. The
spec says when: `error` if a fetch or action failed, `caution` otherwise.

## Q5. Leave these as they are?

**Recommendation: yes, leave them.** 71 sites stay. This follows the EmptyState
holds, and each reason is in `spec.md`, section 9.

- **The seven tape banners** (4 on the player page: All-Star, rehab, injured
  list, last played; 2 on the slate: All-Star break, off day; 1 under the game
  masthead: delayed or postponed). They are filled bands with white or dark
  words, no rail and no wash. They are the status-tape family of ADR-0083. If
  they join, Notice needs a fifth look, and the band stops looking like tape.
- **The as-of banner.** It is a control strip, not a message: a date form, a
  bare link, and a strip with two buttons. A notice has one message and at most
  one button. It sits on open pages (team, player, leaders, Scout), not on a
  scoring screen. It is the one named member I would not move.
- **The live-edge chip** ("Caught up"). It reads the sealed colour and reports
  the seal state. No notice may read `--seal`.
- **The sync strip** (a link and a dismiss button), **the pregame board's
  message and tag** (scoreboard art), **the highlight dialog's text** (it mixes
  wait, error and "not playable").
- **Express Lane lines** (7). They sit on the dark album ground, and no
  contrast pair is checked for them. One is a real consent line.
- **The lab and admin pages** (35 sites). Your answers on 2026-09-24 and
  2026-10-01 stand. One note: these hold the only 3px clay bars in the app, so
  they are the closest match to the issue's picture. Moving them is cheap if you
  ever lift the hold.

Trade-off: those places keep their own look. The issue's name list shrinks from
6 to 4 moved members, and the delay card, the photos notice, the pitcher card
and the error lines are the 4.

---

## Already decided — not questions

- **Loading lines do not move.** 9 loading lines keep the plain hint or the
  pencil loader (EmptyState, "Already decided"). The census found no reason to
  change that. Two lines mix loading and another job in one box
  (`HighlightSheet.jsx:113-126`); they are held until someone splits them.
- **Footnotes do not move.** The EmptyState census counts 64 caveat lines now
  (it said 61 before the empty-state slices). One edge case: the Game Log stats
  line that warns totals leave out unresolved stamps
  (`LogbookStatsPage.jsx:271`). It stays a footnote.
- **The spoiler rule does not move.** 44 of the 97 moving sites are on a
  scoring screen. Each keeps the test that decides WHEN it shows, exactly where
  it is. Notice fetches, computes and gates nothing and has no reveal prop. The
  copy says what is missing or what state the page is in, never what happened.
  The spoiler sites get their own slices (N4 to N8), each with a seal pin test.
- **No club colours.** ADR-0030's addendum lets a club colour a card that names
  the club, never a control, cover or seal-state report. No member needs it. A
  club-coloured notice would be a new decision, not a default.
- **The issue's count was off.** It says six classes draw a 3px bar on a tint.
  One does. It says there are six banners. The word "banner" names 36 classes;
  7 are tape. The PR says so; the issue is not edited.
- **Dashed edges are an input to the dashed-rule fix, not a choice here.**
  Three notices are dashed today (the photos notice, the postponed strip, the
  as-of banner). The migrating ones keep their dashed edge in their own rule, so
  nothing changes on screen until that fix decides. `spec.md` section 11 lists
  all 10 dashed rules on a candidate.
- **Two ADR-0084 rows need fixing.** `.delaycard → .notice--delay` and
  `.pitchernotice → .notice--pitcher` do not fit the grammar. The delay card
  becomes `.delay` in N5. The pitcher card gets its name in N8. N9 rewrites the
  ledger rows. The ledger also lists 13 files and 18 elements for the pitcher
  card; the real numbers are 28 and 20.
- **Five things I found and did not fix** (`spec.md`, section 12), for later:
  a raw copy of the seal colour in three Express Lane rules, an offseason error
  drawn as "No moves filed", a failed transactions page with no message, the
  `Notice` name clash on two admin pages, and `.hint--error` still worn by five
  dev pages.
