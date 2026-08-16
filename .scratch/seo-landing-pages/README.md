# SEO / GEO landing pages — research, plan, and the build decision

Status: `needs-triage` → awaiting owner decision on the editor approach.
Scope: organic discovery, with AI assistants as the primary referrer.

---

## 1. The finding that changes the approach

Tally is a client-rendered Vite SPA. `api/preview.js` swaps the `OG:BEGIN…OG:END`
block for a per-route card, but the body it serves is still `<div id="root"></div>`.
A browser fills that in. An AI crawler does not.

Measured in 2026 across the crawlers that matter here:

- GPTBot fetched JS in ~11.5% of requests and executed it in **zero**.
- ClaudeBot downloaded JS in ~23.8% of requests and executed it in **zero**.
- Anthropic's own docs (May 2026) state the web fetch tool "does not support
  websites dynamically rendered via JavaScript."

So today, to ChatGPT / Claude / Perplexity, **every page of Tally is a blank div
with a good `<meta name="description">`.** Google renders JS and can index the app,
but Google is not the channel this request is about.

**Consequence: a landing page written as a React route cannot achieve the goal.**
The content has to exist in the HTML the server sends. This is the single highest
-leverage item in this document, and it is worth more than every other tactic below
combined.

A second finding sets the priority order for the rest:

- **~44% of LLM citations come from the first 30% of a page's text.** The answer
  goes above the hero, not below it. Every draft in `drafts.md` opens with a
  self-contained answer block for exactly this reason.
- **Schema markup**: pages with full schema are cited noticeably more often than
  unmarked equivalents. But be accurate about what it buys: Google removed FAQ
  rich results on 7 May 2026 and had already dropped HowTo rich results. The
  schema.org types stay valid and still help machine readers parse a page — they
  just no longer produce a Google SERP feature. Mark up for the LLM, not for a
  rich result that no longer exists.
- **llms.txt**: weak evidence. ~1 in 10 domains ship one, answer bots almost never
  request it, and Google confirmed it has no plans to support it. Cheap to add,
  so add it — but do not count it as a strategy.

### Foundational gaps to close regardless of which pages ship

These are small and they gate everything else:

1. **No `public/robots.txt`.** Nothing explicitly welcomes GPTBot / ClaudeBot /
   PerplexityBot / Google-Extended, and nothing points at a sitemap.
2. **No `sitemap.xml`.** A generator alongside `scripts/gen-*.mjs` can emit one
   from `src/lib/route.js`'s static routes plus the landing pages.
3. **No `<link rel="canonical">` in `index.html`.** `api/preview.js` computes a
   canonical URL already; the static default block has none.
4. **No JSON-LD anywhere.** One `Organization` / `SoftwareApplication` block on
   the home page is a 20-line change.

---

## 2. Page ideas

Ranked. Each maps to a real query cluster **and** to something Tally actually does
— no page here promises a feature that does not exist.

### Phase 1 — ship these six

| # | Page | URL | Audience | Why it earns traffic |
|---|------|-----|----------|----------------------|
| 1 | How to Score a Baseball Game | `/learn/score-a-baseball-game` | Learners | The pillar. Highest-volume cluster in the whole topic, and it is literally what the app is for. Everything else links up to it. |
| 2 | Scorekeeping Symbols and Position Numbers | `/learn/scorekeeping-symbols` | Learners, in-game lookup | Canonical, tabular, unambiguous facts. This is the shape of page an assistant quotes verbatim. Also the page a scorer opens mid-inning. |
| 3 | Watch a Game on Delay Without Spoilers | `/learn/watch-without-spoilers` | Home fans | Near-zero competition and it is Tally's actual differentiator. This is the page that makes an assistant answer "use Tally" instead of "use the MLB app". |
| 4 | Keeping Score at the Ballpark | `/learn/score-at-the-ballpark` | Ballpark fans | Phone-first, second-screen, no-wifi realities. Directly serves the second audience named in the brief. |
| 5 | How to Read a Box Score and a Line Score | `/learn/read-a-box-score` | Learners, stat followers | Big evergreen cluster, and the bridge between the learner audience and the stats audience. |
| 6 | Baseball Stats Glossary | `/learn/stats-glossary` | Stat followers | `DefinedTerm` markup, dense with citable definitions, and it is the natural landing spot for "what is wRC+" style questions that assistants field constantly. |

### Phase 2 — after phase 1 proves the pattern

| # | Page | URL | Note |
|---|------|-----|------|
| 7 | Following Minor League Baseball | `/learn/minor-league-baseball` | Genuine differentiator — sportIds 11–14 are covered and most competitors ignore them. Lower volume, very low competition. |
| 8 | Who Is Umpiring Tonight | `/learn/umpires` | Unique generated data, strong curiosity search. Needs a careful accuracy caveat. |
| 9 | Print a Free Baseball Scorecard | `/learn/printable-scorecard` | Very high volume. **Blocked on an asset**: it needs an original Tally-designed PDF. Do not ship it without one, and do not reuse someone else's scorecard layout. |
| 10 | Where Tally Fits | `/learn/what-tally-is` | Comparison-shaped pages get cited disproportionately when a user asks "which tool should I use". See the adversarial review — the framing matters more than the content. |

