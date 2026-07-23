// Records what each MLB club actually wore in every game — the daily jersey/
// uniform history the future team-color-lab correlation page (a separate PR)
// will join against. Source is the dedicated /api/v1/uniforms/game endpoint
// (docs/uniforms-and-logos.md — the live feed carries zero uniform data).
// Spoiler-free: uniform assignment reveals nothing about the score and never
// changes once posted, so this needs no SealBox and no coordination with the
// spoiler rule.
//
// Background data only — no public/data/*.json export and no UI surface yet.
// Writes straight to the shared SQLite layer (scripts/lib/db.js, ADR-0021),
// its own `jerseys` group (scripts/data/jerseys.sql), one row per (game,
// team) side. `payload_json` carries each side's asset list verbatim
// (label text, piece code, and uniformAssetCode — the join key the color-lab
// page will need) rather than exploding into columns.
//
// APPEND-ONLY / incremental, same shape as gen-comeback-wins.mjs: each run
// sweeps a small trailing window of dates, skips any (gamePk, teamId) pair
// already recorded, and fetches the uniforms endpoint (which takes a
// gamePk batch) for whatever's left. A posted assignment never changes, so an
// already-recorded side is never refetched. The endpoint fills in around game
// time — a game from the trailing window that isn't posted yet just tries
// again next run. MLB only (sportId 1) — verified un-covered for MiLB.
//
// Run by hand:
//   node scripts/gen-jerseys.mjs            # trailing 3 days
//   node scripts/gen-jerseys.mjs --days=200 # season-to-date backfill
import { pathToFileURL } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'

const BASE = 'https://statsapi.mlb.com'
const DEFAULT_DAYS = 3
const BATCH_SIZE = 100 // gamePks per uniforms/game call

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
    if (m) args[m[1]] = m[2] ?? true
  }
  return args
}

const isoDay = (d) => d.toISOString().slice(0, 10)
const args = parseArgs(process.argv.slice(2))
const days = Number(args.days) || DEFAULT_DAYS

// One side's assets, trimmed to the fields a color-lab correlation needs.
function normalizeAssets(side) {
  return (side?.uniformAssets ?? [])
    .map((a) => ({
      text: a.uniformAssetText ?? '',
      piece: a.uniformAssetType?.uniformAssetTypeCode ?? '',
      code: a.uniformAssetCode ?? null,
    }))
    .filter((a) => a.text)
}

async function main() {
  const db = await openDb()
  const existing = new Set(
    db
      .prepare('SELECT game_pk, team_id FROM jerseys')
      .all()
      .map((r) => `${r.game_pk}:${r.team_id}`),
  )
  const upsert = db.prepare(
    `INSERT INTO jerseys (game_pk, team_id, side, date, payload_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_pk, team_id) DO UPDATE SET
       side = excluded.side,
       date = excluded.date,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
  )

  const today = new Date()
  const dates = []
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(isoDay(d))
  }

  // Gather every MLB game in the window whose (gamePk, teamId) pair for
  // EITHER side is still missing, tagged with its date + both team ids.
  const candidates = []
  for (const dateStr of dates) {
    const slate = await getJson(`/api/v1/schedule?sportId=1&date=${dateStr}`)
    for (const g of (slate.dates ?? []).flatMap((d) => d.games ?? [])) {
      const homeId = g.teams?.home?.team?.id
      const awayId = g.teams?.away?.team?.id
      if (!homeId || !awayId) continue
      const done =
        existing.has(`${g.gamePk}:${homeId}`) && existing.has(`${g.gamePk}:${awayId}`)
      if (done) continue
      candidates.push({ gamePk: g.gamePk, date: dateStr })
    }
  }

  console.log(
    `${candidates.length} game(s) to check (${dates[dates.length - 1]}..${dates[0]})`,
  )

  let recorded = 0
  let notPosted = 0
  const now = new Date().toISOString()
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const pks = batch.map((c) => c.gamePk).join(',')
    try {
      const data = await getJson(`/api/v1/uniforms/game?gamePks=${pks}`)
      const byPk = new Map(batch.map((c) => [String(c.gamePk), c.date]))
      for (const game of data.uniforms ?? []) {
        const date = byPk.get(String(game.gamePk))
        if (!date) continue
        if (!game.home || !game.away) {
          notPosted++
          continue
        }
        for (const [side, team] of [
          ['home', game.home],
          ['away', game.away],
        ]) {
          const assets = normalizeAssets(team)
          if (!assets.length) continue
          upsert.run(
            Number(game.gamePk),
            Number(team.id),
            side,
            date,
            JSON.stringify(assets),
            now,
          )
          recorded++
        }
      }
    } catch (err) {
      console.error(`gamePks ${pks}: ${err.message}`)
    }
  }

  const total = db.prepare('SELECT COUNT(*) AS n FROM jerseys').get().n
  if (recorded > 0) {
    await dumpGroup(db, 'jerseys')
    console.log(
      `wrote scripts/data/jerseys.sql (${recorded} side(s) recorded this run, ${notPosted} not posted yet, ${total} total rows)`,
    )
  } else {
    console.log(`no changes (${notPosted} not posted yet, ${total} total rows)`)
  }
  db.close()
}

// Only sweep when run as a script — keeps the pure helper importable for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
