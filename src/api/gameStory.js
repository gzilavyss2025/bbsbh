// Each team's own MLB.com coverage of this game — a recap, and any same-game
// news (an in-game injury, e.g.) — resolved server-side by api/game-story.js,
// a Vercel edge function. That server hop exists because mlb.com's
// team-branded RSS feeds (the only place a TEAM's own recap lives, as opposed
// to the single neutral one statsapi's `content` endpoint exposes) send no
// CORS header, unlike statsapi.mlb.com, so the browser can't fetch them
// directly.
//
// Each RSS story carries only a headline and a link — no photo, no preview
// text. dapi.mlbinfra.com/v2/content/en-us/stories/{slug} (the same content
// API statsapi's own `editorial.recap.mlb.url` points into) resolves ANY
// mlb.com/news slug, not just the one statsapi happens to tag to a gamePk —
// and unlike mlb.com's RSS it DOES send a CORS header, so this second lookup
// runs straight from the browser, one per story, purely additive: a story
// still renders headline+link if its lookup fails or comes back thin.
// Verified live 2026-08-21 against gamePk 823035 and several other
// RSS-derived slugs.
//
// Unlike the single-recap version this replaced, this renders each story's
// real headline — MLB.com recap headlines routinely state the final — but
// that's fine here: GameStoryCard only ever mounts inside the box score's
// already-revealed render (see BoxScore.jsx), where the full final line score
// is already sitting on the same screen. Nothing here reaches the DOM before
// that seal is tapped, and nothing shown after it is a new spoiler.

const CONTENT_API = 'https://dapi.mlbinfra.com/v2/content/en-us/stories'

// mlb.com's canonical article path is /news/{slug} (see api/game-story.js's
// normalizeUrl) — pull that slug back out to key the content lookup.
export function slugFromStoryUrl(url) {
  return /\/news\/([^/?#]+)/.exec(url ?? '')?.[1] ?? null
}

// The content API's photo objects carry a Cloudinary-style templateUrl with
// a `{formatInstructions}` placeholder (same shape as statsapi's own
// editorial.recap.mlb.image.cuts) rather than a ready crop at card size —
// thumbnailUrl alone is a fixed 250x250 square, too small for a card image.
export function buildStoryPhotoUrl(thumbnail, { width = 640, height = 360 } = {}) {
  const template = thumbnail?.templateUrl
  if (!template) return null
  return template.replace('{formatInstructions}', `w_${width},h_${height},c_fill,g_auto,q_auto,f_jpg`)
}

async function enrichStory(story) {
  const slug = slugFromStoryUrl(story.url)
  if (!slug) return story
  try {
    const res = await fetch(`${CONTENT_API}/${slug}`)
    if (!res.ok) return story
    const data = await res.json()
    return {
      ...story,
      blurb: typeof data.summary === 'string' ? data.summary.trim() : null,
      photo: buildStoryPhotoUrl(data.thumbnail),
    }
  } catch {
    return story
  }
}

export async function fetchGameStory(gamePk, awayTeamId, homeTeamId) {
  try {
    const q = new URLSearchParams({
      gamePk: String(gamePk),
      awayId: String(awayTeamId),
      homeId: String(homeTeamId),
    })
    const res = await fetch(`/api/game-story?${q}`)
    if (!res.ok) return []
    const data = await res.json()
    const stories = Array.isArray(data?.stories) ? data.stories : []
    return Promise.all(stories.map(enrichStory))
  } catch {
    return []
  }
}
