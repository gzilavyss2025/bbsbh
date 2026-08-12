// Which pictures the poster needs, and where each comes from.
//
// Split out of the screen so the URL rules — which mark a club wears tonight,
// which headshot rung to try, how a CSS focal point becomes a canvas one — sit
// next to each other and can be read in one go. Everything here is a plain
// function of the model plus the jersey treatments; the loading itself is
// posterImages.js.
import { isMlbTeamId, realHeadshotUrl, teamLogoUrl, treatmentTile } from '../teams.js'
import { milbTreatmentTile } from '../milbColors.js'
import { parkBackdrop } from '../ballpark/parkBackdrop.js'
import { loadPosterImages } from './posterImages.js'

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
  return {
    park,
    awayTile,
    homeTile,
    sources: {
      parkPhoto: park?.src ?? null,
      awayMark: model.away.id ? teamLogoUrl(model.away.id, awayTile?.logoVariant ?? 'base') : null,
      homeMark: model.home.id ? teamLogoUrl(model.home.id, homeTile?.logoVariant ?? 'base') : null,
      // No `mono` knockouts are loaded: every place the poster prints a club
      // mark is on card paper, where a one-colour white lockup would be
      // invisible. The knockouts exist for navy mastheads (ADR-0031), and the
      // poster's mastheads carry a title only.
      //
      // 480px because the poster prints these at 104px on a fixed 1200px-wide
      // sheet — the on-screen rungs' 320px default would upscale here.
      awayShot: model.starters.away ? realHeadshotUrl(model.starters.away.id, 480) : null,
      homeShot: model.starters.home ? realHeadshotUrl(model.starters.home.id, 480) : null,
    },
  }
}

// Resolve every source and shape it the way the painters expect. A missing
// image is null throughout — the poster draws around it.
export async function loadPosterArt(model, treatments, t) {
  const { park, awayTile, homeTile, sources } = posterArtSources(model, treatments, t)
  const img = await loadPosterImages(sources)
  return {
    park: img.parkPhoto ? { image: img.parkPhoto, focus: focusPoint(park?.focus) } : null,
    away: { mark: img.awayMark, tile: awayTile },
    home: { mark: img.homeMark, tile: homeTile },
    awayShot: img.awayShot,
    homeShot: img.homeShot,
  }
}
