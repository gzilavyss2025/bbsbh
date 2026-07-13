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

// Every player who batted, from the raw feed (selectBoxscore's battingRows
// strips fields like homeRuns that this module needs but the printed box
// score doesn't show).
function battersOf(feed, side) {
  const players = feed?.liveData?.boxscore?.teams?.[side]?.players ?? {}
  return Object.values(players).filter((p) => p.battingOrder != null)
}

function multiHrSignal(feed) {
  for (const side of ['away', 'home']) {
    for (const p of battersOf(feed, side)) {
      const hr = p.stats?.batting?.homeRuns ?? 0
      if (hr >= 2) {
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
    }
  }
  return null
}

// Starter's Game Score, from either team's first pitcher of record.
function eliteGameScoreSignal(feed) {
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
    points: best.gs >= 90 ? 40 : 25,
    text: `${best.name} was dominant (Game Score ${best.gs})`,
    performer: performerFrom(feed, best.side, best.box, `Game Score ${best.gs}`),
  }
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
// score is appended right after it. Keep only the first sentence.
function firstSentence(desc) {
  const cut = desc.indexOf('. ')
  return (cut === -1 ? desc : desc.slice(0, cut)).replace(/\.\s*$/, '')
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
function performerSubCaption(top, bundle) {
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
    if (rec) return `Team is ${rec.w}-${rec.l} in his starts`
  }
  return null
}

// `entries`: [{ gamePk, game, feed, winProb, dateStr }] — `game` is the
// normalized schedule row (away/home abbreviation + gameNumber), `dateStr` its
// slate date, both needed to build the box-score link. `calloutsData` is the
// whole date's bundle (fetchCallouts's return, `{games}` keyed by gamePk) —
// optional, so a caller with none (or a pre-callouts date) still gets plain
// protagonist rows with no sub-caption.
export function rankDayHighlights(entries, calloutsData) {
  return entries
    .filter(Boolean)
    .map(({ gamePk, game, feed, winProb, dateStr }) => {
      const box = selectBoxscore(feed)
      const potg = computePlayOfTheGame(winProb, feed)
      const winnerIsHome = box.home.line.r > box.away.line.r
      const extraInnings = Math.max(0, (box.innings?.length ?? 9) - 9)

      const signals = [
        noHitterSignal(box, feed),
        multiHrSignal(feed),
        eliteGameScoreSignal(feed),
        ...winProbSignals(winProb, winnerIsHome, potg),
        ...marginSignals(box.away, box.home, extraInnings),
      ].filter(Boolean)

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
    // scores that don't belong in a "most interesting" ranking.
    .filter((entry) => entry.signals.length > 0)
    .sort((a, b) => a.tier - b.tier || b.score - a.score)
}
