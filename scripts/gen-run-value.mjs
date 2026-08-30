// Regenerates public/data/run-value.json — every player's season run value,
// split into the four things a player can do to move a run: bat, field, run
// the bases, pitch. Pulled from Baseball Savant, which computes all four and
// publishes them on four separate leaderboards but never adds them up.
//
// WHAT A RUN VALUE IS. Savant scores an event by how much it changed the runs
// the average team would go on to score from that base/out/count state. Sum a
// season of those and you get one number, in runs above average, on a scale
// every one of the four shares — which is the only reason they can be added.
// The four boards this reads are CONTEXT NEUTRAL: an event is scored off the
// generic run-expectancy table, never off the leverage of the game it happened
// in, so a grand slam in a blowout and one in a tie game are worth the same.
// Savant offers a leverage-weighted swing/take board as well (`ddlLeverage`);
// this deliberately takes the neutral one, because a leverage-weighted figure
// answers "how much did his season help HIS team win" and cannot be compared
// across the four skills or across clubs.
//
// THE FOUR SOURCES, verified live 2026-08-30 against the season's published
// top ten (see docs/run-value.md for the reconstruction and its check):
//
//   bat  swing-take, group=Batter   -> runs_all   the batter's swing/take runs
//   pit  swing-take, group=Pitcher  -> runs_all   the same metric, pitcher side
//   fld  fielding-run-value         -> total_runs range + arm + double plays,
//                                                 and for a catcher framing,
//                                                 blocking and throwing
//   run  baserunning-run-value      -> runner_runs_tot  taking the extra base
//                                                 and stealing it
//
// Batting and pitching are the SAME metric read from the two sides of the
// plate — that is not a shortcut, it is what Savant's own player pages show
// under "Batting Run Value" and "Pitching Run Value". It is also why a two-way
// player (Ohtani) is the one case where a row carries both.
//
// EVERY BOARD FAILS SOFT EXCEPT THE FIRST TWO. Savant renames columns without
// notice and a rename does not error — the column simply comes back empty
// (scripts/lib/savant.mjs's header). A missing fielding or baserunning board
// costs a component; a missing swing/take board would publish a leaderboard of
// pitchers with no pitching in it, which is worse than publishing nothing, so
// those two are fatal and last night's committed file stands.
//
// THE FILE SHIPS THE FOUR COMPONENTS AND NOTHING ELSE. No total, no rank, no
// qualification floor — those are all computed in src/api/around-the-game/
// runValue.js, where they are pure, unit-tested and arguable without a
// regeneration. Same split gen-gate.mjs keeps with gate.js.
//
// This runs nightly via .github/workflows/update-nightly-data.yml.
// Run by hand: node scripts/gen-run-value.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { csvObjects, num, round1, withRetry } from './lib/savant.mjs'
import { getJson } from './lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'run-value.json')
const season = new Date().getFullYear()

// Savant's own default minimums hide most of a league behind a "qualified"
// filter, and a club page wants its whole roster, not its nine regulars. Each
// board spells its floor differently — `min` on swing/take, `minInnings` on
// fielding — and the baserunning CSV export ignores a floor argument entirely
// and always returns its own qualified set, which is why no floor is passed
// there. Verified live 2026-08-30: min=1 returns 640 batters and 827 pitchers
// against 299 apiece at the default `q`.
const MIN_PITCHES = 1
const MIN_INNINGS = 1

// Below this many rows a board is not thin, it is broken — a renamed column,
// a mid-migration response, an empty season. Set well under the counts above
// so a legitimately small early-April file still passes.
const MIN_ROWS = { bat: 200, pit: 200, fld: 100, run: 50 }

async function fetchCsv(label, url, { attempts = 4 } = {}) {
  return withRetry(label, attempts, async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = csvObjects(await res.text())
    if (!rows.length) throw new Error('empty response')
    return rows
  })
}

