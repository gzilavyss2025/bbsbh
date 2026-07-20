// DAY HIGHLIGHTS — ranks a past day's Final games by how interesting/memorable
// they were, for the sealed "Day Highlights" panel on a past date's slate.
// SPOILER RULE: reveal-only, exactly like linescore.js/derive.js/boxscore.js —
// only ever call rankDayHighlights from inside a SealBox's reveal render
// function, never at render top-level or in a pre-reveal useMemo.
//
// Each game is scanned for discrete "storylines," grouped into tiers (0 =
// rarest/highest priority, down to 3 = a quiet game with nothing much fired).
// A game's rank key is (tier, score): tier hard-sorts so a no-hitter never
// buries itself under a pile of minor signals, then `score` — a diminishing-
// returns sum of every fired signal's points — breaks ties within a tier so a
// genuinely multi-story game still separates from a one-note one. Degrades
// gracefully at MiLB parks with no win-probability feed: the win-probability-
// dependent signals (walk-off, comeback) just don't fire; margin, hits, extra
// innings, decisions, and multi-HR all still work from the box score alone.
import { selectBoxscore, computePlayOfTheGame, positionLabel } from './boxscore.js'
// Bill James Game Score (40 + 2*outs + K - 2*H - 4*ER - 2*(R-ER) - BB) —
// shared with the three-stars/top-performers blend so the "dominant start"
// signal here and the player rankings can't drift apart.
import { gameScore } from './performanceScore.js'
import { calloutsForGame } from './callouts.js'
import { gamePath } from '../lib/route.js'

// A signal's protagonist, when it has one — the batter/pitcher whose face and
// stat line the "Face the Story" row shows next to the headline. team* comes
// from gameData.teams (verified shape, same lookup computePlayOfTheGame uses
// below); id/name/position come from the box player subtree. Signals with no
// natural single protagonist (margin/length storylines, the win-probability
// comeback) carry `performer: null` and render as a team-logo row instead.
function performerFrom(feed, side, boxPlayer, stat) {
  if (!boxPlayer?.person?.id) return null
  return {
    id: boxPlayer.person.id,
    name: boxPlayer.person.fullName ?? '',
    teamId: feed?.gameData?.teams?.[side]?.id ?? null,
    teamAbbr: feed?.gameData?.teams?.[side]?.abbreviation ?? '',
    position: positionLabel(boxPlayer),
    stat,
  }
}

const TIER = { RARE: 0, NOTABLE: 1, STORY: 2, CLOSE: 3 }

// A starter-record sub-caption ("Team is 11-6 in his starts") only earns its
// line when the club actually wins behind him — see performerSubCaption.
const STARTER_RECORD_MIN_STARTS = 8
const STARTER_RECORD_MIN_WINPCT = 0.6

// How many "was dominant (Game Score N)" highlights a single day keeps. Four
// near-identical dominant-pitcher rows read as a wall, so only the best-pitched
// games survive — ranked by Game Score across the whole slate, NOT dropped by
// whether the pitcher also appears in Top Performers (an earlier fix did that
// and kept the WEAKEST duplicate while cutting the day's best starts — the
// exact backfire the review flagged). The genuine best pitching story is
// allowed to repeat between Top Performers and Highlights; the lesser dominant
// starts are what get trimmed.
const MAX_DOMINANT_HIGHLIGHTS = 2

// Every player who batted, from the raw feed (selectBoxscore's battingRows
// strips fields like homeRuns that this module needs but the printed box
// score doesn't show).
function battersOf(feed, side) {
  const players = feed?.liveData?.boxscore?.teams?.[side]?.players ?? {}
  return Object.values(players).filter((p) => p.battingOrder != null)
}

