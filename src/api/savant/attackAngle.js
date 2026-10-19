// Contact replay, phase C (#1771, docs/contact-replay.md §3.3): the bat's measured attack angle, from
// Baseball Savant's Statcast CSV, STRIPPED ON PARSE (Gary, 2026-10-18).
//
// The CSV carries the whole game, bat_score and post_bat_score on every row. So the raw text never leaves
// this file: parseAttack keeps ONLY game_pk, at_bat_number, pitch_number, attack_angle and attack_direction
// and drops the rest at once. Nothing else holds, caches or logs the text.
//
// OUTPUT: Map of '{at_bat_number}-{pitch_number}' -> { attackDeg, attackDir }, degrees. at_bat_number is the
// feed's atBatIndex + 1. A pitch with no measured angle (a take) has no entry. Not a Final game, or not MLB
// (sportId !== 1): an empty Map and no fetch. One fetch per gamePk per page load once it has rows, never polled; a CSV that is
// empty (not filled yet) or a failed fetch gives an empty Map that is not kept, so a later open asks again.
//
// SPOILER CLASSIFICATION: reveal-only. The kept fields describe one swing; call it only from the replay,
// inside the half's reveal.

import { csvObjects } from '../../lib/csv/parse.js'

export function statcastUrl(gamePk, date) {
  const params = new URLSearchParams({
    all: 'true',
    type: 'details',
    player_type: 'batter',
    hfGT: 'R|F|D|L|W|',
    game_date_gt: date,
    game_date_lt: date,
    game_pk: gamePk,
  })
  return `https://baseballsavant.mlb.com/statcast_search/csv?${params}`
}

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

// CSV text -> the five kept fields of each row that has a measured attack angle.
export function parseAttack(text) {
  return csvObjects(text)
    .map((r) => ({
      game_pk: num(r.game_pk),
      at_bat_number: num(r.at_bat_number),
      pitch_number: num(r.pitch_number),
      attack_angle: num(r.attack_angle),
      attack_direction: num(r.attack_direction),
    }))
    .filter((r) => r.attack_angle != null && r.at_bat_number != null && r.pitch_number != null)
}

const asked = new Map() // gamePk -> Promise<Map>: the stripped Map only, never the body
export function fetchAttackAngles(gamePk, sportId, state, date) {
  if (sportId !== 1 || state !== 'Final' || !date) return Promise.resolve(new Map())
  if (!asked.has(gamePk)) {
    asked.set(
      gamePk,
      fetch(statcastUrl(gamePk, date))
        .then((res) => (res.ok ? res.text() : ''))
        .then((text) => new Map(parseAttack(text).map((r) => [`${r.at_bat_number}-${r.pitch_number}`, { attackDeg: r.attack_angle, attackDir: r.attack_direction }])))
        .catch(() => new Map()),
    )
  }
  const got = asked.get(gamePk)
  // The fill time is unknown (#2349): an empty or failed answer is not kept, so a LATER open asks again (never a poll).
  got.then((m) => m.size === 0 && asked.get(gamePk) === got && asked.delete(gamePk))
  return got
}
