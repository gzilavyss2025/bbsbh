// Presentation vocabulary shared by the slate's game cards, both faces — the
// pill/chip labels and colors, the doubleheader label, the plain score line,
// the twin-bill stack, and the slate's crowned-game promotion. Lives here, not
// inside a component,
// because four modules need it and they would otherwise import each other:
// GameResultFace renders PerformerCard, and PerformerCard needs
// scorePairsLine, which used to live in GameResultFace — a real import cycle;
// GameResultFace also reached sideways into GameCard for doubleHeaderLabel.
// GameSelect (a screen) likewise needs the labels/colors for its filter chips
// without pulling in a component module for two constants.
//
// Spoiler-free: nothing here reads a score. The CLASSIFICATION that decides
// which label a card wears is reveal-only (dayHighlights.js's
// classifyGameCards); these are just the words and hues it maps onto. The three
// list-reshaping functions at the bottom do take schedule rows, but only their
// identity, clock, and coarse abstract state — never a run, an inning, or a
// linescore.

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

// Pill category label per scenario, in the fixed order the chips and pills
// both render.
export const SCENARIO_LABEL = {
  dominant: 'Dominant Performance',
  blowout: 'Blowout',
  close: 'Close Game',
  extras: 'Extra Innings',
}

// Each scenario's own accent color, reused BOTH as the whole card's border
// tint (see GameResultFace's cardAccent + .flipback--accent in index.css) and
// as its own pill's fill (.flipback__pill--scenario) — an existing design-
// system token per scenario rather than a new hue, so the card palette stays
// inside the app's established set:
//   dominant → --field  (the app's own "positive" green)
//   blowout  → --clay   (the app's own "alert/lopsided" red)
//   close    → --marker (the "watch this" highlighter yellow)
//   extras   → --allstar-blue (a distinct, unusual-occasion blue)
// `text` is the ONE piece that can't just follow the same accent: filling a
// pill solid with --marker and setting its own text to --marker too would be
// invisible, and the WCAG-AA-legible foreground for a saturated dark fill
// (field/clay/allstar-blue) is the opposite of what a light, bright fill
// (marker) needs. Every pairing below is asserted by scripts/check-contrast.mjs
// (run by `npm run lint`), so a later hex nudge can't quietly break one.
// The crown outranks all four for the card border — see cardAccent's priority
// order — but keeps its own amber pill treatment.
export const SCENARIO_STYLE = {
  dominant: { accent: 'var(--field)', text: 'var(--text-on-ink)' },
  blowout: { accent: 'var(--clay)', text: 'var(--text-on-ink)' },
  close: { accent: 'var(--marker)', text: 'var(--text-heading)' },
  extras: { accent: 'var(--allstar-blue)', text: 'var(--text-on-ink)' },
}

// Every filter chip GameSelect's ResultFilterBar can show, in a fixed display
// order — crown first (the single biggest deal), then the four scenarios in
// the same order their own pills render on a card. The crown's colors match
// its existing pill (--award-ink fill, --text-on-ink text, see
// .flipback__pill--crown) so a chip and the card pill it filters for are
// always the identical color.
export const FILTER_CHIPS = [
  { key: 'crown', label: '★ Game of the Night', accent: 'var(--award-ink)', text: 'var(--text-on-ink)' },
  ...Object.entries(SCENARIO_LABEL).map(([key, label]) => ({ key, label, ...SCENARIO_STYLE[key] })),
]

// "MIL 5, STL 3" — comma-joined "ABBR score" pairs, in caller-supplied order.
// Shared so every "final score, plain text" spot renders the same shape
// instead of hand-rolling its own.
export function scorePairsLine(pairs) {
  return pairs.map(([abbr, score]) => `${abbr} ${score}`).join(', ')
}

// Whether GameResultFace will stack an extra PerformerCard block above its
// Play of the Game text for this card — a performer takes that slot on a
// Dominant Performance, or a Blowout/Extra-Innings card whose deterministic
// playChoice landed on the performer variant. Pulled out of GameResultFace so
// BoxScoreSkeleton (its card's "still fetching" placeholder) can make the
// SAME call from the same cardMeta and reserve a matching placeholder shape
// — a best-effort narrowing of the window where the real face pops in an
// extra block after mounting, not a guarantee it never does (see
// BoxScoreSkeleton.jsx's own header comment for why cardMeta can arrive
// after this card's own reveal fetch already has).
export function showsPerformerCard(cardMeta) {
  const { scenario, playChoice, performer } = cardMeta ?? {}
  return (
    !!performer &&
    (scenario === 'dominant' || ((scenario === 'blowout' || scenario === 'extras') && playChoice === 'performer'))
  )
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

// Promotes the crowned "Game of the Night" (dayHighlights.js's
// classifyGameCards, via useDayCardMeta) to the front of the slate — but
// behind the favorite team's own game, which sortGames already floated to
// slot 0 and which outranks any storyline for a user who has a favorite. With
// no pinned game leading the slate there's nothing to sit behind, so the
// crown takes slot 0 outright rather than hiding behind whichever game merely
// happened to start earliest.
//
// `isPinned(game)` reports whether a game is the favorite's own (or its
// affiliate's, on a MiLB level) — the same predicate that produced the sort.
// `cardMetaByGamePk` is an empty Map until the day's reveal-all fires, so this
// is a no-op before then: nothing here can promote a game ahead of time based
// on which one WILL turn out to be crowned.
export function reorderGameOfTheNight(games, cardMetaByGamePk, isPinned = () => false) {
  if (cardMetaByGamePk.size === 0 || games.length === 0) return games
  const crownedIdx = games.findIndex((g) => cardMetaByGamePk.get(g.gamePk)?.isGameOfTheNight)
  if (crownedIdx === -1) return games
  const target = isPinned(games[0]) ? 1 : 0
  if (crownedIdx <= target) return games
  const next = [...games]
  const [crowned] = next.splice(crownedIdx, 1)
  next.splice(target, 0, crowned)
  return next
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
