// Which network(s) carry a game — the lineup pages' Broadcast fact (next to
// Attendance) and the slate card's national-TV icon. Spoiler-free: a broadcast
// assignment is known well ahead of first pitch, same footing as the
// uniform/weather facts, so unlike linescore.js/derive.js this has no reveal
// gate and can be fetched eagerly.
//
// SOURCE: statsapi's own schedule endpoint, hydrated `broadcasts(all)`.
//
// It used to be ESPN's public scoreboard (site.api.espn.com), matched to a game
// by date + both teams' identities. That source is UNUSABLE FROM A BROWSER and
// had silently stopped working: ESPN's Akamai edge answers 403 to any request
// carrying a browser User-Agent (verified 2026-08-09 — the same URL returns 200
// to a bare curl and 403 the moment a Chrome/Safari UA is attached), and a 403
// from that edge carries no `Access-Control-Allow-Origin`, so every slate and
// lineup page threw a CORS error into the console and rendered no broadcast at
// all. Nothing about the app's own code was wrong; the source went away.
//
// The replacement is strictly better than a like-for-like hop would have been:
//   - it is the SAME origin the app already reads, already CORS-open, already
//     NetworkOnly in the service worker;
//   - it is keyed by gamePk, so the whole ESPN team-matching layer is gone —
//     no abbreviation/nickname reconciliation, and no closest-start-time
//     tiebreak for a doubleheader's two same-matchup events;
//   - it carries `isNational` as a field, so the slate icon no longer has to
//     infer "national" from a market bucket; and
//   - it covers the MINORS, which ESPN never did (verified against AA gamePk
//     818035: "Bally Sports Live", "MiLB.TV").
// The slate gets it for free — `fetchSchedule` already asks for each day's
// games, and the hydrate adds ~7 KB to a 15-game MLB day under the field
// projection (measured 2026-08-08), which is less than the extra cross-origin
// request it replaces.

import { getJson } from './statsapi.js'

// The hydrate + `fields` projection any caller needs for the two selectors
// below. Exported so schedule.js can splice them into the slate's own request
// rather than keeping a second copy of the field list.
export const BROADCAST_HYDRATE = 'broadcasts(all)'
export const BROADCAST_FIELDS = 'broadcasts,name,type,isNational,homeAway'

// The out-of-market streaming packages, filtered out of every broadcast fact
// this module produces. Neither is the broadcast (with its own announcers)
// that identifies who is calling a game: each is an add-on subscription sold
// alongside whatever else airs it. statsapi does not list MLB.TV on an MLB
// game at all (verified across the full 2026-08-08 slate — 15 games, 84
// broadcast entries, no MLB.TV), but it DOES list MiLB.TV on a minor-league
// one, which is the same kind of thing and reads the same way in the fact.
// "ESPN Unlmtd" is ESPN's streaming-only tier, kept here from the previous
// source for the same reason.
const PACKAGE_NAMES = new Set(['mlb.tv', 'milb.tv', 'espn unlmtd'])

function isPackage(name) {
  return PACKAGE_NAMES.has((name ?? '').trim().toLowerCase())
}

// statsapi prints a network's full contractual name, which for a handful of
// entries is longer than a one-line fact can carry. Two mechanical trims, both
// against strings this feed really returns (2026-08-08 slate):
//   - a simulcast is joined with a slash — "FOX / FOX ONE" — and the first
//     name is the one a viewer would recognise (and the one
//     lib/broadcastLogos.js has a wordmark for);
//   - a club's direct-to-consumer feed carries its sponsor — "Brewers.TV
//     Presented by Potawatomi Sportsbook", "Padres.TV Presented by UC San
//     Diego Health" — and the sponsor is not part of the answer to "who is
//     carrying this".
// Nothing else is rewritten: the name is reported as the league reports it.
export function cleanNetworkName(name) {
  const first = (name ?? '').split('/')[0]
  return first.replace(/\s+presented by\s+.*$/i, '').trim()
}

// TV entries only, cleaned, deduped, in the order given. Radio (AM/FM) and the
// minors' INET "Audio" stream are real broadcasts but not the one this fact is
// about — it sits beside Attendance on a page about watching the game, and a
// dozen flagship stations would bury the network that matters.
function tvNames(broadcasts, keep) {
  const out = []
  for (const b of broadcasts ?? []) {
    if (b?.type !== 'TV' || !b.name || !keep(b)) continue
    const name = cleanNetworkName(b.name)
    if (name && !isPackage(name) && !out.includes(name)) out.push(name)
  }
  return out
}

// Collapses one game's broadcast list to a single display string, national feed
// first (what most viewers would recognize), then home market, then away,
// deduped and capped so the fact stays one readable line.
export function summarizeBroadcasts(broadcasts) {
  const national = tvNames(broadcasts, (b) => b.isNational)
  const home = tvNames(broadcasts, (b) => !b.isNational && b.homeAway === 'home')
  const away = tvNames(broadcasts, (b) => !b.isNational && b.homeAway === 'away')
  const names = []
  for (const n of [...national, ...home, ...away]) if (!names.includes(n)) names.push(n)
  return names.slice(0, 3).join(' · ')
}

// The national network name only (FOX/FS1/ESPN/TBS/Apple TV/…), or '' when
// this game has no such assignment — the fact the slate icon flags, distinct
// from summarizeBroadcasts' full "national · home · away" line. A national
// entry is listed once per market side, so this deduping pass is what keeps
// "FOX / FOX ONE" from reading as two networks.
export function nationalName(broadcasts) {
  return tvNames(broadcasts, (b) => b.isNational)[0] ?? ''
}

// One schedule-by-gamePk read per game, shared by every caller in the session.
// A broadcast assignment doesn't change mid-game, so a live Refresh must not
// re-pull it; a failed fetch caches an empty list rather than retrying on
// every poll. (The slate needs none of this — its games arrive with their own
// broadcasts already hydrated onto the schedule call it was making anyway.)
const byGamePk = new Map()
function fetchGameBroadcasts(gamePk) {
  if (!byGamePk.has(gamePk)) {
    byGamePk.set(
      gamePk,
      getJson(
        `/api/v1/schedule?gamePk=${gamePk}&hydrate=${BROADCAST_HYDRATE}&fields=dates,games,gamePk,${BROADCAST_FIELDS}`,
      )
        .then((data) => data?.dates?.[0]?.games?.[0]?.broadcasts ?? [])
        .catch(() => []),
    )
  }
  return byGamePk.get(gamePk)
}

// Resolves to the broadcast summary string for this game, or '' when the
// league lists nothing (a postponed game, a level with no TV deal). Never
// throws — a failed fetch degrades to '' like every other optional
// lineup-page fact.
export async function fetchGameBroadcast(feed) {
  try {
    const gamePk = feed?.gamePk ?? feed?.gameData?.game?.pk
    if (!gamePk) return ''
    return summarizeBroadcasts(await fetchGameBroadcasts(gamePk))
  } catch {
    return ''
  }
}
