# src/components/honors — team-season honors

`LeaguePennant.jsx` exports the named `LeaguePennant` component. `PennantRow.jsx` is the shared swipe row
(compact on a phone, full on a wide screen) the team and player pages use.
Usage, props, design references, and edit locations: [docs/pennants.md](../../../docs/pennants.md).

- Draw-only. The caller selects verified honors and supplies the season's league.
  Do not fetch winners, rosters, or game results here. Browser image loads are allowed.
- A team honor does not establish a player award. Player callers must verify the
  player's qualifying team-season connection.
- `pennantModel.js` holds `PENNANT_ART` geometry, identity, and palette defaults. Respect covered
  eras from `lib/identity/seasonMarks.js`. Uncovered current defaults do not promise
  exact historical identity. Callers can supply period labels, art, and colors.
- Keep the one-color mark's negative spaces. Use existing knockout art or a supplied
  one-color asset. Do not flatten full-color logos with a whitening filter (ADR-0031).
- `league` is explicit `AL` or `NL`. Use the season's league, not today's affiliation.
  League champions predate the LCS, which began in 1969. There is no 1994 champion.
- The approved design is flat: team-color field, contrasting team border, block year, one-color
  mark, and block league text. Yellowtail is an optional club-label accent.
  No physical hardware, folds, perspective, cast shadows, bevels, or animation.
- `variant` is explicit. Full draws header, mark, year, and league text; compact
  draws mark and year. Width does not choose a variant.
  The full league title is two lines: "AMERICAN LEAGUE" or "NATIONAL LEAGUE" on one line, then
  "CHAMPIONS". Keep the league name on one line.
- `LeaguePennant.jsx` owns text positions, sizes, and font imports. Bungee draws
  the year; Barlow Condensed draws league text. CSS owns responsive sizing and script casing.
- `palette` accepts six-digit hex only. The model corrects ink/year to 4.5:1 contrast.
- Preserve one complete accessible image label in either variant. `decorative`
  hides the graphic only when adjacent accessible text supplies the same honor.
- Import the component's own path. Do not add a barrel file.

Preview and compare both variants at `/design-lab?nointro#pennants`.
