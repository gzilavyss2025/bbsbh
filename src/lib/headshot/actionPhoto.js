// The ACTION photo of the SAME CDN/personId as the headshots in ../teams.js: a game photo of
// the player batting or pitching, for the player page hero (#1863). Verified live 2026-10-12:
//   `vertical` — a 2:3 portrait (525×788 at w_525). Active MLB players, hitters and
//                pitchers. The only variant the app uses.
//   `pitching` — a landscape 525×330. MLB pitchers only. Not used (the hero shows
//                `vertical` for everyone); kept so a later surface can ask for it.
//   `hitting`  — 404 for every player tried. Never ask for it.
// Retired players (Babe Ruth) and MiLB-only players have neither, so they 404.
// Same no-`d_people:generic` rule as realHeadshotUrl: Gameday's own templates add that
// default, which turns a miss into a 200 with a gray silhouette. Without it, a 404
// means "no action photo" and the hero keeps today's look. `current` follows the
// player's current club, so a photo can show an old uniform until MLB updates it.
// `width` is the CDN pixel width. 525 is sharp on a 3× phone at the hero's ~190px wash;
// keep one width so the cache is reused. The service worker's `/mlb-photos/` rule
// (vite.config.js) already caches these, so there is no second rule.
import { HEADSHOT_BASE } from '../teams.js'

const ACTION_VARIANTS = ['vertical', 'pitching']

export function actionPhotoUrl(personId, { variant = 'vertical', width = 525 } = {}) {
  if (!personId || !ACTION_VARIANTS.includes(variant)) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/action/${variant}/current`
}
