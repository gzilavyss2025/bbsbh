// The lockout switch (ADR-0126). In the 2021-22 lockout MLB swapped current players'
// photos for a generic silhouette, so a CDN photo may come back 200 with a gray shape
// instead of the 404 our fallback chain expects. When the switch is on, a MAJOR-LEAGUE
// player's Headshot skips the CDN and shows the club logo (`headshotSources` in
// ../teams.js), and the action-photo washes are not drawn. Minor leaguers and coaches
// keep their photos: they are not covered by the expiring major-league CBA.
//
// It turns on by itself when the CBA lapses (11:59 p.m. ET Dec 1, 2026), from 12:01 a.m.
// ET Dec 2, by the viewer's device clock. VITE_PLAYER_PHOTOS overrides the date both
// ways, set in Vercel and then redeployed: `on` shows photos (a deal was signed, or the
// lockout ended), `off` hides them now. Any other value, or none, follows the date.
export const LOCKOUT_STARTS_AT = Date.parse('2026-12-02T05:01:00Z')

// Which env to read. Vite inlines import.meta.env, so the app follows the date. Outside
// Vite (the unit suite in plain node) the default is `on`, so URL tests don't start
// failing on Dec 2; a test can still set process.env.VITE_PLAYER_PHOTOS.
export function photoEnv(viteEnv, procEnv) {
  if (viteEnv) return viteEnv
  return { VITE_PLAYER_PHOTOS: procEnv?.VITE_PLAYER_PHOTOS ?? 'on' }
}

export function playerPhotosOff(env = photoEnv(import.meta.env, globalThis.process?.env), now = Date.now()) {
  const setting = env?.VITE_PLAYER_PHOTOS
  if (setting === 'off') return true
  if (setting === 'on') return false
  return now >= LOCKOUT_STARTS_AT
}
