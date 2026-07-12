# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Doc tiers

Guidance is split by how often it's needed, so the always-loaded file stays lean:

- **Root `CLAUDE.md`** — always loaded every session: the project one-liner, the
  spoiler-rule invariant, the high-level map, and pointers. Kept under 200 lines
  (guarded by `scripts/check-claude-md.mjs`).
- **Nested `CLAUDE.md`** — `src/`, `src/api/`, `scripts/`: subsystem detail that
  Claude Code loads only when it navigates into that directory. Put per-module /
  per-script detail here, not in root.
- **`docs/*` + `docs/adr/` + `CONTEXT.md`** — reference material and rationale,
  read on demand.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this repo):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
