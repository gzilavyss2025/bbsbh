# Roster card: four directions (mock-ups only, no product code)

Mocks: `A.html` … `D.html`, plus `A-undeclared.html` (club not declared) and `B-list.html` (B phone, list state).
Shots: `<name>-<390|820|1180|1440>.jpg`. Regenerate: `node .scratch/roster-card/gen.mjs`, then serve with `npm run dev`
and open `/.scratch/roster-card/A.html`. Data: `data.json` (LAD and TOR active roster on 2025-10-23, stats from statsapi, real).
Markup comes from `cardClassName`, `tableParts`, `segmentedMarkup`; CSS from `/src/index.css`. Headshots: `headshotSources(id,{mlb:true})[0]`.

| | Layout | Club tabs | Player row | Stat line opens | Toggle |
|---|---|---|---|---|---|
| A | Hitters / Pitchers side by side (stacked on phone) | `Segmented` fill, logo + name + 26 | jersey, photo 36, name, pos, chevron | inline expand under the row; rows open independently | under the tabs, one for the whole card |
| B | Master/detail: list left, stat line right; phone pushes to the detail with "‹ Roster" | compact logo + abbr tabs on top of the list | jersey, photo 36, name, pos | split panel (wide), full-screen push (phone) | in the detail head |
| C | Photo tile grid | `Segmented` fill | tile: photo, big jersey, name, pos | sheet inside the card: bottom sheet (phone), right drawer (wide) | in the sheet head |
| D | Two stat tables (hitters, pitchers), sticky name column | `Segmented` fill | table row: photo 32, name; stats are the columns | docked "full line" panel at the foot of the card (the extra fields) | above the tables; it changes the columns |

## Found
- "Regular season" does not fit one line in a 3-way `Segmented` at 390 with default type. The mocks use `--fs-label` and `--ls-none` below 480px. Unconfirmed: whether the guards accept that override.
- A tappable list row is drawn as `.btn.btn--ghost` re-laid as a row (no third control). Unconfirmed against the control guard.
- Casparius and Wrobleski have no postseason line, so all their cells read "—" (real data).
- D at 390: the table scrolls sideways; name column pinned, 3 stat columns visible. D's dock would be `position: sticky` in a real build; the mock draws it static.
- C draws a scrim and sheet inside the card; a real build needs focus handling and a ✕ (touch only, no hover).
- Headshots mean 26 image requests per club. The mocks use plain `<img>`, not `Headshot.jsx` and its fallback chain (unconfirmed how it behaves here).
