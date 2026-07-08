// What each club is actually wearing tonight, from the dedicated
// /api/v1/uniforms/game endpoint — the live feed carries zero uniform data
// (see docs/uniforms-and-logos.md for the verified findings). Spoiler-FREE:
// the assignment reveals nothing about the score and never changes once
// posted. It IS empty until around first pitch, and MiLB games return
// nothing, so this degrades to null and callers show the usual "—".

import { getJson } from './statsapi.js'

// Assets sort jersey → pants → cap so the composed line always reads top-down.
const UNIFORM_PIECE_ORDER = { J: 0, P: 1, C: 2 }

export async function fetchGameUniforms(gamePk) {
  if (!gamePk) return null
  try {
    const data = await getJson(`/api/v1/uniforms/game?gamePks=${gamePk}`)
    const game = data.uniforms?.[0]
    const normalize = (side) => {
      const assets = (side?.uniformAssets ?? [])
        .map((a) => ({
          text: a.uniformAssetText ?? '',
          piece: a.uniformAssetType?.uniformAssetTypeCode ?? '',
        }))
        .filter((a) => a.text)
        .sort(
          (a, b) =>
            (UNIFORM_PIECE_ORDER[a.piece] ?? 9) -
            (UNIFORM_PIECE_ORDER[b.piece] ?? 9),
        )
      return assets.length > 0 ? assets : null
    }
    const away = normalize(game?.away)
    const home = normalize(game?.home)
    if (!away && !home) return null
    return { away, home }
  } catch {
    // Not posted yet / MiLB / endpoint hiccup — the uniform row just shows "—".
    return null
  }
}

// Slate-wide uniform readiness: given the day's gamePks, return a map
// gamePk -> boolean of whether BOTH clubs' uniforms are posted yet. The
// /uniforms/game endpoint takes a comma-separated gamePks list, so the whole
// slate resolves in ONE request rather than one per card. Spoiler-free (a
// uniform assignment reveals no score) and, like the per-game fetch, empty
// until ~first pitch and absent for MiLB — so a missing/errored game just maps
// to `false` (the card's uniform chip stays red until the assignment lands).
export async function fetchScheduleUniforms(gamePks) {
  const list = (gamePks ?? []).filter(Boolean)
  if (list.length === 0) return {}
  try {
    const data = await getJson(
      `/api/v1/uniforms/game?gamePks=${list.join(',')}`,
    )
    const posted = (side) =>
      (side?.uniformAssets ?? []).some((a) => a.uniformAssetText)
    const out = {}
    for (const u of data.uniforms ?? []) {
      out[u.gamePk] = posted(u.away) && posted(u.home)
    }
    return out
  } catch {
    return {}
  }
}

// One printable uniform line — "Alt 2 Navy Blue jersey · Road Grey pants ·
// Alt Yellow Front hat". Asset labels arrive as "<Club> <desc> <Piece>"
// ("Brewers Alt 2 Navy Blue Jersey"); the club name is redundant next to a
// team header, so it's stripped, and the trailing piece word is lowercased so
// the descriptor reads as the name and the piece as a plain noun.
export function uniformLine(assets, clubName) {
  if (!assets?.length) return ''
  return assets
    .map((a) => {
      let text = a.text
      if (clubName && text.startsWith(`${clubName} `)) {
        text = text.slice(clubName.length + 1)
      }
      return text.replace(/\s(Jersey|Pants|Hat)$/, (m) => m.toLowerCase())
    })
    .join(' · ')
}

// A tight, at-a-glance uniform summary — "Away Alternate Navy Blue",
// "Home White", "Road Grey" — synthesized from the full asset list the way
// weather.js boils a forecast down to a scorebook line. The JERSEY is the
// identifying piece (pants and cap almost always follow the home/road default —
// grey pants, plain cap on the road), so the summary leads with tonight's side
// and the jersey's descriptor, dropping the redundant club name, the piece noun,
// and any variant number. A standard Home/Road jersey already names the side, so
// the prefix isn't doubled up ("Home White", not "Home Home White").
export function uniformSummary(assets, side, clubName) {
  if (!assets?.length) return ''
  const jersey = assets.find((a) => a.piece === 'J') ?? assets[0]
  let text = jersey.text
  if (clubName && text.startsWith(`${clubName} `)) {
    text = text.slice(clubName.length + 1)
  }
  text = text
    .replace(/\s*\bJersey\b\s*/i, ' ') // drop the piece noun
    .replace(/\bAlt\b/gi, 'Alternate') // expand the abbreviation
    .replace(/\bAlternate\s+\d+\b/i, 'Alternate') // "Alternate 2" → "Alternate"
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  // A Home/Road/Away jersey self-identifies; anything else (an alternate, a
  // City Connect) gets tonight's side stamped on the front.
  if (/^(home|road|away)\b/i.test(text)) return text
  return `${side === 'away' ? 'Away' : 'Home'} ${text}`
}