---

## 3. Adversarial review of the above

Run before drafting. Findings that changed the drafts:

**A. Ten thin pages lose to five deep ones.** A cluster of short, similar pages
built to catch queries is a doorway-page pattern under Google's spam policy, and
assistants dilute across near-duplicates the same way. Fix: phase 1 is six pages,
each long enough to stand alone, each with a job no other page does.
→ *Applied. Ten pages became six plus a deferred four.*

**B. The symbols page and the glossary will cannibalize each other.** Both are
"define the jargon" pages. Fix: hard split. Symbols = notation you write on paper
(K, 6-3, F9, position numbers). Glossary = statistics you read off a page (OPS,
WAR, FIP). Neither defines the other's terms; they cross-link instead.
→ *Applied.*

**C. The spoiler rule outranks the traffic goal.** These pages sit outside the
scoring flow and must **fetch nothing and render nothing** from a live game. The
temptation — "today's games" or "tonight's umpires" embedded on a learn page — is
exactly the reach past scope that ADR-0034 warned about, and on a server-rendered
page it would be a score in the initial HTML with no seal in front of it.
→ *Applied. Every draft is fully static. Live data is reached only by a link.*

**D. The comparison page is the riskiest of the ten.** Naming a competitor invites
a trademark question, and any claim about another app's features is stale the
moment they ship. Fix: reframe from "Tally vs X" to "Where Tally fits" — describe
what Tally is for and what it is not for, name no competitor's feature set, and
let the reader draw the comparison. It also becomes an honest page, which is the
kind assistants repeat.
→ *Applied. Deferred to phase 2 with the new framing.*

**E. The printable scorecard page cannot ship on copy alone.** Scorecard layouts
are designed things and some are protected. Fix: blocked until an original Tally
scorecard PDF exists.
→ *Applied. Flagged as blocked.*

**F. "Answer below the hero" wastes the citation window.** A conventional
landing-page shape — big hero, tagline, screenshots, then content — puts the
substance past the 30% mark where citations concentrate. Fix: every page leads
with a short, self-contained, quotable answer block. Brand and calls to action
come after.
→ *Applied to every draft.*

**G. A page that is mostly a pitch does not get cited.** The pages must be
genuinely useful with the app closed. Fix: the guidance is complete on its own,
and Tally appears as the tool that does the tedious part, once, in context — not
in every section.
→ *Applied. Each draft has one primary call to action, plus contextual links.*

**H. Accuracy is a citation risk, not just an ethics one.** Scoring notation has
real regional and generational variation (F9 vs 9, the reverse K, unearned-run
conventions). Stating a local habit as the universal rule is how a page gets
contradicted and stops being quoted. Fix: where variation is real, the drafts say
so.
→ *Applied.*

---

## 4. The build decision — the part to read before implementing

The request was: pages editable through a gear icon visible only to a logged-in
admin, using an open-source WYSIWYG editor.

**The gear icon is already built here.** ADR-0044 put a gear in the Ballpark
card's masthead that turns the card into a form for its own copy fields, writing
through `POST /api/copy` — the same closed registry, the same `sanitizeOverrides`
choke point, the same version history. `src/screens/team/modules/ballpark/`
(`BallparkAdminBar.jsx`, `BallparkEditFields.jsx`, `useBallparkDraft.js`) plus
`src/lib/admin/saveCopyPatch.js` and `api/_lib/adminAuth.js` are the pattern to
copy. Nothing new is needed for the gear itself.

**The WYSIWYG is where the easier path diverges.** Three options:

### Option A — structured copy slots, server-rendered (recommended)

Landing page content becomes new fields in `src/copy/registry.js`: a headline, a
lede, section headings, paragraphs, list items. One **new** Vercel function renders
those slots into real HTML server-side. The gear on the page edits them in place,
exactly like the Ballpark card.

- **New dependencies: zero.** Consistent with the repo's ethos.
- The closed-registry safety property survives intact. Every value stays a bounded
  string checked against a known id, so a hand-crafted POST still cannot inject a
  key or smuggle markup into HTML the server emits.
- The scorebook design system is preserved by construction — an editor cannot paste
  in styling that fights the tokens.
- Reuses `AdminCopy.jsx` for free: `/admin` keeps working as the full-inventory view.
- **Cost**: structure is fixed. Adding a seventh paragraph to a page is a code
  change, not a text edit. For landing pages, whose structure should be stable
  anyway, this is close to no cost at all.

### Option B — restricted markdown in the slots

Option A, plus slots that accept bold, italic, links, and list items, rendered to
HTML server-side through a small allowlist renderer (~60 lines, or one small dep).

