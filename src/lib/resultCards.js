// Presentation vocabulary shared by the slate's game cards, both faces — the
// pill/chip labels and colors, the doubleheader label, the plain score line,
// and the slate's crowned-game promotion. Lives here, not inside a component,
// because four modules need it and they would otherwise import each other:
// GameResultFace renders PerformerCard, and PerformerCard needs
// scorePairsLine, which used to live in GameResultFace — a real import cycle;
// GameResultFace also reached sideways into GameCard for doubleHeaderLabel.
// GameSelect (a screen) likewise needs the labels/colors for its filter chips
// without pulling in a component module for two constants.
//
// Spoiler-free: nothing here reads a feed. The CLASSIFICATION that decides
// which label a card wears is reveal-only (dayHighlights.js's
// classifyGameCards); these are just the words and hues it maps onto.

// "Game 1" / "Game 2" for a card that's part of a doubleheader (regular or
// split), so the two same-matchup rows on the slate are told apart at a
// glance. A lone game (doubleHeader 'N') gets nothing. Shared by the card's
// pregame front face (GameCard) and its revealed back face's pill row
// (GameResultFace), so the two can't drift.
export function doubleHeaderLabel(game) {
  if (!game.doubleHeader || game.doubleHeader === 'N') return null
  return `Game ${game.gameNumber ?? 1}`
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