// The swing/take board, one side of the plate at a time. `type=All` is the
// whole-season roll-up rather than one of its attack-region splits, and
// `sub_type=null` is what Savant's own page sends for it.
const swingTake = (group) =>
  fetchCsv(
    `Savant swing-take ${group}`,
    `https://baseballsavant.mlb.com/leaderboard/swing-take` +
      `?year=${season}&team=&group=${group}&type=All&sub_type=null&min=${MIN_PITCHES}&csv=true`,
  )

// Fielding. `type=fielder` is the per-player board; the same path also serves
// club and batter-side views, which are a different shape entirely.
const fielding = () =>
  fetchCsv(
    'Savant fielding-run-value',
    `https://baseballsavant.mlb.com/leaderboard/fielding-run-value` +
      `?type=fielder&seasonStart=${season}&seasonEnd=${season}&minInnings=${MIN_INNINGS}&csv=true`,
  )

// Baserunning. Note the column names differ from every other board here — the
// id is `player_id` but the name is `entity_name`, and the total is
// `runner_runs_tot`.
const baserunning = () =>
  fetchCsv(
    'Savant baserunning-run-value',
    `https://baseballsavant.mlb.com/leaderboard/baserunning-run-value?year=${season}&csv=true`,
  )

// "Crow-Armstrong, Pete" -> "Pete Crow-Armstrong". Savant appends a suffix to
// the LAST-name half ("Witt Jr., Bobby"), so a single split on the first comma
// puts it back in the right place with no suffix handling. Only used when the
// statsapi name lookup below could not answer for that id.
function flipName(savantName) {
  const raw = (savantName ?? '').trim()
  const comma = raw.indexOf(',')
  if (comma < 0) return raw
  return `${raw.slice(comma + 1).trim()} ${raw.slice(0, comma).trim()}`.trim()
}

// Canonical names, current club and position from statsapi — the same ids this
// app joins on everywhere, so a Savant row and a roster entry can never
// disagree about what a man is called. Batched, because a thousand ids is one
// request per chunk rather than a thousand requests.
//
// NEVER FATAL. Savant already carries a usable name and a team id on the
// swing/take boards; this only upgrades them, so a statsapi outage costs the
// position abbreviation and leaves everything else standing.
const PEOPLE_CHUNK = 200

async function fetchPeople(ids) {
  const map = new Map()
  for (let i = 0; i < ids.length; i += PEOPLE_CHUNK) {
    const chunk = ids.slice(i, i + PEOPLE_CHUNK)
    try {
      const body = await getJson(`/api/v1/people?personIds=${chunk.join(',')}`)
      for (const p of body?.people ?? []) {
        map.set(String(p.id), {
          name: p.fullName ?? null,
          teamId: p.currentTeam?.id ?? null,
          pos: p.primaryPosition?.abbreviation ?? null,
        })
      }
    } catch (err) {
      console.error(`statsapi people chunk ${i / PEOPLE_CHUNK + 1}: ${err.message} — falling back to Savant names`)
    }
  }
  return map
}

// One row per player, accumulating whichever of the four boards names him.
const players = new Map()

function row(id, savantName) {
  const key = String(id)
  if (!players.has(key)) {
    players.set(key, { id: Number(id), savantName, teamId: null, bat: 0, fld: 0, run: 0, pit: 0, seen: new Set() })
  }
  const r = players.get(key)
  if (!r.savantName && savantName) r.savantName = savantName
  return r
}

// A board's rows folded into the map. `+=`, not `=`: Savant splits a traded
// player's fielding into one row per position group, and a hitter who pitched
// an inning of mop-up appears on both swing/take boards. Summing is what makes
// a two-way season and a mid-season trade come out whole.
function fold(rows, { key, idCol, nameCol, valueCol, teamCol = null }) {
  let counted = 0
  for (const r of rows) {
    const id = r[idCol]
    if (!id) continue
    const v = num(r[valueCol])
    if (v == null) continue
    const entry = row(id, r[nameCol])
    entry[key] += v
    entry.seen.add(key)
    if (teamCol && entry.teamId == null) {
      const t = num(r[teamCol])
      if (t != null) entry.teamId = t
    }
    counted++
  }
  return counted
}

