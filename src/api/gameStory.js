// The MLB.com game story: a link out to the official recap article for this
// game, resolved from the same `content` endpoint highlights.js reads
// (`/api/v1/game/{gamePk}/content`, `editorial.recap.mlb`). The card itself
// only ever shows a generic "Read the game story" link (never the headline —
// MLB.com recap headlines routinely state the final), so unlike buzz.js this
// module renders no spoiler text either way. Still only ever call it from
// inside the box score's revealed render (GameStoryCard mounts the fetcher
// there) — the article's `slug` in the resolved URL can itself read like a
// spoiler ("mets-storm-back-in-9th-to-topple-phillies"), so nothing here
// should reach the DOM before the box score's own seal is tapped.
//
// mlb.com serves articles at /news/{slug} regardless of the dapi.mlbinfra.com
// API host the content endpoint's own `url` field points at (verified live
// 2026-07-17, gamePk 823440). MLB only — MiLB games carry no editorial recap.
import { getJson } from './statsapi.js'

export async function fetchGameStory(gamePk) {
  try {
    const data = await getJson(`/api/v1/game/${gamePk}/content`)
    const slug = data?.editorial?.recap?.mlb?.slug
    if (!slug) return null
    return { url: `https://www.mlb.com/news/${slug}` }
  } catch {
    return null
  }
}
