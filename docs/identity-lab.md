# The Team Identity Lab — editing, uploads, recolored marks

Reference moved out of `src/lib/CLAUDE.md`. The rules stay there.

## Editing a value — two paths, one set of stores

Run `npm run dev`, open `/identity-lab`, tune, hit Save; the store is rewritten
sorted by team id and the page hot-reloads off the landed value. That endpoint
exists only under `vite dev` — ADR-0029 has the allowlist and the four layers.

The second takes no deploy: an admin gear on `/team/{id}` writes a RUNTIME override
that `src/lib/identity/`'s overlay layers under these same readers, so every
resolver here answers with it and none changed signature (ADR-0050). Id grammar,
traps and the two save gates: `docs/identity-overrides.md`.

## The upload contract

Drag a PNG onto a tile in `/identity-lab` and it lands there. **The upload
contract**, in one place because PR 4's MiLB art builds directly on it:

| | |
| --- | --- |
| Endpoint | `POST /__dev/team-logo?teamId={id}&treatment={key}`, raw PNG bytes as the body |
| Destination | resolved server-side — directory from `LOGO_TREATMENT_DIRS`, filename from `teamAbbr`. **A request never supplies a path.** |
| Rejected | not a PNG, not exactly 512×512, over the cap — each with the reason, shown inline on the tile |
| Accepted-with-a-note | a PNG carrying no alpha channel (118 of the 148 files in `logo-art.json` have none and render fine, so it's said once, not refused) |
| Response | `{ file, url, caveat }` |
| Side effect | `src/lib/data/logo-art.json` is rebuilt from disk |

A sibling endpoint reuses one already-uploaded mark on another of the same
club's treatments instead of procuring/uploading it again — the lab's "Copy
here" control next to Replace art on every tile: `POST
/__dev/team-logo-copy?teamId={id}&from={key}&to={key}`, no body — the bytes
travel server-side, read off whatever `from` already has on disk, and land
through the exact same validate/write/rebuild-the-manifest path as a real
upload. Same response shape, plus a 404 (`no art uploaded for "{from}" yet`)
when the source tile is itself empty.

Validation reads the PNG header by hand — width and height are big-endian
uint32s at bytes 16 and 20 of the IHDR chunk — so there is **no image library
and no new dependency**. The same functions run in the browser (instant, specific
rejection) and in Node (the authoritative check), so the two can't disagree.

## Recolored marks

Uploading isn't the only way a treatment gets a mark. The CDN carries no
alternate or City Connect art, and the real thing is often the SAME shapes in
another palette — so `/identity-lab`'s **Logo art** editor recolors a source
mark shape by shape (`logoRecolor.js`, sharing `logoMono.js`'s shape numbering
so a shape means one thing in both editors) and saves the result to the club's
library under a name.

## Eras — a club's past marks

The **Eras** tab owns `src/lib/data/season-marks.json` and `public/logos/historical/`
(#1591). Eras hang off the club's CURRENT franchise id, so the Brooklyn Dodgers sit under
the Dodgers. Per era you set the first and last season, a name, a 2–4 letter period
abbreviation and a source/licence note, then drop an SVG on the mark box. An era with no SVG
draws its abbreviation in a serif face, never today's mark (ADR-0078).

Two dev-only routes, both under `/__dev` (`scripts/lib/eras/dev-season-marks.mjs`):
`POST /__dev/era` takes `{ action: 'save' | 'delete', teamId, era?, replaceFrom?, from? }`;
`POST /__dev/era-art?teamId={id}&from={season}` takes the SVG as the body. A request never
supplies a path: the art name is rebuilt as `{teamId}-{from}-{to}.svg`. Eras in one club may
not overlap, because `seasonMark` takes the first match. An edit keeps the fields the form
does not show (the art file, a fetched licence). Markup passes the same gate as the custom
marks: it must be an SVG and carry nothing executable.

An era may also carry a header triad, `bar`, `accent` and `onBar`, set with the same hex fields
and SAFE/OUT chip as a club's bars. A bar needs its `onBar`, and `onBar` must clear WCAG AA
against it: the dev save refuses a pair that fails, `scripts/check-contrast.mjs` re-checks the
table, and picking a bar suggests white or near-black for the ink. With a triad, an old game's
club bar wears it and its tile tints with `bar`; with none, the era keeps the neutral chrome.
Today's club colours never carry back to an old game.

`scripts/season-marks/fetch.mjs` is a one-time bootstrap now. It refuses to run without
`--rebuild-from-seed`, because it rebuilds the table from `seed.json` and would erase the
lab's edits.

## `TeamLogo`'s own fallback chain

Curated-art coverage is partial by design (`src/lib/CLAUDE.md`, "The curated art"), so the component every
consumer renders through (`src/components/logo/TeamLogo.jsx`) degrades in its own
two steps, independent of the colour chain: a requested `variant` that 404s
retries the plain `base` mlbstatic mark; no id, no base mark, or the base also
failing draws a single-letter monogram. Never a broken-image icon, and asking
for a mark a club happens to lack (the same 8-club City Connect gap PR 2/3
found, or a not-yet-uploaded MiLB side) quietly falls back rather than
erroring. This is orthogonal to `logo-art.json` — the manifest is a record for
`test/logo-upload.test.js`, not something `TeamLogo` consults.
