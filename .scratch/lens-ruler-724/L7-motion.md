Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L7 of #724: motion

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler": on a phone, the
scorecard opens zoomed onto the next sealed at-bat under a fixed navy frame. The brief is the issue
comment https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. **Read all of
it.** This slice is its slice 4 (section 5, gotchas G1, G8, G13, G14). Where this prompt and the
brief disagree, this prompt wins.

**Already on `claude/lens-ruler`:** L2 helpers, L3 lens (instant scroll, ADR-0091), L4 bar and tap
lock, L5 dock, cards and pitcher sheet, L6 carry strip. Every state exists. This slice only moves them.

## Workspace

1. `git fetch origin`. Base: `origin/claude/lens-ruler`. Check that L6 is merged into it:
   `gh pr list --base claude/lens-ruler --state merged --json number,title` must list "Lens L6".
   If not, stop and tell Gary.
2. `git worktree add ../bbsbh-lens-l7 -b claude/lens-l7-motion origin/claude/lens-ruler`, then
   `npm install`. Do not edit the primary checkout.
3. Dev server: the first free of `npm run dev` (5173), `dev:2` to `dev:5`. Add `?nointro` to every URL.
   If all five ports are taken, run `node scripts/dev-servers.mjs`. Stop (`taskkill /PID <pid> /F`) only
   the servers of `bbsbh-lens-*` worktrees whose PR is already merged into `claude/lens-ruler`. Stop
   nothing else. If still no port is free, stop and tell Gary.
4. **Windows baseline.** This PC runs Windows. Here `npm run lint` fails `check-dir-size` and
   `check-file-size`, and `npm test` fails the three `.cluster`, `.grid` and `.stack` tests, only
   because of `\` in paths. They fail the same way on `origin/main`, and CI (Linux) passes them. Do not
   change code or budgets for them. Run those two guards with the path shim instead. Each must exit 0:
   `node --import=file:///C:/Users/gzilavy/claude-prompts/lens-ruler-724/posix-paths.mjs scripts/check-dir-size.mjs`
   and the same for `scripts/check-file-size.mjs`. Any other failure is yours to fix.

## Read first

`docs/motion.md` (the seam, `useBecameTrue`, the "things that bit" list), then
`.agents/skills/review-animations/STANDARDS.md` and the `SKILL.md` in `.agents/skills/apple-design/`
and `.agents/skills/emil-design-eng/`. Read these files directly. On this Windows clone,
`.claude/skills/<name>` for those three is a symlink that git wrote as a plain text file, so the Skill
tool cannot load them. ADR-0046. `src/lib/sealTear.js`, `src/styles/12a-seal-tear.css`
and the `SealTear` part of `src/components/SealBox.jsx`: **the app already tears kraft.**

## Build (brief section 5)

1. **Tear.** The reveal commits on the tap, as today. Draw two kraft halves over the inked box and fly
   them off in 180 ms on `--ease-out` (left `translate(-26px, 8px) rotate(-9deg)`, right mirrored, to
   opacity 0). **Reuse `sealTear.js`** for the split line (seed from `gamePk` and the step) so the
   scorecard seal tears like every other seal. Do not write a second tear. If its shape and the brief's
   motion do not fit together, keep the shared split and the brief's timing, and say so in the PR.
   The tear halves read `--seal*`, so `scripts/check-seal-scope.mjs` needs an `ALLOWLIST` entry for
   their partial and selector, with a one-line reason. Add nothing else there (G11).
2. **Glide** (G1): animate the **pane scroll**, 300 ms, `--ease-out`, at the same time as the tear,
   with a small `requestAnimationFrame` tween. Not `scroll-behavior: smooth`. Add the token
   `--dur-glide: 300ms`. Put the easing math in a pure function in `src/lib/scorecard/` with a test.
   A new tap or a user scroll cancels a running glide.
3. **Ink-in**: the existing `armed` + `fresh` press in `ScorecardPage`, unchanged.
4. **Runner-move fade** (G14): 1.6 s (`--dur-highlight`) from the marker tint to the box's normal fill,
   only on boxes the just-opened play changed (L2's `runnerMoves`), gated on `armed`.
5. **Page turn**: out 160 ms (opacity 0 + `translateX(-28px)`), switch `side`, in 200 ms from
   `translateX(28px)`. No vertical glide during the turn.
6. **Seal breath**: in lens mode only, 4 iterations (2 full cycles), then still. Keep today's hold
   under hover, press and focus. The desktop sheet keeps its breath as it is.
7. **Cards** fade in 220 ms (opacity + scale 1.04 → 1). **Pitcher sheet** slides up 260 ms from
   `translateY(40px)`.
8. **Live edge**: a seal that arrives by a poll appears with no motion and no fresh breath.
9. **Reduced motion**: no tear, no glide (instant scroll), no fades, no slide. The runner tint stays
   static until the next tap.

**Gates (G13):** no one-shot replays on a cold load, a poll, a navigation, a return visit or a
force-reveal. Use `useBecameTrue` or the existing `armed` + `fresh` diff. Do not merge the two
(`docs/motion.md` says why). **Before a tap, no timing may differ by the sealed result** (ADR-0046).
The 700 ms tap lock stays constant.

## Where code goes

Motion CSS in `src/styles/motion/` (a new `scorecard-lens.css`, `@import`ed with the other motion
partials in `src/index.css`). Resting looks stay in `src/styles/scorecard/`. Components in
`src/components/scoring/lens/`. `src/lib/`, `src/hooks/`, `src/styles/` and `src/components/scoring/`
are full. 600-line file cap. Never raise a cap. Tokens, not raw values.
`src/lib/scorecard/` fills up across the slices: at about its 10th file, move a group into a
subfolder (`check-dir-size` fails at 13).

## Animation Lab and docs

- Add an entry in `src/screens/animlab/motionDemos.jsx` (`/animation-lab`) for the tear + glide, the
  runner fade and the page turn. A delayed animation also needs its line in the `.animlab__frame`
  pause list in `src/styles/46-consent-modal.css`.
- A row in `docs/motion.md` for each new motion.

## Verify (no e2e)

iPhone 390 × 844, Incognito. Tap through a half, a handoff, a runner advance and a pitching change.
Check each motion with an enlarged multi-frame strip (screenshots at about 0, 60, 120, 180, 300 ms),
not one screenshot. Then turn on reduced motion (devtools, Rendering, `prefers-reduced-motion`) and
check every state again. Reload at mid-game: nothing replays. Turn on Scores Unlocked: lens off,
nothing plays.

## Rules

- Test first. Never loosen a test. The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge.
- ASD-STE100 for comments, commits and PR text. Never "playoffs".

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass, apart from the Windows baseline (Workspace
   step 4), and the two shimmed guards exit 0. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L7: motion". Body: each motion and its
   gate, the reduced-motion check, the frame strips you looked at, "Part of #724".
4. Leave the dev server running. Last message, in plain words for Gary: the PR link, two clickable
   local URLs (the scorecard and `/animation-lab?nointro`), and what to tap and watch.
