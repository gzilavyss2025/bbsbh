// Regenerates public/data/fever-radar.json — a nightly snapshot of Fever
// Baseball's (feverbaseball.com) breakout/fade prospect radar, an outside
// scouting opinion we display attributed and separately from bbsbh's own
// callouts (see docs/callouts.md's worthiness rubric: every callout family
// is a fact reconciled against the official MLB record; Fever's overlay
// score is a third-party model output we can't reconcile the same way, so it
// gets its own clearly-sourced surface — a RadarPill, not a callout — rather
// than being ranked in the callout worthiness table as if it were the same
// kind of thing).
//
// Source: https://www.feverbaseball.com/api/data/boards (CORS-open,
// unauthenticated, documented at feverbaseball.com/open-data, "free for
// non-commercial use with attribution"). Four boards, each already ranked:
//   mlb_breakout / mlb_fade — MLB hitters, keyed by batter_id
//   aaa_hitters / aaa_pitchers — AAA prospects, keyed by batter_id/pitcher_id
// There is no MLB pitcher board, so RadarPill only wires onto batting-order
// rows (see src/screens/TeamInfo.jsx), not the opposing-pitcher card.
//
// Every player+board pair is upserted into the shared SQLite layer's
// player_snapshots table (scripts/lib/db.js, ADR-0021) dated to the source's
// own data_through (not "today") so a late cron run never fabricates a day
// of history the source didn't actually publish. That table is what makes
// "movers" a query instead of trusting Fever's own /api/data/movers feed to
// share bbsbh's snapshot cadence: each exported row's `movement` compares
// today's rank to the nearest prior snapshot at least RADAR_WINDOW_DAYS back.
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at
// request time. Run by hand: node scripts/gen-fever-radar.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'fever-radar.json')
const SOURCE = 'feverbaseball'
const SOURCE_URL = 'https://www.feverbaseball.com'
const RADAR_WINDOW_DAYS = 6 // "since a week ago" — see exportJson's movement lookup

// Board -> the field that carries its player id (batters vs. pitchers) and
// the metric fields worth keeping in payload_json (drop the source's own
// routing field `slug`, not meaningful outside feverbaseball.com).
const BOARD_SPECS = {
  mlb_breakout: { idField: 'batter_id', fields: ['full_name', 'team', 'age', 'ev95', 'luck_gap_adj', 'overlay', 'sprint', 'ops', 'g'] },
  mlb_fade: { idField: 'batter_id', fields: ['full_name', 'team', 'age', 'ev95', 'luck_gap_adj', 'overlay', 'sprint', 'ops', 'g'] },
  aaa_hitters: { idField: 'batter_id', fields: ['full_name', 'team', 'age', 'ev95', 'xval_mlb', 'mlb_debut', 'ops', 'g'] },
  aaa_pitchers: { idField: 'pitcher_id', fields: ['full_name', 'team', 'age', 'stuff100', 'mlb_debut', 'era', 'ip'] },
}

async function fetchBoards() {
  const res = await fetch(`${SOURCE_URL}/api/data/boards`)
  if (!res.ok) throw new Error(`feverbaseball boards: HTTP ${res.status}`)
  return res.json()
}

const upsertSnapshot = (db) =>
  db.prepare(
    `INSERT INTO player_snapshots (date, player_id, board, source, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, player_id, board, source) DO UPDATE SET payload_json = excluded.payload_json`,
  )

// Exports today's rows for every board, each with a `movement` computed
// against the nearest EARLIER snapshot at least RADAR_WINDOW_DAYS back (the
// closest prior date at or before that cutoff) — a plain self-join over the
// table this generator itself has been filling in, not Fever's own /movers
// feed, so the window is ours to choose and never depends on our cron
// cadence matching theirs.
function exportJson(db, dataThrough) {
  const boards = {}
  for (const board of Object.keys(BOARD_SPECS)) {
    const rows = db
      .prepare(
        `SELECT player_id, payload_json FROM player_snapshots
         WHERE date = ? AND board = ? AND source = ?
         ORDER BY player_id`,
      )
      .all(dataThrough, board, SOURCE)
    boards[board] = rows.map((row) => {
      const payload = JSON.parse(row.payload_json)
      const prior = db
        .prepare(
          `SELECT date, payload_json FROM player_snapshots
           WHERE player_id = ? AND board = ? AND source = ? AND date <= date(?, '-${RADAR_WINDOW_DAYS} days')
           ORDER BY date DESC LIMIT 1`,
        )
        .get(row.player_id, board, SOURCE, dataThrough)
      let movement = null
      if (prior) {
        const priorPayload = JSON.parse(prior.payload_json)
        movement = { delta: priorPayload.rank - payload.rank, sinceDate: prior.date }
      }
      return { playerId: row.player_id, ...payload, movement }
    })
  }
  return {
    generatedAt: new Date().toISOString(),
    dataThrough,
    source: SOURCE_URL,
    attribution: 'Fever Baseball',
    boards,
  }
}

async function main() {
  const data = await fetchBoards()
  const dataThrough = data.data_through
  if (!dataThrough) throw new Error('feverbaseball boards: missing data_through')

  const db = await openDb()
  const insert = upsertSnapshot(db)
  for (const [board, spec] of Object.entries(BOARD_SPECS)) {
    for (const [rank, entry] of (data[board] ?? []).entries()) {
      const playerId = entry[spec.idField]
      if (!playerId) continue
      const payload = { rank: rank + 1 }
      for (const field of spec.fields) payload[field] = entry[field] ?? null
      insert.run(dataThrough, playerId, board, SOURCE, JSON.stringify(payload))
    }
  }
  await dumpGroup(db, 'player-snapshots')

  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(exportJson(db, dataThrough)))
  const counts = Object.keys(BOARD_SPECS)
    .map((board) => `${board}=${(data[board] ?? []).length}`)
    .join(', ')
  console.log(`wrote ${out} (data_through ${dataThrough}, ${counts})`)
  db.close()
}

main()
