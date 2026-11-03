// The lockout switch (ADR-0126). In the 2021-22 lockout MLB swapped every current
// player's photo for a generic silhouette, so a CDN photo may come back 200 with a
// gray shape instead of the 404 our fallback chain expects. When the switch is on,
// every player photo URL builder returns null and each Headshot drops straight to
// its team-logo rung. Coach photos stay on; coaches are not in the union.
//
// It turns on by itself when the CBA lapses (11:59 p.m. ET, Dec 1, 2026, so from
// 12:01 a.m. ET Dec 2). VITE_PLAYER_PHOTOS_OFF overrides the date both ways, set in
// Vercel and then redeployed: `0` keeps photos (a deal was signed, or the lockout
// ended), `1` hides them now. Any other value, or none, follows the date.
export const LOCKOUT_STARTS_AT = Date.parse('2026-12-02T05:01:00Z')

// Vite inlines import.meta.env, so the app follows the date. Outside Vite (the unit suite in
// plain node) the default is `0`: photos on, so URL tests don't start failing on Dec 2.
// A test can still set process.env.VITE_PLAYER_PHOTOS_OFF to drive it.
const nodeEnv = () => ({ VITE_PLAYER_PHOTOS_OFF: globalThis.process?.env?.VITE_PLAYER_PHOTOS_OFF ?? '0' })

export function playerPhotosOff(env = import.meta.env ?? nodeEnv(), now = Date.now()) {
  const override = env?.VITE_PLAYER_PHOTOS_OFF
  if (override === '1') return true
  if (override === '0') return false
  return now >= LOCKOUT_STARTS_AT
}