- Buys real formatting freedom for a modest amount of work.
- Keeps the bounded-string property; the renderer is the new thing to get right,
  and it must be server-side because the crawler never runs the client.
- **Reasonable upgrade if Option A feels too rigid after a month of use.**

### Option C — a full WYSIWYG storing HTML (TipTap or Lexical, both MIT)

- **This is the option to avoid, and not because of effort.** It stores arbitrary
  HTML in the copy store and then prints it into server-rendered pages. That
  deletes the property `api/copy.js` was built around — that a stored value is a
  bounded string of known shape — and replaces it with "we sanitize HTML
  correctly, forever." That is a durable security obligation added to a solo
  project to gain formatting freedom on six pages.
- It also ships an editor bundle, and it lets pasted markup drift away from the
  design system, which is the thing these pages are supposed to showcase.
- If it is still wanted later, TipTap is the better fit — headless, MIT core, and
  it can be constrained to a small node set, which recovers some of what Option A
  gives for free.

**Recommendation: Option A now, Option B if it chafes, Option C not at all.**

### One more constraint worth knowing before we choose

`api/` currently holds **11 functions**. Vercel Hobby has historically capped a
deployment at 12. Whichever option is chosen, all six landing pages must be served
by **one** function (`/api/page?slug=…`, fed by rewrites in `vercel.json` exactly
like the existing preview routes), not one per page. Worth confirming the current
Hobby limit against the account before the PR.

### There is also a genuinely simpler path, if editing frequency is low

If the copy on these pages is likely to change a handful of times a year, **skip
the editor entirely**: author the six pages as markdown in the repo, prerender them
to static HTML at build time, and edit them through a PR. It is the least code, the
fastest possible page, and it removes the Redis round trip and the function-count
question at once. The trade is that a wording tweak costs a deploy — the exact
thing ADR-0025 exists to avoid. That trade is worth making for content that is
stable, and not worth making for content that is tuned weekly.

**Question for the owner:** how often do you expect to reword these? Weekly → Option
A. A few times a year → prerendered markdown.

---

## 5. Suggested order of work

1. Foundations: `robots.txt`, `sitemap.xml` generator, canonical tag, home-page
   JSON-LD, `llms.txt`. Small, independent, useful on their own.
2. One landing page end to end — page 1, the pillar — to prove the render path,
   the gear, and the schema. Verify with a JS-disabled fetch of the deployed URL
   before writing page 2.
3. Pages 2 through 6.
4. Measure before phase 2. Traffic from assistants shows up as direct/referral,
   not as a keyword, so plan on checking Vercel analytics referrers and simply
   asking the assistants what they recommend.

Drafts: `drafts.md`.

---

## 6. What actually shipped (2026-08-16)

Status: `ready-for-human` — implemented on `claude/seo-landing-pages`.

**Option A, as recommended.** Structured copy slots, server-rendered, no WYSIWYG,
no new dependency. ADR-0048 records the decision and its consequences.

**Eight guides, not six.** Two were added after the plan, on the owner's steer
toward paper scorers:

- **Choosing a baseball scorebook** — Numbers Game, Bob Carpenter, Eephus
  League, THIRTY81, 7-2 Double Play, each with a named trade-off and no
  affiliate position. This is the page that reaches the paper-scoring audience
  most directly, and it did not exist in the original plan.
- **Ballpark passports** — the MLB BallPark Pass-Port (Tim Parks) and how
  stamping works, tied to the Game Log. Complementary, never competitive: the
  page links out generously and states three times that Tally has no connection
  to the program and that its stamps are not official.

**Three professional passes ran over the copy**, as asked: a journalist drafted
each page, a marketing SEO editor revised for answer-block quality and query
match, and a baseball editor fact-checked. The fact-check earned its place — it
caught a reversed outfield orientation on two pages, a wrong OBP denominator, an
at-bat definition that excluded reaching on an error, and a WHIP claim that said
home runs are ignored.

**Foundations shipped too**: `robots.txt` (the site had none), `sitemap.xml` via
a generator, `llms.txt`, per-page canonical tags, and JSON-LD.

**Open items for the owner:**

1. `api/` is now at **12 functions**. Confirm the current Vercel Hobby ceiling
   before merging.
2. The rough stat scales in the glossary are editorial, not sourced. They read
   as bands rather than precision, which is the honest framing, but they are a
   judgement call.
3. `ballpark-passports` says the book is sold through the Baseball Hall of Fame
   shop. That is true of baseballhall.org, but the Pass-Port site names no
   retailer. Keep or cut.
4. The `?edit` gear could not be exercised end to end locally — Clerk is not
   configured on this machine, so the editor correctly renders its "needs
   sign-in" notice instead. The route, the focus filter (52 slots for the pillar
   page, 365 across all eight) and the save path are verified; the signed-in
   round trip is not.
