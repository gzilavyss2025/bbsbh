# Issue tracker: GitHub Issues

**Issues for this repo live in GitHub Issues**, reached with the `gh` CLI. This
repo used to keep them as local markdown under `.scratch/`, and the August 2026
triage moved the ones still live. Some `.scratch/` directories still carry the
migrated originals; those are HISTORY, and a line like "(Migrated from
.scratch/…)" in an issue body points back to one.

`.scratch/<feature-slug>/` remains the place for working notes, PRDs, scope
documents and wayfinding maps — the long-form thinking behind a piece of work.
What it is no longer is the tracker: an open question about the product belongs
in GitHub, where it can be found without knowing which directory to look in.

## Conventions

- `gh issue list`, `gh issue view <n>`, `gh issue create`, `gh issue close <n>`
- Triage state is a GitHub **label** (see `triage-labels.md` for the role strings)
- Discussion is a GitHub comment, not an appended `## Comments` section
- A PR closes its issue with `Closes #<n>` in the PR body when it meets the issue's "Done
  means". A slice of a larger issue says `Part of #<n>` instead. `/stack-prs` copies the
  `Closes` lines into the stack PR.
- Long-form context that would swamp an issue body stays in `.scratch/` and is
  LINKED from the issue, rather than pasted into it

## Shape of an issue

There are two issue templates in `.github/ISSUE_TEMPLATE/`. A person who files on the
GitHub site picks one. An agent that files through the API skips templates, so it
follows this section.

- **`idea.md`** is for a rough idea in the reader's own words. It gets `needs-triage`.
- **`spec.md`** is for work that an agent can build. Use its headings, in this order:
  1. **Idea.** One or two sentences: what changes for the reader.
  2. **Why.** Who uses it, when, and where the idea came from.
  3. **Decisions.** One line each: what, who decided, and the date.
  4. **Where it lives.** Files and patterns to copy.
  5. **Spoiler-rule check.** Does it touch one of the four scoring surfaces (slate score
     cells, lineup pages, innings viewer, box score)? If so, say what is revealed, and when,
     and name the ADRs. Otherwise write "No impact" and stop.
  6. **Done means.** Lines that a test or a screenshot can check. Name the route and the
     `gamePk`. For a visible change, include the 390 px screenshot with `?nointro`.
  7. **Not decided.** Questions that need an answer before or during the build.
  8. **Out of scope.**
  9. **Blocked by / Related.** `Blocked by: #n` makes the issue wait.

Rules for a spec issue:

- Give a source for each fact. For an API field, give the date you checked it. Start
  each guess with "Inference:".
- `ready-for-agent` goes only on an issue that an agent can start today. A blocked issue
  gets no triage label (roadmap #1198, "House rules").
- A big change lists slices of at most 5 files. Each slice names the pattern to follow
  and a done test. Slice PRs say `Part of #<n>`.
- Write the text in ASD-STE100 (`writing-style.md`).

## When a skill says "publish to the issue tracker"

`gh issue create` with a title, a body in the shape above, and the triage label. If the
work has a scope document, link it rather than inlining it.

## When a skill says "fetch the relevant ticket"

`gh issue view <n>`. The user will normally pass the issue number. A path under
`.scratch/` is a working note, not a ticket — read it, but do not treat its
`Status:` line as the tracker's answer.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket. No tracked `.scratch/` folder holds a map today. Only the child shape (`issues/NN-<slug>.md`) exists in the tree, as old notes. A new effort that uses `/wayfinder` creates both.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