export function multiHrSignal(feed) {
  // Pick the BEST multi-HR line in the game, not the first one found. Scanning
  // away batters first and returning on the first `hr >= 2` buried a 3-HR game
  // on the home team under a 2-HR game on the away team (a real bug: the CIN/COL
  // game on 2026-07-19 credited Tyler Stephenson's 2 HR while Hunter Goodman hit
  // 3 in the same box score) — and the `hr >= 3` points bonus below was
  // effectively unreachable whenever a 2-HR hitter batted first. `hr > best.hr`
  // (strict) keeps the away hitter on an exact tie, preserving prior ordering.
  let best = null
  for (const side of ['away', 'home']) {
    for (const p of battersOf(feed, side)) {
      const hr = p.stats?.batting?.homeRuns ?? 0
      if (hr >= 2 && (!best || hr > best.hr)) best = { hr, p, side }
    }
  }
  if (!best) return null
  const { hr, p, side } = best
  const name = p.person?.fullName ?? ''
  return {
    key: 'multiHr',
    tier: TIER.NOTABLE,
    points: 50 + (hr >= 3 ? 15 : 0),
    // Colon, not another em dash — buildHeadline already appends
    // " — {score}", and two dashes back to back ("Name — 2 HR — score")
    // read like three unrelated fragments instead of one headline.
    text: `${name}: ${hr} HR`,
    performer: performerFrom(feed, side, p, `${hr} HR`),
  }
}

// Starter's Game Score, from either team's first pitcher of record.
export function eliteGameScoreSignal(feed) {
  let best = null
  for (const side of ['away', 'home']) {
    const team = feed?.liveData?.boxscore?.teams?.[side]
    const startId = team?.pitchers?.[0]
    if (startId == null) continue
    const box = team?.players?.[`ID${startId}`]
    const s = box?.stats?.pitching
    if (!s) continue
    const gs = gameScore(s)
    if (gs >= 80 && (!best || gs > best.gs)) {
      best = { gs, name: box?.person?.fullName ?? '', side, box }
    }
  }
  if (!best) return null
  return {
    key: 'gameScore',
    tier: TIER.STORY,
    // Scale with the actual Game Score (80 is the floor to fire) so an 85 start
    // ranks above an 80 one — the old two-bucket 25/40 made every 80–89 outing
    // tie, which left ordering among the day's dominant starts arbitrary. `gs`
    // rides on the signal so the cross-game de-dupe below can rank by it.
    points: 25 + (best.gs - 80),
    gs: best.gs,
    text: `${best.name} was dominant (Game Score ${best.gs})`,
    performer: performerFrom(feed, best.side, best.box, `Game Score ${best.gs}`),
  }
}

// A batter who hit for the cycle — single + double + triple + homer in one
// game (singles are derived: hits minus the extra-base kinds the box lists).
// Rare enough to lead a day; a hand-scorer's dream to have on the card.
export function cycleSignal(feed) {
  for (const side of ['away', 'home']) {
    for (const p of battersOf(feed, side)) {
      const b = p.stats?.batting
      if (!b) continue
      const hr = b.homeRuns ?? 0
      const triples = b.triples ?? 0
      const doubles = b.doubles ?? 0
      const singles = (b.hits ?? 0) - hr - triples - doubles
      if (singles >= 1 && doubles >= 1 && triples >= 1 && hr >= 1) {
        return {
          key: 'cycle',
          tier: TIER.RARE,
          points: 90,
          text: `${p.person?.fullName ?? ''} hit for the cycle`,
          performer: performerFrom(feed, side, p, 'Cycle'),
        }
      }
    }
  }
  return null
}

// A position player who took the mound — listed among a team's pitchers but
// whose position in this game isn't P (usually mop-up in a lopsided game). A
// novelty the box score alone reveals; degrades silently where the field is
// absent.
export function positionPlayerPitchingSignal(feed) {
  for (const side of ['away', 'home']) {
    const team = feed?.liveData?.boxscore?.teams?.[side]
    for (const id of team?.pitchers ?? []) {
      const p = team?.players?.[`ID${id}`]
      const pos = p?.position?.abbreviation
      // A genuine position player on the mound — not a pitcher (P) and not a
      // two-way player (TWP), whose pitching is his job, not a novelty.
      if (p && pos && pos !== 'P' && pos !== 'TWP') {
        return {
          key: 'positionPlayerPitching',
          tier: TIER.NOTABLE,
          points: 45,
          text: `${p.person?.fullName ?? ''} took the mound — a position player pitching`,
          performer: performerFrom(feed, side, p, 'Position player, P'),
        }
      }
    }
  }
  return null
}

