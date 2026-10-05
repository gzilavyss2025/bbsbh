# src/lib/data — the hand-tuned stores

Values tuned by eye — an edge-bleed scale, a nudge, a band colour, a header
triad — live on disk as JSON rather than as JS literals, so the Team Identity
Lab can write an edit straight back instead of handing over a snippet to paste
(ADR-0029).

| File | Read by |
| --- | --- |
| `mlb-treatment-tuning.json` | `teams.js` |
| `milb-treatment-tuning.json` | `milbColors.js` |
| `milb-colors.json` | `brandColors.js` |
| `mlb-team-colors.json` | `brandColors.js`, `teams.js` |
| `mono-ink.json` | `monoInk.js` (overlay-aware, ADR-0054) — and `scripts/gen-mono-logos.mjs`, which is what actually changes the served art, on its own schedule |
| `stamp-logo-tuning.json` | `stampLogoTuning.js` → `components/GameStamp.jsx` — the one store read at RENDER time |
| `wpa-tuning.json` | `wpa/wpaLogo.js`, `wpa/wpaBandColors.js` — deliberately NOT reachable from the eager entry graph; see `wpa/wpaDefaults.js` |

Every store has the same outer shape:

```json
{ "<teamId>": { "name": "…", "treatments": { "<key>": { …fields, "note": "…" } } } }
```

`name` and `note` are the per-entry comments these tables carried as literals,
kept as data so a 900-line JSON diff still says which club moved and why a value
is odd. **No resolver reads either one** — they exist for humans, and the lab
renders `note` as an editable field so rationale is authored in the tool rather
than lost on the first write.

**Two stores have no `treatments`** — they hold a fact about the CLUB, not about
one of its jersey treatments. `test/identity-lab-stores.test.js` keeps them in
its `TEAM_LEVEL_STORES` list so they still get every outer-shape guard.

`milb-colors.json` — an affiliate has a single identity, not a per-treatment one:

```json
{ "546": { "name": "…", "level": "Double-A", "pair": ["#e03a3e", "#003263"],
           "third": "#cbccce", "confidence": "low", "source": "…", "note": "…" } }
```

`mlb-team-colors.json` — a club's brand colours, the store behind
`TEAM_COLOR_PAIRS`, `TEAM_COLORS`, and `teamColorExtras`, plus the club-level
(not per-treatment) `offDayTreatment` pick `offDayTreatmentFor` reads for
`OffDaySection.jsx`'s tile — absent means Main — and the same idea per side,
`defaultHomeTreatment`/`defaultAwayTreatment` (`defaultHomeTreatmentFor`/
`defaultAwayTreatmentFor`), which `defaultTreatmentFor` consults before its own
Friday/City-Connect heuristic — absent means "guess" rather than "Main":

```json
{ "158": { "name": "…", "primary": "#12284B", "secondary": "#FFC52F",
           "accent": "#FFC52F", "offDayTreatment": "alternate",
           "defaultHomeTreatment": "city-connect", "defaultAwayTreatment": "main",
           "extras": [{ "label": "Powder Blue", "hex": "#6CACE4" }], "note": "…" } }
```

**`accent` is not a third brand colour**, and conflating the two is the mistake
this schema exists to prevent. It is the hand-picked *distinctiveness* hex — the
one that makes two clubs on a slate card tell apart — so for 27 of 30 clubs it
deliberately restates that club's own `primary` or `secondary`, and only the
Guardians, Rays, and Blue Jays carry a hue the pair doesn't. A club's real
third-or-later colours are `extras`, researched against Wikipedia infoboxes and
teamcolorcodes.com and skipped rather than guessed where sources disagreed (14
clubs have one). Every colour field is optional; **a role the club lacks is an
absent field, never `""`** — the dev-save validator rejects the empty string, and
the lab's `applyColorsDraft` deletes rather than blanks
(`src/screens/identity-lab/profiles/mlbColorRoles.js`).

In `milb-colors.json`, `pair` is the only field a resolver reads. `third`/`confidence`/`source`/`note`
are provenance, and `found: false` (mutually exclusive with `pair`, enforced by
the dev-save validator and by `test/identity-lab-stores.test.js`) marks a club
research resolved nothing for.

`tuningStore.js` holds the readers. Each consuming module rebuilds the exact
`{ [teamId]: { [treatment]: value } }` table it used to declare inline, so every
resolver below it — and every test pinning one — is untouched by the move. **The
store is the authoring format; those tables are still the lookup format.**
