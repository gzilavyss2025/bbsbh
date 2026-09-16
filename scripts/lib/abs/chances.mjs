// A CHANCE IS ONE HALF-INNING A CLUB PLAYED WHILE IT STILL HELD A CHALLENGE —
// the denominator "challenges by inning" is meaningless without, and the third
// pure part of the job behind gen-abs-challenges.mjs (rows.mjs makes the rows,
// bank.mjs replays the bank, export.mjs ships the file).
//
// WHY THE RAW COUNT MISLEADS, TWICE. Ask which innings draw the most
// challenges and the rows answer that the ninth (1,216) barely beats the
// eighth (1,151), which reads as a flat appetite that sags at the end. Both
// halves of that are an artefact of the denominator:
//
//   1. NOT EVERY GAME REACHES THE NINTH, and in a good half of the ones that
//      do, the home club never bats in it.
//   2. A CLUB THAT HAS LOST TWO CANNOT ASK AT ALL. By the ninth a large share
//      of the league is holding nothing, so its silence is the rulebook rather
//      than a decision.
//
// Divide by the half-innings a club actually played holding a challenge and
// the answer inverts: 10.20 challenges per 100 chances in the first against
// 21.36 in the ninth. The appetite MORE THAN DOUBLES, and the raw count hides
// half of that rise. The share won falls the other way across the same span,
// 60.9% to 40.5%, which is the finding: clubs ask more as the game gets late
// and are right less often when they do.
//
// BOTH CLUBS ARE EXPOSED IN EVERY HALF-INNING — the batting club through its
// batter, the fielding club through its catcher or its pitcher — so a played
// half-inning offers two chances, one to each club, and only to a club that is
// still armed.
//
// ONE DENOMINATOR, AND IT IS THE CLUB'S. The role cut is counted on the SAME
// club chances rather than on a role's own share of them. A batter can only
// challenge in his club's batting half, so his own opportunity is half the
// club total — and a panel drawn that way sums to exactly twice the club rate,
// which reads as though catchers alone out-ask the whole club they play for.
// Ship the three roles over the club denominator and they add up to the club
// figure, which is the only way the panel can be read.

import { replayBank } from './bank.mjs'
import { ROLES } from './rows.mjs'

// How many half-innings of inning `i` were played, given the game's shape.
//
// The top of an inning the game reached was always played — reaching it is
// what "final inning" means. The bottom was played in every inning BEFORE the
// last, and in the last one only when the home club batted.
//
// THE FEED SAYS SO BY OMISSION. A nine-inning game the home club led after the
// top of the ninth carries a last `innings[]` entry whose `home` object has no
// `runs` KEY AT ALL, where a club that batted and was retired in order carries
// `runs: 0` (verified on gamePk 824872 against 823413). So `bottom_played` is
// written from the key's presence, never from its value, and a reader that
// tested `home.runs > 0` would drop every scoreless home half in the season.
export function halvesPlayed(inning, finalInning, bottomPlayed) {
  if (inning > finalInning) return 0
  const bottom = inning < finalInning || Boolean(bottomPlayed)
  return 1 + (bottom ? 1 : 0)
}

// THE THREE COLUMNS, READ OFF A LINESCORE. One function for both callers,
// because the SAME object shape arrives from two places: `liveData.linescore`
// on a game feed the sweep is already reading, and `linescore` on a schedule
// row once `--recheck` asks for `&hydrate=linescore`. Verified identical on
// gamePks 816247, 824872 and 816025.
//
// NEITHER CALLER PAYS A FETCH FOR IT. The sweep has the feed in hand; the
// recheck's one schedule call a fortnight a level is already made, and the
// hydration rides along on it.
//
// `bottomPlayed` tests the PRESENCE of the last inning's `home.runs` key, not
// its value — a home club retired in order carries `runs: 0` and a home club
// that never batted carries no `runs` key at all. `finalInning` prefers
// `currentInning` and falls back to the last entry's own number, which agree
// on every game checked.
//
// Everything is null on a game that was never played: a cancelled or postponed
// schedule row carries an empty linescore, which is exactly the class of game
// isPlayedGame already keeps off the ledger.
export function gameShape(linescore) {
  const innings = linescore?.innings ?? []
  const last = innings.length ? innings[innings.length - 1] : null
  const finalInning = linescore?.currentInning ?? last?.num ?? null
  if (finalInning == null) return { finalInning: null, bottomPlayed: null, scheduledInnings: null }
  return {
    finalInning,
    bottomPlayed: Object.hasOwn(last?.home ?? {}, 'runs') ? 1 : 0,
    scheduledInnings: linescore?.scheduledInnings ?? null,
  }
}

