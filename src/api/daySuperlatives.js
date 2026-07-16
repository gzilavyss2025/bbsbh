// Slate-wide Statcast superlatives for a past day's recap — the LONGEST HOME
// RUN, HARDEST BASE HIT, and FASTEST STRIKEOUT across every game on the day,
// each resolved to the player who did it (headshot + position + team) so it can
// render as a PerformerCard-style tile beside Top Performers.
//
// SPOILER RULE — reveal-only, exactly like derive.js / topPerformers.js. Only
// ever call computeDaySuperlatives from inside the past-day recap's SealBox
// reveal render (RecapPanel in PastDayRecapBox.jsx). The values here are
// score-adjacent (a home run, a strikeout), so no fetched-then-hidden node may
// exist before the user reveals.
//
// Reads the SAME per-game feeds RecapPanel already fetched for Day Highlights
// (usePastGameSignals), so it adds no network cost. Unlike derive.js's per-half
// superlatives — which keep only the player's NAME — this keeps the
// batter/pitcher personId so the card can show his headshot + position pill,
// resolved through the feed's own boxscore the same way topPerformers does.
import { resolveCardPlayer } from './boxscore.js'

// The result.eventType strings we bucket on (same vocabulary playbyplay.js and
// person-fetch.js use): a "base hit" is any of the four hit types; a strikeout
// is either flavor (looking, swinging, or the K half of a strikeout DP).
const HIT_EVENTS = new Set(['single', 'double', 'triple', 'home_run'])
const STRIKEOUT_EVENTS = new Set(['strikeout', 'strikeout_double_play'])

// Fold a winning (feed, personId, value) candidate into a resolved card, or
// null when the player can't be resolved / no candidate was found (an all-MiLB
// slate with no tracking data leaves every field null, and the caller hides the
// card rather than showing an empty one).
function buildCard(best, stat) {
  if (!best) return null
  const player = resolveCardPlayer(best.feed, best.personId)
  if (!player) return null
  return { ...player, stat: stat(best) }
}

// `entries`: the same [{ gamePk, game, feed, winProb, dateStr }] array
// RecapPanel builds for Day Highlights. Walks every game's play-by-play once,
// keeping the single best batted ball / strikeout pitch across the whole slate.
// Batted-ball tracking (hitData) and pitch tracking (pitchData) ride individual
// playEvents, exactly as derive.js reads them; both are absent at most MiLB
// parks, so each field is guarded and an untracked slate yields all-null cards.
export function computeDaySuperlatives(entries) {
  let longestHr = null // { value: ft, personId, feed }
  let hardestHit = null // { value: mph exit velo, personId, feed }
  let fastestK = null // { value: mph, personId, feed }

  for (const entry of (entries ?? []).filter(Boolean)) {
    const feed = entry.feed
    const plays = feed?.liveData?.plays?.allPlays ?? []
    for (const play of plays) {
      const et = play.result?.eventType
      const events = play.playEvents ?? []

      // Longest home run — the batted ball's tracked carry (totalDistance).
      if (et === 'home_run') {
        for (const e of events) {
          const dist = e.hitData?.totalDistance
          if (typeof dist === 'number' && dist > (longestHr?.value ?? -Infinity)) {
            longestHr = { value: dist, personId: play.matchup?.batter?.id, feed }
          }
        }
      }

      // Hardest base hit — top exit velocity among balls that went for a hit.
      if (HIT_EVENTS.has(et)) {
        for (const e of events) {
          const ev = e.hitData?.launchSpeed
          if (typeof ev === 'number' && ev > (hardestHit?.value ?? -Infinity)) {
            hardestHit = { value: ev, personId: play.matchup?.batter?.id, feed }
          }
        }
      }

      // Fastest strikeout — the velocity of the pitch that recorded strike
      // three, i.e. the last tracked pitch of a strikeout at-bat.
      if (STRIKEOUT_EVENTS.has(et)) {
        const pitches = events.filter(
          (e) => e.isPitch && typeof e.pitchData?.startSpeed === 'number',
        )
        const velo = pitches[pitches.length - 1]?.pitchData?.startSpeed
        if (typeof velo === 'number' && velo > (fastestK?.value ?? -Infinity)) {
          fastestK = { value: velo, personId: play.matchup?.pitcher?.id, feed }
        }
      }
    }
  }

  return {
    longestHomeRun: buildCard(longestHr, (b) => `${Math.round(b.value)} ft`),
    hardestBaseHit: buildCard(hardestHit, (b) => `${b.value.toFixed(1)} mph`),
    fastestStrikeout: buildCard(fastestK, (b) => `${b.value.toFixed(1)} mph`),
  }
}
