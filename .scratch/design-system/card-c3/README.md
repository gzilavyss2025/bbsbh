# Card slice C3 — the before/after check (#1113, PR #1262)

Scripts for the browser check in PR #1262. Run them from a scratch folder, with
main on one port and the branch on another:

- `node probe.mjs 5169 before` and `node probe.mjs 5170 after`: measure every C3
  block (frame, size, margin, padding, clip, descendants past the edge, focus
  rings) at 390px and 900px, and take full-page screenshots.
- `node cmp.js`: compare the two reports, property by property.
- `node pixdiff.mjs`: diff the screenshots; `node crop.mjs <png> x y w h out.png`
  puts before, after and diff side by side.

The screenshots are not committed. The result is in the PR body.