// Every challenge grouped by the club-game that called for it, which is the
// unit the bank is replayed over.
function byGameTeam(rows) {
  const out = new Map()
  for (const r of rows) {
    const key = `${r.game_pk}:${r.team_id}`
    const list = out.get(key) ?? []
    list.push(r)
    out.set(key, list)
  }
  return out
}

// THE DENOMINATOR, inning by inning, over every game on file.
//
// Returns `{ byInning, total, dropped, games }` — a Map of inning number to
// the chances offered in it, the season total, and how many games could not be
// counted.
//
// A GAME WITH NO `final_inning` IS DROPPED, NOT COUNTED AS NOUGHT INNINGS. The
// columns are NULL on a game swept before they existed, and treating a NULL as
// a short game would quietly shrink every inning's denominator and inflate
// every rate. `--recheck` backfills them from the schedule row it already
// reads, so the count is expected to be zero; it is returned rather than
// logged so the export can say "every game counted" instead of printing a
// number that reads as data loss (docs/adr/0075).
//
// The bank is replayed ONCE per club-game, not once per inning: `atStart`
// already holds what the club had at the top of every inning, and asking
// armedAt nine times a game would replay the same night nine times.
export function chancesByInning(rows, games) {
  const challenges = byGameTeam(rows)
  const byInning = new Map()
  let dropped = 0
  let counted = 0

  for (const g of games) {
    if (g.final_inning == null) {
      dropped += 1
      continue
    }
    counted += 1
    const last = g.final_inning
    const scheduled = g.scheduled_innings ?? null

    for (const teamId of [g.away_team_id, g.home_team_id]) {
      if (teamId == null) continue
      // The club's whole night in one pass. The game's real length goes in so
      // an extra inning it never challenged in still re-arms it, and the
      // SCHEDULED length goes in so the eighth of a seven-inning game counts
      // as the extra inning it is (bank.mjs).
      const { atStart } = replayBank(challenges.get(`${g.game_pk}:${teamId}`) ?? [], last, scheduled)
      for (let inning = 1; inning <= last; inning++) {
        if ((atStart.get(inning) ?? 0) === 0) continue
        const halves = halvesPlayed(inning, last, g.bottom_played)
        if (halves === 0) continue
        byInning.set(inning, (byInning.get(inning) ?? 0) + halves)
      }
    }
  }

  let total = 0
  for (const n of byInning.values()) total += n
  return { byInning, total, dropped, games: counted }
}

// The challenges themselves, cut by inning and by role, ready to be divided by
// the chances above. Counts only — the rate is put together in export.mjs,
// where the two halves meet.
//
// Every role gets a row in every inning that saw any challenge, including the
// roles that saw none there, because a panel that dropped the empty ones would
// draw a catcher's line with gaps in it and read as missing data rather than
// as a quiet inning.
export function challengesByInningRole(rows) {
  const byInning = new Map()
  for (const r of rows) {
    if (!byInning.has(r.inning)) {
      byInning.set(r.inning, new Map(ROLES.map((role) => [role, { n: 0, success: 0 }])))
    }
    const t = byInning.get(r.inning).get(r.role) ?? byInning.get(r.inning).get('other')
    t.n += 1
    if (r.outcome === 'success') t.success += 1
  }
  return byInning
}