// A triple play anywhere in the game — read off the play-by-play event/desc
// (no reliable structured flag), so match defensively on the phrase. No single
// protagonist (it's a defensive sequence), so it renders as a team-logo row.
export function triplePlaySignal(feed) {
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const text = `${play?.result?.event ?? ''} ${play?.result?.description ?? ''}`
    if (/triple play/i.test(text)) {
      return { key: 'triplePlay', tier: TIER.RARE, points: 85, text: 'A triple play turned', performer: null }
    }
  }
  return null
}

// Every Final game's bare result (both sides + the winner id), for the recap's
// "Your Team" block — which needs the score of the favorite club's game even
// when nobody on it cracked Top Performers or a highlight. Reveal-only like the
// rest of this module (it reads run totals straight off the box score).
export function selectGameResults(entries) {
  return (entries ?? []).filter(Boolean).map(({ gamePk, game, feed, dateStr }) => {
    const box = feed?.liveData?.boxscore?.teams ?? {}
    const gd = feed?.gameData?.teams ?? {}
    // Run totals off teamStats (the same field topPerformers.js reads); ids/
    // abbreviations off gameData (present even where a side's box is thin).
    const side = (key) => ({
      id: gd?.[key]?.id ?? box?.[key]?.team?.id ?? null,
      abbr: gd?.[key]?.abbreviation ?? box?.[key]?.team?.abbreviation ?? '',
      r: box?.[key]?.teamStats?.batting?.runs ?? 0,
    })
    const away = side('away')
    const home = side('home')
    return {
      gamePk,
      away,
      home,
      // null on a tie (thin MiLB box with both totals defaulting to 0, a
      // suspended/called tie) so the caller can hide the W/L badge rather than
      // declaring the away side a phantom winner.
      winnerId: home.r === away.r ? null : home.r > away.r ? home.id : away.id,
      // 1 for a single game, 1 & 2 for a doubleheader — lets the Your Team block
      // label both games of a twin bill ("Game 1"/"Game 2") instead of showing
      // only the opener.
      gameNumber: game?.gameNumber ?? null,
      boxScorePath: game
        ? gamePath(dateStr, game.away.abbreviation, game.home.abbreviation, 'boxscore', game.gameNumber)
        : null,
    }
  })
}

// Win-probability-dependent signals — walk-off and largest comeback. Both
// need the per-play winProb array (absent at most MiLB parks), so both
// silently don't fire when it's missing.
// NOTE: the feed's win-probability fields are already percentage POINTS
// (0-100, e.g. 52.2), not a 0-1 fraction — verified against gamePk 823035's
// /winProbability response. Every threshold/constant below is on that same
// 0-100 scale.
function winProbSignals(winProb, winnerIsHome, potg) {
  if (!Array.isArray(winProb) || winProb.length === 0) return []
  const signals = []

  const last = winProb[winProb.length - 1]
  const lastWp = last?.homeTeamWinProbability
  const walkedOff =
    winnerIsHome &&
    last?.about?.isTopInning === false &&
    typeof lastWp === 'number' &&
    lastWp >= 97
  if (walkedOff) {
    // `potg` (computePlayOfTheGame) is reliably the walk-off itself on a
    // walk-off game — same assumption buildHeadline already makes when it
    // splices potg's description into this signal's text.
    signals.push({
      key: 'walkoff',
      tier: TIER.NOTABLE,
      points: 60,
      text: 'Walk-off winner',
      performer: potg?.batterId
        ? {
            id: potg.batterId,
            name: potg.batterName,
            teamId: potg.batterTeamId,
            teamAbbr: potg.batterTeamAbbr,
            position: potg.batterPos,
            stat: 'Walk-off',
          }
        : null,
    })
  }

  // Comeback depth: how far from 50% the eventual winner's own win probability
  // dipped at its worst point during the game.
  let worst = 50
  for (const e of winProb) {
    const hwp = e.homeTeamWinProbability
    if (typeof hwp !== 'number') continue
    const winnerWp = winnerIsHome ? hwp : 100 - hwp
    if (winnerWp < worst) worst = winnerWp
  }
  const deficit = 50 - worst
  if (deficit > 25) {
    signals.push({
      key: 'comeback',
      tier: TIER.STORY,
      // `worst` is the WINNER's own win probability at its lowest point, so
      // this reads as the deficit they climbed out of — not the opponent's
      // peak (that read backwards here until fixed: showing 100-worst made a
      // 23%-at-the-bottom comeback read as "down to a 77% win probability",
      // which barely sounds like a comeback at all).
      points: Math.round(1.2 * deficit),
      text: `Comeback win (down to a ${Math.round(worst)}% win probability)`,
      // No single protagonist — the win-prob swing is a whole-game team arc,
      // not one player's play. Renders as a team-logo row, not a face.
      performer: null,
    })
  }

  return signals
}

