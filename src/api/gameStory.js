// Each team's own MLB.com coverage of this game — a recap, and any same-game
// news (an in-game injury, e.g.) — resolved server-side by api/game-story.js,
// a Vercel edge function. That server hop exists because mlb.com's
// team-branded RSS feeds (the only place a TEAM's own recap lives, as opposed
// to the single neutral one statsapi's `content` endpoint exposes) send no
// CORS header, unlike statsapi.mlb.com, so the browser can't fetch them
// directly.
//
// Unlike the single-recap version this replaced, this renders each story's
// real headline — MLB.com recap headlines routinely state the final — but
// that's fine here: GameStoryCard only ever mounts inside the box score's
// already-revealed render (see BoxScore.jsx), where the full final line score
// is already sitting on the same screen. Nothing here reaches the DOM before
// that seal is tapped, and nothing shown after it is a new spoiler.
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
    return Array.isArray(data?.stories) ? data.stories : []
  } catch {
    return []
  }
}
