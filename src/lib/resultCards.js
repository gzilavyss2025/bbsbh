// Presentation vocabulary shared by the slate's game cards — the doubleheader
// label and the twin-bill stack. Lives here, not inside a component, because
// several modules need it and they would otherwise import each other.
//
// Spoiler-free: nothing here reads a score. The list-reshaping functions at the
// bottom do take schedule rows, but only their identity, clock, and coarse
// abstract state — never a run, an inning, or a linescore.

import { humanDate } from './dates.js'

// "Game 1" / "Game 2" for a card that's part of a doubleheader (regular or
// split), so the two same-matchup rows on the slate are told apart at a
// glance. A lone game (doubleHeader 'N') gets nothing. Shared by the card's
// pregame front face (GameCard) and its revealed back face's pill row
// (GameResultFace), so the two can't drift.
//
// `stacked` is the back-to-back twin bill before first pitch, where the
// slate hides game 2 behind game 1's card (stackDoubleHeaders below): one card
// is standing for both games, so numbering it "Game 1" would name only half of
// what it opens. The word lives here, next to the labels it replaces.
export function doubleHeaderLabel(game, stacked = false) {
  if (!game.doubleHeader || game.doubleHeader === 'N') return null
  if (stacked) return 'Doubleheader'
  return `Game ${game.gameNumber ?? 1}`
}

// "Sat, Jul 11" for a rescheduled game, or '' when no make-up date is set yet
// (a fresh postponement carries no rescheduleGameDate — PostponedBanner then
// just reads POSTPONED). Parsed as a plain calendar date (humanDate), never
// shifted by the viewer's zone.
export function rescheduleLabel(game) {
  const d = game.rescheduleGameDate
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? humanDate(d) : ''
}

// Same idea for a suspended game's set continuation date (resumeGameDate),
// or '' when the league hasn't set one yet — a game just suspended tonight
// carries no resume date until the league schedules it.
export function resumeLabel(game) {
  const d = game.resumeGameDate
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? humanDate(d) : ''
}

// The back-to-back twin bill, and why the slate shows it as one card until it
// starts.
//
// A traditional doubleheader is two games played straight through: game 2
// begins about half an hour after game 1 ENDS. The schedule feed has no way to
// say "after the first one," so it stamps game 2 with a placeholder start a few
// minutes past game 1's. Taken at face value that puts two cards for the same
// matchup at the top of the slate, five minutes apart, and neither one is wrong
// enough to tell apart at a glance.
//
// So before first pitch the two collapse into ONE card: game 1's, wearing a
// DOUBLEHEADER pill instead of GAME 1 (doubleHeaderLabel above) and game 2's
// sheet offset behind it. Once game 1 is under way the placeholder has done its
// job — the two games are now genuinely distinguishable, one live and one not —
// and game 2 returns to the slate in its own right, both cards back to GAME 1 /
// GAME 2.
//
// Same shape as the three reorder functions below, and applied before all of
// them: take the slate's games, return the list the slate should actually
// render. Order never interacts with the stack — a stacked pair is Preview by
// definition, so reorderLiveGames has nothing to promote until game 1 starts,
// which is the same moment the stack dissolves.

// How close two scheduled starts must be for the second to read as a
// placeholder rather than a time. This is the WHOLE rule — no level gate, and
// no reading of the feed's own doubleHeader letter beyond "is this a twin
// bill at all," because the clock is what a reader can and can't act on.
//
// Every doubleheader on the 2026 schedule through Aug 7 splits cleanly either
// side of it, at both levels:
//
//   traditional ('Y')  gap = 5 min      MiLB: OMA@TOL Aug 7 (5:35 / 5:40 PM,
//                                        gamePks 815575 / 815573)
//                                       MLB:  CHC@CLE Apr 5, COL@NYM Apr 26,
//                                        HOU@BAL Apr 30 — all exactly 5 min
//   split ('S')        gap = 240-405 min  14 MLB pairs, an afternoon game and
//                                        an evening one, each a real time
//
// An hour is clear of both by a wide margin, so a split doubleheader keeps its
// two cards and its two honest start times.
export const STACK_WINDOW_MINUTES = 60

// Groups a level's slate rows by matchup so a twin bill's two rows land
// together. Date is part of the key because a caller may hand over more than
// one day's games (nothing on the slate does today, but the team pages do).
function matchupKey(game) {
  return [game.sportId, game.officialDate, game.away?.id, game.home?.id].join('|')
}

