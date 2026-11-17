// "The 9th natural cycle since 1950, the Brewers' 1st." The rarity count for a natural cycle,
// an unassisted triple play, an immaculate inning, a four-homer game, four straight home runs, six-plus double plays by one club
// or a home run on a first MLB pitch (#2968), from the feat index (public/data/notable/).
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
// An immaculate inning and a four-homer game each have their own file, every row a find, so its floor is the first season the
// generator swept in an unbroken run: 2001 for immaculate innings (IMMACULATE_FLOOR in
// scripts/lib/notable/immaculate.mjs, the first year with real pitches), 1901 for four-homer games
// (fourhr.json, read off the hitting game logs), FOURSTRAIGHT_FLOOR for four straight home runs
// (scripts/lib/notable/fourstraight.mjs, the first season whose four-homer games all have plays), 1901
// for six-plus double plays (sixdp.json, read off the team fielding game logs), FIRSTPITCH_FLOOR (2001) for a
// home run on a first MLB pitch (scripts/lib/notable/rarity/firstpitch.mjs, real pitch sequences).
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
  fourhr: { flag: null, noun: 'four-homer game' },
  fourstraight: { flag: null, noun: 'set of four straight home runs' },
  sixdp: { flag: null, noun: 'game with six or more double plays' },
  firstpitch: { flag: null, noun: 'home run on a first MLB pitch' },
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

// Four straight home runs by one club: four plate appearances of the club in a row, each a home
// run. A home run never makes an out, so a run of them can only sit inside one half-inning (or end
// the game). A fifth adds nothing: one find per run. [{ side (the batting club) }]; null when the
// feed has no plays.
export function fourStraightHomers(allPlays) {
  const plays = orderedPlays({ allPlays })
  if (!plays.length) return null
  const run = { away: 0, home: 0 }
  const out = []
  for (const p of plays) {
    const side = p.about?.halfInning === 'top' ? 'away' : 'home'
    run[side] = p.result?.eventType === 'home_run' ? run[side] + 1 : 0
    if (run[side] === 4) out.push({ side })
  }
  return out
}

// A double play: a play whose event type says so (double_play, grounded_into_double_play,
// strikeout_double_play, …), or one where exactly two runners are out on the same event. The feed
// files some under the batter's hit: gamePk 23759 (2005) has a 'single' where the batter lines into
// a double play. Two outs on two events (a pickoff, then the strikeout) are not one.
function isDoublePlay(p) {
  if (/double_play/.test(p.result?.eventType ?? '')) return true
  const outs = new Map() // playIndex -> runners out on it
  for (const r of p.runners ?? []) {
    if (!r.movement?.isOut) continue
    const at = r.details?.playIndex
    outs.set(at, (outs.get(at) ?? 0) + 1)
  }
  return [...outs.values()].includes(2)
}

// Six or more double plays turned by one club in a game, counted for the fielding club. Matches
// the fielding log's `doublePlays` on every indexed game since 1990 (checked 2026-11-16). One find
// per club and game. [{ side (the fielding club) }]; null when the feed has no plays.
export function sixDoublePlays(allPlays) {
  const plays = orderedPlays({ allPlays })
  if (!plays.length) return null
  const turned = { away: 0, home: 0 }
  for (const p of plays) {
    if (isDoublePlay(p)) turned[p.about?.halfInning === 'top' ? 'home' : 'away'] += 1
  }
  return ['away', 'home'].filter((side) => turned[side] >= 6).map((side) => ({ side }))
}

// A home run on the first pitch of the batter's first plate appearance of the game: true, false,
// or null when the feed has no plays or the batter never batted. The plate appearance holds one
// pitch and ends in a home run. Whether it was his first in the majors is the caller's question
// (scripts/lib/notable/firstpitch.mjs reads his logs; the page reads his debut date).
export function firstPitchHomer(allPlays, batterId) {
  const pa = orderedPlays({ allPlays }).find((p) => p.matchup?.batter?.id === batterId)
  if (!pa) return null
  // His own pitches only: a pinch hitter who comes in mid-count sees those after the change.
  const events = pa.playEvents ?? []
  const pitches = events.slice(events.findLastIndex((e) => e.details?.eventType === 'offensive_substitution') + 1).filter((e) => e.isPitch)
  return pa.result?.eventType === 'home_run' && pitches.length === 1
}

// True when the box score says the batter had a plate appearance before tonight's this season
// (season total above tonight's), or cannot say. `seasonStats` in a Final feed includes the game.
function battedBeforeTonight(feed, batterId) {
  const teams = feed?.liveData?.boxscore?.teams
  const bp = teams?.away?.players?.[`ID${batterId}`] ?? teams?.home?.players?.[`ID${batterId}`]
  const season = bp?.seasonStats?.batting?.plateAppearances
  const tonight = bp?.stats?.batting?.plateAppearances
  return !(Number.isInteger(season) && Number.isInteger(tonight)) || season > tonight
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

// The rare feats a Final game holds: each natural cycle, unassisted triple play, immaculate inning, four-homer game, run of four straight home runs and club game of six or more double plays.
// [{ kind, side, player? }]
export function detectRareFeats(feed) {
  const plays = orderedPlays(feed?.liveData?.plays)
  const out = []
  const homers = new Map() // batter id -> home runs so far
  for (const p of plays) {
    if (!HIT_ORDER.includes(p.result?.eventType) && !isTriplePlayEvent(p)) continue
    const battingSide = p.about?.halfInning === 'top' ? 'away' : 'home'
    // A four-homer game: the batter's fourth home run of the game (a fifth adds nothing).
    const batter = p.matchup?.batter
    if (p.result?.eventType === 'home_run' && batter?.id != null) {
      homers.set(batter.id, (homers.get(batter.id) ?? 0) + 1)
      if (homers.get(batter.id) === 4) out.push({ kind: 'fourhr', side: battingSide, player: { id: batter.id, name: batter.fullName ?? '' } })
    }
    const feat = detectPlayFeat(feed, p.about?.atBatIndex, battingSide)
    if (feat?.kind === 'cycles' && isNaturalCycle(plays, feat.player.id)) out.push(feat)
    if (feat?.kind === 'tripleplays' && isUnassistedTriplePlay(p)) out.push(feat)
  }
  for (const f of immaculateInnings(plays) ?? []) out.push({ kind: 'immaculate', ...f })
  for (const f of fourStraightHomers(plays) ?? []) out.push({ kind: 'fourstraight', ...f })
  for (const f of sixDoublePlays(plays) ?? []) out.push({ kind: 'sixdp', ...f })
  // A home run on a first MLB pitch: the batter's first plate appearance tonight is a one-pitch home
  // run, he debuted this season, and the box score shows no plate appearance before tonight's
  // (a debut days earlier off the bench counts: Willson Contreras, gamePk 447906). A player who
  // debuted in an earlier season and never batted (a pitcher) is missed, never miscounted.
  const year = (feed?.gameData?.datetime?.officialDate ?? '').slice(0, 4)
  const firstPa = new Set()
  for (const p of plays) {
    const batter = p.matchup?.batter
    if (batter?.id == null || firstPa.has(batter.id)) continue
    firstPa.add(batter.id)
    const debut = feed.gameData?.players?.[`ID${batter.id}`]?.mlbDebutDate ?? ''
    if (!year || debut.slice(0, 4) !== year || !firstPitchHomer([p], batter.id)) continue
    if (battedBeforeTonight(feed, batter.id)) continue
    out.push({ kind: 'firstpitch', side: p.about?.halfInning === 'top' ? 'away' : 'home', player: { id: batter.id, name: batter.fullName ?? '' } })
  }
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
