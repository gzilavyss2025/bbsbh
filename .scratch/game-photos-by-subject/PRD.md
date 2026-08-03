# Game photos by player and by team

Status: ready-for-agent
Groundwork **shipped** in PR #487 (`claude/game-photo-categories`), Aug 2026.
That PR classified each photo and attached its subject; this file records what
landed, what the remaining work is, and the decisions already settled so a
later context doesn't re-derive them.

## The ask

Pull a player's photos, or a club's photos, across games — not just within the
one game whose gallery is open. PR #487 deliberately built the per-photo half of
this (classification + subject attribution) and stopped short of the index.

## 1. What shipped in PR #487

`src/api/gamePhotos.js`. `fetchGamePhotos(gamePk)` now returns, per photo:

```js
{ id, original, thumb, kind, headline,
  focus: { playerId, playerName, teamId, teamName, playerIds, teamIds } }
```

- **`kind`** — `photographer` | `broadcast` | `graphic` | `unknown`. Read the
  module header before touching `classifyPhotoAsset`; it records which signals
  were tried and how each one fails alone. Short version: the decisive test is
  the ORIGINAL asset's aspect ratio via Cloudinary `fl_getinfo` (cameras shoot
  3:2, video is 16:9), the filename is a free shortcut that is *not* sufficient,
  and taxonomy describes the video rather than the image.
- **`focus`** — subject player + team, from the item's own `keywordsAll` ids.
  Never name matching: `playerId` is the same personId `Headshot.jsx` takes,
  `teamId` the same key `src/lib/teams.js` uses everywhere.
- **`photosForPlayer(photos, personId)` / `photosForTeam(photos, teamId)`** —
  match against `playerIds`/`teamIds` (every tagged id, not just the primary),
  so a montage tagging three players is found under all three. **These are the
  query primitives the by-subject feature is meant to reuse.** They are
  currently exercised only by the unit suite — no screen calls them yet.
- **`withoutGraphics(photos)`** — the camera-only filter both `/photos` and
  `GamePhotosStrip` apply. Keeps `unknown` on purpose.

Attribution quality, measured over 431 assets (88 games, Jul–Aug 2026): a
photographer still carries exactly one team 110/110 times and exactly one player
105/110. Broadcast frames are nearly as good (71/76). Graphics mostly carry
neither (19/59) — which is why dropping them also removes most of the rows that
would have been unattributable anyway.

## 2. What is missing

There is no cross-game index. Every lookup today needs `fetchGamePhotos(gamePk)`
for each game, so "Jarren Duran's photos this season" is ~160 content-endpoint
calls plus a shape probe per asset. That is the whole remaining problem.

## 3. Decisions already settled — do not re-litigate

- **Attribution names the SUBJECT, not everyone in frame.** A photo of a Rockies
  batter also shows the Brewers catcher; only Colorado is tagged. A by-team pull
  therefore means "photos this club is the subject of", not "photos this club
  appears in". Verified visually — don't try to widen it without a pixel-level
  source, which the feed cannot provide.
- **Bare `data-visualization` is NOT a graphic signal.** It also marks
  "Data Viz: …" clips whose thumbnail is an ordinary broadcast frame. Including
  it dropped real photos. `condensed-game` IS kept — that card is served at
  1280x720, indistinguishable from a frame grab by shape alone. Both pinned by
  tests in `test/game-photos.test.js`.
- **The `guid` → `playId` join works on photos too** (36/39 sampled), via the
  same map `src/api/highlights.js` builds. It yields batter, pitcher, inning and
  therefore both clubs. Not wired in — it was not needed for a caption, but it
  is the precision upgrade if subject-by-keyword ever proves too coarse. NOTE:
  it pulls in the play's result, so it is score-revealing — fine on `/photos`
  (the unsealed exception), never outside a `SealBox` in the scored-game flow.

## 4. Open questions for the index

1. **Where does it live?** The obvious fit is the build-time-fetch pattern
   (`src/api/CLAUDE.md`) — a nightly `scripts/gen-game-photos.mjs` writing
   `public/data/game-photos.json` keyed by personId and teamId. Cost-driven,
   exactly like `vs-team-splits.json`. Open: how large does that get over a
   season, and does it need the same out-of-precache treatment (`vite.config.js`)
   that `vs-team-splits.json` / `rookies.json` have?
2. **Store URLs or ids?** Only the `mlb/{id}.jpg` segment is needed —
   `original`/`thumb` are pure functions of it (`CDN_PREFIX` + the id). Storing
   the id alone keeps the file small and can't drift from the URL builders.
3. **Does the shape probe move to the generator?** It should — that removes the
   per-page-view `fl_getinfo` fan-out that PR #487 accepted as the price of
   accuracy, and it is the main reason to precompute at all. The runtime reader
   would then just read `kind` off the file.
4. **Surface?** Candidates: a section on the player page (alongside the existing
   `SplitsVsTeam`/`FoulCard` tier) and a filter on `/photos` itself. Not decided.

## 5. Where to look

- `src/api/gamePhotos.js` — the module header is the authoritative record of the
  classification evidence.
- `src/api/CLAUDE.md` — catalog entry for this module.
- `test/game-photos.test.js` — 20 tests; the edge cases in §3 are pinned there.
- PR #487 description — the measured numbers behind each signal.
