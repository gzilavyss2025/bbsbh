// Which pictures the poster needs, and where each comes from.
//
// Split out of the screen so the URL rules — which mark a club wears tonight,
// which headshot rung to try, how a CSS focal point becomes a canvas one — sit
// next to each other and can be read in one go. Everything here is a plain
// function of the model plus the jersey treatments; the loading itself is
// posterImages.js.
import { isMlbTeamId, realHeadshotUrl, teamLogoUrl, treatmentTile } from '../teams.js'
import { milbTreatmentTile } from '../milbColors.js'
import { headerThemeFor, mastheadMarkFor } from '../headerTheme.js'
import { parkBackdrop } from '../ballpark/parkBackdrop.js'
import { loadPosterImages } from './posterImages.js'

// A club's own card chrome — the bar colours and the mark that rides it, the
// same pair `TeamInfo`'s themed sections resolve (ADR-0030). `theme` is null
// for the ~majority of (club, treatment) pairs with no curated colours on
// file, and the painter falls back to the default navy bar exactly as the CSS
// `var(--bar-fill, var(--navy))` chain does.
//
// `reink` is false when the bar's mark is a club's own uploaded City Connect
// lockup rather than the generated knockout: that is finished art coloured for
// its bar, not a silhouette to darken. Told apart by the mono path, which is
// the only art `gen-mono-logos.mjs` writes.
// `treatment` falls back to 'main' rather than being passed through empty.
// A jersey is not posted until close to first pitch, which is exactly when a
// preview poster gets made — and `headerThemeFor` answers null for a missing
// treatment, so passing the gap straight through left every bar on the poster
// the default navy even for a club with curated colours on file. Main is the
// club's own bar in the absence of a jersey, which is also what the treatment
// tile resolver does with a falsy treatment.
export function barFor(teamId, treatment) {
  if (!teamId) return { theme: null, markUrl: null, reink: true }
  const worn = treatment || 'main'
  const { url } = mastheadMarkFor(teamId, worn)
  return {
    theme: headerThemeFor(teamId, worn),
    markUrl: url || teamLogoUrl(teamId, 'mono'),
    reink: !url || url.includes('/logos/mono/'),
  }
}

// TeamTreatmentMark's resolver, asked the same way it asks: MLB clubs read the
// per-treatment table, a MiLB affiliate reads milbColors' Home/Away pair, and
// anything else gets the plain paper tile.
export function tileFor(teamId, treatment, side) {
  if (!teamId) return null
  if (isMlbTeamId(teamId)) return { offsetX: 0, offsetY: 0, ...treatmentTile(teamId, treatment) }
  return side ? milbTreatmentTile(teamId, side) : null
}

// "50% 20%" -> { x: 0.5, y: 0.2 }. CSS background-position fractions and the
// canvas cover() helper mean the same thing; only the notation differs.
export function focusPoint(css) {
  const parts = String(css || '')
    .trim()
    .split(/\s+/)
    .map((p) => Number.parseFloat(p))
  const x = Number.isFinite(parts[0]) ? parts[0] / 100 : 0.5
  const y = Number.isFinite(parts[1]) ? parts[1] / 100 : 0.5
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
}

// Every image the poster draws, as { key: url }. `t` is the copy reader, which
// is what lets an owner-uploaded ballpark photo (ADR-0044) reach the poster
// with no second upload — the same route the slate card's backdrop takes.
export function posterArtSources(model, treatments, t) {
  const park = parkBackdrop(model.venue.name, t)
  const awayTile = tileFor(model.away.id, treatments?.away, 'away')
  const homeTile = tileFor(model.home.id, treatments?.home, 'home')
  const awayBar = barFor(model.away.id, treatments?.away)
  const homeBar = barFor(model.home.id, treatments?.home)
  return {
    park,
    awayTile,
    homeTile,
    awayBar,
    homeBar,
    sources: {
      parkPhoto: park?.src ?? null,
      awayMark: model.away.id ? teamLogoUrl(model.away.id, awayTile?.logoVariant ?? 'base') : null,
      homeMark: model.home.id ? teamLogoUrl(model.home.id, homeTile?.logoVariant ?? 'base') : null,
      // The one-colour knockouts, for the club-coloured bars over the pitcher
      // and batting-order cards. Never a `filter: invert()` on the colour
      // mark — that is what ADR-0031 replaced.
      awayBarMark: awayBar.markUrl,
      homeBarMark: homeBar.markUrl,
      // 480px because the poster prints these at 96px on a fixed 1200px-wide
      // sheet — the on-screen rungs' 320px default would upscale here.
      awayShot: model.starters.away ? realHeadshotUrl(model.starters.away.id, 480) : null,
      homeShot: model.starters.home ? realHeadshotUrl(model.starters.home.id, 480) : null,
      // One per posted hitter, eighteen in all. Requested at 160px because the
      // batting-order row prints them at 32 — the shared 320 default would be
      // ten times the pixels needed, times eighteen, for no visible gain.
      ...lineupShotSources(model),
    },
  }
}

// `shot:{side}:{order}` keys, so the painter can look a row's headshot up by
// where it bats without threading a second array alongside the lineup.
export function lineupShotKey(side, order) {
  return `shot:${side}:${order}`
}

function lineupShotSources(model) {
  const out = {}
  for (const side of ['away', 'home']) {
    for (const p of model.lineups[side]) {
      out[lineupShotKey(side, p.order)] = p.id ? realHeadshotUrl(p.id, 160) : null
    }
  }
  return out
}

// Resolve every source and shape it the way the painters expect. A missing
// image is null throughout — the poster draws around it.
export async function loadPosterArt(model, treatments, t) {
  const { park, awayTile, homeTile, awayBar, homeBar, sources } = posterArtSources(model, treatments, t)
  const img = await loadPosterImages(sources)
  return {
    park: img.parkPhoto ? { image: img.parkPhoto, focus: focusPoint(park?.focus) } : null,
    away: { mark: img.awayMark, tile: awayTile },
    home: { mark: img.homeMark, tile: homeTile },
    awayBar: { ...awayBar, mark: img.awayBarMark },
    homeBar: { ...homeBar, mark: img.homeBarMark },
    awayShot: img.awayShot,
    homeShot: img.homeShot,
    // The `shot:{side}:{order}` entries ride along on the same object the
    // painter already receives; a hitter with no photo on file is null here and
    // the row draws its monogram instead.
    ...img,
  }
}
