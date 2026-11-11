// The Series MVP's own stat line, from the per-player series sums
// (postseason/archive/series.js `lines`). One line per player: a pitcher's when his outs recorded
// outnumber his at-bats, else his batting line; [] when unknown. Pure arithmetic.
import { preload } from 'react-dom'
import { outsToIp } from '../math/innings.js'

const rate3 = (v) => v.toFixed(3).replace(/^0(?=\.)/, '')

export function mvpStatLine(lines, playerId) {
  const bat = lines?.batting?.[playerId]
  const pit = lines?.pitching?.[playerId]
  const batting = bat
    ? [
        ['AVG', bat.atBats ? rate3(bat.hits / bat.atBats) : '—'],
        ['H', String(bat.hits)],
        ['HR', String(bat.homeRuns)],
        ['RBI', String(bat.rbi)],
        ['BB', String(bat.baseOnBalls)],
      ]
    : []
  const pitching = pit
    ? [
        ['IP', outsToIp(pit.outs)],
        ['W-L', `${pit.wins}-${pit.losses}`],
        ['SV', String(pit.saves)],
        ['ER', String(pit.earnedRuns)],
        ['SO', String(pit.strikeOuts)],
      ]
    : []
  return pit && (!bat || pit.outs > bat.atBats) ? pitching : batting
}

// A Series photo of the MVP, picked by hand from the clincher's MLB highlights (an image id on
// img.mlbstatic.com). 2026: Contreras lifting the MVP trophy after Game 5. Here, not in
// ChampionHero, so the slate can start the photo before the hero's chunk and bracket land (#3042).
export const MVP_PHOTOS = { 2026: { id: 'cz7beynol16rtuq2neot', club: 158 } } // club: the photo's side (Brewers), known before the award loads
export const mvpPhotoUrl = (id, w = 900) => id && `https://img.mlbstatic.com/mlb-images/image/upload/w_${w},h_${w},f_jpg,q_auto:good,c_fill,g_center/mlb/${id}.jpg`
// 450 for a 1x screen, 900 for 2x and up (the phone slab is about 360 CSS px wide).
export const mvpPhotoSrcSet = (id) => `${mvpPhotoUrl(id, 450)} 450w, ${mvpPhotoUrl(id)} 900w`
export const MVP_PHOTO_SIZES = '(max-width: 739px) 100vw, 450px'

// Start the champion hero's photo as soon as the slate knows which winter it shows (call in render;
// React dedupes). Its URL is static, so it need not wait for the hero's chunk or the bracket.
export function preloadMvpPhoto(season) {
  const pick = MVP_PHOTOS[season]
  if (pick) preload(mvpPhotoUrl(pick.id), { as: 'image', imageSrcSet: mvpPhotoSrcSet(pick.id), imageSizes: MVP_PHOTO_SIZES, fetchPriority: 'high' })
}
