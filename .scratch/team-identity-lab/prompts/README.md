# How to run the Team Identity Lab PRs

Seven PRs, one per fresh context. Each prompt file in this directory is
paste-ready — open it, copy the whole thing, paste into a cleared Claude Code
session in `C:\Users\gzilavy\bbsbh`.

## The loop, per PR

1. `/clear`
2. `/model <model from the table below>`
3. Set effort in `/config` → **Reasoning effort** (see table)
4. Paste the contents of the matching `NN-*.md` file
5. Review the PR it opens, merge it on GitHub
6. Repeat

Each prompt already tells the agent to read `PRD.md` and
`implementation-log.md` first, so it recovers full context on its own. **You do
not need to re-explain anything.**

## Model and effort per PR

| PR | Prompt file | Model | Effort | Why |
| --- | --- | --- | --- | --- |
| 1 | `01-framework.md` | **Opus 5** | high | Largest refactor of the set. Must move ~6 hand-tuned tables to JSON with zero rendering change. Wrong call here costs every later PR. |
| 2 | `02-audit-view.md` | **Sonnet 5** | medium | Mostly additive UI over data that is already fetched. Well-specified. |
| 3 | `03-logo-upload.md` | **Opus 5** | high | New middleware writing binary files to disk from a browser. Validation and the path allowlist are a security boundary — worth the stronger model. |
| 4 | `04-milb-logo-art.md` | **Sonnet 5** | medium | Follows PR 3's pattern closely; the schema and manifest work is mechanical once PR 3 exists. |
| 5 | `05-milb-colors.md` | **Opus 5** | high | Data reconciliation with judgement calls, plus a fallback-chain change that alters every MiLB headshot. Needs care. |
| 6 | `06-theming.md` | **Opus 5** | high | The user-facing feature. Touches the spoiler-adjacent surface and needs real design judgement plus a contrast guard. |
| 7 | `07-docs-cleanup.md` | **Sonnet 5** | low | Docs, an ADR renumber, one stale file. Mechanical. |

If a Sonnet run stalls or produces something you do not trust, re-run that PR's
prompt on Opus 5. Nothing in the sequence depends on which model did an earlier
step.

## If a PR goes wrong

Do not try to patch it from a stale context. Close the PR, `/clear`, and re-run
the same prompt — the PRD and log are the source of truth, so a fresh run picks
up cleanly. Add a line to the prompt describing what went wrong the first time.

## Ports

Other agents' worktrees may hold dev ports. The reserved band is 5173 then
5172-5169 via `npm run dev` / `dev:2` … `dev:5`. The session-start hook prints
which are taken. Always append `?nointro` to a test URL.
