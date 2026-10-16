# MLB Gameday assets (checked live 2026-10-12)

MLB's Gameday app loads its art from public CDN paths keyed by ids the app
already has: `venueId`, `teamId`, `personId`, `uniformAssetCode`. This file is
the catalog, so a future project can find them without a new search. **No art
is stored in the repo.** Every image belongs to MLB Advanced Media. A consumer
loads it at runtime, like the logos and headshots.

## Where the list comes from

Gameday's main script holds one config object with every URL template it uses:
`https://prod-gameday.mlbstatic.com/app-mlb/5.59.4-mlb.0/gd.min.js` (the build
that `https://www.mlb.com/gameday/{gamePk}` loaded on 2026-10-12). Search it for
`stadiumTop`, `jersey`, `playerActionShot`. A later build can rename a path:
read the new script before you trust this file.

`{base}` below is
`https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images`.

## Stadium backdrops (not used in the app yet)

`{base}/stadiums/{day|night}/{venueId}{density}.jpg`

- **What it is:** a 3D render of the outfield view from behind home plate:
  stands, scoreboard, roof. Gameday puts it behind the pitch view.
- **Density:** `@2x` gives 2316×888. An empty density (`{venueId}.jpg`) gives
  1158×444. About 160-420 KB at `@2x`, 40-135 KB at 1×.
- **Coverage:** all 30 MLB home parks return 200 for `day` and `night`, at both
  densities (full sweep from `/api/v1/teams?sportId=1&season=2026`). Some
  special-event parks also have art: London Stadium (5381) and Estadio Alfredo
  Harp Helu (5340) return 200.
- **MiLB:** no art. Fifth Third Field (2767), Coca-Cola Park (3230) and
  Principal Park (2844) return 403.
- **Unknown id:** 403 (tried 999999). There is no silent fallback, so `onError`
  is reliable. The template is written `{id:default}`, so Gameday uses
  `{base}/stadiums/{day|night}/default@2x.jpg` (a generic park) when it has no
  id. That file returns 200.
- **Domes:** Tropicana Field (12) and Rogers Centre (14) serve the same file
  for `day` and `night`.
- **The art changes.** `last-modified` on venue 32 was 2026-09-28, and the
  scoreboard in the render shows "Postseason 2026" and sponsor boards
  ("The Show 26"). MLB updates the art in the season. Do not rely on a fixed
  crop of the scoreboard.
- **Headers:** `access-control-allow-origin: *`, `cache-control:
  public,max-age=3600`. A cached `<img>` needs `crossOrigin="anonymous"` (the
  same rule as the batter figure in `docs/uniforms-and-logos.md`).
- **The park-photo surfaces may not use it.** The slate wash and the Ballpark
  card follow the licence rule in `docs/ballpark-photos.md`: free-licence
  photos only, bundled in the repo, no hotlinking. This art is MLB-owned and
  served from MLB's host, so it fails both parts. A NEW surface that wants it
  (for example a pitch-view scene) needs Gary's decision first, made the same
  way as for the logos and headshots the app already hotlinks.
- **Spoiler rule:** not affected. It is fixed art for a park.

Gameday also asks for an infield floor image
(`{base}/stadiums/infield-full/{id}{density}.jpg` and `…/infield/…`). The
`default` file returns 200. Venue 32 returned 403 on both paths. No other venue
was tried.

## Other paths, and where each one is documented

| Asset | Template | Status | Home |
|---|---|---|---|
| Batter figure, per uniform | `{base}/batters/{year}/{right\|left}/{uniformAssetCode}.png` | In use: the lineup crest sheet, and the batter beside each at-bat's strike zone (`StrikeZone.jsx`, silhouette when the art cannot come) | `docs/uniforms-and-logos.md`, #1852 |
| Club's usual batter ("immortal") | `{base}/batters/immortal/{right\|left}/{teamId}-{home\|away}.png` | Not used. 496×1050, jersey and pants in one image. `GENERIC-home` also exists | — |
| Field outline per park | `{base}/fields/{venueId}.svg` | MLB and MiLB parks; `generic.svg` is the fallback | PR #1860 (`docs/ballpark-layouts.md`) |
| Player action photo | `img.mlbstatic.com/mlb-photos/image/upload/w_{w},q_auto:best/v1/people/{personId}/action/{vertical\|pitching}/current` | Not used. Active MLB players only | #1863 |
| League logo | `www.mlbstatic.com/team-logos/league-on-{theme}/{id}.svg` | In use | `src/lib/teams.js` |
| Cap logo | `www.mlbstatic.com/team-logos/team-cap-on-{light\|dark}/{teamId}.svg` | In use | `src/lib/logoCdn.js` |

## Dead ends (checked 2026-10-12)

- `{base}/tv_station/light/{id}.svg`: 403 for every broadcast id from
  `/schedule?hydrate=broadcasts` (Brewers.TV 6216, Cardinals.TV 6415, WTMJ 192,
  KMOX 105).
- `{base}/abs/v1/min`: 403.
- `statsapi.mlb.com/api/v1/game/{gamePk}/feed/color`: 404.
- `…/people/{personId}/action/hitting/current`: 404 for every player tried.
- Do not add Gameday's `d_people:generic…` segment to a photo URL. With it, a
  missing photo returns 200 and a generic silhouette, so the app cannot fall
  back (see the headshot comments in `src/lib/teams.js`).

## Risk

None of these paths is a documented API. The asset path has a version
(`1.3.0`) and so does the app build (`5.59.4`). MLB can move or remove a file
without notice. Every consumer must hide the image on `onError` and look
complete without it.
