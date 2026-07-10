<!--
bbsbh PR template — mirrors the structure the repo's PRs already use.
Fill in each section; delete a section only if it genuinely doesn't apply.
Open as a DRAFT (agent/`claude/*` branches are required to; see CLAUDE.md).
-->

## Summary

<!-- What this change does and why, in a few sentences. Link any related PR/issue. -->

## Changes

<!-- The notable changes, as a short list. Skip if the Summary already covers it. -->

-

## Spoiler-safety

<!--
The core invariant: a score-revealing value must never exist in the DOM until
the user reveals it (see the "spoiler rule" section of CLAUDE.md + docs/adr/).
-->

- [ ] This change doesn't touch any sealed/reveal-gated game surface, **or**
- [ ] It does, and no score-revealing value reaches the DOM before reveal — reveal-only modules (`linescore.js`/`derive.js`) stay caller-gated, pre-pitch selectors stay bounded to `revealedThrough`, and extra innings stay locked. Relevant ADR(s): <!-- e.g. ADR-0001 -->

## Verification

<!--
No CI-enforced test suite here — verify by exercising the real flow.
Note: this sandbox usually can't reach statsapi.mlb.com from a headless
browser, so live-game screenshots often aren't possible — say how you
verified instead (curl-fed mock via page.route(), the `preview` branch URL,
regenerated data file, etc.).
-->

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Exercised the affected flow (`npm run dev` / `npm run e2e`) against a live or recent game — <!-- gamePk / how -->

## Files touched

<!--
List them — the maintainer runs concurrent `claude/*` sessions and uses this
to spot overlap across open PRs at a glance (see CLAUDE.md "Concurrent agents").
-->

-
