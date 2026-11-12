// "The 9th natural cycle since 1950, the Brewers' 1st." The rarity count for a natural cycle or
// an unassisted triple play (#2968), from the feat index (public/data/notable/).
//
// REVEAL-ONLY (ADR-0101, ADR-0001). The docs and the count name results, so this module takes the
// docs as an argument and never fetches. hooks/callouts/useLastTime.js calls it only inside the
// box score's reveal, for a Final game. Every count is cut strictly before tonight, so a feat of
// tonight's never counts twice.
//
// THE FLAGS. scripts/gen-notable.mjs writes `natural` on a cycle row and `unassisted` on a triple
// play row, read off the game's play-by-play with the two detectors below (one spelling for the
// generator and the page). Old games have no play-by-play, so their rows carry no flag. The count
// runs from the FLOOR: the year of the oldest flagged row with no unflagged row after it. The line
// says "since {floor}", never "ever", and with no floor it says nothing: it never invents a count.
import { ordinal } from '../../lib/format.js'
import { orderedPlays } from '../../lib/worldSeries/classify.js'
import { detectPlayFeat } from '../callout-notes/lastTime.js'
import { SCORE_BASE } from '../callout-notes/shared.js'

const HIT_ORDER = ['single', 'double', 'triple', 'home_run']
export const RARITY = {
  cycles: { flag: 'natural', noun: 'natural cycle' },
  tripleplays: { flag: 'unassisted', noun: 'unassisted triple play' },
}

// A natural cycle: the batter's hits hold a single, then a double, then a triple, then a home
// run, in that order (other hits may fall between). null when the feed has no plays.
export function isNaturalCycle(allPlays, batterId) {
  const plays = orderedPlays({ allPlays })
  if (!plays.length) return null
  let next = 0
  for (const p of plays) {
    if (p.matchup?.batter?.id !== batterId) continue
    if (p.result?.eventType === HIT_ORDER[next]) next += 1
    if (next === HIT_ORDER.length) return true
  }
  return false
}

// An unassisted triple play: every putout and assist on the play is one fielder's.
export function isUnassistedTriplePlay(play) {
  const credits = (play?.runners ?? []).flatMap((r) => r.credits ?? [])
  const fielders = new Set(credits.filter((c) => c.credit === 'f_putout' || c.credit === 'f_assist').map((c) => c.player?.id))
  return fielders.size === 1 && credits.some((c) => c.credit === 'f_putout')
}

// The flagged triple play of a game, or null when the feed has no plays: true when one of the
// game's triple plays by `fieldingSide` is unassisted. `fieldingSide` is null in the generator,
// whose row already names the side (a game with two triple plays is one row per side).
export function gameHasUnassistedTriplePlay(allPlays, fieldingSide = null) {
  const plays = orderedPlays({ allPlays })
  if (!plays.length) return null
  return plays.some((p) => {
    if (p.result?.eventType !== 'triple_play') return false
    if (fieldingSide && (p.about?.halfInning === 'top' ? 'home' : 'away') !== fieldingSide) return false
    return isUnassistedTriplePlay(p)
  })
}

const yearOf = (iso) => Number(iso.slice(0, 4))
const possessive = (name) => (/[sx]$/i.test(name) ? `${name}'` : `${name}'s`)

// The first year the flag is known for every row from then on: the year after the newest
// unflagged row, and never before the oldest flagged one. null when no flagged row is left.
export function floorYear(rows, flag) {
  const flagged = rows.filter((r) => typeof r[flag] === 'boolean').map((r) => yearOf(r.officialDate))
  const unflagged = rows.filter((r) => typeof r[flag] !== 'boolean').map((r) => yearOf(r.officialDate))
  const floor = Math.max(Math.min(...flagged), unflagged.length ? Math.max(...unflagged) + 1 : -Infinity)
  return flagged.some((y) => y >= floor) ? floor : null
}

// The rare feats a Final game holds: each natural cycle and each unassisted triple play.
// [{ kind, side, player? }]
export function detectRareFeats(feed) {
  const plays = orderedPlays(feed?.liveData?.plays)
  const out = []
  for (const p of plays) {
    if (![...HIT_ORDER, 'triple_play'].includes(p.result?.eventType)) continue
    const battingSide = p.about?.halfInning === 'top' ? 'away' : 'home'
    const feat = detectPlayFeat(feed, p.about?.atBatIndex, battingSide)
    if (feat?.kind === 'cycles' && isNaturalCycle(plays, feat.player.id)) out.push(feat)
    if (feat?.kind === 'tripleplays' && isUnassistedTriplePlay(p)) out.push(feat)
  }
  return out
}

// One note for a rare feat: "The 9th natural cycle since 1950, the Brewers' 1st." [] when the
// index has no floor, or tonight is older than it.
export function buildRarityNotes(docs, feed, feat) {
  const date = feed?.gameData?.datetime?.officialDate
  const spec = RARITY[feat?.kind]
  const rows = docs?.[feat?.kind]?.rows
  if (!date || !spec || !rows) return []
  const floor = floorYear(rows, spec.flag)
  if (floor === null || yearOf(date) < floor) return []
  const gameNumber = feed.gameData.game?.gameNumber ?? 1
  const before = (r) =>
    r.gamePk !== feed.gamePk && (r.officialDate < date || (r.officialDate === date && (r.gameNumber ?? 1) < gameNumber))
  const prior = rows.filter((r) => r[spec.flag] === true && yearOf(r.officialDate) >= floor && before(r))
  const club = feed.gameData?.teams?.[feat.side]
  const clubName = club?.teamName ?? club?.name
  const mine = prior.filter((r) => r[r.side]?.id === club?.id).length
  const tail = clubName ? `, the ${possessive(clubName)} ${ordinal(mine + 1)}` : ''
  return [{
    text: `The ${ordinal(prior.length + 1)} ${spec.noun} since ${floor}${tail}.`,
    link: null,
    personId: feat.player?.id ?? null,
    side: feat.side,
    teamId: club?.id ?? null,
    teamName: clubName ?? '',
    personName: feat.player?.name ?? '',
    kind: 'rarityCount',
    dedupeKey: `rarityCount-${feat.kind}-${feat.player?.id ?? feat.side}`,
    score: SCORE_BASE.rarityCount,
  }]
}
