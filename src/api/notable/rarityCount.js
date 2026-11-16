// "The 9th natural cycle since 1950, the Brewers' 1st." The rarity count for a natural cycle,
// an unassisted triple play or an immaculate inning (#2968), from the feat index (public/data/notable/).
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
// An immaculate inning has its own file, every row a find, so its floor is the first season the
// generator swept (IMMACULATE_FLOOR in scripts/lib/notable/immaculate.mjs: the first year with real pitches).
import { ordinal } from '../../lib/format.js'
import { orderedPlays } from '../../lib/worldSeries/classify.js'
import { detectPlayFeat, possessive, priorRows, tonightOf, yearOf } from '../callout-notes/lastTime.js'
import { SCORE_BASE } from '../callout-notes/shared.js'

const HIT_ORDER = ['single', 'double', 'triple', 'home_run']
// Every triple-play event type (triple_play, grounded_into_triple_play, …), as detectPlayFeat reads it.
const isTriplePlayEvent = (p) => /triple_play/.test(p.result?.eventType ?? '')
export const RARITY = {
  cycles: { flag: 'natural', noun: 'natural cycle' },
  tripleplays: { flag: 'unassisted', noun: 'unassisted triple play' },
  immaculate: { flag: null, noun: 'immaculate inning' },
}

// A natural cycle: the batter's hits hold a single, then a double, then a triple, then a home
// run, in that order (other hits may fall between), among the hits up to the one that completes
// the cycle. null when the feed has no plays.
export function isNaturalCycle(allPlays, batterId) {
  const plays = orderedPlays({ allPlays })
  if (!plays.length) return null
  // Read only up to the hit that completes the cycle: a hit after it cannot make it natural.
  let next = 0
  const seen = new Set()
  for (const p of plays) {
    if (p.matchup?.batter?.id !== batterId) continue
    const type = p.result?.eventType
    if (type === HIT_ORDER[next]) next += 1
    if (next === HIT_ORDER.length) return true
    if (HIT_ORDER.includes(type)) seen.add(type)
    if (seen.size === HIT_ORDER.length) return false
  }
  return false
}

// An unassisted triple play: every putout and assist on the play is one fielder's.
export function isUnassistedTriplePlay(play) {
  const credits = (play?.runners ?? []).flatMap((r) => r.credits ?? [])
  const fielding = credits.filter((c) => c.credit === 'f_putout' || c.credit === 'f_assist')
  // A credit with no fielder id names nobody, so it can never make the play one fielder's.
  if (fielding.some((c) => c.player?.id == null)) return false
  const fielders = new Set(fielding.map((c) => c.player.id))
  return fielders.size === 1 && fielding.some((c) => c.credit === 'f_putout')
}

// The flagged triple play of a game, or null when the feed has no plays: true when one of the
// game's triple plays by `fieldingSide` is unassisted. The generator passes its row's `side`
// (a game with two triple plays is one row per side); null reads every triple play.
export function gameHasUnassistedTriplePlay(allPlays, fieldingSide = null) {
  const plays = orderedPlays({ allPlays })
  if (!plays.length) return null
  return plays.some((p) => {
    if (!isTriplePlayEvent(p)) return false
    if (fieldingSide && (p.about?.halfInning === 'top' ? 'home' : 'away') !== fieldingSide) return false
    return isUnassistedTriplePlay(p)
  })
}

