# ADR-0048 — The guides are server-rendered documents, not app routes

Status: accepted (2026-08-16)

## Context

This app has no organic front door. It is a client-rendered Vite SPA:
`api/preview.js` swaps the `OG:BEGIN…OG:END` block so a shared deep link gets a
real card, but the body it serves is `<div id="root"></div>` and always has been.
For Google that is survivable — it renders JavaScript. For the crawlers behind AI
assistants it is not, and that is the channel this decision is about.

The 2026 measurements are not ambiguous. GPTBot fetches JavaScript files in
roughly 11.5% of requests and executes them in none. ClaudeBot downloads them in
roughly 23.8% of requests and executes them in none. Anthropic's own
documentation states plainly that its web fetch tool does not support pages
rendered by JavaScript. An analysis of some 500 million GPTBot fetches found zero
JavaScript execution. So to an assistant asked "what should I use to keep score
at a game", every page of this app is a blank div with a good meta description.

That is a strange gap for this app in particular, because the thing it is best at
is the thing people search for. "How to score a baseball game" is a large, stable
query cluster. The app is a scorekeeping companion. The two have never met.

The obvious fix — write the guides as React screens — fails for the same reason
the rest of the app does, and it fails silently: the pages would look perfect in
a browser and be invisible to the audience they were written for.

## Decision

**The guides at `/learn` are standalone HTML documents rendered on the server by
`api/page.js`.** They are not React routes, they do not boot the bundle, and they
contain no `#root`. A crawler and a reader receive identical bytes.

**Content lives in plain data modules** under `src/copy/landing/pages/`, one per
guide, in a small section schema (`answer`, `prose`, `list`, `table`, `cta`,
`faq`, `related`). `src/copy/landing/render.js` turns a page into a document and
is a pure function — all I/O stays in the endpoint.

**Every prose string is an admin-editable copy slot** in the existing closed
registry (ADR-0025), addressed as `learn.{slug}.{sectionId}.{slot}`. Structural
data — the nine position numbers, the box-score column names — is deliberately
NOT editable. Those are reference facts, not wording, and a textarea in front of
one is an invitation to make a reference page wrong.

**The answer block leads every page.** Roughly 44% of the citations these engines
make come from the first 30% of a page's text, so each guide opens with a
self-contained, quotable answer before any framing or any brand. This is pinned
by a test rather than left to taste, because it is the whole reason the pages are
shaped the way they are and it is the first thing a redesign would undo.

**The hub is a task map.** Guides belong to one editorial group, and the visible
hub plus its `ItemList` JSON-LD derive from the same group list. The flat page
array used by the copy registry and sitemap derives from those groups. A new
guide cannot appear in one system and become an orphan in the other.

**References stay visible and structural.** A guide can list primary sources
after its body. The renderer also emits those URLs as `Article.citation` values.
Names and URLs are not copy slots because they identify the authority behind a
fact; an editor can rewrite the explanation without silently changing its
source.

**Editing happens on the page, via `?edit`.** The gear links to
`/learn/{slug}?edit`; `api/page.js` answers that one URL with the app shell so
the existing copy editor takes over, filtered to that guide's slots. ADR-0044's
principle survives on a page that cannot host a React editor.

**Three foundations ship alongside**: `public/robots.txt` (the app had none, so
nothing named the AI crawlers or pointed at a sitemap), `scripts/gen-sitemap.mjs`,
and `public/llms.txt`.

## Consequences

**These pages are the one place in the app where a score would have no seal in
front of it.** Everywhere else, safety comes from a `SealBox` deciding when a
render function runs. Here the HTML is composed complete and handed to whoever
asked, including an anonymous crawler, with no reveal mark consulted and no
opportunity to gate anything. So the rule is absolute and structural rather than
careful: the landing layer imports nothing that can reach the feed, and
`test/landing-pages.test.js` asserts it over the import graph. A future "today's
games" strip on a guide is not a small feature — it is a spoiler with nothing in
front of it.

**A slug is a storage key and a public URL at once.** It is half of every copy-slot
id for its page and it is a citable address. Renaming one abandons every override
written against it AND breaks a link an assistant may already be repeating.
Rename only with a redirect, and expect to re-enter the copy.

**The ALL-CAPS INVARIANT does not reach these pages, and that is correct.** It is
scoped to `#root *`, and it is right for a scorebook interface and wrong for 1,400
words of body copy — the same judgement that made the welcome modal's explainer a
sanctioned exception, applied to a whole document. A page with no `#root` gets
natural case by construction rather than by fighting specificity.

**`public/learn.css` is a copy of part of the palette**, because a document
served outside the bundle cannot import a Vite-resolved token sheet. A copy
drifts, so `scripts/check-learn-css.mjs` fails the build when it does. The fonts
are system fonts for the same reason, which is also the better outcome: a guide
opened from a search result renders instantly with no webfont swap.

**`api/` is now at twelve functions**, which is the ceiling a Vercel Hobby
deployment has historically enforced. That is why all eight guides are served by
ONE function keyed on a slug rather than one function each, and it is a real
constraint on whatever the next backend exception turns out to be.

**The gear is drawn by a cookie check**, which proves somebody is signed in and
nothing more. The boundary is unchanged and still server-side —
`authenticateAdmin` plus the `COPY_ADMIN_USER_IDS` allowlist — so a signed-in
stranger who finds the gear reaches an editor that refuses to save. This is the
trade ADR-0044 already made for the Ballpark card.

**A rich-text editor was considered and rejected.** The copy store's safety
property is that a stored value is a bounded, inert string, which is what lets
`sanitizeOverrides` be the single choke point. Storing WYSIWYG HTML and printing
it into server-rendered documents would replace that property with a standing
obligation to sanitize HTML correctly, forever, in exchange for formatting
freedom on eight pages. If rich text is ever genuinely needed, add an allowlisted
subset with its own tests — do not relax the renderer's escaping.
