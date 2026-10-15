# The Tally Baseball design system (claude.ai/design)

The "Tally Baseball" project in claude.ai/design holds the stamped look of ADR-0109. A
designer picks it as the design system when they start a new design, for example the team
page (#1107). The project is `419659a9-0431-40ef-b2ae-c04dce4c076a`; the same id is in
`.design-sync/config.json`.

**The project is built from this repo and never edited by hand.** `.design-sync/build/` makes
every file in it. A change to a token, a part style or a card reaches the project in two steps:
rebuild, then upload.

## What is in the project

| Path | What it is | Source |
| --- | --- | --- |
| `tokens/*.css` | colour, spacing, effects, type, layout | `src/tokens/`, copied. Two deliberate changes, below |
| `tokens/TOKENS.md` | a usage line per token | `.design-sync/build/usage-data.json` |
| `_ds_bundle.css` | the part styles | `src/styles/system/`, `09-team-info.css`, `motion/`, and `.design-sync/build/ds-*.css` |
| `fonts/` | five woff2 files and three OFL licences | `node_modules/@fontsource/` |
| `components/` | one preview per part, a Motion preview, seven player cards | `.design-sync/build/previews.mjs`, `motion.mjs`, `playercards.mjs` |
| `README.md` | the brand book | `.design-sync/build/README.template.md` |

There is no JavaScript bundle. The look is CSS and class names. `_ds_bundle.js` is an empty
stub that the design tool needs.

## Where this system differs from the app

Gary asked for these changes. Each one has a comment in the CSS.

- `--font-body` is JetBrains Mono 500. The app uses Source Sans 3. Source Sans 3 is not in the project.
- A band head (`sectionhead--band`) is square. The app rounds its top corners.
- `stattile--compact` (a stat tile about 40% smaller) and `sectionhead--textured` (the lineup
  page's ripple rings, opt-in) are new classes.

## Rebuild

```bash
npm install
node .design-sync/build/run.mjs --out ds-bundle     # ds-bundle/ is in .gitignore
```

The player cards come from `.design-sync/captures/*.json`, which are saved copies of real
cards. To refresh them, start `npm run dev` on port 5173 and add `--capture`. That loads one
real batter (592885) and one real pitcher (642547) and saves each card's markup with only
the CSS rules that match inside it. The figures in the cards are those players' figures on
the day of capture.

## Upload

Use the `/design-sync` skill, or the `DesignSync` tool by hand:

1. `list_files` on the project.
2. `finalize_plan` with `localDir` set to the build folder. Writes: `README.md`, `styles.css`,
   `_ds_bundle.css`, `_ds_bundle.js`, `_ds_needs_recompile`, `tokens/**`, `fonts/**`, `components/**`.
   Deletes: only the paths a rebuild dropped.
3. `write_files` in batches, then write `_ds_needs_recompile` again last. The design tool
   reads that file as the cue to re-index.

## Add or change a part

- **A token:** change `src/tokens/`. Add its usage line to `usage-data.json`, or the build stops
  and names the token.
- **A preview:** edit `previews.mjs`. The first line of each preview file must stay
  `<!-- @dsCard group="..." -->`.
- **A player card:** add its name to `WANT` in `capture.mjs` and to `NAMES` in `playercards.mjs`.
- **A change to the brand book:** edit `README.template.md`.
