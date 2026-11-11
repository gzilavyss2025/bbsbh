// Player and coach headshot URLs off the mlbstatic CDN. Split out of teams.js
// (#3039); teams.js re-exports it.

import { playerPhotosOff } from '../headshot/lockout.js'

// Player headshots
//
// The same mlbstatic CDN that serves team logos also serves per-player
// headshots, keyed by the person id we already carry everywhere (the same id
// that drives /people/{id}). Verified live: returns a 1:1 transparent "silo"
// cutout (426×426 at w_426, palette PNG + tRNS), the subject already framed
// consistently — head crown ~3.3% from the top, shoulders bleeding off the
// bottom — so a plain CSS top-center cover crop (see .shot img) reframes it to
// 3:4 with no per-image work. MiLB coverage is partial, hence the same
// "decorative, render behind a fallback" rule as logos: components/Headshot.jsx
// and StatBox.jsx's PitcherPhoto both use the URL below (WITHOUT the CDN's
// `d_people:generic:headshot:silo` default-image transform some other
// integrations use), so a personId with no real photo on file 404s instead of
// silently serving the CDN's own generic gray silo placeholder — the miss is
// then distinguishable from a real photo and can fall back to something more
// useful (Headshot.jsx falls back further to the player's team logo, or a
// monogram with no team).
export const HEADSHOT_BASE = 'https://img.mlbstatic.com/mlb-photos/image/upload'

// `width` is the CDN-delivered pixel width, NOT the CSS display size. It
// defaults to 320 so the largest on-screen rung (--shot-xl, 104px wide) is
// still ≥1 device pixel per source pixel on a 3× phone (104×3 = 312) — at the
// old 213 those big headshots were upscaled ~1.5× and looked pixelated. One
// shared width means every call site reuses a single cached image; callers
// should only override it for a materially larger surface.
export function realHeadshotUrl(personId, width = 320) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/silo/current`
}

// The `milb` context of the SAME CDN/personId — what milb.com's own team pages
// render. Verified live: a 426×640 portrait JPEG (a real photo on a colored
// backdrop, NOT a transparent silo cutout), and crucially present for many
// prospects whose `silo` variant 404s (they've no posed MLB studio shot yet).
// Same no-`d_people:generic` rule as realHeadshotUrl: a personId with no photo
// on file still 404s cleanly here, so it degrades to the team-logo fallback.
// Headshot.jsx uses this as the second rung of its chain — silo (preferred,
// matches the app's floating-cutout treatment) → milb (a real face for a
// prospect) → team logo → monogram.
export function milbHeadshotUrl(personId, width = 320) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/milb/current`
}

// Coaches and managers have NO `silo`/`milb` variant — both 404 for a coaching
// personId (verified live). Their photo lives under a distinct `{code}/coach`
// context instead. Verified live across teams: the code is NOT team-specific —
// `67` and `83` both resolve for every manager tested (Murphy/Melvin/Boone/
// Counsell); we use `67`, a 426×640-family ~2:3 portrait JPEG on a colored
// backdrop (same shape as the milb variant, so the .shot top-center cover crop
// reframes it head-near-top with no per-image work). Same no-`d_people:generic`
// rule as the player URLs: a personId with no coach photo on file still 404s
// cleanly, so Headshot.jsx degrades to the team logo. Used by Headshot's
// `coach` mode (components/Headshot.jsx) — the manager page's only photo source.
export function coachHeadshotUrl(personId, width = 320) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/67/coach/current`
}

// The ordered PHOTO rungs of a person's Headshot fallback chain (see
// components/Headshot.jsx), before the shared team-logo / monogram rungs the
// component appends. Pure so the rung POLICY is unit-testable on its own
// (test/teams.test.js) rather than buried in the component's render.
//   • coaches/managers (`coach`): the `{code}/coach` variant only — a coaching
//     personId has no silo/milb (both 404).
//   • MiLB / prospect players (`mlb` false): silo → milb. The milb rung is a
//     real, RECENT minor-league face for a prospect whose MLB `silo` studio
//     shot 404s — exactly the case that rung exists for.
//   • MAJOR-LEAGUE players (`mlb` true): silo ONLY (plus the coach rung below). An established MLB player's
//     `milb` variant is a years-old prospect photo in the wrong team's cap;
//     since the MLB `silo` studio shot is the one that can lag or briefly 404
//     (regeneration, a trade), letting a momentary silo miss fall to that
//     stale minor-league shot — permanently, once Headshot advances a rung —
//     showed veterans in their old rookie-ball hats. Dropping the milb rung
//     for a confirmed MLB player degrades a silo miss to the club logo
//     (neutral, current) instead. A brand-new call-up with no silo yet shows
//     the club logo rather than his recent MiLB face — an accepted, rare trade
//     for never mis-capping a regular.
//   • Every player ends on the `coach` rung. A retired player now on a staff
//     (Matsui, Burrell, Bush — verified live) has no silo/milb but does have a
//     coach photo; for everyone else it is one more clean 404 before the logo.
// `mlb` is a plain boolean the caller decides (Headshot derives it from the
// player's ACTUAL team, not the display teamId — a prospect's card tints with
// his parent MLB org but must still keep the milb rung).
export function headshotSources(personId, { coach = false, mlb = false } = {}) {
  if (!personId) return []
  if (coach) return [coachHeadshotUrl(personId)]
  // Lockout (ADR-0126): no photo rung at all, not even coach, so the tile goes straight
  // to the logo with no 404 to wait out or log.
  if (mlb && playerPhotosOff()) return []
  if (mlb) return [realHeadshotUrl(personId), coachHeadshotUrl(personId)]
  return [realHeadshotUrl(personId), milbHeadshotUrl(personId), coachHeadshotUrl(personId)]
}
