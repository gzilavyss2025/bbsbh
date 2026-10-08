<!--
bbsbh PR template — mirrors the structure the repo's PRs already use.
Fill in each section; delete a section only if it genuinely doesn't apply.
Open as a DRAFT (agent/`claude/*` branches are required to; see docs/development.md, "Cloud sessions").
-->

## Summary

<!-- What this change does and why, in a few sentences. Link any related PR/issue. -->

## Issue

<!--
One line per issue. `Closes #n` when this PR meets the issue's "Done means". `Part of #n`
when more slices follow. `/stack-prs` copies the `Closes` lines into the stack PR, so
GitHub closes the issue when the stack merges.
-->

- 

## Changes

<!-- The notable changes, as a short list. Skip if the Summary already covers it. -->

-

## Spoiler-safety

<!--
The core invariant, with its scope: on the SCORING surfaces (the slate's score
cells, the lineup pages, the innings viewer, the box score) a score-revealing
value never exists in the DOM until the user reveals it. Open surfaces — season
and career stats, player and team pages, leader boards, standings — are not
gated, and gating one is a regression rather than a hardening. See the "spoiler
rule" section of CLAUDE.md + docs/adr/.
-->

- [ ] This change doesn't touch any sealed/reveal-gated game surface, **or**
- [ ] It does, and no score-revealing value reaches the DOM before reveal — reveal-only modules (`linescore.js`/`derive.js`) stay caller-gated, pre-pitch selectors stay bounded to `revealedThrough`, and extra innings stay locked. Relevant ADR(s): <!-- e.g. ADR-0001 -->

## Verification

<!--
`npm test` is CI-gated (`lint-and-build` runs lint, `npm test` and build). Also verify by exercising the real flow.
Cloud sessions verify in the container with the preinstalled Chromium and send the
maintainer a screenshot. If the live feed is out of reach, say what you mocked
(`e2e/fixtures/mock-api.js` for a spec pinned to the anchor game, a regenerated data
file, etc.). `.claude/skills/run/SKILL.md` has the live-data setup. Don't
troubleshoot an unreachable-network failure by re-running headed/`--debug`.
-->

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Exercised the affected flow in `npm run dev` against a live or recent game, and sent a screenshot — <!-- route, gamePk, what was mocked -->
<!-- Run `npm run e2e` only when Gary asks for it. -->

## Files touched

<!--
List them — the maintainer runs concurrent `claude/*` sessions and uses this
to spot overlap across open PRs at a glance (see docs/development.md, "Cloud sessions", "Parallel sessions").
-->

-
