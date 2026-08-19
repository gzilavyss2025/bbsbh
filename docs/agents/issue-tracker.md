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
- A PR closes its issue with `Closes #<n>` in the PR body
- Long-form context that would swamp an issue body stays in `.scratch/` and is
  LINKED from the issue, rather than pasted into it

## When a skill says "publish to the issue tracker"

`gh issue create` with a title, a body, and the triage label. If the work has a
scope document, link it rather than inlining it.

## When a skill says "fetch the relevant ticket"

`gh issue view <n>`. The user will normally pass the issue number. A path under
`.scratch/` is a working note, not a ticket — read it, but do not treat its
`Status:` line as the tracker's answer.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
