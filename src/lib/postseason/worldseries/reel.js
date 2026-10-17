// The World Series reel's cards (#1906, slice 2). Pure.
//
// SPOILER FOOTING (ADR-0087). Only games dated BEFORE `slateDate` are read, so
// the slate date's game, Final or not, never yields a card. Clip titles narrate
// results; that is allowed for past games (the bracket brief: yesterday's
// results are not protected).
//
// Per game: the "Game N highlights" recap first, then the clips and the
// photographer stills interleaved (clip, photo, clip, ...) in feed order, the
// condensed game dropped, any photo whose image is already a clip thumbnail
// dropped (every MLB photo is some clip's thumbnail), capped at `maxPerGame`.
// Newest game first. [DECISION: the issue says "mixed, in feed order"; the two
// feeds are separate, so they alternate.]
import { classifyHighlight, isEligibleForPositiveFilter } from '../../../api/highlights.js'
import { originalPhotoUrl } from '../../../api/gamePhotos.js'

const RECAP = /^game\s+\d+\s+highlights?$/i
const CDN_PREFIX = 'https://img.mlbstatic.com/mlb-images/image/upload/'

// highlights.js keeps selectCondensedGame on a reveal-only allowlist, so the
// reel reads the same taxonomy tag itself rather than widen that list.
const isCondensed = (item) => (item?.keywordsAll ?? []).some((k) => k.type === 'taxonomy' && k.value === 'condensed-game')

const titleOf = (item) => String(item?.headline ?? item?.title ?? '').trim()

// The CDN id of a clip's thumbnail: the same id a photo carries.
function clipImageId(item) {
  const url = originalPhotoUrl(item?.image?.templateUrl) ?? originalPhotoUrl(item?.image?.cuts?.[0]?.src)
  return url ? url.slice(CDN_PREFIX.length) : null
}

function gameCards(g, maxPerGame, seenImageIds) {
  const clips = (g.clips ?? []).filter((c) => !isCondensed(c) && (RECAP.test(titleOf(c)) || isEligibleForPositiveFilter(classifyHighlight(c))))
  const recap = clips.filter((c) => RECAP.test(titleOf(c)))
  const rest = clips.filter((c) => !RECAP.test(titleOf(c)))
  const clipIds = new Set(clips.map(clipImageId).filter(Boolean))
  const photos = (g.photos ?? []).filter((p) => p.kind === 'photographer' && !clipIds.has(p.id) && !seenImageIds.has(p.id))

  const meta = { gamePk: g.gamePk, gameNumber: g.gameNumber, tag: g.tag, filter: g.filter }
  const asClip = (item) => ({ kind: 'clip', ...meta, title: titleOf(item), item })
  const asPhoto = (photo) => ({ kind: 'photo', ...meta, title: photo.headline || 'Photo', photo })

  const mixed = []
  for (let i = 0; i < Math.max(rest.length, photos.length); i++) {
    if (i < rest.length) mixed.push(asClip(rest[i]))
    if (i < photos.length) mixed.push(asPhoto(photos[i]))
  }
  const cards = [...recap.map(asClip), ...mixed].slice(0, maxPerGame)
  for (const c of cards) {
    const id = c.kind === 'clip' ? clipImageId(c.item) : null
    if (id) seenImageIds.add(id)
  }
  return cards
}

// games: [{ gamePk, gameNumber, date, tag, filter, clips (raw content items), photos (fetchGamePhotos rows) }]
export function buildReel(games, { slateDate, maxPerGame = 6 } = {}) {
  const seenImageIds = new Set()
  return (games ?? [])
    .filter((g) => g.date < slateDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber)
    .flatMap((g) => gameCards(g, maxPerGame, seenImageIds))
}

// "Road here": the last `perClub` games of each club's LCS dated before the
// slate date. clubs: [{ clubId, abbr, round: 'NLCS', games: [{ gamePk, gameNumber, date }] }].
export function roadHereGames(clubs, slateDate, { perClub = 2 } = {}) {
  return (clubs ?? []).flatMap((c) =>
    c.games
      .filter((g) => g.date < slateDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.gameNumber - b.gameNumber)
      .slice(-perClub)
      .map((g) => ({ ...g, clubId: c.clubId, tag: `${c.round} G${g.gameNumber}`, filter: c.abbr })),
  )
}