// Minutes between two schedule rows' first pitches, or Infinity when either row
// carries no parseable gameDate (lean MiLB rows do occur — see the
// degrade-gracefully convention in the root CLAUDE.md).
function minutesApart(a, b) {
  const ta = new Date(a.gameDate).getTime()
  const tb = new Date(b.gameDate).getTime()
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Infinity
  return Math.abs(ta - tb) / 60000
}

// Whether these two rows are the same twin bill, scheduled back to back, with
// game 1 still to come. `first` must be game 1 and `second` game 2 — gamePk
// order does NOT settle that (Toledo's game 2 carries the LOWER pk), so the
// caller pairs on gameNumber.
function isStackablePair(first, second) {
  if (first.doubleHeader === 'N' || second.doubleHeader === 'N') return false
  if (minutesApart(first, second) > STACK_WINDOW_MINUTES) return false
  // The whole point of stacking is that the placeholder start is unreadable
  // BEFORE the day gets going. The moment game 1 is live or final, the two
  // games tell themselves apart and both belong on the slate.
  return first.abstractState === 'Preview' && second.abstractState === 'Preview'
}

// Collapses every back-to-back twin bill in `games` into its game 1.
//
// Returns `{ games, stackedBehind }` — the list with each stacked game 2
// removed, and a Map from game 1's gamePk to the game 2 hiding behind it. The
// partner rides in a Map rather than on the game object because that object is
// also the navigation seed handed to `onPick`; a card looks its partner up, and
// nothing downstream inherits a field it does not understand.
//
// A no-op for a day with no twin bill, for a split doubleheader, and for one
// already under way — in each of those it returns the SAME array reference it
// was given, so a caller memoizing on it re-renders nothing.
export function stackDoubleHeaders(games) {
  if (!Array.isArray(games) || games.length < 2) {
    return { games: games ?? [], stackedBehind: new Map() }
  }
  const byMatchup = new Map()
  for (const g of games) {
    if (!g.doubleHeader || g.doubleHeader === 'N') continue
    const key = matchupKey(g)
    if (!byMatchup.has(key)) byMatchup.set(key, [])
    byMatchup.get(key).push(g)
  }
  const stackedBehind = new Map()
  const hidden = new Set()
  for (const rows of byMatchup.values()) {
    const first = rows.find((g) => (g.gameNumber ?? 1) === 1)
    const second = rows.find((g) => g.gameNumber === 2)
    if (!first || !second) continue
    if (!isStackablePair(first, second)) continue
    stackedBehind.set(first.gamePk, second)
    hidden.add(second.gamePk)
  }
  if (hidden.size === 0) return { games, stackedBehind }
  return { games: games.filter((g) => !hidden.has(g.gamePk)), stackedBehind }
}

// Mirrors selectGameStatus's isSuspended substring test (api/select.js)
// without importing it — src/lib/ deliberately stays a layer BELOW src/api/,
// which itself imports from here, and this is the one field the pairing
// below needs from that check.
function isSuspendedRow(game) {
  return (game.detailedState ?? '').toLowerCase().includes('suspended')
}

// A suspended game whose continuation lands on the same day as an ALREADY-
// scheduled game between the same two teams — MLB's own schedule bucketing
// re-lists the suspended gamePk again under its resumeGameDate (verified
// 2026-08-14 against a live game), so both rows land in the same day's slate
// fetch on their own, with no fetch of ours involved. To a fan this plays out
// just like a twin bill (the suspended game finishes, then the other begins),
// but MLB's feed does NOT flag it as one: both rows carry doubleHeader 'N'
// and gameNumber 1, since the second game is genuinely separate and
// independently scheduled rather than "game 2" of a pair — stackDoubleHeaders
// above, gated on that flag, correctly leaves this pairing alone.
//
// Front card is always the suspended game: it resumes before the park can
// host the other one. Dissolves the moment the suspended game stops being
// suspended (it resumed and is actually being played, or finished) — at that
// point the two are distinguishable on their own status alone, same
// reasoning stackDoubleHeaders uses once game 1 goes live.
export function stackSuspendedContinuation(games) {
  if (!Array.isArray(games) || games.length < 2) {
    return { games: games ?? [], stackedBehind: new Map() }
  }
  const suspended = games.filter(isSuspendedRow)
  if (suspended.length === 0) return { games, stackedBehind: new Map() }
  const stackedBehind = new Map()
  const hidden = new Set()
  for (const first of suspended) {
    const second = games.find(
      (g) =>
        g.gamePk !== first.gamePk &&
        !hidden.has(g.gamePk) &&
        g.abstractState === 'Preview' &&
        g.away?.id === first.away?.id &&
        g.home?.id === first.home?.id,
    )
    if (!second) continue
    stackedBehind.set(first.gamePk, second)
    hidden.add(second.gamePk)
  }
  if (hidden.size === 0) return { games, stackedBehind }
  return { games: games.filter((g) => !hidden.has(g.gamePk)), stackedBehind }
}