// Margin/length storylines, written as prose with the clubs named — "The
// Brewers edged the Cubs by a single run" reads like the other signals'
// narrative headlines, where the old label-style "One-run game" read like a
// filing tag. Takes both box sides (not bare run totals) for the names.
function marginSignals(away, home, extraInnings) {
  const signals = []
  const margin = Math.abs(away.line.r - home.line.r)
  const winner = away.line.r > home.line.r ? away : home
  const loser = winner === away ? home : away
  const name = (side) => side.clubName || side.abbreviation || side.teamName
  // None of these three carry a single protagonist — they're team-vs-team
  // length/margin storylines — so `performer: null` throughout, same as
  // comeback above. Renders as a team-logo row (see PastDayRecapBox.jsx).
  if (extraInnings > 0) {
    signals.push({
      key: 'extras',
      tier: TIER.STORY,
      points: Math.min(20 + 8 * extraInnings, 60),
      text: `The ${name(winner)} outlasted the ${name(loser)} in ${9 + extraInnings} innings`,
      performer: null,
    })
  }
  if (margin === 1) {
    signals.push({
      key: 'oneRun',
      tier: TIER.CLOSE,
      points: 18,
      text: `The ${name(winner)} edged the ${name(loser)} by a single run`,
      performer: null,
    })
  } else if (margin >= 8) {
    signals.push({
      key: 'blowout',
      tier: TIER.CLOSE,
      points: -10,
      text: `A ${margin}-run laugher for the ${name(winner)}`,
      performer: null,
    })
  }
  return signals
}

function noHitterSignal(box, feed) {
  const loserIsAway = box.away.line.r < box.home.line.r
  const loser = loserIsAway ? box.away : box.home.line.r < box.away.line.r ? box.home : null
  if (!loser || loser.line.h !== 0) return null
  const perfect = loser.line.e === 0 && (box.away.batTotals.bb ?? 0) === 0 && (box.home.batTotals.bb ?? 0) === 0
  // The pitcher of record is on the OTHER side from the no-hit-suffering
  // team — a combined no-hitter still credits the starter, same convention
  // as eliteGameScoreSignal above (first pitcher of record only).
  const pitcherSide = loserIsAway ? 'home' : 'away'
  const startId = feed?.liveData?.boxscore?.teams?.[pitcherSide]?.pitchers?.[0]
  const pbox = startId != null ? feed?.liveData?.boxscore?.teams?.[pitcherSide]?.players?.[`ID${startId}`] : null
  const label = perfect ? 'Perfect game' : 'No-hitter'
  return {
    key: perfect ? 'perfectGame' : 'noHitter',
    tier: TIER.RARE,
    points: 100,
    text: label,
    performer: performerFrom(feed, pitcherSide, pbox, label),
  }
}

