# A lockout switch hides player photos

**Status:** Accepted (Gary, 2026-11-03)
**Date:** 2026-11-03

## Context

The CBA expires on 2026-12-01, and a lockout is expected. On 2021-12-02, the first day of the
last lockout, MLB took current players' photos off MLB.com and put generic silhouettes in their
place (ESPN, NBC Boston, Techdirt, 2021-12-02). The reporting covers MLB.com pages. It does not
say what the `img.mlbstatic.com` CDN returned. If the CDN answers 200 with a silhouette, the
Headshot fallback chain never runs, because it depends on a 404 (`realHeadshotUrl` in
`src/lib/teams.js`). Then every player photo would show a gray shape.

## Decision

A switch in `src/lib/headshot/lockout.js`. It turns on by itself at 12:01 a.m. ET on
2026-12-02, after the CBA lapses at 11:59 p.m. ET on Dec 1.

When it is on:

- A **major-league** player's Headshot has no photo rung, not even the coach rung, so it shows
  the club logo with no 404 to wait out (`headshotSources`, `mlb` true).
- The action-photo washes are not drawn (`actionPhotoUrl`; only active MLB players have them).
- The preview poster leaves an MLB club's player slots empty, and Gameday stops warming an MLB
  game's roster photos.
- **Minor leaguers and coaches keep their photos.** The 2021 reporting names current MLB players
  only. That minor leaguers are outside the expiring CBA is an inference (they bargain under their
  own agreement); check it on Dec 2.

`VITE_PLAYER_PHOTOS` overrides the date both ways (set it in Vercel, then redeploy): `on` shows
photos (a deal was signed, or the lockout ended) and `off` hides them now. Gary chose the date
over a live silhouette check (2026-11-03): it is simple and predictable, and the override covers
a deal or a different start date.

## Known limits

- The date is read from the viewer's device clock. A phone set a day off flips a day off, and an
  open page flips on its next render. The override is the fix for any device.
- Turning photos back on after the lockout is not automatic: set `VITE_PLAYER_PHOTOS=on`.
- A retired player who appears as an MLB-team player (the "played for both" card) loses his photo
  too; there is no reliable active/retired signal at that call site.

## Rejected

- **Detect the silhouette by ETag or size.** We cannot capture the real image until it
  appears, so the check would be a guess.
- **Host our own copies of the photos.** This is the likeness use the league says it cannot
  license during a lockout.