// Underway, by the same test the slate card's own LIVE pill uses
// (GameCard.jsx) — so what the card says and where it sits can't disagree.
const isLiveGame = (game) => game.abstractState === 'Live'

// The stretch of the slate the two reorders below may rearrange: from behind a
// pinned favorite (slot 0, which outranks every other draw) down to the first
// Final. `games` is assumed to already be in sortGames' order, so a contiguous
// run of `abstractState !== 'Final'` from the front marks that stretch. The
// Finals are left alone on purpose — nothing there is still worth watching, so
// no promotion may lift one above a game that is.
function openBlock(games, isPinned) {
  const finalIdx = games.findIndex((g) => g.abstractState === 'Final')
  const end = finalIdx === -1 ? games.length : finalIdx
  return { start: isPinned(games[0]) ? 1 : 0, end }
}

// Floats every game already underway above the ones that haven't thrown a
// pitch — the slate's second tier, behind the favorite team's own game and
// ahead of the national-TV grouping below. A game in progress is the thing a
// second screen is FOR; a 7:05 national game that hasn't started is a plan.
// Both groups keep their existing relative (start-time) order, so this only
// ever moves a game across the live/scheduled line, never within a group.
export function reorderLiveGames(games, isPinned = () => false) {
  if (games.length === 0) return games
  const { start, end } = openBlock(games, isPinned)
  if (start >= end) return games
  const active = games.slice(start, end)
  const live = active.filter(isLiveGame)
  if (live.length === 0 || live.length === active.length) return games
  const scheduled = active.filter((g) => !isLiveGame(g))
  return [...games.slice(0, start), ...live, ...scheduled, ...games.slice(end)]
}

// Promotes every nationally-broadcast game (GameSelect's nationalBroadcasts,
// keyed by gamePk → network name) to the front of the games that HAVEN'T
// STARTED — the slate's third tier. Unlike the crown (always exactly one game,
// promoted from anywhere in the slate), a day can have several national games,
// so this stably groups all of them together in their existing relative
// (start-time) order rather than picking just one.
//
// It may not touch the live games above it: airing on FOX is a reason to pick
// this game over that one tonight, not a reason to outrank a game already in
// the sixth inning. `games` is assumed to have been through reorderLiveGames
// already, so the live block is the contiguous run at the front of
// openBlock's stretch and skipping it is what confines this to the scheduled
// games.
export function reorderNationalBroadcasts(games, nationalByGamePk, isPinned = () => false) {
  if (!nationalByGamePk || games.length === 0) return games
  const { start, end } = openBlock(games, isPinned)
  let from = start
  while (from < end && isLiveGame(games[from])) from += 1
  if (from >= end) return games
  const scheduled = games.slice(from, end)
  const national = scheduled.filter((g) => !!nationalByGamePk[g.gamePk])
  if (national.length === 0) return games
  const others = scheduled.filter((g) => !nationalByGamePk[g.gamePk])
  return [...games.slice(0, from), ...national, ...others, ...games.slice(end)]
}

// Lifts the World Series game to the front of the slate, ahead even of the
// favorite team's own game: on a Series day it is the one game the whole page
// is about. `gamePk` comes from the bracket (`worldSeries.cutoffGame`), never
// from a score, so this reads nothing sealed. A pk that is not on this slate
// (another level, another day) leaves the order untouched.
export function reorderSeriesGame(games, gamePk) {
  if (!gamePk) return games
  const idx = games.findIndex((g) => g.gamePk === gamePk)
  if (idx <= 0) return games
  return [games[idx], ...games.slice(0, idx), ...games.slice(idx + 1)]
}
