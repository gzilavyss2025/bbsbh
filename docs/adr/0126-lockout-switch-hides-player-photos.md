# A lockout switch hides player photos

**Status:** Proposed
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
2026-12-02, the minute after the CBA lapses. When it is on, the player photo URL builders (`realHeadshotUrl`, `milbHeadshotUrl`, `actionPhotoUrl`)
return null. Headshot and PitcherNotice then show the team logo, and the action-photo washes
are not drawn. Coach photos stay on, because coaches are not in the union.

`VITE_PLAYER_PHOTOS_OFF` overrides the date both ways (set it in Vercel, then redeploy): `0`
keeps photos (a deal was signed, or the lockout ended) and `1` hides them now. Gary chose the
date over a live silhouette check (2026-11-03): it is simple and predictable, and the override
covers a deal or a different start date.

## Rejected

- **Detect the silhouette by ETag or size.** We cannot capture the real image until it
  appears, so the check would be a guess.
- **Host our own copies of the photos.** This is the likeness use the league says it cannot
  license during a lockout.
