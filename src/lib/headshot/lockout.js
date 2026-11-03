// The lockout switch (ADR-0126). In the 2021-22 lockout MLB swapped every current
// player's photo for a generic silhouette, so a CDN photo may come back 200 with a
// gray shape instead of the 404 our fallback chain expects. Set VITE_PLAYER_PHOTOS_OFF=1
// (Vercel env, then redeploy) and every player photo URL builder returns null: each
// Headshot drops straight to its team-logo rung. Coach photos stay on; coaches are
// not in the union. Turn it off (unset) when a new CBA is signed.
// The process.env fallback only reaches node (the unit suite); Vite inlines import.meta.env.
export function playerPhotosOff(env = import.meta.env ?? globalThis.process?.env) {
  return env?.VITE_PLAYER_PHOTOS_OFF === '1'
}