// The feed's own play description often runs multiple sentences together —
// "Ezequiel Duran homers (8) on a fly ball to center field. Brandon Nimmo
// scores." — where that trailing "X scores." clause is redundant once the
// score is appended right after it. Keep only the first sentence — but split on
// a REAL sentence break, not the period inside an abbreviated name ("Tatis Jr.",
// "J.C. Escarra"), which a naive indexOf('. ') truncated mid-name.
export function firstSentence(desc) {
  const str = desc ?? ''
  // ". " that is NOT preceded by a name suffix (Jr/Sr/…) or a lone initial.
  const m = str.match(/(?<!\b(?:Jr|Sr|St|Dr|[A-Z]))\.\s/)
  const cut = m ? m.index : -1
  return (cut === -1 ? str : str.slice(0, cut)).replace(/\.\s*$/, '')
}

// The single signal a game's row is built around — same (tier, points) sort
// the family ranking uses elsewhere, so "what fired" and "what's shown" never
// disagree. Exported logic kept local (not every caller needs it) but shared
// between buildHeadline and rankDayHighlights so both agree on the same pick.
function pickTopSignal(signals) {
  return [...signals].sort((a, b) => a.tier - b.tier || b.points - a.points)[0]
}

// One template for every headline, so a reader can count on the same shape
// regardless of which signal fired: "{what happened} — {final score}". Only
// the walk-off signal gets the actual play spliced in (via potg) — it's
// reliably the walk-off itself, the game's last and most decisive play.
// Comeback deliberately does NOT splice in the "most captivating" play: that
// play can belong to the team that ultimately LOST (e.g. the go-ahead shot
// the winner later overcame), which read as a non sequitur credited to the
// wrong side.
function buildHeadline(top, box, potg) {
  const score = `${box.away.abbreviation} ${box.away.line.r}, ${box.home.abbreviation} ${box.home.line.r}`
  if (!top) return `Final: ${score}`
  const text = top.key === 'walkoff' && potg?.desc ? `${top.text}: ${firstSentence(potg.desc)}` : top.text
  return `${text} — ${score}`
}

// The callouts-sourced supplemental caption line for the winning signal's
// protagonist, e.g. "14 HR this season" or "Club is 5-1 when he goes deep" —
// reuses the SAME nightly bundle the pre-half strip/play cards read
// (src/api/callouts.js), rather than a fresh fetch. `bundle` is one game's
// slice (calloutsForGame's return); every lookup is null-guarded, same
// degrade-gracefully convention as every other callouts consumer — MiLB dates
// mostly have these families too (see docs/callouts.md's coverage note), and
// a missing bundle/field just means no sub-caption, never a crash.
export function performerSubCaption(top, bundle) {
  const id = top?.performer?.id
  if (!id || !bundle) return null
  if (top.key === 'multiHr') {
    const hr = bundle.leaders?.[id]?.cats?.hr
    if (typeof hr === 'number' && hr > 0) return `${hr} HR this season`
    const rec = bundle.homerRecords?.[id]
    if (rec) return `Team is ${rec} when he goes deep`
  }
  if (top.key === 'gameScore') {
    const rec = bundle.starterRecords?.[id]?.teamStarts
    // Only surface the club's record in his starts when it's genuinely
    // flattering. A .500-ish or losing record ("Team is 8-8 in his starts")
    // under a "was dominant" headline reads as a non-sequitur downer that
    // undercuts the praise, so require a winning record over a meaningful
    // sample — otherwise the row carries no sub-caption at all.
    if (rec) {
      const starts = (rec.w ?? 0) + (rec.l ?? 0)
      if (starts >= STARTER_RECORD_MIN_STARTS && rec.w / starts >= STARTER_RECORD_MIN_WINPCT) {
        return `Team is ${rec.w}-${rec.l} in his starts`
      }
    }
  }
  return null
}

