// RUNS OF BEING RIGHT, AND RUNS OF BEING WRONG — the fifth pure part of the
// job behind gen-abs-challenges.mjs (rows.mjs makes the rows, bank.mjs replays
// the bank, chances.mjs counts the denominator, ranout.mjs finds the nights a
// club emptied it, export.mjs ships the file).
//
// Order a man's challenges by the day he called them and walk them for runs of
// the same outcome. Two scopes come out, because they are two different
// questions — how long he went without being wrong ACROSS THE SEASON, and how
// long he went inside ONE GAME — and each is asked of both outcomes.
//
// THE SMALL SAMPLE IS THE WHOLE TRAP. Carson Kelly won 16 in a row out of 88
// challenges all year; Isaac Paredes won 10 in a row out of 14. Those are not
// the same fact, and a board that prints the run alone makes them look like
// one. So every row carries the man's season total beside the run, in a column
// that says what it is — not in a sentence under the table, where a reader
// comparing two rows will not have it.
//
// WHAT A RUN INSIDE ONE GAME CAN REACH, and why the rulebook is only half of
// it. A club is issued two challenges and loses one each time the call stands,
// so a run of losses inside one game stops at two — in REGULATION. A club that
// has run out is armed again in each extra inning (bank.mjs), and Triple-A's
// rows carry three men who lost three in a row in one night because of it. So
// the cap is read off the data (`gameLoss`'s own `max`, which the reader turns
// into a sentence in inGameLossCap) and never stated as a rule: the page that
// says "two is the rulebook, not a record" is wrong the moment its own level
// chip switches to Triple-A.
//
// THE BOARDS ARE CUT HERE, not in the reader, and it is the same trade
// ranout.mjs records. 1,553 men challenged this season; a row carrying each
// man's name, club and four run lengths costs about 108 KB on a file every
// visitor to /abs-challenges downloads whole, to show twelve of them.
//
// SO THE DISTRIBUTION IS SHIPPED WHOLE AND THE ROWS ARE NOT. `reached` counts
// every player at every run length, which is what the page needs to say how
// many men tie below the twelve on screen, and it costs about a kilobyte a
// level. Nothing about the shape of the season is hidden by the cut; only the
// names below it are.

import { ROLES } from './rows.mjs'

// How many men each board shows. Twelve rather than ten because the run
// lengths tie heavily — MLB's in-game win board has two men at five and the
// rest at four or three — and a board cut at ten would slice a tie for no
// reason but the round number.
export const STREAK_TOP = 12

// The four boards, in the order the page offers them. The key is the field a
// player row carries the run in, and the file ships them under exactly these
// names — the reader reaches for one by name (streakBoard), so the list itself
// stays private to this file.
const BOARD_KEYS = ['seasonWin', 'seasonLoss', 'gameWin', 'gameLoss']

// The day the challenge was called, then the game, then the order inside it.
// `seq` is written per GAME across both clubs (rows.mjs), so it orders one
// man's calls inside a night exactly; the date orders the nights.
//
// A DOUBLEHEADER IS ORDERED BY gamePk, which is the only handle the rows carry
// — both games share a date. MLB issues the two pks in order on every
// doubleheader on file, and a run that crossed the wrong way between two games
// of one afternoon would be off by the boundary between them and by nothing
// else.
function inOrder(challenges) {
  return [...challenges].sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      a.game_pk - b.game_pk ||
      (a.seq ?? 0) - (b.seq ?? 0),
  )
}

// The longest run of one outcome in an ordered list. A challenge of the other
// outcome breaks it; nothing else does — a game the man did not challenge in
// at all is not a break, because he did nothing there to be right or wrong
// about.
function longestRun(ordered, want) {
  let best = 0
  let run = 0
  for (const c of ordered) {
    if ((c.outcome === 'success') === want) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

// The longest run inside any ONE game, which is the same walk bounded to a
// gamePk.
function longestInGame(ordered, want) {
  const games = new Map()
  for (const c of ordered) {
    const list = games.get(c.game_pk) ?? []
    list.push(c)
    games.set(c.game_pk, list)
  }
  let best = 0
  for (const list of games.values()) {
    const run = longestRun(list, want)
    if (run > best) best = run
  }
  return best
}

// THE JOB HE MOSTLY DID, which is not the job he did first. Francisco Alvarez
// challenged from behind the plate and from the batter's box, and a board that
// grouped him by his opening call in April could put a catcher among the
// hitters for the rest of the season.
//
// It differs on purpose from `byPlayer.role` in export.mjs, which is the role
// of a man's FIRST challenge and says so. That list ships each man's own
// totals and is never grouped; these boards are grouped by role and nothing
// else, so the label has to be the one that describes most of what he did.
// Ties fall to ROLES order, which puts the batter first.
function mainRole(ordered) {
  const counts = new Map()
  for (const c of ordered) counts.set(c.role, (counts.get(c.role) ?? 0) + 1)
  let best = ordered[0].role
  for (const role of ROLES) {
    if ((counts.get(role) ?? 0) > (counts.get(best) ?? 0)) best = role
  }
  return best
}

// One man's four runs, his role and his season line.
export function streaksByPlayer(rows) {
  const byPlayer = new Map()
  for (const r of rows) {
    if (r.player_id == null) continue
    const list = byPlayer.get(r.player_id) ?? []
    list.push(r)
    byPlayer.set(r.player_id, list)
  }

  const out = []
  for (const [playerId, challenges] of byPlayer) {
    const ordered = inOrder(challenges)
    out.push({
      playerId,
      name: ordered[0].player_name ?? '',
      teamId: ordered[0].team_id,
      role: mainRole(ordered),
      n: ordered.length,
      success: ordered.filter((c) => c.outcome === 'success').length,
      seasonWin: longestRun(ordered, true),
      seasonLoss: longestRun(ordered, false),
      gameWin: longestInGame(ordered, true),
      gameLoss: longestInGame(ordered, false),
    })
  }
  return out
}

// One board's rows for one role: the longest runs, and the full distribution
// behind them.
//
// `reached` counts EVERY player at every run length, the men on the rows and
// the men below them alike, so the page can say how many tie at two without
// the file carrying them. A run of nought is left out — it means the man never
// had that outcome at all, which is a fact about his record and not about any
// run he put together.
function boardFor(players, key, top) {
  const reached = new Map()
  for (const p of players) {
    const run = p[key]
    if (run > 0) reached.set(run, (reached.get(run) ?? 0) + 1)
  }
  const rows = players
    .filter((p) => p[key] > 0)
    .sort((a, b) => b[key] - a[key] || b.n - a.n || a.playerId - b.playerId)
    .slice(0, top)
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      teamId: p.teamId,
      run: p[key],
      n: p.n,
      success: p.success,
    }))
  return {
    rows,
    max: rows.length ? rows[0].run : 0,
    players: [...reached.values()].reduce((n, c) => n + c, 0),
    reached: [...reached].sort((a, b) => b[0] - a[0]).map(([run, n]) => ({ run, n })),
  }
}

// Every board, by role. A role nobody challenged from is left out rather than
// shipped empty, which is what `other` does on a healthy season.
export function streakBoards(rows, top = STREAK_TOP) {
  const players = streaksByPlayer(rows)
  const boards = {}
  for (const key of BOARD_KEYS) {
    const byRole = {}
    for (const role of ROLES) {
      const mine = players.filter((p) => p.role === role)
      if (mine.length === 0) continue
      byRole[role] = boardFor(mine, key, top)
    }
    boards[key] = byRole
  }
  return { top, players: players.length, boards }
}