const [batRows, pitRows] = await Promise.all([swingTake('Batter'), swingTake('Pitcher')])

// The two soft boards, each swallowed on its own so one failure never takes
// the other down with it.
const [fldRows, runRows] = await Promise.all([
  fielding().catch((err) => {
    console.error(`${err.message} — this file ships with no fielding component`)
    return []
  }),
  baserunning().catch((err) => {
    console.error(`${err.message} — this file ships with no baserunning component`)
    return []
  }),
])

const counts = {
  bat: fold(batRows, { key: 'bat', idCol: 'player_id', nameCol: 'last_name, first_name', valueCol: 'runs_all', teamCol: 'team_id' }),
  pit: fold(pitRows, { key: 'pit', idCol: 'player_id', nameCol: 'last_name, first_name', valueCol: 'runs_all', teamCol: 'team_id' }),
  fld: fold(fldRows, { key: 'fld', idCol: 'id', nameCol: 'name', valueCol: 'total_runs' }),
  run: fold(runRows, { key: 'run', idCol: 'player_id', nameCol: 'entity_name', valueCol: 'runner_runs_tot' }),
}

// A column Savant has renamed comes back blank for EVERY row, so a board that
// parsed fine and folded nothing is the failure this checks for. The two
// hard boards abort; the two soft ones have already warned above and simply
// contribute nothing.
for (const key of ['bat', 'pit']) {
  if (counts[key] < MIN_ROWS[key]) {
    throw new Error(
      `Savant swing-take ${key}: only ${counts[key]} usable rows (expected ≥ ${MIN_ROWS[key]}) — ` +
        'a column was probably renamed; last night’s file stands',
    )
  }
}
for (const key of ['fld', 'run']) {
  if (counts[key] > 0 && counts[key] < MIN_ROWS[key]) {
    console.error(`Savant ${key} board: only ${counts[key]} usable rows (expected ≥ ${MIN_ROWS[key]}) — shipping it anyway, but check the columns`)
  }
}

const people = await fetchPeople([...players.keys()])

// Rounded to a tenth of a run, which is the storage precision every Savant
// figure in this repo keeps (scripts/lib/savant.mjs's round1). Display rounds
// to whole runs: a tenth of a run over a season is a database talking. The
// TOTAL is summed from these tenths in the reader rather than stored, and the
// reconstruction in docs/run-value.md confirms that a tenth of rounding never
// moves a published figure.
const outPlayers = []
for (const p of players.values()) {
  const info = people.get(String(p.id))
  const name = info?.name || flipName(p.savantName)
  if (!name) continue
  const entry = {
    id: p.id,
    name,
    teamId: info?.teamId ?? p.teamId ?? null,
    bat: round1(p.bat),
    fld: round1(p.fld),
    run: round1(p.run),
    pit: round1(p.pit),
  }
  if (info?.pos) entry.pos = info.pos
  outPlayers.push(entry)
}

// Sorted by id, not by any figure. A stable order keeps the nightly diff to
// the numbers that actually moved instead of re-ordering a thousand rows every
// time somebody passes somebody else; the reader does the ranking.
outPlayers.sort((a, b) => a.id - b.id)

await writeJsonAtomic(out, {
  season,
  generatedAt: new Date().toISOString(),
  source: 'Baseball Savant',
  sourceUrl: 'https://baseballsavant.mlb.com/leaderboard/swing-take',
  // Stated in the file so the page can print it without hard-coding a claim
  // about the source that a later change here would silently falsify.
  leverage: 'neutral',
  counts,
  players: outPlayers,
})

console.log(
  `run-value.json: ${outPlayers.length} players — ` +
    `bat ${counts.bat}, pit ${counts.pit}, fld ${counts.fld}, run ${counts.run}`,
)
