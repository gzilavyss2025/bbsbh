// Shared low-level fetch wrapper for the public MLB Stats API — every topic
// file in api/ (schedule.js, uniforms.js, game.js, person-fetch.js, team.js,
// search.js) calls this for its own endpoints. Field paths across those files
// were verified against the live July 5 2026 Brewers @ D-backs game (gamePk
// 825061).

const BASE = 'https://statsapi.mlb.com'

export async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for ${path}`)
  }
  return res.json()
}