// `entries`: [{ gamePk, game, feed, winProb, dateStr }] — `game` is the
// normalized schedule row (away/home abbreviation + gameNumber), `dateStr` its
// slate date, both needed to build the box-score link. `calloutsData` is the
// whole date's bundle (fetchCallouts's return, `{games}` keyed by gamePk) —
// optional, so a caller with none (or a pre-callouts date) still gets plain
// protagonist rows with no sub-caption. The "was dominant" pitcher rows are
// de-duped across the whole slate (see MAX_DOMINANT_HIGHLIGHTS) — a cross-game
// pass, so the ranking is computed here in two phases rather than one map.
export function rankDayHighlights(entries, calloutsData) {
  // Phase 1: gather every game's fired signals (the objects, not just keys).
  const games = entries.filter(Boolean).map(({ gamePk, game, feed, winProb, dateStr }) => {
    const box = selectBoxscore(feed)
    const potg = computePlayOfTheGame(winProb, feed)
    const winnerIsHome = box.home.line.r > box.away.line.r
    const extraInnings = Math.max(0, (box.innings?.length ?? 9) - 9)
    const signals = [
      noHitterSignal(box, feed),
      triplePlaySignal(feed),
      cycleSignal(feed),
      multiHrSignal(feed),
      positionPlayerPitchingSignal(feed),
      eliteGameScoreSignal(feed),
      ...winProbSignals(winProb, winnerIsHome, potg),
      ...marginSignals(box.away, box.home, extraInnings),
    ].filter(Boolean)
    return { gamePk, game, dateStr, box, potg, winnerIsHome, signals }
  })

  // Cross-game de-dupe: keep only the top MAX_DOMINANT_HIGHLIGHTS "was dominant"
  // starts by Game Score across the slate; strip the rest so the day's best
  // pitching survives while the repetitive tail drops.
  const kept = new Set(
    games
      .flatMap((g) => g.signals.filter((s) => s.key === 'gameScore'))
      .sort((a, b) => (b.gs ?? 0) - (a.gs ?? 0))
      .slice(0, MAX_DOMINANT_HIGHLIGHTS),
  )
  for (const g of games) {
    g.signals = g.signals.filter((s) => s.key !== 'gameScore' || kept.has(s))
  }

  // Phase 2: finalize each game's rank key + display fields.
  return games
    .map(({ gamePk, game, dateStr, box, potg, winnerIsHome, signals }) => {
      const tier = signals.length ? Math.min(...signals.map((s) => s.tier)) : 4
      const raw = signals.reduce((sum, s) => sum + s.points, 0)
      const score = 100 * (1 - Math.exp(-raw / 120))
      const top = signals.length ? pickTopSignal(signals) : null
      const bundle = calloutsForGame(calloutsData, gamePk)

      return {
        gamePk,
        tier,
        score,
        headline: buildHeadline(top, box, potg),
        signals: signals.map((s) => s.key),
        performer: top?.performer ?? null,
        subCaption: performerSubCaption(top, bundle),
        // The turning-point play, for the "Game of the Day" hero to show a
        // beat beyond the headline (null where no win-prob feed → no potg).
        // Suppressed on a walk-off: buildHeadline already splices the same play
        // into the headline there, so showing it again reads as a stutter.
        playOfGame: top?.key === 'walkoff' || !potg?.desc ? null : firstSentence(potg.desc),
        // The team-logo fallback row's pair, when the winning signal has no
        // performer (margin/length storylines, comeback) — winner first.
        teams: winnerIsHome
          ? { winner: { id: box.home.id, abbr: box.home.abbreviation }, loser: { id: box.away.id, abbr: box.away.abbreviation } }
          : { winner: { id: box.away.id, abbr: box.away.abbreviation }, loser: { id: box.home.id, abbr: box.home.abbreviation } },
        boxScorePath: gamePath(
          dateStr,
          game.away.abbreviation,
          game.home.abbreviation,
          'boxscore',
          game.gameNumber,
        ),
      }
    })
    // A quiet game with no fired signal (tier 4, the "Final: X, Y" default
    // headline) isn't a HIGHLIGHT — drop it rather than pad the list with
    // scores that don't belong in a "most interesting" ranking. A game whose
    // ONLY signal is a blowout is likewise dropped: a rout is the opposite of a
    // highlight (its points are even negative), and it only ever rode the list
    // as filler — when a lopsided game also has a real story (a multi-HR night),
    // that OTHER signal keeps it.
    .filter((entry) => entry.signals.length > 0)
    .filter((entry) => !(entry.signals.length === 1 && entry.signals[0] === 'blowout'))
    .sort((a, b) => a.tier - b.tier || b.score - a.score)
}