// The immaculate innings of a game: one pitcher faces three batters to end a half-inning and
// strikes out all three on nine pitches, no batter reaching. [{ side (the pitching
// club), player (the pitcher) }]; null when the feed has no plays or no real pitch sequences.
// Feeds before about 1988 make up a minimal count for each plate appearance (three strikes for a
// strikeout, four balls for a walk; read on gamePk 188808, 1985), so every three-strikeout inning
// would read as nine pitches. A real game has some pitch with both a ball and a strike on the count.
export function immaculateInnings(allPlays) {
  const plays = orderedPlays({ allPlays })
  const sequenced = plays.some((p) => (p.playEvents ?? []).some((e) => e.isPitch && e.count?.balls > 0 && e.count?.strikes > 0))
  if (!sequenced) return null
  const halves = new Map()
  for (const p of plays) {
    const key = `${p.about?.inning}:${p.about?.halfInning}`
    if (!halves.has(key)) halves.set(key, [])
    halves.get(key).push(p)
  }
  const out = []
  for (const all of halves.values()) {
    // The last pitcher's run of plays to the end of the half. A reliever who comes in with
    // nobody out and fans three on nine pitches counts, whoever is on base (Brad Boxberger,
    // gamePk 381051, 2014-05-08, with the bases loaded): his three strikeouts are all three outs.
    const pitcher = all.at(-1).matchup?.pitcher
    let from = all.length
    while (from > 0 && all[from - 1].matchup?.pitcher?.id === pitcher?.id) from -= 1
    const half = all.slice(from)
    if (half.length !== 3 || pitcher?.id == null) continue
    // No batter reaches: a strikeout on a wild pitch puts the batter on base, not out.
    const clean = half.every((p) => p.result?.eventType === 'strikeout'
      && !(p.runners ?? []).some((r) => r.movement?.start == null && r.movement?.end))
    // His own pitches only: a reliever who comes in mid-count throws only those after the change.
    const own = (events) => events.slice(events.findLastIndex((e) => e.details?.eventType === 'pitching_substitution') + 1)
    const pitches = half.flatMap((p) => own(p.playEvents ?? []).filter((e) => e.isPitch))
    // The 1990s feeds fill a missing inning (often an extra one) with S, S, S for each strikeout,
    // inside a game of real sequences (gamePk 2342, 1999-07-10, the 10th). Nine swinging strikes
    // with no pitch speed is that fill, not a find; a modern pitch carries its speed.
    const madeUp = pitches.every((e) => e.details?.code === 'S' && !e.pitchData?.startSpeed)
    if (clean && pitches.length === 9 && !madeUp) {
      out.push({ side: half[0].about.halfInning === 'top' ? 'home' : 'away', player: { id: pitcher.id, name: pitcher.fullName ?? '' } })
    }
  }
  return out
}

// The first year the flag is known for every row from then on: the year after the newest
// unflagged row, and never before the oldest flagged one. null when no flagged row is left.
export function floorYear(rows, flag) {
  const flagged = rows.filter((r) => typeof r[flag] === 'boolean').map((r) => yearOf(r.officialDate))
  const unflagged = rows.filter((r) => typeof r[flag] !== 'boolean').map((r) => yearOf(r.officialDate))
  const floor = Math.max(Math.min(...flagged), unflagged.length ? Math.max(...unflagged) + 1 : -Infinity)
  return flagged.some((y) => y >= floor) ? floor : null
}

// The first season of the unbroken run of swept seasons that ends at the newest: a gap means the
// seasons before it may be missing rows, so the count starts after it. null when nothing is swept.
export function sweptFrom(seasons = []) {
  const s = [...seasons].sort((a, b) => a - b)
  let i = s.length - 1
  while (i > 0 && s[i - 1] === s[i] - 1) i -= 1
  return s.length ? s[i] : null
}

// The rare feats a Final game holds: each natural cycle, unassisted triple play and immaculate inning.
// [{ kind, side, player? }]
export function detectRareFeats(feed) {
  const plays = orderedPlays(feed?.liveData?.plays)
  const out = []
  for (const p of plays) {
    if (!HIT_ORDER.includes(p.result?.eventType) && !isTriplePlayEvent(p)) continue
    const battingSide = p.about?.halfInning === 'top' ? 'away' : 'home'
    const feat = detectPlayFeat(feed, p.about?.atBatIndex, battingSide)
    if (feat?.kind === 'cycles' && isNaturalCycle(plays, feat.player.id)) out.push(feat)
    if (feat?.kind === 'tripleplays' && isUnassistedTriplePlay(p)) out.push(feat)
  }
  for (const f of immaculateInnings(plays) ?? []) out.push({ kind: 'immaculate', ...f })
  return out
}

// One note for a rare feat: "The 9th natural cycle since 1950, the Brewers' 1st." [] when the
// index has no floor, or tonight is older than it.
export function buildRarityNotes(docs, feed, feat) {
  const t = tonightOf(feed)
  const spec = RARITY[feat?.kind]
  const rows = docs?.[feat?.kind]?.rows
  if (!t || !spec || !rows) return []
  const floor = spec.flag ? floorYear(rows, spec.flag) : sweptFrom(docs[feat.kind].coverage?.seasons)
  if (floor === null || yearOf(t.date) < floor) return []
  const counted = (r) => (spec.flag ? r[spec.flag] === true : true) && yearOf(r.officialDate) >= floor
  const prior = priorRows(docs, feat.kind, t).filter(counted)
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
