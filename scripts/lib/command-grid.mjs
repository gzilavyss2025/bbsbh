// THE COMMAND GRID — the storage and counting half of "where he puts it".
//
// Split out of gen-pitch-arsenal.mjs, which sweeps the same feeds for the pitch
// MIX and grew past check-file-size's ceiling when this arrived. The seam is
// real rather than convenient: the mix asks what a pitcher throws, this asks
// where he puts it, and only the fetch is shared.
import { GRID, commandCell, normalizePitch } from '../../src/lib/zone/zoneGeometry.js'
import { FOUL_CODES, WHIFF_CODES } from '../../src/api/playbyplay/pitchInfo.js'

// pitchInfo.js keeps the called-strike and in-play sets module-private; the
// command sweep needs both, and a second copy of MLB's own code table is
// exactly the drift that file's header warns about — so they are named here
// once, beside the two it does export, and pinned by test/command-aggregate.test.js.
const CALLED_STRIKE_COMMAND_CODES = new Set(['C', 'K', 'A', 'AB', 'AC'])
const INPLAY_COMMAND_CODES = new Set(['D', 'X', 'E', 'J', 'Y', 'Z'])

// ---------------------------------------------------------------------------
// COMMAND — where he put it, as opposed to what he threw.
//
// The arsenal card above says WHAT a pitcher throws and HOW HARD. Nothing on
// his page says WHERE HE PUTS IT, which is the same shape of hole a hitter's
// spray map fills: "by handedness" says who he beat, nothing says where the
// ball went.
//
// THIS COSTS NO NEW NETWORK WORK. The sweep already walks every pitch of every
// MLB and AAA feed for the mix; this reads four more fields off the same
// playEvents it is already holding. A season's worth of locations for one
// pitcher is a few hundred integers, because it is BINNED rather than stored
// per pitch — 25 cells x pitch type x batter hand, with the outcomes that make
// a location mean something counted in the same cell.
//
// Pure, like aggregateGamePitchTypes beside it, so a synthetic fixture drives
// the counting rules. Shape: Map personId -> Map `${code}:${stand}` ->
// { cells: Int (25), whiffs: Int (25), calledStrikes: Int (25), homers: Int (25),
//   swings: Int (25), firstPitch: Int (25) }.
//
// WHY THE OUTCOMES RIDE ALONG. A density map alone cannot say whether a
// location worked. Whiffs and called strikes are what a spot EARNED; a home
// run allowed is what it cost, plotted where he threw it rather than where it
// landed. Swings are the denominator whiff rate needs, and first pitches are
// the one command number a scorer feels every at-bat.
export function aggregateGameCommand(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const out = new Map()
  const zeros = () => new Int32Array(GRID * GRID)
  const getBucket = (pitcherId, code, stand) => {
    let byKey = out.get(pitcherId)
    if (!byKey) {
      byKey = new Map()
      out.set(pitcherId, byKey)
    }
    const key = `${code}:${stand}`
    let b = byKey.get(key)
    if (!b) {
      b = { cells: zeros(), whiffs: zeros(), calledStrikes: zeros(), homers: zeros(), swings: zeros(), firstPitch: zeros() }
      byKey.set(key, b)
    }
    return b
  }

  for (const play of plays) {
    const pitcherId = play.matchup?.pitcher?.id ?? null
    if (pitcherId == null) continue
    // The batter's hand decides which half of a pitcher's plan this pitch
    // belongs to, and a switch-hitter's side changes per at-bat — so it is read
    // off the MATCHUP, never off the batter's own listed bats.
    const stand = play.matchup?.batSide?.code
    if (stand !== 'L' && stand !== 'R') continue
    // A home run is charged to the pitch that gave it up, so it is read off the
    // play's result and attached to the LAST pitch of the at-bat.
    const isHomer = play.result?.eventType === 'home_run'
    const pitchEvents = (play.playEvents ?? []).filter((e) => e.isPitch)

    pitchEvents.forEach((e, i) => {
      const code = e.details?.type?.code
      if (!code) return
      const c = e.pitchData?.coordinates
      const cell = commandCell(
        normalizePitch(c?.pX, c?.pZ, e.pitchData?.strikeZoneTop, e.pitchData?.strikeZoneBottom),
      )
      // No tracking, no cell. Below Triple-A there are no coordinates at all,
      // and a pitch with no location is not a pitch down the middle.
      if (!cell) return
      const b = getBucket(pitcherId, code, stand)
      const at = cell.index
      b.cells[at] += 1
      if (i === 0) b.firstPitch[at] += 1

      const callCode = e.details?.call?.code
      if (WHIFF_CODES.has(callCode)) {
        b.whiffs[at] += 1
        b.swings[at] += 1
      } else if (FOUL_CODES.has(callCode) || INPLAY_COMMAND_CODES.has(callCode)) {
        b.swings[at] += 1
      } else if (CALLED_STRIKE_COMMAND_CODES.has(callCode)) {
        b.calledStrikes[at] += 1
      }
      if (isHomer && i === pitchEvents.length - 1) b.homers[at] += 1
    })
  }

  return out
}


// The command grid accumulates by READ-MODIFY-WRITE rather than by SQL
// addition: the counters are 25-value CSVs (see schema.sql), so the arrays are
// summed element-wise in JS and the row written back whole. One prepared pair,
// reused for every (pitcher, type, hand) in a game's transaction.
// The bucket's own field names, paired index-for-index with COLS below. They
// differ deliberately: `calledStrikes` reads as what it is in code, `called` is
// the column. Getting these out of step silently hands Array.from an undefined.
export const CELLS = ['cells', 'whiffs', 'calledStrikes', 'homers', 'swings', 'firstPitch']
export const COLS = ['cells', 'whiffs', 'called', 'homers', 'swings', 'first_pitch']

export function commandStmts(db) {
  const read = db.prepare(
    `SELECT ${COLS.join(', ')} FROM pitch_command_cells
      WHERE person_id = ? AND level = ? AND code = ? AND stand = ?`,
  )
  const write = db.prepare(
    `INSERT INTO pitch_command_cells
       (person_id, level, code, stand, season, ${COLS.join(', ')})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(person_id, level, code, stand) DO UPDATE SET
       season = excluded.season,
       ${COLS.map((c) => `${c} = excluded.${c}`).join(',\n       ')}`,
  )
  return { read, write }
}

export const parseCells = (csv) => (csv ? csv.split(',').map(Number) : new Array(GRID * GRID).fill(0))

export const markCommandIngested = (db) =>
  db.prepare('INSERT OR IGNORE INTO pitch_command_ingested_games (game_pk, level, date) VALUES (?, ?, ?)')

